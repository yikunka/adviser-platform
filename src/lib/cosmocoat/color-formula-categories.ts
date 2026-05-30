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
