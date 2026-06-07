import { formatSelectedRecipeQcTests } from '@/lib/cosmocoat/recipe-qc-tests'

export const MATERIAL_ATTRIBUTE_GROUPS: { code: string; label: string }[] = [
  { code: 'RS', label: '树脂&单体 RS' },
  { code: 'SO', label: '溶剂 SO' },
  { code: 'AD', label: '助剂 AD' },
  { code: 'CA', label: 'CAB CA' },
  { code: 'CO', label: '粉料 CO' },
  { code: 'HD', label: '固化剂 HD' },
  { code: 'PI', label: '色粉 PI' },
  { code: 'PB', label: '色浆 PB' },
  { code: 'PA', label: '颜料 PA' },
  { code: 'PP', label: 'PP' },
  { code: 'LA', label: '乳液 LA' },
  { code: 'EC', label: 'EC' },
  { code: 'DY', label: 'DY' },
  { code: 'CC', label: 'CC' },
  { code: 'CQ', label: 'CQ' },
  { code: 'SI', label: 'SI' },
  { code: 'ZO', label: 'ZO' },
  { code: 'SPP', label: 'SPP' },
  { code: 'SCL', label: 'SCL' },
  { code: 'SCP', label: 'SCP' },
]

export type RecipeItemInput = {
  rawMaterialId?: string
  /** Semi-finished product (another recipe) used as a component */
  recipeId?: string
  /** Sol. 半成品库存 */
  productSemifinishedId?: string
  /** 工厂成品 */
  factoryProductId?: string
  sortOrder: number
  quantity: number
  unitPrice: number | null
  notes: string
}

export function isRecipeItemInputValid(item: RecipeItemInput): boolean {
  return [
    Boolean(item.rawMaterialId),
    Boolean(item.recipeId),
    Boolean(item.productSemifinishedId),
    Boolean(item.factoryProductId),
  ].filter(Boolean).length === 1
}

export type RecipeTotals = {
  totalQuantity: number
  totalAmount: number
  unitCost: number
}

export function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

/** Common packaging requirement presets for recipe production fields. */
export const PACKAGING_REQUIREMENT_PRESETS = ['200目', '300目', '400目', '色装机'] as const

/**
 * Line amount for a recipe batch: (quantity / totalQuantity) × unitPrice × batchQuantity.
 * Quantities are treated as parts; when they sum to 100 each part is an effective percentage.
 */
export function computeItemAmount(
  quantity: number,
  unitPrice: number | null,
  totalQuantity: number,
  batchQuantity = 1,
): number {
  if (unitPrice == null || quantity <= 0 || totalQuantity <= 0 || batchQuantity <= 0) return 0
  return (quantity / totalQuantity) * unitPrice * batchQuantity
}

/** Product unit cost (per kg): Σ (quantity / totalQuantity × unitPrice). */
export function computeUnitCostFromItems(
  items: { quantity: number; unitPrice: number | null }[],
): number {
  const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0)
  if (totalQuantity <= 0) return 0
  return items.reduce((sum, item) => {
    if (item.unitPrice == null || item.quantity <= 0) return sum
    return sum + (item.quantity / totalQuantity) * item.unitPrice
  }, 0)
}

/** 物料占比 = 该物料数量 / 配方物料数量合计 × 100% */
export function computeItemPercentage(quantity: number, totalQuantity: number): number {
  if (totalQuantity <= 0 || quantity <= 0) return 0
  return (quantity / totalQuantity) * 100
}

export function computeRecipeTotals(
  items: { quantity: number; amount: number; unitPrice?: number | null }[],
  batchQuantity: number,
): RecipeTotals {
  const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0)
  const totalAmount = items.reduce((sum, item) => sum + item.amount, 0)
  const unitCost = items.some(item => item.unitPrice !== undefined)
    ? computeUnitCostFromItems(items.map(item => ({
        quantity: item.quantity,
        unitPrice: item.unitPrice ?? null,
      })))
    : (batchQuantity > 0 ? totalAmount / batchQuantity : 0)
  return { totalQuantity, totalAmount, unitCost }
}

