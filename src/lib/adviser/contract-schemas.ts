import { z } from 'zod'

export const contractPatchSchema = z.object({
  contractName: z.string().min(1).max(200),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  notes: z.string().max(2000).optional().nullable(),
})
