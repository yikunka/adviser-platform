import { z } from 'zod'

export const accountTypeSchema = z.enum([
  'ASSET',
  'NON_CURRENT_ASSET',
  'LIABILITY',
  'NON_CURRENT_LIABILITY',
  'EQUITY',
  'REVENUE',
  'EXPENSE',
  'CGS',
  'CURRENT_ACCOUNT',
])
export const journalStatusSchema = z.enum(['DRAFT', 'POSTED', 'CANCELLED'])
export const manualJournalSourceTypeSchema = z.enum(['MANUAL', 'CLOSING'])

const nullableIdSchema = z.preprocess(
  value => (value === '' || value === 'NONE' || value === undefined ? null : value),
  z.string().trim().min(1).nullable(),
)

const accountSchemaBase = z.object({
  code: z.string().trim().min(1, 'Code is required').max(32),
  name: z.string().trim().min(1, 'Name is required').max(200),
  type: accountTypeSchema,
  companyId: z.string().cuid('Company is required'),
  parentId: nullableIdSchema.optional().default(null),
  sortOrder: z.coerce.number().int().min(0).max(999999).optional().default(0),
  isSystem: z.coerce.boolean().optional().default(false),
  notes: z.string().trim().max(1000).optional().default(''),
  openingDebit: z.coerce.number().min(0).max(999999999999).optional().default(0),
  openingCredit: z.coerce.number().min(0).max(999999999999).optional().default(0),
  openingBalancePeriod: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  yearToDateAmount: z.coerce.number().min(0).max(999999999999).optional().default(0),
  yearToDateDebit: z.coerce.number().min(0).max(999999999999).optional(),
  yearToDateCredit: z.coerce.number().min(0).max(999999999999).optional(),
})

export const accountCreateSchema = accountSchemaBase.refine(data => !(data.openingDebit > 0 && data.openingCredit > 0), {
  message: 'Opening balance can be either debit or credit, not both.',
  path: ['openingDebit'],
})

export const accountUpdateSchema = accountSchemaBase.partial().refine(
  data => !((data.openingDebit ?? 0) > 0 && (data.openingCredit ?? 0) > 0),
  {
    message: 'Opening balance can be either debit or credit, not both.',
    path: ['openingDebit'],
  },
)

export const journalLineSchema = z.object({
  id: z.string().optional(),
  accountId: z.string().trim().min(1, 'Account is required'),
  description: z.string().trim().max(500).optional().default(''),
  debit: z.coerce.number().min(0).max(999999999999).optional().default(0),
  credit: z.coerce.number().min(0).max(999999999999).optional().default(0),
  notes: z.string().trim().max(500).optional().default(''),
})

export const journalEntryCreateSchema = z.object({
  entryDate: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  description: z.string().trim().min(1, 'Description is required').max(1000),
  companyId: z.string().cuid('Company is required'),
  lines: z.array(journalLineSchema).min(2, 'At least two lines are required'),
  attachments: z.array(z.string().trim().min(1)).optional().default([]),
  sourceType: manualJournalSourceTypeSchema.optional().default('MANUAL'),
})

export const journalEntryUpdateSchema = journalEntryCreateSchema.partial().extend({
  lines: z.array(journalLineSchema).min(2, 'At least two lines are required').optional(),
})

export const journalEntryFilterSchema = z.object({
  period: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  status: journalStatusSchema.optional(),
  search: z.string().trim().max(100).optional(),
  companyId: z.string().cuid().optional(),
})

export const ledgerFilterSchema = z.object({
  accountId: z.string().trim().min(1).optional(),
  accountIds: z.array(z.string().trim().min(1)).max(500).optional(),
  accountType: accountTypeSchema.optional(),
  period: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  voucherNo: z.string().trim().max(100).optional(),
  companyId: z.string().cuid().optional(),
}).refine(data => !data.startDate || !data.endDate || data.startDate <= data.endDate, {
  message: 'Start date must be earlier than or equal to end date.',
  path: ['endDate'],
})

