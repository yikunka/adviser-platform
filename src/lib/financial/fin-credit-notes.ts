import { Prisma } from '@prisma/client'
import type { CreditNoteKind } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'
import { resolveMappedAccountId } from '@/lib/financial/account-mappings'
import { validateAllocations } from '@/lib/financial/allocations'
import { nextDocNo } from '@/lib/financial/doc-numbers'
import { createAndPostEntry, PostingError, reversePostedEntry } from '@/lib/financial/posting-engine'
import { invoiceStatusAfterSettlement } from '@/lib/financial/sales-invoices'
import { billStatusAfterSettlement } from '@/lib/financial/purchase-bills'
import { buildCustomerCreditNotePosting, buildSupplierDebitNotePosting } from '@/lib/financial/subledger-posting'
import { parseYmdDate, roundMoney } from '@/lib/financial/utils'

export const creditNoteInclude = {
  party: { select: { id: true, code: true, name: true } },
  offsetAccount: { select: { id: true, code: true, name: true } },
  journalEntry: { select: { id: true, voucherNo: true } },
  createdBy: { select: { id: true, nameEn: true } },
  allocations: {
    include: {
      salesInvoice: { select: { id: true, invoiceNo: true } },
      purchaseBill: { select: { id: true, billNo: true } },
    },
  },
} satisfies Prisma.FinCreditNoteInclude

export type CreditNoteWithRelations = Prisma.FinCreditNoteGetPayload<{ include: typeof creditNoteInclude }>

export type CreateCreditNoteArgs = {
  companyId: string
  partyId: string
  kind: CreditNoteKind
  issueDate: string // YYYY-MM-DD
  subtotal: number
  taxRate: number
  reason?: string
  offsetAccountId?: string | null
  createdById: string
}

export async function createCreditNote(args: CreateCreditNoteArgs) {
  if (args.subtotal <= 0) throw new PostingError('贷项/借项金额必须大于零。')

  const party = await prisma.party.findUnique({
    where: { id: args.partyId },
    select: { companyId: true, isCustomer: true, isSupplier: true },
  })
  if (!party || party.companyId !== args.companyId) throw new PostingError('往来单位不存在或不属于该公司。')
  if (args.kind === 'CUSTOMER' && !party.isCustomer) throw new PostingError('贷项通知单对象必须是客户。')
  if (args.kind === 'SUPPLIER' && !party.isSupplier) throw new PostingError('借项通知单对象必须是供应商。')

  const issueDate = parseYmdDate(args.issueDate)
  const subtotal = roundMoney(args.subtotal)
  const taxAmount = roundMoney(subtotal * args.taxRate)
  const total = roundMoney(subtotal + taxAmount)

  return prisma.$transaction(async tx => {
    const noteNo = await nextDocNo(tx, {
      companyId: args.companyId,
      docType: args.kind === 'CUSTOMER' ? 'CREDIT_NOTE' : 'DEBIT_NOTE',
      date: issueDate,
    })
    return tx.finCreditNote.create({
      data: {
        companyId: args.companyId,
        partyId: args.partyId,
        kind: args.kind,
        noteNo,
        status: 'DRAFT',
        issueDate,
        subtotal: new Prisma.Decimal(subtotal),
        taxRate: new Prisma.Decimal(args.taxRate),
        taxAmount: new Prisma.Decimal(taxAmount),
        total: new Prisma.Decimal(total),
        reason: args.reason ?? '',
        offsetAccountId: args.offsetAccountId ?? null,
        createdById: args.createdById,
      },
      include: creditNoteInclude,
    })
  })
}

