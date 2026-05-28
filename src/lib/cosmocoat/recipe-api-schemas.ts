import { z } from 'zod'

export const recipeItemSchema = z.object({
  rawMaterialId: z.string().trim().min(1).optional(),
  recipeId: z.string().trim().min(1).optional(),
  sortOrder: z.coerce.number().int().min(0).optional().default(0),
  quantity: z.coerce.number().min(0),
  unitPrice: z.coerce.number().min(0).nullable().optional().default(null),
  notes: z.string().trim().max(500).optional().default(''),
}).refine(
  data => Boolean(data.rawMaterialId) !== Boolean(data.recipeId),
  { message: 'Each item must have either rawMaterialId or recipeId, not both' },
)
