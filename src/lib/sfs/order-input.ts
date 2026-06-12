import { z } from 'zod'
import { getSfsOrderSpecOptions } from '@/lib/sfs/diamond-spec-options-server'
import { getDesignOptionsForSettingType, type SfsSpecOption } from '@/lib/sfs/diamond-spec-options'

export const sfsDiamondItemInputSchema = z.object({
  carat: z.string().min(1),
  shape: z.string().min(1),
  type: z.string().min(1),
  ringSize: z.string().optional(),
  design: z.string().optional(),
  metal: z.string().optional(),
})

export const sfsOrderInputSchema = z.object({
  memorialName: z.string().min(1),
  relationship: z.string().min(1),
  clientName: z.string().min(1),
  contactNumber: z.string().min(1),
  email: z.string().email(),
  mailingAddress: z.string().min(1),
  sourceType: z.string().min(1),
  sourceOther: z.string().optional(),
  remarks: z.string().optional(),
  mailingPackage: z.string().min(1),
  color: z.string().min(1),
  diamonds: z.array(sfsDiamondItemInputSchema).min(1).max(8),
})

export type SfsOrderInput = z.infer<typeof sfsOrderInputSchema>

function optionValues(options: SfsSpecOption[]) {
  return new Set(options.map(option => option.value))
}

export async function validateSfsOrderSpecOptions(input: SfsOrderInput): Promise<string | null> {
  const options = await getSfsOrderSpecOptions()
  const colors = optionValues(options.colors)
  const carats = optionValues(options.carats)
  const shapes = optionValues(options.shapes)
  const settingTypes = optionValues(options.settingTypes)
  const metals = optionValues(options.metals)

  if (!colors.has(input.color)) return 'Invalid diamond color'

  for (let index = 0; index < input.diamonds.length; index += 1) {
    const diamond = input.diamonds[index]
    const label = `Diamond #${index + 1}`
    if (!carats.has(diamond.carat)) return `${label}: invalid carat`
    if (!shapes.has(diamond.shape)) return `${label}: invalid shape`
    if (!settingTypes.has(diamond.type)) return `${label}: invalid setting type`
    if (diamond.type === 'Ring' && !diamond.ringSize?.trim()) return `${label}: ring size is required`
    const designOptions = getDesignOptionsForSettingType(diamond.type, options)
    if (designOptions.length > 0 && !optionValues(designOptions).has(diamond.design ?? '')) {
      return `${label}: invalid ${diamond.type.toLowerCase()} design`
    }
    if (diamond.type !== 'Diamond only' && !metals.has(diamond.metal ?? '')) return `${label}: invalid metal`
  }

  return null
}
