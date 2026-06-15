import type {
  BankAccount,
  CreditNoteKind,
  CreditNoteStatus,
  FinPaymentDirection,
  FinPaymentMethod,
  FinPaymentStatus,
  Party,
  PurchaseBillStatus,
  SalesInvoiceStatus,
} from '@prisma/client'
import type { CreditNoteWithRelations } from '@/lib/financial/fin-credit-notes'
import type { FinPaymentWithRelations } from '@/lib/financial/fin-payments'
import type { PurchaseBillWithRelations } from '@/lib/financial/purchase-bills'
import type { SalesInvoiceWithRelations } from '@/lib/financial/sales-invoices'
import { roundMoney } from '@/lib/financial/utils'

function money(value: { toString(): string } | number | null | undefined) {
  return Number(value ?? 0)
}

function ymd(value: Date | null | undefined) {
  return value ? value.toISOString().slice(0, 10) : null
}

// ── Party ──

export type SerializedParty = {
  id: string
  code: string
  name: string
  nameZh: string | null
  isCustomer: boolean
  isSupplier: boolean
  isEmployee: boolean
  email: string | null
  phone: string | null
  address: string | null
  taxNumber: string | null
  currency: string
  paymentTermsDays: number
  creditLimit: number | null
  arAccountId: string | null
  apAccountId: string | null
  notes: string
  isActive: boolean
  createdAt: string
}

export function serializeParty(party: Party): SerializedParty {
  return {
    id: party.id,
    code: party.code,
    name: party.name,
    nameZh: party.nameZh,
    isCustomer: party.isCustomer,
    isSupplier: party.isSupplier,
    isEmployee: party.isEmployee,
    email: party.email,
    phone: party.phone,
    address: party.address,
    taxNumber: party.taxNumber,
    currency: party.currency,
    paymentTermsDays: party.paymentTermsDays,
    creditLimit: party.creditLimit === null ? null : money(party.creditLimit),
    arAccountId: party.arAccountId,
    apAccountId: party.apAccountId,
    notes: party.notes,
    isActive: party.isActive,
    createdAt: party.createdAt.toISOString(),
  }
}

// ── Sales invoice ──

export type SerializedSalesInvoice = {
  id: string
  invoiceNo: string
  status: SalesInvoiceStatus
  /** 展示状态：到期未结清 → OVERDUE（派生，不入库） */
  displayStatus: SalesInvoiceStatus | 'OVERDUE'
  party: { id: string; code: string; name: string }
  issueDate: string
  dueDate: string | null
  currency: string
  subtotal: number
  taxRate: number
  taxAmount: number
  total: number
  amountPaid: number
  outstanding: number
  notes: string
  journalEntry: { id: string; voucherNo: string } | null
  createdBy: string | null
  postedAt: string | null
  voidedAt: string | null
  createdAt: string
  lines: Array<{
    id: string
    description: string
    quantity: number
    unitPrice: number
    amount: number
    revenueAccountId: string | null
  }>
}

function overdueDisplay<T extends string>(
  status: T,
  openStatuses: readonly T[],
  dueDate: Date | null,
  today = new Date(),
): T | 'OVERDUE' {
  if (dueDate && openStatuses.includes(status) && dueDate.getTime() < today.getTime()) return 'OVERDUE'
  return status
}

