import type { CosColorFormulaCategory, Prisma } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'
import {
  colorFormulaCategoryLabel,
  formatColorFormulaCategoryLabel,
  inferCategoryFromProductCategory,
} from '@/lib/cosmocoat/color-formula-categories'

export { inferCategoryFromProductCategory }
import { computeItemAmount, computeRecipeTotals, normalizeRecipeItems, type RecipeItemInput } from '@/lib/cosmocoat/recipes'

export type ColorFormulaItemInput = {
  rawMaterialId?: string | null
  productSemifinishedId?: string | null
  productionCode?: string
  name?: string
  attributeCode?: string
  sortOrder: number
  quantity: number
  actualWeight?: number | null
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
  productSemifinished: {
    select: {
      id: true,
      code: true,
      name: true,
      category: true,
      unitPrice: true,
    },
  },
} as const

const sampleOrderLineInclude = {
  orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  include: {
    sampleOrder: {
      select: {
        id: true,
        code: true,
        status: true,
        sampleKind: true,
        customer: { select: { id: true, code: true, name: true } },
        salesEmployee: {
          select: {
            id: true,
            code: true,
            name: true,
            employeeType: true,
            position: true,
            department: true,
            phone: true,
            isActive: true,
          },
        },
        technicalEmployee: {
          select: {
            id: true,
            code: true,
            name: true,
            employeeType: true,
            position: true,
            department: true,
            phone: true,
            isActive: true,
          },
        },
      },
    },
  },
} satisfies Prisma.CosTableColorFormula$sampleOrderLinesArgs

const formulaInclude = {
  subcategory: {
    select: { id: true, parentCategory: true, code: true, name: true },
  },
  factoryProduct: {
    select: {
      id: true,
      productCode: true,
      name: true,
      category: { select: { id: true, name: true, slug: true } },
    },
  },
  sourceRecipe: { select: { id: true, code: true, name: true } },
  customer: { select: { id: true, code: true, name: true, phone: true } },
  technicalOwner: {
    select: {
      id: true,
      code: true,
      name: true,
      employeeType: true,
      position: true,
      department: true,
      phone: true,
      isActive: true,
    },
  },
  sampleOrderLines: sampleOrderLineInclude,
  items: { orderBy: { sortOrder: 'asc' as const }, include: itemInclude },
} as const

export type ColorFormulaSampleOrderLineInput = {
  sampleOrderId: string
  quantityKg: number
  sortOrder: number
  notes: string
}

function serializeItem(item: {
  id: string
  sortOrder: number
  quantity: unknown
  actualWeight?: unknown
  unitPrice: unknown
  amount: unknown
  percentage: unknown
  notes: string
  rawMaterialId: string | null
  productSemifinishedId: string | null
  manualProductionCode: string
  manualName: string
  manualAttributeCode: string
  rawMaterial: {
    id: string
    productionCode: string
    name: string
    attributeCode: string
    category: string
    primaryPackageKg: unknown
    primaryPricePerKg: unknown
    primaryNotes: string
  } | null
  productSemifinished: {
    id: string
    code: string
    name: string
    category: string
    unitPrice: unknown
  } | null
}) {
  const itemType = item.rawMaterial
    ? 'raw_material'
    : item.productSemifinished
      ? 'product_semifinished'
      : 'manual'

  return {
    id: item.id,
    sortOrder: item.sortOrder,
    rawMaterialId: item.rawMaterialId,
    productSemifinishedId: item.productSemifinishedId,
    itemType,
    productionCode:
      item.rawMaterial?.productionCode ??
      item.productSemifinished?.code ??
      item.manualProductionCode,
    name:
      item.rawMaterial?.name ??
      item.productSemifinished?.name ??
      item.manualName,
    attributeCode:
      item.rawMaterial?.attributeCode ??
      item.productSemifinished?.category ??
      item.manualAttributeCode,
    manualProductionCode: item.manualProductionCode,
    manualName: item.manualName,
    manualAttributeCode: item.manualAttributeCode,
    quantity: Number(item.quantity),
    actualWeight: item.actualWeight != null ? Number(item.actualWeight) : null,
    unitPrice: item.unitPrice != null ? Number(item.unitPrice) : null,
    amount: item.amount != null ? Number(item.amount) : null,
    percentage: item.percentage != null ? Number(item.percentage) : null,
    notes: item.notes,
    rawMaterial: item.rawMaterial
      ? {
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
        }
      : null,
    productSemifinished: item.productSemifinished
      ? {
          id: item.productSemifinished.id,
          code: item.productSemifinished.code,
          name: item.productSemifinished.name,
          category: item.productSemifinished.category,
          unitPrice: item.productSemifinished.unitPrice != null
            ? Number(item.productSemifinished.unitPrice)
            : null,
        }
      : null,
  }
}

