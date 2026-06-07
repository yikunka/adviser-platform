export const CHEMICAL_RESISTANCE_OPTIONS = [
  { id: 'ALCOHOL_99_50', label: '耐醇 99%/50' },
  { id: 'ALCOHOL_99_100', label: '耐醇 99%/100' },
  { id: 'ALCOHOL_99_200', label: '耐醇 99%/200' },
  { id: 'MEK_50', label: '耐 MEK/50' },
  { id: 'MEK_100', label: '耐 MEK/100' },
] as const

export const HIGH_TEMP_HUMIDITY_SALT_SPRAY_OPTIONS = [
  { id: 'HIGH_TEMP_HUMIDITY_SALT_SPRAY', label: '高温高湿/盐雾' },
  { id: 'HIGH_TEMP_HUMIDITY_65C85_24H', label: '65°C/85%RH 24H' },
  { id: 'HIGH_TEMP_HUMIDITY_65C85_48H', label: '65°C/85%RH 48H' },
  { id: 'SALT_SPRAY_5_24H', label: '5% NaCl盐雾24H' },
  { id: 'SALT_SPRAY_5_48H', label: '5% NaCl盐雾48H' },
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
