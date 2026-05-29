import { z } from 'zod'

export const entityGroupCreateSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(200),
  contactPerson: z.string().trim().max(200).optional().nullable(),
  email: z
    .string()
    .trim()
    .max(320)
    .optional()
    .nullable()
    .refine(v => !v || v === '' || z.string().email().safeParse(v).success, 'Invalid email'),
  phone: z.string().trim().max(50).optional().nullable(),
  address: z.string().trim().max(500).optional().nullable(),
  notes: z.string().trim().max(5000).optional().nullable(),
  memberUserIds: z.array(z.string().cuid()).optional().default([]),
})

export const entityGroupUpdateSchema = entityGroupCreateSchema.partial()

export const entityGroupFilterSchema = z.object({
  q: z.string().trim().max(200).optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
})

export const bulkCompanyImportRowSchema = z.object({
  nameEn: z.string().trim().min(1).max(200),
  nameZh: z.string().trim().max(200).optional(),
  companyNumber: z.string().trim().max(20).optional(),
  companyType: z.enum(['HONG_KONG', 'BVI', 'CAYMAN', 'MARSHALL']).optional(),
  groupName: z.string().trim().max(200).optional(),
  groupId: z.string().cuid().optional(),
})

export const bulkCompanyImportSchema = z.object({
  groupId: z.string().cuid().optional(),
  createGroupIfMissing: z.boolean().optional().default(false),
  defaultGroupName: z.string().trim().max(200).optional(),
  rows: z.array(bulkCompanyImportRowSchema).min(1).max(500),
})

export type EntityGroupFormValues = z.infer<typeof entityGroupCreateSchema>
export type BulkCompanyImportInput = z.infer<typeof bulkCompanyImportSchema>
