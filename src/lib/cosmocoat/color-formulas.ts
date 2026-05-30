import type { CosColorFormulaCategory, Prisma } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'
import { generateColorFormulaCode } from '@/lib/cosmocoat/color-formula-code'
import { colorFormulaCategoryLabel } from '@/lib/cosmocoat/color-formula-categories'
import { computeRecipeTotals, normalizeRecipeItems, type RecipeItemInput } from '@/lib/cosmocoat/recipes'

export type ColorFormulaItemInput = {
  rawMaterialId: string
  sortOrder: number
  quantity: number
  unitPrice: number | null
  notes: string
}

const itemInclude = {
  rawMaterial: {
    select: {
      id: true,
      productionCode: true,
      name: true,
      attributeCode: true,
      category: true,
      primaryPackageKg: true,
      primaryPricePerKg: true,
      primaryNotes: true,
    },
  },
} as const

const formulaInclude = {
  factoryProduct: {
    select: {
      id: true,
      productCode: true,
      name: true,
      category: { select: { id: true, name: true, slug: true } },
    },
  },
  sourceRecipe: { select: { id: true, code: true, name: true } },
  items: { orderBy: { sortOrder: 'asc' as const }, include: itemInclude },
} as const

function serializeItem(item: {
  id: string
  sortOrder: number
  quantity: unknown
  unitPrice: unknown
  amount: unknown
  percentage: unknown
  notes: string
  rawMaterialId: string
  rawMaterial: {
    id: string
    productionCode: string
    name: string
    attributeCode: string
    category: string
    primaryPackageKg: unknown
    primaryPricePerKg: unknown
    primaryNotes: string
  }
}) {
  return {
    id: item.id,
    sortOrder: item.sortOrder,
    rawMaterialId: item.rawMaterialId,
    quantity: Number(item.quantity),
    unitPrice: item.unitPrice != null ? Number(item.unitPrice) : null,
    amount: item.amount != null ? Number(item.amount) : null,
    percentage: item.percentage != null ? Number(item.percentage) : null,
    notes: item.notes,
    rawMaterial: {
      id: item.rawMaterial.id,
      productionCode: item.rawMaterial.productionCode,
      name: item.rawMaterial.name,
      attributeCode: item.rawMaterial.attributeCode,
      category: item.rawMaterial.category,
      primaryPackageKg:
        item.rawMaterial.primaryPackageKg != null ? Number(item.rawMaterial.primaryPackageKg) : null,
      primaryPricePerKg:
        item.rawMaterial.primaryPricePerKg != null ? Number(item.rawMaterial.primaryPricePerKg) : null,
      primaryNotes: item.rawMaterial.primaryNotes,
    },
  }
}

export function serializeColorFormula(formula: {
  id: string
  code: string
  name: string
  category: CosColorFormulaCategory
  factoryProductId: string | null
  sourceRecipeId: string | null
  colorCode: string
  customerName: string
  targetColor: string
  batchQuantity: unknown
  notes: string
  createdAt: Date
  updatedAt: Date
  factoryProduct?: {
    id: string
    productCode: string
    name: string
    category: { id: string; name: string; slug: string } | null
  } | null
  sourceRecipe?: { id: string; code: string; name: string } | null
  items?: Array<Parameters<typeof serializeItem>[0]>
  _count?: { items: number }
}) {
  const items = formula.items?.map(serializeItem) ?? []
  const totals = computeRecipeTotals(
    items.map(i => ({ quantity: i.quantity, amount: i.amount ?? 0 })),
    Number(formula.batchQuantity),
  )

  return {
    id: formula.id,
    code: formula.code,
    name: formula.name,
    category: formula.category,
    categoryLabel: colorFormulaCategoryLabel(formula.category),
    factoryProductId: formula.factoryProductId,
    sourceRecipeId: formula.sourceRecipeId,
    colorCode: formula.colorCode,
    customerName: formula.customerName,
    targetColor: formula.targetColor,
    batchQuantity: Number(formula.batchQuantity),
    notes: formula.notes,
    createdAt: formula.createdAt.toISOString(),
    updatedAt: formula.updatedAt.toISOString(),
    itemCount: formula._count?.items ?? items.length,
    unitCost: totals.unitCost,
    totalQuantity: totals.totalQuantity,
    totalAmount: totals.totalAmount,
    factoryProduct: formula.factoryProduct ?? null,
    sourceRecipe: formula.sourceRecipe ?? null,
    items,
  }
}

export type FullColorFormula = ReturnType<typeof serializeColorFormula>

export async function getColorFormulaById(id: string) {
  const formula = await prisma.cosTableColorFormula.findUnique({
    where: { id },
    include: formulaInclude,
  })
  return formula ? serializeColorFormula(formula) : null
}

