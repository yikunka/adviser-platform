export type SubledgerSide = 'ar' | 'ap'

/** 归一化后的子分类账单据（发票/账单共用一个 UI 形状） */
export type SubDoc = {
  id: string
  docNo: string
  supplierRef: string
  partyId: string
  partyName: string
  date: string
  dueDate: string | null
  subtotal: number
  taxRate: number
  taxAmount: number
  total: number
  amountPaid: number
  outstanding: number
  status: string
  displayStatus: string
  notes: string
  journalEntry: { id: string; voucherNo: string } | null
  lines: Array<{
    description: string
    quantity: number
    unitPrice: number
    amount: number
    accountId: string | null
  }>
}

export const STATUS_COLORS: Record<string, string> = {
  DRAFT: '#9CA3AF',
  ISSUED: '#38bdf8',
  POSTED: '#38bdf8',
  PARTIALLY_PAID: '#f59e0b',
  PAID: '#10b981',
  VOIDED: '#ef4444',
  OVERDUE: '#ef4444',
}

type RawDocLine = {
  description: string
  quantity: number
  unitPrice: number
  amount: number
  revenueAccountId?: string | null
  expenseAccountId?: string | null
}

type RawDoc = {
  id: string
  invoiceNo?: string
  billNo?: string
  supplierRef?: string
  party: { id: string; name: string }
  issueDate?: string
  billDate?: string
  dueDate: string | null
  subtotal: number
  taxRate: number
  taxAmount: number
  total: number
  amountPaid: number
  outstanding: number
  status: string
  displayStatus: string
  notes: string
  journalEntry: { id: string; voucherNo: string } | null
  lines: RawDocLine[]
}

function normalizeDoc(raw: RawDoc): SubDoc {
  return {
    id: raw.id,
    docNo: raw.invoiceNo ?? raw.billNo ?? '',
    supplierRef: raw.supplierRef ?? '',
    partyId: raw.party.id,
    partyName: raw.party.name,
    date: raw.issueDate ?? raw.billDate ?? '',
    dueDate: raw.dueDate,
    subtotal: raw.subtotal,
    taxRate: raw.taxRate,
    taxAmount: raw.taxAmount,
    total: raw.total,
    amountPaid: raw.amountPaid,
    outstanding: raw.outstanding,
    status: raw.status,
    displayStatus: raw.displayStatus,
    notes: raw.notes,
    journalEntry: raw.journalEntry,
    lines: raw.lines.map(line => ({
      description: line.description,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      amount: line.amount,
      accountId: line.revenueAccountId ?? line.expenseAccountId ?? null,
    })),
  }
}

export type SideConfig = {
  side: SubledgerSide
  title: string
  subtitle: string
  docTabLabel: string
  docLabel: string
  payTabLabel: string
  payLabel: string
  noteTabLabel: string
  noteLabel: string
  partyRole: 'customer' | 'supplier'
  partyLabel: string
  docsEndpoint: string
  docsResponseKey: 'invoices' | 'bills'
  paymentsDirection: 'RECEIPT' | 'PAYMENT'
  noteKind: 'CUSTOMER' | 'SUPPLIER'
  lineAccountLabel: string
  docDateLabel: string
  docDateField: 'issueDate' | 'billDate'
  lineAccountField: 'revenueAccountId' | 'expenseAccountId'
  postVerb: string
  statusLabels: Record<string, string>
  hasSupplierRef: boolean
  normalizeDoc: (raw: RawDoc) => SubDoc
}

export const SIDE_CONFIG: Record<SubledgerSide, SideConfig> = {
  ar: {
    side: 'ar',
    title: '应收管理',
    subtitle: '销售发票、收款核销、贷项通知单与应收账龄。',
    docTabLabel: '销售发票',
    docLabel: '发票',
    payTabLabel: '收款',
    payLabel: '收款',
    noteTabLabel: '贷项通知单',
    noteLabel: '贷项通知单',
    partyRole: 'customer',
    partyLabel: '客户',
    docsEndpoint: '/api/admin/financial/sales-invoices',
    docsResponseKey: 'invoices',
    paymentsDirection: 'RECEIPT',
    noteKind: 'CUSTOMER',
    lineAccountLabel: '收入科目（留空用默认）',
    docDateLabel: '开票日期',
    docDateField: 'issueDate',
    lineAccountField: 'revenueAccountId',
    postVerb: '开票过账',
    statusLabels: {
      DRAFT: '草稿',
      ISSUED: '已开票',
      PARTIALLY_PAID: '部分收款',
      PAID: '已收款',
      VOIDED: '已作废',
      OVERDUE: '已逾期',
    },
    hasSupplierRef: false,
    normalizeDoc,
  },
  ap: {
    side: 'ap',
    title: '应付管理',
    subtitle: '采购账单、付款核销、借项通知单与应付账龄。',
    docTabLabel: '采购账单',
    docLabel: '账单',
    payTabLabel: '付款',
    payLabel: '付款',
    noteTabLabel: '借项通知单',
    noteLabel: '借项通知单',
    partyRole: 'supplier',
    partyLabel: '供应商',
    docsEndpoint: '/api/admin/financial/purchase-bills',
    docsResponseKey: 'bills',
    paymentsDirection: 'PAYMENT',
    noteKind: 'SUPPLIER',
    lineAccountLabel: '费用科目（留空用默认）',
    docDateLabel: '账单日期',
    docDateField: 'billDate',
    lineAccountField: 'expenseAccountId',
    postVerb: '入账过账',
    statusLabels: {
      DRAFT: '草稿',
      POSTED: '已入账',
      PARTIALLY_PAID: '部分付款',
      PAID: '已付款',
      VOIDED: '已作废',
      OVERDUE: '已逾期',
    },
    hasSupplierRef: true,
    normalizeDoc,
  },
}

export function money(value: number) {
  return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export const inputStyle = {
  background: '#0E0E0A',
  border: '1px solid #2A2418',
  color: '#FFF7E6',
  caretColor: '#C9A96E',
  colorScheme: 'dark',
} as const

export const fieldClassName =
  'bg-[#0E0E0A] border-[#2A2418] text-[#FFF7E6] placeholder:text-[#7A6A50] caret-[#C9A96E] focus-visible:border-[#C9A96E] focus-visible:ring-[#C9A96E]/25'

export const accountPickerInputClassName =
  'bg-[#0E0E0A] border-[#2A2418] text-[#FFF7E6] placeholder:text-[#7A6A50] caret-[#C9A96E] focus-visible:border-[#C9A96E]'

export const selectContentClassName =
  'border border-[#2A2418] bg-[#11100B] text-[#FFF7E6] shadow-xl shadow-black/30'

export const selectItemClassName =
  'text-[#FFF7E6] focus:bg-[#1F1A12] focus:text-[#FFF7E6] data-[highlighted]:bg-[#1F1A12] data-[highlighted]:text-[#FFF7E6]'