/** 贷项/借项过账：冲减应收或应付。 */
export async function postCreditNote(args: { id: string; companyId: string; userId: string }) {
  return prisma.$transaction(async tx => {
    const note = await tx.finCreditNote.findUnique({
      where: { id: args.id },
      include: { party: true },
    })
    if (!note || note.companyId !== args.companyId) throw new PostingError('贷项/借项通知单不存在。')
    if (note.status !== 'DRAFT') throw new PostingError('只有草稿状态可以过账。')

    const taxAmount = Number(note.taxAmount)
    const isCustomerNote = note.kind === 'CUSTOMER'
    const controlAccountId = isCustomerNote
      ? note.party.arAccountId ?? (await resolveMappedAccountId(tx, args.companyId, 'AR_CONTROL'))
      : note.party.apAccountId ?? (await resolveMappedAccountId(tx, args.companyId, 'AP_CONTROL'))
    const offsetAccountId = note.offsetAccountId
      ?? (await resolveMappedAccountId(tx, args.companyId, isCustomerNote ? 'SALES_REVENUE' : 'PURCHASE_EXPENSE_DEFAULT'))
    const taxAccountId = taxAmount > 0
      ? await resolveMappedAccountId(tx, args.companyId, isCustomerNote ? 'OUTPUT_TAX' : 'INPUT_TAX')
      : null

    const description = isCustomerNote
      ? `贷项通知单 ${note.noteNo} - ${note.party.name}`
      : `借项通知单 ${note.noteNo} - ${note.party.name}`

    const postingLines = isCustomerNote
      ? buildCustomerCreditNotePosting({
          arAccountId: controlAccountId,
          offsetAccountId,
          partyId: note.partyId,
          description,
          subtotal: Number(note.subtotal),
          taxAccountId,
          taxAmount,
          total: Number(note.total),
        })
      : buildSupplierDebitNotePosting({
          apAccountId: controlAccountId,
          offsetAccountId,
          partyId: note.partyId,
          description,
          subtotal: Number(note.subtotal),
          taxAccountId,
          taxAmount,
          total: Number(note.total),
        })

    const entry = await createAndPostEntry(tx, {
      companyId: args.companyId,
      entryDate: note.issueDate,
      description,
      sourceType: 'CREDIT_NOTE',
      sourceId: note.id,
      createdById: args.userId,
      lines: postingLines,
    })

    return tx.finCreditNote.update({
      where: { id: note.id },
      data: { status: 'POSTED', journalEntryId: entry.id, postedAt: new Date() },
      include: creditNoteInclude,
    })
  })
}

export type ApplyCreditNoteArgs = {
  id: string
  companyId: string
  allocations: Array<{ targetId: string; amount: number }>
}

