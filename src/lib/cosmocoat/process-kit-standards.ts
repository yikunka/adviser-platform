export const CHEMICAL_RESISTANCE_OPTIONS = [
  { id: 'ALCOHOL_99_50', label: '耐醇 99%/50' },
  { id: 'ALCOHOL_99_100', label: '耐醇 99%/100' },
  { id: 'ALCOHOL_99_200', label: '耐醇 99%/200' },
  { id: 'MEK_50', label: '耐 MEK/50' },
  { id: 'MEK_100', label: '耐 MEK/100' },
  { id: 'PERFUME_WRAP_24H', label: '香水包裹 24H' },
  { id: 'PERFUME_SOAK_4H', label: '香水浸泡 4H' },
  { id: 'PERFUME_SOAK_8H', label: '香水浸泡 8H' },
] as const

export const HIGH_TEMP_HUMIDITY_SALT_SPRAY_OPTIONS = [
  { id: 'HIGH_TEMP_HUMIDITY_65C85_24H', label: '65°C/85%RH 24H' },
  { id: 'HIGH_TEMP_HUMIDITY_65C85_48H', label: '65°C/85%RH 48H' },
  { id: 'SALT_SPRAY_5_24H', label: '5% NaCl 盐雾 24H' },
  { id: 'SALT_SPRAY_5_48H', label: '5% NaCl 盐雾 48H' },
] as const

export const CHEMICAL_RESISTANCE_STANDARD_IDS = new Set(
  CHEMICAL_RESISTANCE_OPTIONS.map(option => option.id),
)

/** @deprecated Replaced by granular ALCOHOL_* / MEK_* options */
export const CHEMICAL_RESISTANCE_STANDARD_ID = 'CHEMICAL_RESISTANCE'

const DEPRECATED_STANDARD_IDS = new Set([
  CHEMICAL_RESISTANCE_STANDARD_ID,
  'ALCOHOL_75_100',
  'HIGH_TEMP_HUMIDITY_SALT_SPRAY',
])

export const PERFORMANCE_STANDARD_GROUPS = [
  {
    id: 'crosshatch',
    options: [
      { id: 'CROSSHATCH_5B', label: '百格 5B' },
    ],
  },
  {
    id: 'boilingWater',
    options: [
      { id: 'BOILING_WATER_80C30M', label: '80C30M' },
      { id: 'BOILING_WATER_80C60M', label: '80C60M' },
      { id: 'BOILING_WATER_100C30M', label: '100C30M' },
      { id: 'BOILING_WATER_100C60M', label: '100C60M' },
      { id: 'BOILING_WATER_100C120M', label: '100C120M' },
    ],
  },
  {
    id: 'rca',
    options: [
      { id: 'RCA_30', label: '30' },
      { id: 'RCA_50', label: '50' },
      { id: 'RCA_100', label: '100' },
      { id: 'RCA_150', label: '150' },
      { id: 'RCA_200', label: '200' },
    ],
  },
  {
    id: 'hardness',
    options: [
      { id: 'HARDNESS_B', label: 'B' },
      { id: 'HARDNESS_HB', label: 'HB' },
      { id: 'HARDNESS_H', label: 'H' },
      { id: 'HARDNESS_2H', label: '2H' },
    ],
  },
  {
    id: 'chemicalResistance',
    options: [...CHEMICAL_RESISTANCE_OPTIONS],
  },
  {
    id: 'highTempHumiditySaltSpray',
    options: [...HIGH_TEMP_HUMIDITY_SALT_SPRAY_OPTIONS],
  },
] as const

const PERFORMANCE_STANDARD_LABELS = new Map<string, string>(
  PERFORMANCE_STANDARD_GROUPS.flatMap(group =>
    group.options.map(option => [option.id, option.label]),
  ),
)

export function getPerformanceStandardLabel(standardId: string): string {
  return PERFORMANCE_STANDARD_LABELS.get(standardId) ?? standardId
}

export function formatPerformanceStandardLabels(standards: string[] = []): string[] {
  return normalizePerformanceStandards(standards).map(getPerformanceStandardLabel)
}

export function normalizePerformanceStandards(standards: string[] = []) {
  const normalized = new Set<string>()

  for (const standard of standards) {
    if (!standard.trim()) continue
    if (DEPRECATED_STANDARD_IDS.has(standard)) continue
    normalized.add(standard)
  }

  return [...normalized]
}
