import { z } from 'zod'
import { getSfsOrderSpecOptions } from '@/lib/sfs/diamond-spec-options-server'
import { getDesignOptionsForSettingType, type SfsSpecOption } from '@/lib/sfs/diamond-spec-options'
import { isSfsCustomDesign } from '@/lib/sfs/design-upload-shared'

export const sfsDesignUploadInputSchema = z.object({ uploadId: z.string().cuid().optional(), attachmentId: z.string().cuid().optional() })
  .refine(upload => Boolean(upload.uploadId) !== Boolean(upload.attachmentId), 'Provide exactly one upload reference')

export const sfsDiamondItemInputSchema = z.object({
  carat: z.string().min(1),
  shape: z.string().min(1),
  type: z.string().min(1),
  ringSize: z.string().optional(),
  chainLength: z.string().max(40).optional(),
  design: z.string().optional(),
  designNotes: z.string().max(1000).optional(),
  metal: z.string().optional(),
  designUploads: z.array(sfsDesignUploadInputSchema).max(8).optional(),
})

export const sfsOrderInputSchema = z.object({
  memorialName: z.string().min(1),
  relationship: z.string().optional().default(''),
  clientName: z.string().min(1),
  contactNumber: z.string().min(1),
  email: z.string().email(),
  mailingAddress: z.string().min(1),
  sourceType: z.string().min(1),
  sourceOther: z.string().optional(),
  remarks: z.string().optional(),
  mailingPackage: z.string().min(1),
  mailingCompany: z.string().trim().max(120).optional(),
  mailTrackingCode: z.string().trim().max(80).optional(),
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
    if ((diamond.type === 'Necklace' || diamond.type === 'Bracelet') && !diamond.chainLength?.trim()) {
      return `${label}: ${diamond.type === 'Bracelet' ? 'bracelet' : 'necklace'} length is required`
    }

    const custom = isSfsCustomDesign(diamond.design)
    if (custom) {
      if (diamond.type === 'Diamond only') return `${label}: custom design is not available for Diamond only`
      const uploads = diamond.designUploads ?? []
      if (uploads.length === 0) return `${label}: please upload at least one design file`
    } else {
      const designOptions = getDesignOptionsForSettingType(diamond.type, options)
      if (designOptions.length > 0 && !optionValues(designOptions).has(diamond.design ?? '')) {
        return `${label}: invalid ${diamond.type.toLowerCase()} design`
      }
      if (diamond.designUploads && diamond.designUploads.length > 0) {
        return `${label}: design uploads are only allowed for Custom designs`
      }
    }

    if (diamond.type !== 'Diamond only' && !metals.has(diamond.metal ?? '')) return `${label}: invalid metal`
  }

  return null
}

/** Strip upload blobs from diamonds JSON persisted on the order (attachments live in their own table). */
export function diamondsJsonForPersistence(diamonds: SfsOrderInput['diamonds']) {
  return diamonds.map(diamond => {
    const { designUploads, ...rest } = diamond
    void designUploads
    return {
      ...rest,
      designNotes: rest.designNotes?.trim() || undefined,
    }
  })
}

export function designUploadRefsFromInput(
  diamonds: SfsOrderInput['diamonds'],
): Array<{ diamondIndex: number; uploadId?: string; attachmentId?: string }> {
  const rows: Array<{ diamondIndex: number; uploadId?: string; attachmentId?: string }> = []
  diamonds.forEach((diamond, diamondIndex) => {
    if (!isSfsCustomDesign(diamond.design)) return
    for (const upload of diamond.designUploads ?? []) {
      rows.push({ diamondIndex, ...upload })
    }
  })
  return rows
}
