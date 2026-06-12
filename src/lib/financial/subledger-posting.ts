import { roundMoney } from '@/lib/financial/utils'
import type { PostingLineInput } from '@/lib/financial/posting-engine'

export type DocPostingLine = {
  accountId: string
  amount: number
  description?: string
}

/**
 * 销售发票过账分录：
 *   借 应收账款（total，挂客户）
 *   贷 收入行（各行金额）
 *   贷 销项税（taxAmount > 0 时）
 */
export function buildSalesInvoicePosting(args: {
  arAccountId: string
  partyId: string
  description: string
  revenueLines: DocPostingLine[]
  taxAccountId?: string | null
  taxAmount?: number
  total: number
}): PostingLineInput[] {
  const taxAmount = roundMoney(args.taxAmount ?? 0)
  const lines: PostingLineInput[] = [
    {
      accountId: args.arAccountId,
      debit: roundMoney(args.total),
      credit: 0,
      partyId: args.partyId,
      description: args.description,
    },
    ...args.revenueLines.map(line => ({
      accountId: line.accountId,
      debit: 0,
      credit: roundMoney(line.amount),
      description: line.description || args.description,
    })),
  ]
  if (taxAmount > 0 && args.taxAccountId) {
    lines.push({
      accountId: args.taxAccountId,
      debit: 0,
      credit: taxAmount,
      description: `销项税 ${args.description}`,
    })
  }
  return lines
}

/**
 * 客户收款分录：
 *   借 银行/现金（amount）
 *   贷 应收账款（amount，挂客户）
 */
export function buildReceiptPosting(args: {
  depositAccountId: string
  arAccountId: string
  partyId: string
  amount: number
  description: string
}): PostingLineInput[] {
  const amount = roundMoney(args.amount)
  return [
    { accountId: args.depositAccountId, debit: amount, credit: 0, description: args.description },
    { accountId: args.arAccountId, debit: 0, credit: amount, partyId: args.partyId, description: args.description },
  ]
}

/**
 * 采购账单过账分录：
 *   借 费用/资产行（各行金额）
 *   借 进项税（taxAmount > 0 时）
 *   贷 应付账款（total，挂供应商）
 */
export function buildPurchaseBillPosting(args: {
  apAccountId: string
  partyId: string
  description: string
  expenseLines: DocPostingLine[]
  taxAccountId?: string | null
  taxAmount?: number
  total: number
}): PostingLineInput[] {
  const taxAmount = roundMoney(args.taxAmount ?? 0)
  const lines: PostingLineInput[] = args.expenseLines.map(line => ({
    accountId: line.accountId,
    debit: roundMoney(line.amount),
    credit: 0,
    description: line.description || args.description,
  }))
  if (taxAmount > 0 && args.taxAccountId) {
    lines.push({
      accountId: args.taxAccountId,
      debit: taxAmount,
      credit: 0,
      description: `进项税 ${args.description}`,
    })
  }
  lines.push({
    accountId: args.apAccountId,
    debit: 0,
    credit: roundMoney(args.total),
    partyId: args.partyId,
    description: args.description,
  })
  return lines
}

/**
 * 供应商付款分录：
 *   借 应付账款（amount，挂供应商）
 *   贷 银行/现金（amount）
 */
export function buildBillPaymentPosting(args: {
  depositAccountId: string
  apAccountId: string
  partyId: string
  amount: number
  description: string
}): PostingLineInput[] {
  const amount = roundMoney(args.amount)
  return [
    { accountId: args.apAccountId, debit: amount, credit: 0, partyId: args.partyId, description: args.description },
    { accountId: args.depositAccountId, debit: 0, credit: amount, description: args.description },
  ]
}

/**
 * 客户贷项通知单分录（冲减应收）：
 *   借 冲减科目/收入（subtotal）
 *   借 销项税（taxAmount > 0 时）
 *   贷 应收账款（total，挂客户）
 */
export function buildCustomerCreditNotePosting(args: {
  arAccountId: string
  offsetAccountId: string
  partyId: string
  description: string
  subtotal: number
  taxAccountId?: string | null
  taxAmount?: number
  total: number
}): PostingLineInput[] {
  const taxAmount = roundMoney(args.taxAmount ?? 0)
  const lines: PostingLineInput[] = [
    { accountId: args.offsetAccountId, debit: roundMoney(args.subtotal), credit: 0, description: args.description },
  ]
  if (taxAmount > 0 && args.taxAccountId) {
    lines.push({ accountId: args.taxAccountId, debit: taxAmount, credit: 0, description: `销项税冲减 ${args.description}` })
  }
  lines.push({
    accountId: args.arAccountId,
    debit: 0,
    credit: roundMoney(args.total),
    partyId: args.partyId,
    description: args.description,
  })
  return lines
}

/**
 * 供应商借项通知单分录（冲减应付）：
 *   借 应付账款（total，挂供应商）
 *   贷 冲减科目/费用（subtotal）
 *   贷 进项税（taxAmount > 0 时）
 */
export function buildSupplierDebitNotePosting(args: {
  apAccountId: string
  offsetAccountId: string
  partyId: string
  description: string
  subtotal: number
  taxAccountId?: string | null
  taxAmount?: number
  total: number
}): PostingLineInput[] {
  const taxAmount = roundMoney(args.taxAmount ?? 0)
  const lines: PostingLineInput[] = [
    {
      accountId: args.apAccountId,
      debit: roundMoney(args.total),
      credit: 0,
      partyId: args.partyId,
      description: args.description,
    },
    { accountId: args.offsetAccountId, debit: 0, credit: roundMoney(args.subtotal), description: args.description },
  ]
  if (taxAmount > 0 && args.taxAccountId) {
    lines.push({ accountId: args.taxAccountId, debit: 0, credit: taxAmount, description: `进项税冲减 ${args.description}` })
  }
  return lines
}