export function serializeSalesInvoice(invoice: SalesInvoiceWithRelations): SerializedSalesInvoice {
  const total = money(invoice.total)
  const amountPaid = money(invoice.amountPaid)
  return {
    id: invoice.id,
    invoiceNo: invoice.invoiceNo,
    status: invoice.status,
    displayStatus: overdueDisplay(invoice.status, ['ISSUED', 'PARTIALLY_PAID'], invoice.dueDate),
    party: { id: invoice.party.id, code: invoice.party.code, name: invoice.party.name },
    issueDate: ymd(invoice.issueDate)!,
    dueDate: ymd(invoice.dueDate),
    currency: invoice.currency,
    subtotal: money(invoice.subtotal),
    taxRate: money(invoice.taxRate),
    taxAmount: money(invoice.taxAmount),
    total,
    amountPaid,
    outstanding: roundMoney(total - amountPaid),
    notes: invoice.notes,
    journalEntry: invoice.journalEntry,
    createdBy: invoice.createdBy?.nameEn ?? null,
    postedAt: invoice.postedAt?.toISOString() ?? null,
    voidedAt: invoice.voidedAt?.toISOString() ?? null,
    createdAt: invoice.createdAt.toISOString(),
    lines: invoice.lines.map(line => ({
      id: line.id,
      description: line.description,
      quantity: money(line.quantity),
      unitPrice: money(line.unitPrice),
      amount: money(line.amount),
      revenueAccountId: line.revenueAccountId,
    })),
  }
}

// ── Purchase bill ──

export type SerializedPurchaseBill = {
  id: string
  billNo: string
  supplierRef: string
  status: PurchaseBillStatus
  displayStatus: PurchaseBillStatus | 'OVERDUE'
  party: { id: string; code: string; name: string }
  billDate: string
  dueDate: string | null
  currency: string
  subtotal: number
  taxRate: number
  taxAmount: number
  total: number
  amountPaid: number
  outstanding: number
  notes: string
  journalEntry: { id: string; voucherNo: string } | null
  createdBy: string | null
  postedAt: string | null
  voidedAt: string | null
  createdAt: string
  lines: Array<{
    id: string
    description: string
    quantity: number
    unitPrice: number
    amount: number
    expenseAccountId: string | null
  }>
}

export function serializePurchaseBill(bill: PurchaseBillWithRelations): SerializedPurchaseBill {
  const total = money(bill.total)
  const amountPaid = money(bill.amountPaid)
  return {
    id: bill.id,
    billNo: bill.billNo,
    supplierRef: bill.supplierRef,
    status: bill.status,
    displayStatus: overdueDisplay(bill.status, ['POSTED', 'PARTIALLY_PAID'], bill.dueDate),
    party: { id: bill.party.id, code: bill.party.code, name: bill.party.name },
    billDate: ymd(bill.billDate)!,
    dueDate: ymd(bill.dueDate),
    currency: bill.currency,
    subtotal: money(bill.subtotal),
    taxRate: money(bill.taxRate),
    taxAmount: money(bill.taxAmount),
    total,
    amountPaid,
    outstanding: roundMoney(total - amountPaid),
    notes: bill.notes,
    journalEntry: bill.journalEntry,
    createdBy: bill.createdBy?.nameEn ?? null,
    postedAt: bill.postedAt?.toISOString() ?? null,
    voidedAt: bill.voidedAt?.toISOString() ?? null,
    createdAt: bill.createdAt.toISOString(),
    lines: bill.lines.map(line => ({
      id: line.id,
      description: line.description,
      quantity: money(line.quantity),
      unitPrice: money(line.unitPrice),
      amount: money(line.amount),
      expenseAccountId: line.expenseAccountId,
    })),
  }
}

// ── Payment ──

export type SerializedPayment = {
  id: string
  paymentNo: string
  direction: FinPaymentDirection
  status: FinPaymentStatus
  party: { id: string; code: string; name: string }
  paymentDate: string
  method: FinPaymentMethod
  bankAccount: { id: string; name: string; bankName: string } | null
  currency: string
  amount: number
  amountAllocated: number
  unallocated: number
  reference: string
  notes: string
  journalEntry: { id: string; voucherNo: string } | null
  createdBy: string | null
  voidedAt: string | null
  createdAt: string
  allocations: Array<{
    id: string
    amount: number
    docNo: string
    targetType: 'SALES_INVOICE' | 'PURCHASE_BILL'
    targetId: string
  }>
}

