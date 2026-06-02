import { z } from 'zod'

export const accountTypeSchema = z.enum([
  'ASSET',
  'LIABILITY',
  'EQUITY',
  'REVENUE',
  'EXPENSE',
  'CGS',
  'CURRENT_ACCOUNT',
])
export const journalStatusSchema = z.enum(['DRAFT', 'POSTED', 'CANCELLED'])

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
  accountType: accountTypeSchema.optional(),
  period: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  voucherNo: z.string().trim().max(100).optional(),
  companyId: z.string().cuid().optional(),
})

export const financialReportFilterSchema = z.object({
  period: z.string().regex(/^\d{4}-\d{2}$/, 'Period must be YYYY-MM'),
  companyId: z.string().cuid().optional(),
  reportGroupId: z.string().cuid().optional(),
}).refine(data => !(data.companyId && data.reportGroupId), {
  message: 'Use either companyId or reportGroupId, not both.',
  path: ['reportGroupId'],
})

export type AccountFormValues = z.infer<typeof accountCreateSchema>
export type JournalEntryFormValues = z.infer<typeof journalEntryCreateSchema>
