import { Prisma } from '@prisma/client'
import type { FinPaymentDirection, FinPaymentMethod } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'
import { resolveMappedAccountId } from '@/lib/financial/account-mappings'
import { validateAllocations } from '@/lib/financial/allocations'
import { nextDocNo } from '@/lib/financial/doc-numbers'
import { createAndPostEntry, PostingError, reversePostedEntry } from '@/lib/financial/posting-engine'
import { invoiceStatusAfterSettlement } from '@/lib/financial/sales-invoices'
import { billStatusAfterSettlement } from '@/lib/financial/purchase-bills'
import { buildBillPaymentPosting, buildReceiptPosting } from '@/lib/financial/subledger-posting'
import { parseYmdDate, roundMoney } from '@/lib/financial/utils'

export const finPaymentInclude = {
  party: { select: { id: true, code: true, name: true } },
  bankAccount: { select: { id: true, name: true, bankName: true } },
  journalEntry: { select: { id: true, voucherNo: true } },
  createdBy: { select: { id: true, nameEn: true } },
  allocations: {
    include: {
      salesInvoice: { select: { id: true, invoiceNo: true, total: true } },
      purchaseBill: { select: { id: true, billNo: true, total: true } },
    },
  },
} satisfies Prisma.FinPaymentInclude

export type FinPaymentWithRelations = Prisma.FinPaymentGetPayload<{ include: typeof finPaymentInclude }>

export type PaymentAllocationInput = {
  /** RECEIPT 核销销售发票，PAYMENT 核销采购账单 */
  targetId: string
  amount: number
}

export type CreatePaymentArgs = {
  companyId: string
  partyId: string
  direction: FinPaymentDirection
  paymentDate: string // YYYY-MM-DD
  method: FinPaymentMethod
  bankAccountId?: string | null
  amount: number
  reference?: string
  notes?: string
  createdById: string
  allocations: PaymentAllocationInput[]
}

/**
 * 创建收/付款（创建即过账）：
 * RECEIPT：借 银行/现金 / 贷 应收（挂客户），核销销售发票；
 * PAYMENT：借 应付（挂供应商）/ 贷 银行/现金，核销采购账单。
 */
