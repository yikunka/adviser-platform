import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'
import { resolveMappedAccountId } from '@/lib/financial/account-mappings'
import { settlementProgress } from '@/lib/financial/allocations'
import { nextDocNo } from '@/lib/financial/doc-numbers'
import { createAndPostEntry, PostingError, reversePostedEntry } from '@/lib/financial/posting-engine'
import { buildSalesInvoicePosting } from '@/lib/financial/subledger-posting'
import { parseYmdDate, roundMoney } from '@/lib/financial/utils'

export const salesInvoiceInclude = {
  party: { select: { id: true, code: true, name: true, email: true, arAccountId: true, paymentTermsDays: true } },
  lines: { orderBy: { sortOrder: 'asc' as const } },
  journalEntry: { select: { id: true, voucherNo: true } },
  createdBy: { select: { id: true, nameEn: true } },
} satisfies Prisma.SalesInvoiceInclude

export type SalesInvoiceWithRelations = Prisma.SalesInvoiceGetPayload<{ include: typeof salesInvoiceInclude }>

export type SalesInvoiceLineInput = {
  description: string
  quantity: number
  unitPrice: number
  revenueAccountId?: string | null
}

/** 行金额 = 数量 × 单价（逐行四舍五入）；税额 = 小计 × 税率。 */
export function computeDocTotals(lines: Array<{ quantity: number; unitPrice: number }>, taxRate: number) {
  const lineAmounts = lines.map(line => roundMoney(line.quantity * line.unitPrice))
  const subtotal = roundMoney(lineAmounts.reduce((sum, amount) => sum + amount, 0))
  const taxAmount = roundMoney(subtotal * taxRate)
  return { lineAmounts, subtotal, taxAmount, total: roundMoney(subtotal + taxAmount) }
}

export type CreateSalesInvoiceArgs = {
  companyId: string
  partyId: string
  issueDate: string // YYYY-MM-DD
  dueDate?: string | null
  taxRate: number
  notes?: string
  createdById: string
  lines: SalesInvoiceLineInput[]
}

export async function createSalesInvoice(args: CreateSalesInvoiceArgs) {
  const party = await prisma.party.findUnique({
    where: { id: args.partyId },
    select: { id: true, companyId: true, isCustomer: true, paymentTermsDays: true },
  })
  if (!party || party.companyId !== args.companyId) throw new PostingError('客户不存在或不属于该公司。')
  if (!party.isCustomer) throw new PostingError('所选往来单位不是客户。')

  const issueDate = parseYmdDate(args.issueDate)
  const dueDate = args.dueDate
    ? parseYmdDate(args.dueDate)
    : new Date(issueDate.getTime() + party.paymentTermsDays * 24 * 60 * 60 * 1000)
  const totals = computeDocTotals(args.lines, args.taxRate)

  return prisma.$transaction(async tx => {
    const invoiceNo = await nextDocNo(tx, { companyId: args.companyId, docType: 'SALES_INVOICE', date: issueDate })
    return tx.salesInvoice.create({
      data: {
        companyId: args.companyId,
        partyId: args.partyId,
        invoiceNo,
        status: 'DRAFT',
        issueDate,
        dueDate,
        subtotal: new Prisma.Decimal(totals.subtotal),
        taxRate: new Prisma.Decimal(args.taxRate),
        taxAmount: new Prisma.Decimal(totals.taxAmount),
        total: new Prisma.Decimal(totals.total),
        notes: args.notes ?? '',
        createdById: args.createdById,
        lines: {
          create: args.lines.map((line, index) => ({
            sortOrder: index,
            description: line.description,
            quantity: new Prisma.Decimal(line.quantity),
            unitPrice: new Prisma.Decimal(line.unitPrice),
            amount: new Prisma.Decimal(totals.lineAmounts[index]!),
            revenueAccountId: line.revenueAccountId ?? null,
          })),
        },
      },
      include: salesInvoiceInclude,
    })
  })
}

export type UpdateSalesInvoiceArgs = Omit<CreateSalesInvoiceArgs, 'createdById' | 'companyId'> & {
  id: string
  companyId: string
}

export async function updateDraftSalesInvoice(args: UpdateSalesInvoiceArgs) {
  const existing = await prisma.salesInvoice.findUnique({ where: { id: args.id }, select: { companyId: true, status: true } })
  if (!existing || existing.companyId !== args.companyId) throw new PostingError('发票不存在。')
  if (existing.status !== 'DRAFT') throw new PostingError('只有草稿发票可以编辑。')

  const party = await prisma.party.findUnique({
    where: { id: args.partyId },
    select: { companyId: true, isCustomer: true },
  })
  if (!party || party.companyId !== args.companyId || !party.isCustomer) throw new PostingError('客户不存在或不属于该公司。')

  const issueDate = parseYmdDate(args.issueDate)
  const totals = computeDocTotals(args.lines, args.taxRate)

  return prisma.$transaction(async tx => {
    await tx.salesInvoiceLine.deleteMany({ where: { invoiceId: args.id } })
    return tx.salesInvoice.update({
      where: { id: args.id },
      data: {
        partyId: args.partyId,
        issueDate,
        dueDate: args.dueDate ? parseYmdDate(args.dueDate) : null,
        subtotal: new Prisma.Decimal(totals.subtotal),
        taxRate: new Prisma.Decimal(args.taxRate),
        taxAmount: new Prisma.Decimal(totals.taxAmount),
        total: new Prisma.Decimal(totals.total),
        notes: args.notes ?? '',
        lines: {
          create: args.lines.map((line, index) => ({
            sortOrder: index,
            description: line.description,
            quantity: new Prisma.Decimal(line.quantity),
            unitPrice: new Prisma.Decimal(line.unitPrice),
            amount: new Prisma.Decimal(totals.lineAmounts[index]!),
            revenueAccountId: line.revenueAccountId ?? null,
          })),
        },
      },
      include: salesInvoiceInclude,
    })
  })
}