export async function saveColorFormulaItems(formulaId: string, items: ColorFormulaItemInput[]) {
  const normalized = normalizeRecipeItems(
    items.map((item, index) => ({
      rawMaterialId: item.rawMaterialId,
      sortOrder: item.sortOrder ?? index + 1,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      notes: item.notes,
    })) as RecipeItemInput[],
  )

  await prisma.cosTableColorFormulaItem.deleteMany({ where: { formulaId } })
  if (normalized.length > 0) {
    await prisma.cosTableColorFormulaItem.createMany({
      data: normalized.map(item => ({
        formulaId,
        rawMaterialId: item.rawMaterialId!,
        sortOrder: item.sortOrder,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        amount: item.amount,
        percentage: item.percentage,
        notes: item.notes,
      })),
    })
  }
  return normalized
}

export async function enrichColorFormulaItemsFromRawMaterials(
  items: ColorFormulaItemInput[],
): Promise<ColorFormulaItemInput[]> {
  const ids = [...new Set(items.map(i => i.rawMaterialId).filter(Boolean))]
  if (ids.length === 0) return items

  const materials = await prisma.cosTableRawMaterial.findMany({
    where: { id: { in: ids } },
    select: { id: true, primaryPricePerKg: true },
  })
  const priceMap = new Map(materials.map(m => [m.id, m.primaryPricePerKg]))

  return items.map(item => ({
    ...item,
    unitPrice:
      item.unitPrice ??
      (priceMap.get(item.rawMaterialId) != null ? Number(priceMap.get(item.rawMaterialId)) : null),
  }))
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

export async function generateColorFormulaFromProduct(params: {
  factoryProductId: string
  category?: CosColorFormulaCategory
  name?: string
  batchQuantity?: number
}) {
  const product = await prisma.cosTableFactoryProduct.findUnique({
    where: { id: params.factoryProductId },
    include: {
      category: { select: { id: true, name: true, slug: true } },
      currentRecipe: {
        include: {
          items: {
            orderBy: { sortOrder: 'asc' },
            include: {
              rawMaterial: {
                select: {
                  id: true,
                  primaryPricePerKg: true,
                },
              },
            },
          },
        },
      },
    },
  })

  if (!product) {
    return { ok: false as const, error: '产品不存在' }
  }
  if (!product.currentRecipe) {
    return { ok: false as const, error: '该产品尚未设定当前配方，无法生成调色配方' }
  }

  const rawItems = product.currentRecipe.items.filter(item => item.rawMaterialId && item.rawMaterial)
  if (rawItems.length === 0) {
    return { ok: false as const, error: '当前配方中没有原料行，无法生成调色配方' }
  }

  const category = params.category ?? inferCategoryFromProductCategory(product.category)
  const code = await generateColorFormulaCode()
  const name =
    params.name?.trim() ||
    `${product.name} 调色配方`
  const batchQuantity = params.batchQuantity ?? Number(product.currentRecipe.batchQuantity)

  const itemInputs: ColorFormulaItemInput[] = rawItems.map((item, index) => ({
    rawMaterialId: item.rawMaterialId!,
    sortOrder: item.sortOrder || index + 1,
    quantity: Number(item.quantity),
    unitPrice:
      item.unitPrice != null
        ? Number(item.unitPrice)
        : item.rawMaterial?.primaryPricePerKg != null
          ? Number(item.rawMaterial.primaryPricePerKg)
          : null,
    notes: item.notes,
  }))

  const enriched = await enrichColorFormulaItemsFromRawMaterials(itemInputs)
  const normalized = normalizeRecipeItems(
    enriched.map(i => ({
      rawMaterialId: i.rawMaterialId,
      sortOrder: i.sortOrder,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      notes: i.notes,
    })) as RecipeItemInput[],
  )
  const formula = await prisma.cosTableColorFormula.create({
    data: {
      code,
      name,
      category,
      factoryProductId: product.id,
      sourceRecipeId: product.currentRecipe.id,
      batchQuantity,
      notes: `由产品 ${product.productCode} 当前配方 ${product.currentRecipe.code} 生成`,
    },
  })

  await prisma.cosTableColorFormulaItem.createMany({
    data: normalized.map(item => ({
      formulaId: formula.id,
      rawMaterialId: item.rawMaterialId!,
      sortOrder: item.sortOrder,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      amount: item.amount,
      percentage: item.percentage,
      notes: item.notes,
    })),
  })

  const full = await getColorFormulaById(formula.id)
  return { ok: true as const, formula: full! }
}

export function buildColorFormulaListWhere(params: {
  q?: string
  category?: CosColorFormulaCategory
}): Prisma.CosTableColorFormulaWhereInput {
  const q = params.q?.trim()
  return {
    ...(params.category ? { category: params.category } : {}),
    ...(q
      ? {
          OR: [
            { code: { contains: q, mode: 'insensitive' } },
            { name: { contains: q, mode: 'insensitive' } },
            { colorCode: { contains: q, mode: 'insensitive' } },
            { customerName: { contains: q, mode: 'insensitive' } },
            { targetColor: { contains: q, mode: 'insensitive' } },
            { notes: { contains: q, mode: 'insensitive' } },
          ],
        }
      : {}),
  }
}
