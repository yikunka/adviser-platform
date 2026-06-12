import { z } from 'zod'
import { recipeItemSchema } from '@/lib/cosmocoat/recipe-api-schemas'
import { recipeViscosityFieldsSchema } from '@/lib/cosmocoat/recipe-viscosity'

export const recipePatchSchema = z.object({
  categoryId: z.string().trim().min(1).optional(),
  code: z.string().trim().min(1).max(32).optional(),
  name: z.string().trim().min(1).max(160).optional(),
  batchQuantity: z.coerce.number().min(0.001).optional(),
  ...recipeViscosityFieldsSchema,
  shelfLifeDays: z.coerce.number().int().min(1).nullable().optional(),
  notes: z.string().trim().max(1000).optional(),
  productionSpeedRequirements: z.string().trim().max(2000).optional(),
  productionTimeRequirements: z.string().trim().max(2000).optional(),
  packagingRequirements: z.string().trim().max(2000).optional(),
  productionNotes: z.string().trim().max(2000).optional(),
  qcTestStandard: z.string().trim().max(2000).optional(),
  qcTestItems: z.array(z.enum(['VISCOSITY', 'CROSSHATCH', 'BOILING_WATER_80C30M', 'WET_OIL_APPEARANCE', 'DRY_PLATE_APPEARANCE'])).optional(),
  qcResult: z.string().trim().max(2000).optional(),
  items: z.array(recipeItemSchema).optional(),
  refreshPrices: z.literal(true).optional(),
})

export type RecipePatchInput = Partial<z.output<typeof recipePatchSchema>>
