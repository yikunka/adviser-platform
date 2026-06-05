export const CHEMICAL_RESISTANCE_OPTIONS = [
  { id: 'ALCOHOL_99_50', label: '耐醇 99%/50' },
  { id: 'ALCOHOL_99_100', label: '耐醇 99%/100' },
  { id: 'ALCOHOL_99_200', label: '耐醇 99%/200' },
  { id: 'MEK_50', label: '耐 MEK/50' },
  { id: 'MEK_100', label: '耐 MEK/100' },
] as const

export const CHEMICAL_RESISTANCE_STANDARD_IDS = new Set(
  CHEMICAL_RESISTANCE_OPTIONS.map(option => option.id),
)

/** @deprecated Replaced by granular ALCOHOL_* / MEK_* options */
export const CHEMICAL_RESISTANCE_STANDARD_ID = 'CHEMICAL_RESISTANCE'

const DEPRECATED_STANDARD_IDS = new Set([
  CHEMICAL_RESISTANCE_STANDARD_ID,
  'ALCOHOL_75_100',
])

export function normalizePerformanceStandards(standards: string[] = []) {
  const normalized = new Set<string>()

  for (const standard of standards) {
    if (!standard.trim()) continue
    if (DEPRECATED_STANDARD_IDS.has(standard)) continue
    normalized.add(standard)
  }

  return [...normalized]
}
