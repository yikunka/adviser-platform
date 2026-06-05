export const CHEMICAL_RESISTANCE_STANDARD_ID = 'CHEMICAL_RESISTANCE'

const LEGACY_CHEMICAL_RESISTANCE_STANDARD_IDS = new Set([
  'ALCOHOL_99_100',
  'ALCOHOL_75_100',
  'MEK_100',
])

export function normalizePerformanceStandards(standards: string[] = []) {
  const normalized = new Set<string>()
  let hasChemicalResistance = false

  for (const standard of standards) {
    if (!standard.trim()) continue

    if (standard === CHEMICAL_RESISTANCE_STANDARD_ID || LEGACY_CHEMICAL_RESISTANCE_STANDARD_IDS.has(standard)) {
      hasChemicalResistance = true
      continue
    }

    normalized.add(standard)
  }

  if (hasChemicalResistance) normalized.add(CHEMICAL_RESISTANCE_STANDARD_ID)

  return [...normalized]
}