export async function createPaymentWithAllocations(args: CreatePaymentArgs) {
  if (args.amount <= 0) throw new PostingError('收付款金额必须大于零。')
  const paymentDate = parseYmdDate(args.paymentDate)

  return prisma.$transaction(async tx => {
    const party = await tx.party.findUnique({
      where: { id: args.partyId },
      select: { id: true, companyId: true, name: true, isCustomer: true, isSupplier: true, arAccountId: true, apAccountId: true },
    })
    if (!party || party.companyId !== args.companyId) throw new PostingError('往来单位不存在或不属于该公司。')
    if (args.direction === 'RECEIPT' && !party.isCustomer) throw new PostingError('收款对象必须是客户。')
    if (args.direction === 'PAYMENT' && !party.isSupplier) throw new PostingError('付款对象必须是供应商。')

    // ── 载入并校验核销目标 ──
    const targetIds = args.allocations.map(allocation => allocation.targetId)
    if (new Set(targetIds).size !== targetIds.length) throw new PostingError('核销目标重复。')

    let targets: Array<{ id: string; docNo: string; total: number; amountPaid: number }> = []
    if (targetIds.length > 0) {
      if (args.direction === 'RECEIPT') {
        const invoices = await tx.salesInvoice.findMany({
          where: { id: { in: targetIds } },
          select: { id: true, companyId: true, partyId: true, status: true, invoiceNo: true, total: true, amountPaid: true },
        })
        if (invoices.length !== targetIds.length) throw new PostingError('部分发票不存在。')
        for (const invoice of invoices) {
          if (invoice.companyId !== args.companyId || invoice.partyId !== args.partyId) {
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
          if (bill.companyId !== args.companyId || bill.partyId !== args.partyId) {
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
        sourceAmount: args.amount,
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
    }

    // ── 解析过账科目 ──
    let depositAccountId: string
    if (args.bankAccountId) {
      const bankAccount = await tx.bankAccount.findUnique({
        where: { id: args.bankAccountId },
        select: { companyId: true, glAccountId: true, isActive: true },
      })
      if (!bankAccount || bankAccount.companyId !== args.companyId) throw new PostingError('银行账户不存在。')
      if (!bankAccount.isActive) throw new PostingError('银行账户已停用。')
      depositAccountId = bankAccount.glAccountId
    } else {
      depositAccountId = await resolveMappedAccountId(
        tx,
        args.companyId,
        args.method === 'CASH' ? 'CASH_DEFAULT' : 'BANK_DEFAULT',
      )
    }

    const controlAccountId = args.direction === 'RECEIPT'
      ? party.arAccountId ?? (await resolveMappedAccountId(tx, args.companyId, 'AR_CONTROL'))
      : party.apAccountId ?? (await resolveMappedAccountId(tx, args.companyId, 'AP_CONTROL'))

    // ── 创建单据 + 过账 ──
    const paymentNo = await nextDocNo(tx, {
      companyId: args.companyId,
      docType: args.direction === 'RECEIPT' ? 'RECEIPT' : 'BILL_PAYMENT',
      date: paymentDate,
    })
    const description = args.direction === 'RECEIPT'
      ? `收款 ${paymentNo} - ${party.name}`
      : `付款 ${paymentNo} - ${party.name}`

    const payment = await tx.finPayment.create({
      data: {
        companyId: args.companyId,
        partyId: args.partyId,
        direction: args.direction,
        paymentNo,
        paymentDate,
        method: args.method,
        bankAccountId: args.bankAccountId ?? null,
        amount: new Prisma.Decimal(roundMoney(args.amount)),
        amountAllocated: new Prisma.Decimal(
          roundMoney(args.allocations.reduce((sum, allocation) => sum + allocation.amount, 0)),
        ),
        reference: args.reference ?? '',
        notes: args.notes ?? '',
        createdById: args.createdById,
      },
    })

    const postingLines = args.direction === 'RECEIPT'
      ? buildReceiptPosting({
          depositAccountId,
          arAccountId: controlAccountId,
          partyId: args.partyId,
          amount: args.amount,
          description,
        })
      : buildBillPaymentPosting({
          depositAccountId,
          apAccountId: controlAccountId,
          partyId: args.partyId,
          amount: args.amount,
          description,
        })

    const entry = await createAndPostEntry(tx, {
      companyId: args.companyId,
      entryDate: paymentDate,
      description,
      sourceType: args.direction === 'RECEIPT' ? 'RECEIPT' : 'BILL_PAYMENT',
      sourceId: payment.id,
      createdById: args.createdById,
      lines: postingLines,
    })

    // ── 写核销并更新目标单据结算状态 ──
    for (const allocation of args.allocations) {
      const target = targets.find(row => row.id === allocation.targetId)!
      await tx.paymentAllocation.create({
        data: {
          paymentId: payment.id,
          salesInvoiceId: args.direction === 'RECEIPT' ? allocation.targetId : null,
          purchaseBillId: args.direction === 'PAYMENT' ? allocation.targetId : null,
          amount: new Prisma.Decimal(roundMoney(allocation.amount)),
        },
      })
      const newPaid = roundMoney(target.amountPaid + allocation.amount)
      if (args.direction === 'RECEIPT') {
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

    return tx.finPayment.update({
      where: { id: payment.id },
      data: { journalEntryId: entry.id },
      include: finPaymentInclude,
    })
  })
}

/** 作废收/付款：红冲凭证并回滚所有核销。 */
export async function voidPayment(args: { id: string; companyId: string; userId: string; reason?: string }) {
  return prisma.$transaction(async tx => {
    const payment = await tx.finPayment.findUnique({
      where: { id: args.id },
      include: {
        allocations: {
          include: {
            salesInvoice: { select: { id: true, total: true, amountPaid: true } },
            purchaseBill: { select: { id: true, total: true, amountPaid: true } },
          },
        },
      },
    })
    if (!payment || payment.companyId !== args.companyId) throw new PostingError('收付款单不存在。')
    if (payment.status === 'VOIDED') throw new PostingError('收付款单已作废。')
    if (!payment.journalEntryId) throw new PostingError('收付款单缺少过账凭证。')

    await reversePostedEntry(tx, {
      entryId: payment.journalEntryId,
      createdById: args.userId,
      reason: args.reason || `作废${payment.direction === 'RECEIPT' ? '收款' : '付款'} ${payment.paymentNo}`,
    })

    for (const allocation of payment.allocations) {
      const allocated = Number(allocation.amount)
      if (allocation.salesInvoice) {
        const newPaid = roundMoney(Number(allocation.salesInvoice.amountPaid) - allocated)
        await tx.salesInvoice.update({
          where: { id: allocation.salesInvoice.id },
          data: {
            amountPaid: new Prisma.Decimal(Math.max(0, newPaid)),
            status: invoiceStatusAfterSettlement(Number(allocation.salesInvoice.total), Math.max(0, newPaid)),
          },
        })
      }
      if (allocation.purchaseBill) {
        const newPaid = roundMoney(Number(allocation.purchaseBill.amountPaid) - allocated)
        await tx.purchaseBill.update({
          where: { id: allocation.purchaseBill.id },
          data: {
            amountPaid: new Prisma.Decimal(Math.max(0, newPaid)),
            status: billStatusAfterSettlement(Number(allocation.purchaseBill.total), Math.max(0, newPaid)),
          },
        })
      }
    }

    // 保留核销行作历史，单据状态标记作废
    return tx.finPayment.update({
      where: { id: payment.id },
      data: { status: 'VOIDED', voidedAt: new Date(), amountAllocated: new Prisma.Decimal(0) },
      include: finPaymentInclude,
    })
  })
}
