import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'
import { resolveMappedAccountId } from '@/lib/financial/account-mappings'
import { settlementProgress } from '@/lib/financial/allocations'
import { nextDocNo } from '@/lib/financial/doc-numbers'
import { createAndPostEntry, PostingError, reversePostedEntry } from '@/lib/financial/posting-engine'
import { buildPurchaseBillPosting } from '@/lib/financial/subledger-posting'
import { computeDocTotals } from '@/lib/financial/sales-invoices'
import { parseYmdDate } from '@/lib/financial/utils'

export const purchaseBillInclude = {
  party: { select: { id: true, code: true, name: true, email: true, apAccountId: true, paymentTermsDays: true } },
  lines: { orderBy: { sortOrder: 'asc' as const } },
  journalEntry: { select: { id: true, voucherNo: true } },
  createdBy: { select: { id: true, nameEn: true } },
} satisfies Prisma.PurchaseBillInclude

export type PurchaseBillWithRelations = Prisma.PurchaseBillGetPayload<{ include: typeof purchaseBillInclude }>

export type PurchaseBillLineInput = {
  description: string
  quantity: number
  unitPrice: number
  expenseAccountId?: string | null
}

export type CreatePurchaseBillArgs = {
  companyId: string
  partyId: string
  billDate: string // YYYY-MM-DD
  dueDate?: string | null
  supplierRef?: string
  taxRate: number
  notes?: string
  createdById: string
  lines: PurchaseBillLineInput[]
}

export async function createPurchaseBill(args: CreatePurchaseBillArgs) {
  const party = await prisma.party.findUnique({
    where: { id: args.partyId },
    select: { id: true, companyId: true, isSupplier: true, paymentTermsDays: true },
  })
  if (!party || party.companyId !== args.companyId) throw new PostingError('供应商不存在或不属于该公司。')
  if (!party.isSupplier) throw new PostingError('所选往来单位不是供应商。')

  const billDate = parseYmdDate(args.billDate)
  const dueDate = args.dueDate
    ? parseYmdDate(args.dueDate)
    : new Date(billDate.getTime() + party.paymentTermsDays * 24 * 60 * 60 * 1000)
  const totals = computeDocTotals(args.lines, args.taxRate)

  return prisma.$transaction(async tx => {
    const billNo = await nextDocNo(tx, { companyId: args.companyId, docType: 'PURCHASE_BILL', date: billDate })
    return tx.purchaseBill.create({
      data: {
        companyId: args.companyId,
        partyId: args.partyId,
        billNo,
        supplierRef: args.supplierRef ?? '',
        status: 'DRAFT',
        billDate,
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
            expenseAccountId: line.expenseAccountId ?? null,
          })),
        },
      },
      include: purchaseBillInclude,
    })
  })
}

export type UpdatePurchaseBillArgs = Omit<CreatePurchaseBillArgs, 'createdById'> & { id: string }

export async function updateDraftPurchaseBill(args: UpdatePurchaseBillArgs) {
  const existing = await prisma.purchaseBill.findUnique({ where: { id: args.id }, select: { companyId: true, status: true } })
  if (!existing || existing.companyId !== args.companyId) throw new PostingError('账单不存在。')
  if (existing.status !== 'DRAFT') throw new PostingError('只有草稿账单可以编辑。')

  const party = await prisma.party.findUnique({
    where: { id: args.partyId },
    select: { companyId: true, isSupplier: true },
  })
  if (!party || party.companyId !== args.companyId || !party.isSupplier) throw new PostingError('供应商不存在或不属于该公司。')

  const billDate = parseYmdDate(args.billDate)
  const totals = computeDocTotals(args.lines, args.taxRate)

  return prisma.$transaction(async tx => {
    await tx.purchaseBillLine.deleteMany({ where: { billId: args.id } })
    return tx.purchaseBill.update({
      where: { id: args.id },
      data: {
        partyId: args.partyId,
        billDate,
        dueDate: args.dueDate ? parseYmdDate(args.dueDate) : null,
        supplierRef: args.supplierRef ?? '',
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
            expenseAccountId: line.expenseAccountId ?? null,
          })),
        },
      },
      include: purchaseBillInclude,
    })
  })
}