export const financialReportFilterSchema = z.object({
  period: z.string().regex(/^\d{4}-\d{2}$/, 'Period must be YYYY-MM'),
  companyId: z.string().cuid().optional(),
  reportGroupId: z.string().cuid().optional(),
}).refine(data => !(data.companyId && data.reportGroupId), {
  message: 'Use either companyId or reportGroupId, not both.',
  path: ['reportGroupId'],
})

// ─────────────────────────────────────────────
// 子分类账：往来单位 / AR / AP / 银行
// ─────────────────────────────────────────────

const ymdSchema = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, '日期格式须为 YYYY-MM-DD')
const moneySchema = z.coerce.number().min(0).max(999999999999)

const partyBaseSchema = z.object({
  companyId: z.string().cuid('Company is required'),
  code: z.preprocess(
    value => (value === '' || value === undefined ? null : value),
    z.string().trim().min(1, '编号必填').max(32).nullable(),
  ).optional(),
  name: z.string().trim().min(1, '名称必填').max(200),
  nameZh: z.string().trim().max(200).optional().nullable(),
  isCustomer: z.coerce.boolean().optional().default(false),
  isSupplier: z.coerce.boolean().optional().default(false),
  isEmployee: z.coerce.boolean().optional().default(false),
  email: z.string().trim().email('邮箱格式无效').nullable().optional(),
  phone: z.string().trim().max(50).optional().nullable(),
  address: z.string().trim().max(500).optional().nullable(),
  taxNumber: z.string().trim().max(100).optional().nullable(),
  currency: z.string().trim().length(3).optional().default('HKD'),
  paymentTermsDays: z.coerce.number().int().min(0).max(365).optional().default(30),
  creditLimit: z.coerce.number().min(0).optional().nullable(),
  arAccountId: z.string().trim().min(1).optional().nullable(),
  apAccountId: z.string().trim().min(1).optional().nullable(),
  notes: z.string().trim().max(1000).optional().default(''),
  isActive: z.coerce.boolean().optional().default(true),
})

export const partySchema = partyBaseSchema.refine(
  data => data.isCustomer || data.isSupplier || data.isEmployee,
  { message: '至少选择一个角色（客户/供应商/员工）。', path: ['isCustomer'] },
)

export const partyUpdateSchema = partyBaseSchema.omit({ companyId: true }).partial()

export const salesInvoiceLineInputSchema = z.object({
  description: z.string().trim().min(1, '明细描述必填').max(500),
  quantity: z.coerce.number().gt(0, '数量必须大于零').max(999999999),
  unitPrice: moneySchema,
  revenueAccountId: z.string().trim().min(1).optional().nullable(),
})

export const salesInvoiceCreateSchema = z.object({
  companyId: z.string().cuid('Company is required'),
  partyId: z.string().trim().min(1, '客户必选'),
  issueDate: ymdSchema,
  dueDate: ymdSchema.optional().nullable(),
  taxRate: z.coerce.number().min(0).max(1).optional().default(0),
  notes: z.string().trim().max(1000).optional().default(''),
  lines: z.array(salesInvoiceLineInputSchema).min(1, '至少一行明细'),
})

export const purchaseBillLineInputSchema = z.object({
  description: z.string().trim().min(1, '明细描述必填').max(500),
  quantity: z.coerce.number().gt(0, '数量必须大于零').max(999999999),
  unitPrice: moneySchema,
  expenseAccountId: z.string().trim().min(1).optional().nullable(),
})

export const purchaseBillCreateSchema = z.object({
  companyId: z.string().cuid('Company is required'),
  partyId: z.string().trim().min(1, '供应商必选'),
  billDate: ymdSchema,
  dueDate: ymdSchema.optional().nullable(),
  supplierRef: z.string().trim().max(100).optional().default(''),
  taxRate: z.coerce.number().min(0).max(1).optional().default(0),
  notes: z.string().trim().max(1000).optional().default(''),
  lines: z.array(purchaseBillLineInputSchema).min(1, '至少一行明细'),
})

export const paymentAllocationInputSchema = z.object({
  targetId: z.string().trim().min(1),
  amount: z.coerce.number().gt(0, '核销金额必须大于零'),
})

