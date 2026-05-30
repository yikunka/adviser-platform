import type { CosColorFormulaCategory } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'
import {
  COLOR_FORMULA_CATEGORIES,
  colorFormulaCategoryLabel,
  inferCategoryFromProductCategory,
} from '@/lib/cosmocoat/color-formula-categories'

export type ColorFormulaFactoryProductOption = {
  id: string
  productCode: string
  name: string
  parentCategory: CosColorFormulaCategory
  categoryId: string | null
  categoryName: string | null
  sortOrder: number
}

export function serializeColorFormulaFactoryProductOption(product: {
  id: string
  productCode: string
  name: string
  sortOrder: number
  categoryId: string | null
  category: { id: string; name: string; slug: string } | null
}): ColorFormulaFactoryProductOption {
  return {
    id: product.id,
    productCode: product.productCode,
    name: product.name,
    parentCategory: inferCategoryFromProductCategory(product.category),
    categoryId: product.categoryId,
    categoryName: product.category?.name ?? null,
    sortOrder: product.sortOrder,
  }
}

export async function listColorFormulaFactoryProductOptions(
  parentCategory?: CosColorFormulaCategory,
) {
  const products = await prisma.cosTableFactoryProduct.findMany({
    include: {
      category: { select: { id: true, name: true, slug: true } },
    },
    orderBy: [{ sortOrder: 'asc' }, { productCode: 'asc' }],
  })

  const options = products.map(serializeColorFormulaFactoryProductOption)
  const filtered = parentCategory
    ? options.filter(item => item.parentCategory === parentCategory)
    : options

  return filtered
}

export async function listColorFormulaFactoryProductsGrouped() {
  const options = await listColorFormulaFactoryProductOptions()
  const byCategory = new Map<CosColorFormulaCategory, ColorFormulaFactoryProductOption[]>()

  for (const category of COLOR_FORMULA_CATEGORIES) {
    byCategory.set(category.value, [])
  }

  for (const option of options) {
    const list = byCategory.get(option.parentCategory) ?? []
    list.push(option)
    byCategory.set(option.parentCategory, list)
  }

  return COLOR_FORMULA_CATEGORIES.map(category => ({
    category: category.value,
    labelZh: category.labelZh,
    labelEn: category.labelEn,
    products: byCategory.get(category.value) ?? [],
  }))
}

export async function validateColorFormulaFactoryProduct(params: {
  category: CosColorFormulaCategory
  factoryProductId: string | null | undefined
}) {
  if (!params.factoryProductId) {
    return { ok: true as const, factoryProductId: null as string | null }
  }

  const product = await prisma.cosTableFactoryProduct.findUnique({
    where: { id: params.factoryProductId },
    include: { category: { select: { name: true, slug: true } } },
  })
  if (!product) {
    return { ok: false as const, error: '无效的工厂产品' }
  }

  const inferred = inferCategoryFromProductCategory(product.category)
  if (inferred !== params.category) {
    return {
      ok: false as const,
      error: `工厂产品属于「${colorFormulaCategoryLabel(inferred)}」，与所选主类别不匹配`,
    }
  }

  return { ok: true as const, factoryProductId: product.id }
}