export function serializeColorFormula(formula: {
  id: string
  code: string
  name: string
  category: CosColorFormulaCategory
  subcategoryId?: string | null
  factoryProductId: string | null
  sourceRecipeId: string | null
  colorCode: string
  customerId?: string | null
  customerName: string
  technicalOwnerId?: string | null
  targetColor: string
  batchQuantity: unknown
  notes: string
  createdAt: Date
  updatedAt: Date
  subcategory?: {
    id: string
    parentCategory: CosColorFormulaCategory
    code: string
    name: string
  } | null
  factoryProduct?: {
    id: string
    productCode: string
    name: string
    category: { id: string; name: string; slug: string } | null
  } | null
  sourceRecipe?: { id: string; code: string; name: string } | null
  customer?: { id: string; code: string; name: string; phone: string | null } | null
  technicalOwner?: {
    id: string
    code: string
    name: string
    employeeType: string
    position: string | null
    department: string | null
    phone: string | null
    isActive: boolean
  } | null
  sampleOrderLines?: Array<{
    id: string
    sampleOrderId: string
    quantityKg: unknown
    sortOrder: number
    notes: string
    sampleOrder: {
      id: string
      code: string
      status: string
      sampleKind: string
      customer: { id: string; code: string; name: string }
      salesEmployee: {
        id: string
        code: string
        name: string
        employeeType: string
        position: string | null
        department: string | null
        phone: string | null
        isActive: boolean
      } | null
      technicalEmployee: {
        id: string
        code: string
        name: string
        employeeType: string
        position: string | null
        department: string | null
        phone: string | null
        isActive: boolean
      } | null
    }
  }>
  items?: Array<Parameters<typeof serializeItem>[0]>
  _count?: { items: number }
}) {
  const items = formula.items?.map(serializeItem) ?? []
  const sampleOrders = formula.sampleOrderLines?.map(line => ({
    id: line.id,
    sampleOrderId: line.sampleOrderId,
    quantityKg: Number(line.quantityKg),
    sortOrder: line.sortOrder,
    notes: line.notes,
    sampleOrder: {
      id: line.sampleOrder.id,
      code: line.sampleOrder.code,
      status: line.sampleOrder.status,
      sampleKind: line.sampleOrder.sampleKind,
      customer: line.sampleOrder.customer,
      salesEmployee: line.sampleOrder.salesEmployee,
      technicalEmployee: line.sampleOrder.technicalEmployee,
    },
  })) ?? []
  const batchQuantity = Number(formula.batchQuantity)
  const totalQuantity = items.reduce((sum, i) => sum + i.quantity, 0)
  const totals = computeRecipeTotals(
    items.map(i => ({
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      amount: computeItemAmount(i.quantity, i.unitPrice, totalQuantity, batchQuantity),
    })),
    batchQuantity,
  )
  const baseCategoryLabel = colorFormulaCategoryLabel(formula.category)
  const factoryProductSuffix = formula.factoryProduct
    ? { name: `${formula.factoryProduct.productCode} · ${formula.factoryProduct.name}` }
    : null
  const legacySubcategorySuffix = !formula.factoryProduct && formula.subcategory
    ? { name: formula.subcategory.name }
    : null
  const categoryLabel = factoryProductSuffix
    ? formatColorFormulaCategoryLabel(baseCategoryLabel, factoryProductSuffix)
    : formatColorFormulaCategoryLabel(baseCategoryLabel, legacySubcategorySuffix)

  return {
    id: formula.id,
    code: formula.code,
    name: formula.name,
    category: formula.category,
    subcategoryId: formula.subcategoryId ?? formula.subcategory?.id ?? null,
    categoryLabel,
    subcategory: formula.subcategory
      ? {
          id: formula.subcategory.id,
          parentCategory: formula.subcategory.parentCategory,
          code: formula.subcategory.code,
          name: formula.subcategory.name,
        }
      : null,
    factoryProductId: formula.factoryProductId,
    sourceRecipeId: formula.sourceRecipeId,
    colorCode: formula.colorCode,
    customerId: formula.customerId ?? formula.customer?.id ?? null,
    customerName: formula.customer?.name ?? formula.customerName,
    technicalOwnerId: formula.technicalOwnerId ?? formula.technicalOwner?.id ?? null,
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
    customer: formula.customer ?? null,
    technicalOwner: formula.technicalOwner ?? null,
    sampleOrders,
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

export async function saveColorFormulaItems(
  formulaId: string,
  items: ColorFormulaItemInput[],
  batchQuantity = 1,
) {
  const normalized = normalizeRecipeItems(
    items.map((item, index) => ({
      rawMaterialId: item.rawMaterialId || undefined,
      productSemifinishedId: item.productSemifinishedId || undefined,
      sortOrder: item.sortOrder ?? index + 1,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      notes: item.notes,
    })) as RecipeItemInput[],
    batchQuantity,
  )

  await prisma.cosTableColorFormulaItem.deleteMany({ where: { formulaId } })
  if (normalized.length > 0) {
    await prisma.cosTableColorFormulaItem.createMany({
      data: normalized.map((item, index) => {
        const source = items[index]
        return {
        formulaId,
        rawMaterialId: item.rawMaterialId || null,
        productSemifinishedId: item.productSemifinishedId || null,
        manualProductionCode: source.productionCode?.trim() ?? '',
        manualName: source.name?.trim() ?? '',
        manualAttributeCode: source.attributeCode?.trim() ?? '',
        sortOrder: item.sortOrder,
        quantity: item.quantity,
        actualWeight: source.actualWeight ?? null,
        unitPrice: item.unitPrice,
        amount: item.amount,
        percentage: item.percentage,
        notes: item.notes,
        }
      }),
    })
  }
  return normalized
}

export async function saveColorFormulaSampleOrders(
  formulaId: string,
  sampleOrders: ColorFormulaSampleOrderLineInput[],
) {
  await prisma.cosSampleOrderColorFormula.deleteMany({ where: { colorFormulaId: formulaId } })
  if (sampleOrders.length > 0) {
    await prisma.cosSampleOrderColorFormula.createMany({
      data: sampleOrders.map((line, index) => ({
        sampleOrderId: line.sampleOrderId,
        colorFormulaId: formulaId,
        quantityKg: line.quantityKg,
        sortOrder: line.sortOrder ?? index,
        notes: line.notes,
      })),
    })
  }
}

export async function enrichColorFormulaItemsFromRawMaterials(
  items: ColorFormulaItemInput[],
): Promise<ColorFormulaItemInput[]> {
  const rawIds = [...new Set(items.map(i => i.rawMaterialId).filter(Boolean))] as string[]
  const semifinishedIds = [...new Set(items.map(i => i.productSemifinishedId).filter(Boolean))] as string[]
  if (rawIds.length === 0 && semifinishedIds.length === 0) return items

  const [materials, semifinishedProducts] = await Promise.all([
    rawIds.length > 0
      ? prisma.cosTableRawMaterial.findMany({
          where: { id: { in: rawIds } },
          select: { id: true, primaryPricePerKg: true },
        })
      : [],
    semifinishedIds.length > 0
      ? prisma.cosTableProductSemifinished.findMany({
          where: { id: { in: semifinishedIds } },
          select: { id: true, unitPrice: true },
        })
      : [],
  ])
  const priceMap = new Map(materials.map(m => [m.id, m.primaryPricePerKg]))
  const semifinishedPriceMap = new Map(semifinishedProducts.map(m => [m.id, m.unitPrice]))

  return items.map(item => ({
    ...item,
    unitPrice:
      item.unitPrice ??
      (item.rawMaterialId && priceMap.get(item.rawMaterialId) != null
        ? Number(priceMap.get(item.rawMaterialId))
        : item.productSemifinishedId && semifinishedPriceMap.get(item.productSemifinishedId) != null
          ? Number(semifinishedPriceMap.get(item.productSemifinishedId))
          : null),
  }))
}

export function buildColorFormulaListWhere(params: {
  q?: string
  category?: CosColorFormulaCategory
  factoryProductId?: string
  customerId?: string
  /** @deprecated Legacy static subcategory filter */
  subcategoryId?: string
}): Prisma.CosTableColorFormulaWhereInput {
  const q = params.q?.trim()
  return {
    ...(params.factoryProductId
      ? { factoryProductId: params.factoryProductId }
      : params.subcategoryId
        ? { subcategoryId: params.subcategoryId }
        : params.category
          ? { category: params.category }
          : {}),
    ...(params.customerId ? { customerId: params.customerId } : {}),
    ...(q
      ? {
          OR: [
            { code: { contains: q, mode: 'insensitive' } },
            { name: { contains: q, mode: 'insensitive' } },
            { colorCode: { contains: q, mode: 'insensitive' } },
            { customerName: { contains: q, mode: 'insensitive' } },
            { customer: { is: { code: { contains: q, mode: 'insensitive' } } } },
            { customer: { is: { name: { contains: q, mode: 'insensitive' } } } },
            { technicalOwner: { is: { code: { contains: q, mode: 'insensitive' } } } },
            { technicalOwner: { is: { name: { contains: q, mode: 'insensitive' } } } },
            { targetColor: { contains: q, mode: 'insensitive' } },
            { notes: { contains: q, mode: 'insensitive' } },
          ],
        }
      : {}),
  }
}