export const paymentCreateSchema = z.object({
  companyId: z.string().cuid('Company is required'),
  partyId: z.string().trim().min(1, '往来单位必选'),
  direction: z.enum(['RECEIPT', 'PAYMENT']),
  paymentDate: ymdSchema,
  method: z.enum(['BANK_TRANSFER', 'CASH', 'CHEQUE', 'CARD', 'OTHER']).optional().default('BANK_TRANSFER'),
  bankAccountId: z.string().trim().min(1).optional().nullable(),
  amount: z.coerce.number().gt(0, '金额必须大于零').max(999999999999),
  reference: z.string().trim().max(200).optional().default(''),
  notes: z.string().trim().max(1000).optional().default(''),
  allocations: z.array(paymentAllocationInputSchema).optional().default([]),
})

export const creditNoteCreateSchema = z.object({
  companyId: z.string().cuid('Company is required'),
  partyId: z.string().trim().min(1, '往来单位必选'),
  kind: z.enum(['CUSTOMER', 'SUPPLIER']),
  issueDate: ymdSchema,
  subtotal: z.coerce.number().gt(0, '金额必须大于零').max(999999999999),
  taxRate: z.coerce.number().min(0).max(1).optional().default(0),
  reason: z.string().trim().max(500).optional().default(''),
  offsetAccountId: z.string().trim().min(1).optional().nullable(),
})

export const creditNoteApplySchema = z.object({
  allocations: z.array(paymentAllocationInputSchema).min(1, '请至少选择一张单据'),
})

export const bankAccountSchema = z.object({
  companyId: z.string().cuid('Company is required'),
  glAccountId: z.string().trim().min(1, '请关联总账科目'),
  name: z.string().trim().min(1, '账户名称必填').max(200),
  bankName: z.string().trim().max(200).optional().default(''),
  accountNumber: z.string().trim().max(100).optional().default(''),
  currency: z.string().trim().length(3).optional().default('HKD'),
  isActive: z.coerce.boolean().optional().default(true),
  notes: z.string().trim().max(1000).optional().default(''),
})

export const bankAccountUpdateSchema = bankAccountSchema.partial().omit({ companyId: true })

export const bankStatementImportSchema = z.object({
  bankAccountId: z.string().trim().min(1, '银行账户必选'),
  fileName: z.string().trim().max(300).optional().default(''),
  openingBalance: z.coerce.number().optional().nullable(),
  closingBalance: z.coerce.number().optional().nullable(),
  lines: z.array(z.object({
    date: ymdSchema,
    description: z.string().trim().max(500).optional().default(''),
    reference: z.string().trim().max(200).optional().default(''),
    amount: z.coerce.number().refine(value => value !== 0, '金额不能为零'),
  })).min(1, '至少一行流水'),
})

export const reconciliationCreateSchema = z.object({
  bankAccountId: z.string().trim().min(1, '银行账户必选'),
  statementDate: ymdSchema,
  statementBalance: z.coerce.number(),
  notes: z.string().trim().max(1000).optional().default(''),
})

export const accountMappingUpsertSchema = z.object({
  companyId: z.string().cuid('Company is required'),
  mappings: z.array(z.object({
    key: z.enum([
      'AR_CONTROL', 'AP_CONTROL', 'SALES_REVENUE', 'OUTPUT_TAX', 'INPUT_TAX',
      'BANK_DEFAULT', 'CASH_DEFAULT', 'PURCHASE_EXPENSE_DEFAULT', 'BANK_FEES',
      'EXCHANGE_GAIN_LOSS', 'RETAINED_EARNINGS',
    ]),
    accountId: z.string().trim().min(1),
  })),
})

export type AccountFormValues = z.infer<typeof accountCreateSchema>
export type JournalEntryFormValues = z.infer<typeof journalEntryCreateSchema>
export type PartyFormValues = z.infer<typeof partySchema>
export type SalesInvoiceFormValues = z.infer<typeof salesInvoiceCreateSchema>
export type PurchaseBillFormValues = z.infer<typeof purchaseBillCreateSchema>
export type PaymentFormValues = z.infer<typeof paymentCreateSchema>
export type CreditNoteFormValues = z.infer<typeof creditNoteCreateSchema>