export function normalizeRecipeItems(
  items: RecipeItemInput[],
  batchQuantity = 1,
): Array<RecipeItemInput & { amount: number; percentage: number }> {
  const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0)
  return items.map((item, index) => {
    const quantity = item.quantity
    const unitPrice = item.unitPrice
    const amount = computeItemAmount(quantity, unitPrice, totalQuantity, batchQuantity)
    return {
      ...item,
      sortOrder: item.sortOrder ?? index + 1,
      amount,
      percentage: computeItemPercentage(quantity, totalQuantity),
    }
  })
}

export function formatMoney(value: number | null | undefined, digits = 4): string {
  if (value == null || Number.isNaN(value)) return '—'
  return value.toFixed(digits)
}

export function formatPercent(value: number | null | undefined, digits = 2): string {
  if (value == null || Number.isNaN(value)) return '—'
  return `${value.toFixed(digits)}%`
}

/** 参考投料 = 生产总量 × 比例 / 100 */
export function computeRequiredWeight(totalWeight: number, percentage: number): number {
  if (totalWeight <= 0 || percentage <= 0) return 0
  return (totalWeight * percentage) / 100
}

export function formatWeight(value: number | null | undefined, digits = 2): string {
  if (value == null || Number.isNaN(value)) return '—'
  return value.toFixed(digits)
}

export type ProductionOrderItemDraft = {
  itemType: 'raw_material' | 'component_recipe' | 'product_semifinished'
  rawMaterialId?: string
  componentRecipeId?: string
  productSemifinishedId?: string
  sortOrder: number
  productionCode: string
  materialName: string
  percentage: number
  requiredWeight: number
  actualWeight: number | null
  notes: string
}

export type RecipeItemForProduction = {
  sortOrder: number
  quantity: number
  percentage: number | null
  notes: string
  rawMaterial: {
    id: string
    productionCode: string
    name: string
  } | null
  componentRecipe: {
    id: string
    code: string
    name: string
  } | null
  productSemifinished: {
    id: string
    code: string
    name: string
  } | null
}

export type ProductionRecipeItem = {
  sortOrder: number
  quantity: number
  percentage: number | null
  notes: string
  itemType: 'raw_material' | 'component_recipe' | 'product_semifinished'
  rawMaterial?: {
    id: string
    productionCode: string
    name: string
  }
  componentRecipe?: {
    id: string
    code: string
    name: string
  }
  productSemifinished?: {
    id: string
    code: string
    name: string
  }
}

/** Keeps raw-material, semi-finished recipe, and Sol. semifinished inventory lines; drops factory products. */
export function recipeItemsForProduction(
  items: Array<Omit<RecipeItemForProduction, 'quantity' | 'percentage'> & {
    quantity: unknown
    percentage?: unknown | null
    itemType?: string
    componentRecipe?: {
      id: string
      code: string
      name: string
    } | null
    productSemifinished?: {
      id: string
      code: string
      name: string
    } | null
  }>,
): ProductionRecipeItem[] {
  const result: ProductionRecipeItem[] = []
  for (const item of items) {
    if (item.rawMaterial) {
      result.push({
        sortOrder: item.sortOrder,
        quantity: Number(item.quantity),
        percentage: item.percentage != null ? Number(item.percentage) : null,
        notes: item.notes,
        itemType: 'raw_material',
        rawMaterial: item.rawMaterial,
      })
      continue
    }
    if (item.componentRecipe) {
      result.push({
        sortOrder: item.sortOrder,
        quantity: Number(item.quantity),
        percentage: item.percentage != null ? Number(item.percentage) : null,
        notes: item.notes,
        itemType: 'component_recipe',
        componentRecipe: item.componentRecipe,
      })
      continue
    }
    if (item.productSemifinished) {
      result.push({
        sortOrder: item.sortOrder,
        quantity: Number(item.quantity),
        percentage: item.percentage != null ? Number(item.percentage) : null,
        notes: item.notes,
        itemType: 'product_semifinished',
        productSemifinished: item.productSemifinished,
      })
    }
  }
  return result
}

export function productionOrderItemKey(item: Pick<ProductionOrderItemDraft, 'itemType' | 'rawMaterialId' | 'componentRecipeId' | 'productSemifinishedId'>): string {
  if (item.itemType === 'component_recipe' && item.componentRecipeId) {
    return `component-recipe:${item.componentRecipeId}`
  }
  if (item.itemType === 'product_semifinished' && item.productSemifinishedId) {
    return `semifinished:${item.productSemifinishedId}`
  }
  if (item.rawMaterialId) return `raw:${item.rawMaterialId}`
  return ''
}