/** 贷项/借项核销到发票/账单：只动子分类账结算状态，不再产生总账凭证。 */
export async function applyCreditNote(args: ApplyCreditNoteArgs) {
  if (args.allocations.length === 0) throw new PostingError('请至少选择一张要核销的单据。')

  return prisma.$transaction(async tx => {
    const note = await tx.finCreditNote.findUnique({
      where: { id: args.id },
      select: { id: true, companyId: true, partyId: true, kind: true, status: true, noteNo: true, total: true, amountApplied: true },
    })
    if (!note || note.companyId !== args.companyId) throw new PostingError('贷项/借项通知单不存在。')
    if (note.status !== 'POSTED') throw new PostingError('只有已过账的通知单可以核销。')

    const targetIds = args.allocations.map(allocation => allocation.targetId)
    if (new Set(targetIds).size !== targetIds.length) throw new PostingError('核销目标重复。')

    let targets: Array<{ id: string; docNo: string; total: number; amountPaid: number }>
    if (note.kind === 'CUSTOMER') {
      const invoices = await tx.salesInvoice.findMany({
        where: { id: { in: targetIds } },
        select: { id: true, companyId: true, partyId: true, status: true, invoiceNo: true, total: true, amountPaid: true },
      })
      if (invoices.length !== targetIds.length) throw new PostingError('部分发票不存在。')
      for (const invoice of invoices) {
        if (invoice.companyId !== args.companyId || invoice.partyId !== note.partyId) {
          throw new PostingError(`发票 ${invoice.invoiceNo} 不属于该客户。`)
        }
        if (invoice.status !== 'ISSUED' && invoice.status !== 'PARTIALLY_PAID') {
          throw new PostingError(`发票 ${invoice.invoiceNo} 当前状态不可核销。`)
        }
      }
      targets = invoices.map(invoice => ({
        id: invoice.id,
        docNo: invoice.invoiceNo,
        total: Number(invoice.total),
        amountPaid: Number(invoice.amountPaid),
      }))
    } else {
      const bills = await tx.purchaseBill.findMany({
        where: { id: { in: targetIds } },
        select: { id: true, companyId: true, partyId: true, status: true, billNo: true, total: true, amountPaid: true },
      })
      if (bills.length !== targetIds.length) throw new PostingError('部分账单不存在。')
      for (const bill of bills) {
        if (bill.companyId !== args.companyId || bill.partyId !== note.partyId) {
          throw new PostingError(`账单 ${bill.billNo} 不属于该供应商。`)
        }
        if (bill.status !== 'POSTED' && bill.status !== 'PARTIALLY_PAID') {
          throw new PostingError(`账单 ${bill.billNo} 当前状态不可核销。`)
        }
      }
      targets = bills.map(bill => ({
        id: bill.id,
        docNo: bill.billNo,
        total: Number(bill.total),
        amountPaid: Number(bill.amountPaid),
      }))
    }

    const targetById = new Map(targets.map(target => [target.id, target]))
    const allocationError = validateAllocations({
      sourceAmount: Number(note.total),
      alreadyAllocated: Number(note.amountApplied),
      allocations: args.allocations.map(allocation => {
        const target = targetById.get(allocation.targetId)!
        return {
          label: target.docNo,
          outstanding: roundMoney(target.total - target.amountPaid),
          amount: allocation.amount,
        }
      }),
    })
    if (allocationError) throw new PostingError(allocationError)

    for (const allocation of args.allocations) {
      const target = targetById.get(allocation.targetId)!
      await tx.paymentAllocation.create({
        data: {
          creditNoteId: note.id,
          salesInvoiceId: note.kind === 'CUSTOMER' ? allocation.targetId : null,
          purchaseBillId: note.kind === 'SUPPLIER' ? allocation.targetId : null,
          amount: new Prisma.Decimal(roundMoney(allocation.amount)),
        },
      })
      const newPaid = roundMoney(target.amountPaid + allocation.amount)
      if (note.kind === 'CUSTOMER') {
        await tx.salesInvoice.update({
          where: { id: allocation.targetId },
          data: {
            amountPaid: new Prisma.Decimal(newPaid),
            status: invoiceStatusAfterSettlement(target.total, newPaid),
          },
        })
      } else {
        await tx.purchaseBill.update({
          where: { id: allocation.targetId },
          data: {
            amountPaid: new Prisma.Decimal(newPaid),
            status: billStatusAfterSettlement(target.total, newPaid),
          },
        })
      }
    }

    const applied = roundMoney(
      Number(note.amountApplied) + args.allocations.reduce((sum, allocation) => sum + allocation.amount, 0),
    )
    return tx.finCreditNote.update({
      where: { id: note.id },
      data: { amountApplied: new Prisma.Decimal(applied) },
      include: creditNoteInclude,
    })
  })
}

/** 作废贷项/借项：未核销时红冲。 */
export async function voidCreditNote(args: { id: string; companyId: string; userId: string; reason?: string }) {
  return prisma.$transaction(async tx => {
    const note = await tx.finCreditNote.findUnique({
      where: { id: args.id },
      select: { id: true, companyId: true, status: true, noteNo: true, amountApplied: true, journalEntryId: true },
    })
    if (!note || note.companyId !== args.companyId) throw new PostingError('贷项/借项通知单不存在。')
    if (note.status === 'DRAFT') {
      await tx.finCreditNote.delete({ where: { id: note.id } })
      return null
    }
    if (note.status === 'VOIDED') throw new PostingError('通知单已作废。')
    if (Number(note.amountApplied) > 0.005) throw new PostingError('通知单已核销到单据，不能作废。')
    if (!note.journalEntryId) throw new PostingError('通知单缺少过账凭证。')

    await reversePostedEntry(tx, {
      entryId: note.journalEntryId,
      createdById: args.userId,
      reason: args.reason || `作废通知单 ${note.noteNo}`,
    })

    return tx.finCreditNote.update({
      where: { id: note.id },
      data: { status: 'VOIDED', voidedAt: new Date() },
      include: creditNoteInclude,
    })
  })
}