export async function deleteDraftSalesInvoice(id: string, companyId: string) {
  const existing = await prisma.salesInvoice.findUnique({ where: { id }, select: { companyId: true, status: true } })
  if (!existing || existing.companyId !== companyId) throw new PostingError('发票不存在。')
  if (existing.status !== 'DRAFT') throw new PostingError('只有草稿发票可以删除。已开票请用作废（红冲）。')
  await prisma.salesInvoice.delete({ where: { id } })
}

/** 开票过账：借应收（挂客户）/ 贷收入 + 销项税，自动生成已过账凭证。 */
export async function postSalesInvoice(args: { id: string; companyId: string; userId: string }) {
  return prisma.$transaction(async tx => {
    const invoice = await tx.salesInvoice.findUnique({
      where: { id: args.id },
      include: { party: true, lines: { orderBy: { sortOrder: 'asc' } } },
    })
    if (!invoice || invoice.companyId !== args.companyId) throw new PostingError('发票不存在。')
    if (invoice.status !== 'DRAFT') throw new PostingError('只有草稿发票可以开票过账。')
    if (invoice.lines.length === 0) throw new PostingError('发票至少需要一行明细。')

    const arAccountId = invoice.party.arAccountId
      ?? (await resolveMappedAccountId(tx, args.companyId, 'AR_CONTROL'))
    const needsDefaultRevenue = invoice.lines.some(line => !line.revenueAccountId)
    const defaultRevenueId = needsDefaultRevenue
      ? await resolveMappedAccountId(tx, args.companyId, 'SALES_REVENUE')
      : null
    const taxAmount = Number(invoice.taxAmount)
    const taxAccountId = taxAmount > 0 ? await resolveMappedAccountId(tx, args.companyId, 'OUTPUT_TAX') : null

    const description = `销售发票 ${invoice.invoiceNo} - ${invoice.party.name}`
    const postingLines = buildSalesInvoicePosting({
      arAccountId,
      partyId: invoice.partyId,
      description,
      revenueLines: invoice.lines.map(line => ({
        accountId: line.revenueAccountId ?? defaultRevenueId!,
        amount: Number(line.amount),
        description: line.description,
      })),
      taxAccountId,
      taxAmount,
      total: Number(invoice.total),
    })

    const entry = await createAndPostEntry(tx, {
      companyId: args.companyId,
      entryDate: invoice.issueDate,
      description,
      sourceType: 'SALES_INVOICE',
      sourceId: invoice.id,
      createdById: args.userId,
      lines: postingLines,
    })

    return tx.salesInvoice.update({
      where: { id: invoice.id },
      data: { status: 'ISSUED', journalEntryId: entry.id, postedAt: new Date() },
      include: salesInvoiceInclude,
    })
  })
}

/** 作废发票：未收款时红冲原凭证。 */
export async function voidSalesInvoice(args: { id: string; companyId: string; userId: string; reason?: string }) {
  return prisma.$transaction(async tx => {
    const invoice = await tx.salesInvoice.findUnique({
      where: { id: args.id },
      select: { id: true, companyId: true, status: true, invoiceNo: true, amountPaid: true, journalEntryId: true },
    })
    if (!invoice || invoice.companyId !== args.companyId) throw new PostingError('发票不存在。')
    if (invoice.status === 'DRAFT') throw new PostingError('草稿发票请直接删除。')
    if (invoice.status === 'VOIDED') throw new PostingError('发票已作废。')
    if (Number(invoice.amountPaid) > 0.005) {
      throw new PostingError('发票已有收款/贷项核销，请先作废相关收款或贷项。')
    }
    if (!invoice.journalEntryId) throw new PostingError('发票缺少过账凭证。')

    await reversePostedEntry(tx, {
      entryId: invoice.journalEntryId,
      createdById: args.userId,
      reason: args.reason || `作废发票 ${invoice.invoiceNo}`,
    })

    return tx.salesInvoice.update({
      where: { id: invoice.id },
      data: { status: 'VOIDED', voidedAt: new Date() },
      include: salesInvoiceInclude,
    })
  })
}

/** 收款/贷项核销后重算发票结算状态。 */
export function invoiceStatusAfterSettlement(total: number, amountPaid: number) {
  const progress = settlementProgress(total, amountPaid)
  if (progress.settled === 'FULL') return 'PAID' as const
  if (progress.settled === 'PARTIAL') return 'PARTIALLY_PAID' as const
  return 'ISSUED' as const
}
