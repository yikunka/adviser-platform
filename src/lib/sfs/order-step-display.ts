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

export function sfsStepRequiresDiamondImages(phase: string, stepNumber: number) {
  return (phase === 'CVD' && (stepNumber === 5 || stepNumber === 6)) || phase === 'CRAFTING'
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