export async function deleteDraftPurchaseBill(id: string, companyId: string) {
  const existing = await prisma.purchaseBill.findUnique({ where: { id }, select: { companyId: true, status: true } })
  if (!existing || existing.companyId !== companyId) throw new PostingError('账单不存在。')
  if (existing.status !== 'DRAFT') throw new PostingError('只有草稿账单可以删除。已入账请用作废（红冲）。')
  await prisma.purchaseBill.delete({ where: { id } })
}

/** 账单入账：借费用/资产 + 进项税 / 贷应付（挂供应商）。 */
export async function postPurchaseBill(args: { id: string; companyId: string; userId: string }) {
  return prisma.$transaction(async tx => {
    const bill = await tx.purchaseBill.findUnique({
      where: { id: args.id },
      include: { party: true, lines: { orderBy: { sortOrder: 'asc' } } },
    })
    if (!bill || bill.companyId !== args.companyId) throw new PostingError('账单不存在。')
    if (bill.status !== 'DRAFT') throw new PostingError('只有草稿账单可以入账。')
    if (bill.lines.length === 0) throw new PostingError('账单至少需要一行明细。')

    const apAccountId = bill.party.apAccountId
      ?? (await resolveMappedAccountId(tx, args.companyId, 'AP_CONTROL'))
    const needsDefaultExpense = bill.lines.some(line => !line.expenseAccountId)
    const defaultExpenseId = needsDefaultExpense
      ? await resolveMappedAccountId(tx, args.companyId, 'PURCHASE_EXPENSE_DEFAULT')
      : null
    const taxAmount = Number(bill.taxAmount)
    const taxAccountId = taxAmount > 0 ? await resolveMappedAccountId(tx, args.companyId, 'INPUT_TAX') : null

    const description = `采购账单 ${bill.billNo} - ${bill.party.name}${bill.supplierRef ? `（${bill.supplierRef}）` : ''}`
    const postingLines = buildPurchaseBillPosting({
      apAccountId,
      partyId: bill.partyId,
      description,
      expenseLines: bill.lines.map(line => ({
        accountId: line.expenseAccountId ?? defaultExpenseId!,
        amount: Number(line.amount),
        description: line.description,
      })),
      taxAccountId,
      taxAmount,
      total: Number(bill.total),
    })

    const entry = await createAndPostEntry(tx, {
      companyId: args.companyId,
      entryDate: bill.billDate,
      description,
      sourceType: 'PURCHASE_BILL',
      sourceId: bill.id,
      createdById: args.userId,
      lines: postingLines,
    })

    return tx.purchaseBill.update({
      where: { id: bill.id },
      data: { status: 'POSTED', journalEntryId: entry.id, postedAt: new Date() },
      include: purchaseBillInclude,
    })
  })
}

/** 作废账单：未付款时红冲原凭证。 */
export async function voidPurchaseBill(args: { id: string; companyId: string; userId: string; reason?: string }) {
  return prisma.$transaction(async tx => {
    const bill = await tx.purchaseBill.findUnique({
      where: { id: args.id },
      select: { id: true, companyId: true, status: true, billNo: true, amountPaid: true, journalEntryId: true },
    })
    if (!bill || bill.companyId !== args.companyId) throw new PostingError('账单不存在。')
    if (bill.status === 'DRAFT') throw new PostingError('草稿账单请直接删除。')
    if (bill.status === 'VOIDED') throw new PostingError('账单已作废。')
    if (Number(bill.amountPaid) > 0.005) {
      throw new PostingError('账单已有付款/借项核销，请先作废相关付款或借项。')
    }
    if (!bill.journalEntryId) throw new PostingError('账单缺少过账凭证。')

    await reversePostedEntry(tx, {
      entryId: bill.journalEntryId,
      createdById: args.userId,
      reason: args.reason || `作废账单 ${bill.billNo}`,
    })

    return tx.purchaseBill.update({
      where: { id: bill.id },
      data: { status: 'VOIDED', voidedAt: new Date() },
      include: purchaseBillInclude,
    })
  })
}

/** 付款/借项核销后重算账单结算状态。 */
export function billStatusAfterSettlement(total: number, amountPaid: number) {
  const progress = settlementProgress(total, amountPaid)
  if (progress.settled === 'FULL') return 'PAID' as const
  if (progress.settled === 'PARTIAL') return 'PARTIALLY_PAID' as const
  return 'POSTED' as const
}
