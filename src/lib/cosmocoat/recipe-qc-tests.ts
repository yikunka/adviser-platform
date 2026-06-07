/** Predefined QC test items selectable on recipe detail pages. */
export const RECIPE_QC_TEST_ITEMS = [
  { id: 'VISCOSITY', label: '黏度' },
  { id: 'CROSSHATCH', label: '百格' },
  { id: 'BOILING_WATER_80C30M', label: '水煮80C/30M' },
  { id: 'WET_OIL_APPEARANCE', label: '湿油外观' },
  { id: 'DRY_PLATE_APPEARANCE', label: '干板外观' },
] as const

export type RecipeQcTestItemId = (typeof RECIPE_QC_TEST_ITEMS)[number]['id']

const RECIPE_QC_TEST_LABELS = new Map<string, string>(
  RECIPE_QC_TEST_ITEMS.map(item => [item.id, item.label]),
)

export function normalizeRecipeQcTestItems(items: string[] | null | undefined): RecipeQcTestItemId[] {
  const allowed = new Set<string>(RECIPE_QC_TEST_ITEMS.map(item => item.id))
  return (items ?? []).filter((id): id is RecipeQcTestItemId => allowed.has(id))
}

export function recipeQcTestItemLabel(id: string): string {
  return RECIPE_QC_TEST_LABELS.get(id) ?? id
}

export function formatRecipeQcTestItemLine(
  id: RecipeQcTestItemId,
  viscosity?: string | null,
  viscosityUnit?: string | null,
): string {
  if (id === 'VISCOSITY') {
    const text = viscosity?.trim() ?? ''
    const unit = viscosityUnit?.trim() ?? ''
    if (text) return unit ? `黏度: ${text} ${unit}` : `黏度: ${text}`
    return '黏度'
  }
  return recipeQcTestItemLabel(id)
}

/** Builds the test-standard block from selected QC checkboxes. */
export function formatSelectedRecipeQcTests(
  items: string[] | null | undefined,
  viscosity?: string | null,
  viscosityUnit?: string | null,
): string {
  return normalizeRecipeQcTestItems(items)
    .map(id => formatRecipeQcTestItemLine(id, viscosity, viscosityUnit))
    .join('\n')
}

export type QcTestItemResults = Partial<Record<RecipeQcTestItemId, string>>

function qcTestItemResultPrefix(id: RecipeQcTestItemId): string {
  return `${recipeQcTestItemLabel(id)}:`
}

/** Parses per-item QC results stored as `label: value` lines. */
export function parseQcTestItemResults(text: string): {
  itemResults: QcTestItemResults
  legacyText: string
} {
  const itemResults: QcTestItemResults = {}
  const legacyLines: string[] = []

  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue

    let matched = false
    for (const item of RECIPE_QC_TEST_ITEMS) {
      const prefix = qcTestItemResultPrefix(item.id)
      if (trimmed === item.label || trimmed.startsWith(`${prefix} `) || trimmed.startsWith(prefix)) {
        itemResults[item.id] = trimmed.slice(prefix.length).trim()
        matched = true
        break
      }
    }
    if (!matched) legacyLines.push(trimmed)
  }

  return { itemResults, legacyText: legacyLines.join('\n') }
}

/** Maps legacy unstructured QC result text onto selected items when loading old records. */
export function hydrateQcTestItemResults(
  qcResult: string,
  qcTestItems: RecipeQcTestItemId[],
): QcTestItemResults {
  const { itemResults, legacyText } = parseQcTestItemResults(qcResult)
  if (legacyText && Object.keys(itemResults).length === 0 && qcTestItems.length === 1) {
    return { [qcTestItems[0]]: legacyText }
  }
  return itemResults
}

/** Serializes per-item QC results for storage in `qcResult`. */
export function formatQcTestItemResults(
  itemResults: QcTestItemResults,
  selectedItems: RecipeQcTestItemId[],
): string {
  const lines: string[] = []
  for (const id of RECIPE_QC_TEST_ITEMS.map(item => item.id)) {
    if (!selectedItems.includes(id)) continue
    const value = itemResults[id]?.trim()
    if (value) lines.push(`${recipeQcTestItemLabel(id)}: ${value}`)
  }
  return lines.join('\n')
}
