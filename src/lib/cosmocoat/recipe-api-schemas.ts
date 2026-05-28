import { z } from 'zod'

const itemRefinement = (data: {
  rawMaterialId?: string
  recipeId?: string
  productSemifinishedId?: string
}) => {
  const count = [
    Boolean(data.rawMaterialId),
    Boolean(data.recipeId),
    Boolean(data.productSemifinishedId),
  ].filter(Boolean).length
  return count === 1
}

export const recipeItemSchema = z.object({
  rawMaterialId: z.string().trim().min(1).optional(),
  recipeId: z.string().trim().min(1).optional(),
  productSemifinishedId: z.string().trim().min(1).optional(),
  sortOrder: z.coerce.number().int().min(0).optional().default(0),
  quantity: z.coerce.number().min(0),
  unitPrice: z.coerce.number().min(0).nullable().optional().default(null),
  notes: z.string().trim().max(500).optional().default(''),
}).refine(
  itemRefinement,
  { message: 'Each item must have exactly one of rawMaterialId, recipeId, or productSemifinishedId' },
)
