import { z } from 'zod'

export const formPatchSchema = z.object({
  formName: z.string().trim().min(1).max(200),
  notes: z.string().trim().max(2000).optional().nullable(),
})
