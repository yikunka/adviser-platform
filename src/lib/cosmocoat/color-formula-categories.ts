import type { CosColorFormulaCategory } from '@prisma/client'

const LEGACY_COLOR_FORMULA_CATEGORIES: Record<CosColorFormulaCategory, {
  labelZh: string
  labelEn: string
}> = {
  PU: { labelZh: 'PU', labelEn: 'PU' },
  BAKING_PAINT: { labelZh: '色漆', labelEn: 'Baking Paint' },
  HT_BAKING_PAINT: { labelZh: '烤漆', labelEn: 'HT Baking Paint' },
  LT_BAKING_PAINT: { labelZh: '烤漆', labelEn: 'LT Baking Paint' },
}

export const COLOR_FORMULA_CATEGORIES: {
  value: CosColorFormulaCategory
  labelZh: string
  labelEn: string
}[] = [
  { value: 'PU', ...LEGACY_COLOR_FORMULA_CATEGORIES.PU },
  { value: 'BAKING_PAINT', ...LEGACY_COLOR_FORMULA_CATEGORIES.BAKING_PAINT },
  { value: 'HT_BAKING_PAINT', ...LEGACY_COLOR_FORMULA_CATEGORIES.HT_BAKING_PAINT },
]

export function colorFormulaCategoryLabel(
  category: CosColorFormulaCategory,
  locale: 'zh' | 'en' = 'zh',
): string {
  const row = LEGACY_COLOR_FORMULA_CATEGORIES[category]
  if (!row) return category
  return locale === 'en' ? row.labelEn : row.labelZh
}

export function isColorFormulaCategory(value: string): value is CosColorFormulaCategory {
  return value in LEGACY_COLOR_FORMULA_CATEGORIES
}

export function formatColorFormulaCategoryLabel(
  categoryLabel: string,
  suffix: { name: string } | null | undefined,
) {
  if (!suffix) return categoryLabel
  return `${categoryLabel} · ${suffix.name}`
}

/** Factory product category name shown under the PU color-formula tab. */
export const PU_FACTORY_PRODUCT_CATEGORY_NAME = 'PU漆'

/** Whether a factory product belongs under a color-formula category tab. */
export function factoryProductMatchesColorFormulaCategory(
  productCategory: { name: string; slug?: string } | null | undefined,
  formulaCategory: CosColorFormulaCategory,
): boolean {
  if (formulaCategory === 'PU') {
    return productCategory?.name.trim() === PU_FACTORY_PRODUCT_CATEGORY_NAME
  }
  return inferCategoryFromProductCategory(productCategory) === formulaCategory
}

/** Infer color formula category from factory product category slug/name. */
export function inferCategoryFromProductCategory(
  category: { name: string; slug?: string } | null | undefined,
): CosColorFormulaCategory {
  if (!category) return 'PU'
  const name = category.name.trim()
  if (name === PU_FACTORY_PRODUCT_CATEGORY_NAME) return 'PU'
  const haystack = `${category.name} ${category.slug ?? ''}`.toLowerCase()
  if (haystack.includes('色漆')) return 'BAKING_PAINT'
  if (
    haystack.includes('baking') ||
    haystack.includes('烤漆') ||
    haystack.includes('ht') ||
    haystack.includes('lt') ||
    haystack.includes('高温') ||
    haystack.includes('低温')
  ) return 'HT_BAKING_PAINT'
  return 'PU'
}
