export type SfsDiamondDisplay = {
  code?: string
}

export function sfsDiamondLabel(diamond: SfsDiamondDisplay, index: number) {
  return diamond.code || `D${String(index + 1).padStart(2, '0')}`
}

export function sfsStepFileName(key: string) {
  return key.split('/').pop() ?? key
}

export function sfsStepFileDiamondLabel(key: string) {
  const name = sfsStepFileName(key)
  return name.match(/^([A-Z0-9_-]+D\d{2})-/i)?.[1] ?? null
}

export function sfsStepRequiresDiamondImages(
  phase: string,
  stepNumber: number,
  defaultKey?: string | null,
) {
  if (phase === 'CRAFTING') return true
  if (defaultKey === 'CVD:5' || defaultKey === 'CVD:6') return true
  // Legacy / plan-less: final CVD labeling was step 6, now step 5 after removing Day-21 check
  if (phase === 'CVD' && (stepNumber === 5 || stepNumber === 6)) return true
  return false
}

export function sfsStepRequiresWeight(defaultKey?: string | null, phase?: string, stepIndex?: number) {
  if (defaultKey === 'CHEM_TRANSFORM:4') return true
  if (phase === 'CHEM_TRANSFORM' && stepIndex === 3) return true
  return false
}

const SFS_IMAGE_REVIEW_PHASES = new Set(['CHEM_TRANSFORM', 'CVD', 'CRAFTING', 'JEWELRY_SETTING'])

export type SfsStepAttachmentDisplay = {
  fileKey: string
  mimeType?: string | null
  reviewStatus?: string | null
}

export function sfsIsImageFile(fileKey: string, mimeType?: string | null) {
  return Boolean(mimeType?.startsWith('image/')) || /\.(jpg|jpeg|png|webp)$/i.test(sfsStepFileName(fileKey))
}

export function sfsStepImageRequiresApproval(phase: string, fileKey: string, mimeType?: string | null) {
  return SFS_IMAGE_REVIEW_PHASES.has(phase) && sfsIsImageFile(fileKey, mimeType)
}

export function sfsCustomerVisibleStepFileKeys(step: {
  fileKeys: string[]
  attachments?: SfsStepAttachmentDisplay[] | null
}) {
  const attachments = step.attachments ?? []
  if (attachments.length === 0) return step.fileKeys

  const attachmentKeys = new Set(attachments.map(attachment => attachment.fileKey))
  return [
    ...attachments
      .filter(attachment => attachment.reviewStatus === 'APPROVED')
      .map(attachment => attachment.fileKey),
    ...step.fileKeys.filter(key => !attachmentKeys.has(key)),
  ]
}

export function splitSfsStepNotes(notes: string | null | undefined) {
  if (!notes) return { weight: null as string | null, remark: null as string | null }

  const lines = notes.split(/\r?\n/)
  let weight: string | null = null
  const remarkLines: string[] = []

  for (const line of lines) {
    const match = line.match(/^\s*Weight:\s*(.+?)\s*$/i)
    if (match) {
      weight = match[1]
    } else if (line.trim()) {
      remarkLines.push(line)
    }
  }

  return {
    weight,
    remark: remarkLines.length > 0 ? remarkLines.join('\n') : null,
  }
}

export function groupSfsStepFilesByDiamond<T extends SfsDiamondDisplay>(
  fileKeys: string[],
  diamonds: T[],
) {
  const groups = diamonds.map((diamond, index) => ({
    label: sfsDiamondLabel(diamond, index),
    fileKeys: [] as string[],
  }))

  const unmatched: string[] = []
  const byLabel = new Map(groups.map(group => [group.label, group]))

  for (const key of fileKeys) {
    const label = sfsStepFileDiamondLabel(key)
    const group = label ? byLabel.get(label) : null
    if (group) group.fileKeys.push(key)
    else unmatched.push(key)
  }

  return { groups, unmatched }
}
