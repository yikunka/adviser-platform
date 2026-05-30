import type { CosColorFormulaCategory } from '@prisma/client'

export const COLOR_FORMULA_CATEGORIES: {
  value: CosColorFormulaCategory
  labelZh: string
  labelEn: string
}[] = [
  { value: 'PU', labelZh: 'PU', labelEn: 'PU' },
  { value: 'BAKING_PAINT', labelZh: '烤漆', labelEn: 'Baking Paint' },
  { value: 'HT_BAKING_PAINT', labelZh: '高温烤漆', labelEn: 'HT Baking Paint' },
  { value: 'LT_BAKING_PAINT', labelZh: '低温烤漆', labelEn: 'LT Baking Paint' },
]

export function colorFormulaCategoryLabel(
  category: CosColorFormulaCategory,
  locale: 'zh' | 'en' = 'zh',
): string {
  const row = COLOR_FORMULA_CATEGORIES.find(c => c.value === category)
  if (!row) return category
  return locale === 'en' ? row.labelEn : row.labelZh
}

export function isColorFormulaCategory(value: string): value is CosColorFormulaCategory {
  return COLOR_FORMULA_CATEGORIES.some(c => c.value === value)
}

export function formatColorFormulaCategoryLabel(
  categoryLabel: string,
  suffix: { name: string } | null | undefined,
) {
  if (!suffix) return categoryLabel
  return `${categoryLabel} · ${suffix.name}`
}

/** Infer color formula category from factory product category slug/name. */
export function inferCategoryFromProductCategory(
  category: { name: string; slug: string } | null | undefined,
): CosColorFormulaCategory {
  if (!category) return 'PU'
  const haystack = `${category.name} ${category.slug}`.toLowerCase()
  if (haystack.includes('ht') || haystack.includes('高温')) return 'HT_BAKING_PAINT'
  if (haystack.includes('lt') || haystack.includes('低温')) return 'LT_BAKING_PAINT'
  if (haystack.includes('baking') || haystack.includes('烤漆')) return 'BAKING_PAINT'
  if (haystack.includes('pu')) return 'PU'
  return 'PU'
}
