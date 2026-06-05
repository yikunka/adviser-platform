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