export function buildProductionOrderItems(
  recipeItems: ProductionRecipeItem[],
  totalWeight: number,
  totalQuantity?: number,
): ProductionOrderItemDraft[] {
  const qtyTotal = totalQuantity ?? recipeItems.reduce((sum, item) => sum + item.quantity, 0)

  return recipeItems.map(item => {
    const percentage = item.percentage != null
      ? item.percentage
      : computeItemPercentage(item.quantity, qtyTotal)

    if (item.itemType === 'product_semifinished' && item.productSemifinished) {
      return {
        itemType: 'product_semifinished' as const,
        productSemifinishedId: item.productSemifinished.id,
        sortOrder: item.sortOrder,
        productionCode: item.productSemifinished.code,
        materialName: item.productSemifinished.name,
        percentage,
        requiredWeight: computeRequiredWeight(totalWeight, percentage),
        actualWeight: null,
        notes: item.notes,
      }
    }

    if (item.itemType === 'component_recipe' && item.componentRecipe) {
      return {
        itemType: 'component_recipe' as const,
        componentRecipeId: item.componentRecipe.id,
        sortOrder: item.sortOrder,
        productionCode: item.componentRecipe.code,
        materialName: item.componentRecipe.name,
        percentage,
        requiredWeight: computeRequiredWeight(totalWeight, percentage),
        actualWeight: null,
        notes: item.notes,
      }
    }

    if (!item.rawMaterial) {
      throw new Error('Production recipe item missing supported material source')
    }

    return {
      itemType: 'raw_material' as const,
      rawMaterialId: item.rawMaterial.id,
      sortOrder: item.sortOrder,
      productionCode: item.rawMaterial.productionCode,
      materialName: item.rawMaterial.name,
      percentage,
      requiredWeight: computeRequiredWeight(totalWeight, percentage),
      actualWeight: null,
      notes: item.notes,
    }
  })
}

export function attributeLabel(code: string): string {
  return MATERIAL_ATTRIBUTE_GROUPS.find(group => group.code === code)?.label ?? code
}

export type RecipeProductionFields = {
  productionSpeedRequirements: string
  productionTimeRequirements: string
  packagingRequirements: string
  productionNotes: string
  qcTestItems?: string[]
  qcTestStandard: string
  qcResult: string
  viscosity?: string | null
  viscosityUnit?: string | null
}

/** Formats recipe speed/time fields for production-order requirements and print output. */
export function formatProductionRequirements(speed: string, time: string): string {
  const parts: string[] = []
  const speedTrim = speed.trim()
  const timeTrim = time.trim()
  if (speedTrim) parts.push(`生产转速要求:\n${speedTrim}`)
  if (timeTrim) parts.push(`生产时间要求:\n${timeTrim}`)
  return parts.join('\n\n')
}

/** Formats recipe QC fields for production-order quality check notes. */
export function formatRecipeQcRequirements(
  testStandard: string,
  result: string,
  options?: {
    qcTestItems?: string[]
    viscosity?: string | null
    viscosityUnit?: string | null
  },
): string {
  const parts: string[] = []
  const selectedTests = formatSelectedRecipeQcTests(
    options?.qcTestItems,
    options?.viscosity,
    options?.viscosityUnit,
  )
  const customStandard = testStandard.trim()
  const standardParts = [selectedTests, customStandard].filter(Boolean).join('\n')
  const qcResult = result.trim()
  if (standardParts) parts.push(`测试标准:\n${standardParts}`)
  if (qcResult) parts.push(`结果:\n${qcResult}`)
  return parts.join('\n\n')
}

/** Maps recipe production fields to production-order snapshot columns. */
export function recipeToOrderRequirements(recipe: RecipeProductionFields) {
  return {
    productionRequirements: formatProductionRequirements(
      recipe.productionSpeedRequirements,
      recipe.productionTimeRequirements,
    ),
    qualityCheckRequirements: formatRecipeQcRequirements(recipe.qcTestStandard, recipe.qcResult, {
      qcTestItems: recipe.qcTestItems,
      viscosity: recipe.viscosity,
      viscosityUnit: recipe.viscosityUnit,
    }),
    packagingRequirements: recipe.packagingRequirements,
    productionNotes: recipe.productionNotes,
  }
}
