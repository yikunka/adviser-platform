import { z } from 'zod'

const processParameterSchema = z.preprocess(
  value => (value === undefined || value === null ? value : String(value)),
  z.string().trim().max(64).nullable().optional(),
)

const optionalIdSchema = z.preprocess(
  value => {
    if (value === undefined || value === null) return value
    const trimmed = String(value).trim()
    return trimmed || null
  },
  z.string().min(1).nullable().optional(),
)

const optionalTextSchema = (max: number) => z.preprocess(
  value => (value === undefined || value === null ? value : String(value)),
  z.string().trim().max(max).nullable().optional(),
)

export const processBlockSchema = z.object({
  id: z.string().trim().min(1).max(80),
  text: z.string().trim().min(1).max(2000),
})

export const processFlowItemSchema = z.discriminatedUnion('type', [
  z.object({
    id: z.string().trim().min(1).max(80),
    type: z.literal('product'),
    kitProductId: z.string().trim().min(1),
  }),
  z.object({
    id: z.string().trim().min(1).max(80),
    type: z.literal('process'),
    text: z.string().trim().min(1).max(2000),
  }),
])

export const processKitProductInputSchema = z.object({
  id: z.string().trim().min(1).max(80).optional(),
  clientId: z.string().trim().min(1).max(80).optional(),
  productId: z.string().trim().min(1),
  productName: z.string().trim().min(1).max(160).optional(),
  sortOrder: z.coerce.number().int().min(0).max(9999).optional(),
  quantityRatio: optionalTextSchema(64),
  usageMethod: optionalTextSchema(2000),
  hardenerProductId: optionalIdSchema,
  hardenerRatio: optionalTextSchema(64),
  thinnerProductId: optionalIdSchema,
  thinnerRatio: optionalTextSchema(64),
  irMinutes: processParameterSchema,
  irTemperature: processParameterSchema,
  uvEnergy: processParameterSchema,
  filmThickness: processParameterSchema,
  sprayViscosity: processParameterSchema,
  notes: optionalTextSchema(2000),
  processBlocks: z.array(processBlockSchema).max(50).optional().default([]),
})

export const processKitTestInputSchema = z.object({
  id: z.string().trim().min(1).max(80).optional(),
  testType: z.enum([
    'PERFORMANCE',
    'DURABILITY',
    'ADHESION',
    'COLOR_STABILITY',
    'BOND_STRENGTH',
    'OTHER',
  ]),
  testResult: z.enum(['PASSED', 'FAILED', 'PENDING']).optional().default('PENDING'),
  testDate: z.string().datetime(),
  testerName: z.string().trim().max(120).optional().default(''),
  testerId: z.string().trim().min(1).nullable().optional(),
  reportLink: z.string().trim().max(500).optional().default(''),
  testNotes: z.string().trim().max(2000).optional().default(''),
  passedAt: z.string().datetime().nullable().optional(),
})

export const processKitPatchSchema = z.object({
  code: z.string().trim().min(1).max(32).optional(),
  name: z.string().trim().min(1).max(160).optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  materials: z.array(z.string()).optional(),
  performanceStandards: z.array(z.string()).optional(),
  otherNote: z.string().trim().max(500).nullable().optional(),
  processDescription: z.string().trim().max(2000).nullable().optional(),
  processFlowNote: z.string().trim().max(2000).nullable().optional(),
  status: z.enum(['DRAFT', 'ACTIVE', 'ARCHIVED']).optional(),
  products: z.array(processKitProductInputSchema).max(100).optional(),
  processFlowItems: z.array(processFlowItemSchema).max(200).optional(),
  tests: z.array(processKitTestInputSchema).max(200).optional(),
})

export type ProcessKitPatchInput = z.infer<typeof processKitPatchSchema>
export type ProcessKitProductInput = z.infer<typeof processKitProductInputSchema>
export type ProcessKitTestInput = z.infer<typeof processKitTestInputSchema>