export function serializePayment(payment: FinPaymentWithRelations): SerializedPayment {
  const amount = money(payment.amount)
  const amountAllocated = money(payment.amountAllocated)
  return {
    id: payment.id,
    paymentNo: payment.paymentNo,
    direction: payment.direction,
    status: payment.status,
    party: { id: payment.party.id, code: payment.party.code, name: payment.party.name },
    paymentDate: ymd(payment.paymentDate)!,
    method: payment.method,
    bankAccount: payment.bankAccount,
    currency: payment.currency,
    amount,
    amountAllocated,
    unallocated: roundMoney(amount - amountAllocated),
    reference: payment.reference,
    notes: payment.notes,
    journalEntry: payment.journalEntry,
    createdBy: payment.createdBy?.nameEn ?? null,
    voidedAt: payment.voidedAt?.toISOString() ?? null,
    createdAt: payment.createdAt.toISOString(),
    allocations: payment.allocations.map(allocation => ({
      id: allocation.id,
      amount: money(allocation.amount),
      docNo: allocation.salesInvoice?.invoiceNo ?? allocation.purchaseBill?.billNo ?? '',
      targetType: allocation.salesInvoice ? 'SALES_INVOICE' : 'PURCHASE_BILL',
      targetId: allocation.salesInvoice?.id ?? allocation.purchaseBill?.id ?? '',
    })),
  }
}

// ── Credit note ──

export type SerializedCreditNote = {
  id: string
  noteNo: string
  kind: CreditNoteKind
  status: CreditNoteStatus
  party: { id: string; code: string; name: string }
  issueDate: string
  currency: string
  subtotal: number
  taxRate: number
  taxAmount: number
  total: number
  amountApplied: number
  remaining: number
  reason: string
  offsetAccount: { id: string; code: string; name: string } | null
  journalEntry: { id: string; voucherNo: string } | null
  createdBy: string | null
  postedAt: string | null
  voidedAt: string | null
  createdAt: string
  allocations: Array<{ id: string; amount: number; docNo: string; targetId: string }>
}

export function serializeCreditNote(note: CreditNoteWithRelations): SerializedCreditNote {
  const total = money(note.total)
  const amountApplied = money(note.amountApplied)
  return {
    id: note.id,
    noteNo: note.noteNo,
    kind: note.kind,
    status: note.status,
    party: { id: note.party.id, code: note.party.code, name: note.party.name },
    issueDate: ymd(note.issueDate)!,
    currency: note.currency,
    subtotal: money(note.subtotal),
    taxRate: money(note.taxRate),
    taxAmount: money(note.taxAmount),
    total,
    amountApplied,
    remaining: roundMoney(total - amountApplied),
    reason: note.reason,
    offsetAccount: note.offsetAccount,
    journalEntry: note.journalEntry,
    createdBy: note.createdBy?.nameEn ?? null,
    postedAt: note.postedAt?.toISOString() ?? null,
    voidedAt: note.voidedAt?.toISOString() ?? null,
    createdAt: note.createdAt.toISOString(),
    allocations: note.allocations.map(allocation => ({
      id: allocation.id,
      amount: money(allocation.amount),
      docNo: allocation.salesInvoice?.invoiceNo ?? allocation.purchaseBill?.billNo ?? '',
      targetId: allocation.salesInvoice?.id ?? allocation.purchaseBill?.id ?? '',
    })),
  }
}

// ── Bank account ──

export type SerializedBankAccount = {
  id: string
  name: string
  bankName: string
  accountNumber: string
  currency: string
  glAccountId: string
  glAccount?: { id: string; code: string; name: string } | null
  isActive: boolean
  notes: string
  createdAt: string
}

export function serializeBankAccount(
  account: BankAccount & { glAccount?: { id: string; code: string; name: string } | null },
): SerializedBankAccount {
  return {
    id: account.id,
    name: account.name,
    bankName: account.bankName,
    accountNumber: account.accountNumber,
    currency: account.currency,
    glAccountId: account.glAccountId,
    glAccount: account.glAccount ?? null,
    isActive: account.isActive,
    notes: account.notes,
    createdAt: account.createdAt.toISOString(),
  }
}
