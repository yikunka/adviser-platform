import type { CosColorFormulaCategory } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'

export type ColorFormulaSubcategorySeed = {
  code: string
  name: string
  sortOrder: number
}

export const COLOR_FORMULA_SUBCATEGORY_SEEDS: Record<
  CosColorFormulaCategory,
  ColorFormulaSubcategorySeed[]
> = {
  PU: [
    { code: 'PU-S', name: 'PU-S（溶剂型）', sortOrder: 10 },
    { code: 'PU-W', name: 'PU-W（水性）', sortOrder: 20 },
    { code: 'PU-HighGloss', name: 'PU-HighGloss（高光）', sortOrder: 30 },
    { code: 'PU-SemiGloss', name: 'PU-SemiGloss（半光）', sortOrder: 40 },
    { code: 'PU-Matt', name: 'PU-Matt（哑光）', sortOrder: 50 },
  ],
  BAKING_PAINT: [
    { code: 'BP-Standard', name: '标准色漆', sortOrder: 10 },
    { code: 'BP-Solid', name: '实色色漆', sortOrder: 20 },
    { code: 'BP-Metallic', name: '金属色漆', sortOrder: 30 },
    { code: 'BP-Pearl', name: '珍珠色漆', sortOrder: 40 },
  ],
  HT_BAKING_PAINT: [
    { code: 'HT-Standard', name: '标准烤漆', sortOrder: 10 },
    { code: 'HT-Solid', name: '实色烤漆', sortOrder: 20 },
    { code: 'HT-Metallic', name: '金属烤漆', sortOrder: 30 },
    { code: 'HT-Pearl', name: '珍珠烤漆', sortOrder: 40 },
  ],
  LT_BAKING_PAINT: [
    { code: 'LT-Standard', name: '标准低温烤漆', sortOrder: 10 },
    { code: 'LT-Solid', name: '实色低温烤漆', sortOrder: 20 },
    { code: 'LT-Metallic', name: '金属低温烤漆', sortOrder: 30 },
    { code: 'LT-Pearl', name: '珍珠低温烤漆', sortOrder: 40 },
  ],
}

export function serializeColorFormulaSubcategory(row: {
  id: string
  parentCategory: CosColorFormulaCategory
  code: string
  name: string
  sortOrder: number
  isActive: boolean
}) {
  return {
    id: row.id,
    parentCategory: row.parentCategory,
    code: row.code,
    name: row.name,
    sortOrder: row.sortOrder,
    isActive: row.isActive,
  }
}

export async function ensureColorFormulaSubcategories() {
  for (const [parentCategory, seeds] of Object.entries(COLOR_FORMULA_SUBCATEGORY_SEEDS) as [
    CosColorFormulaCategory,
    ColorFormulaSubcategorySeed[],
  ][]) {
    for (const seed of seeds) {
      await prisma.cosTableColorFormulaSubcategory.upsert({
        where: {
          parentCategory_code: {
            parentCategory,
            code: seed.code,
          },
        },
        create: {
          parentCategory,
          code: seed.code,
          name: seed.name,
          sortOrder: seed.sortOrder,
        },
        update: {
          name: seed.name,
          sortOrder: seed.sortOrder,
          isActive: true,
        },
      })
    }
  }
}

export async function listColorFormulaSubcategories(parentCategory?: CosColorFormulaCategory) {
  await ensureColorFormulaSubcategories()
  const rows = await prisma.cosTableColorFormulaSubcategory.findMany({
    where: {
      isActive: true,
      ...(parentCategory ? { parentCategory } : {}),
    },
    orderBy: [{ parentCategory: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
  })
  return rows.map(serializeColorFormulaSubcategory)
}

export async function validateColorFormulaSubcategory(params: {
  category: CosColorFormulaCategory
  subcategoryId: string | null | undefined
}) {
  if (!params.subcategoryId) {
    return { ok: true as const, subcategoryId: null as string | null }
  }

  const subcategory = await prisma.cosTableColorFormulaSubcategory.findUnique({
    where: { id: params.subcategoryId },
  })
  if (!subcategory || !subcategory.isActive) {
    return { ok: false as const, error: '无效的子类别' }
  }
  if (subcategory.parentCategory !== params.category) {
    return { ok: false as const, error: '子类别与主类别不匹配' }
  }
  return { ok: true as const, subcategoryId: subcategory.id }
}
