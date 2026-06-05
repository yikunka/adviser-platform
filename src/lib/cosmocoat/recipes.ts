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
  rawMaterialId: string
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
}

export type ProductionRecipeItem = {
  sortOrder: number
  quantity: number
  percentage: number | null
  notes: string
  rawMaterial: {
    id: string
    productionCode: string
    name: string
  }
}

/** Keeps only raw-material lines; drops nested recipes and semifinished rows. */
export function recipeItemsForProduction(
  items: Array<Omit<RecipeItemForProduction, 'quantity' | 'percentage'> & {
    quantity: unknown
    percentage?: unknown | null
  }>,
): ProductionRecipeItem[] {
  return items.flatMap(item => {
    if (!item.rawMaterial) return []
    return [{
      sortOrder: item.sortOrder,
      quantity: Number(item.quantity),
      percentage: item.percentage != null ? Number(item.percentage) : null,
      notes: item.notes,
      rawMaterial: item.rawMaterial,
    }]
  })
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

    return {
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
  qcTestStandard: string
  qcResult: string
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
export function formatRecipeQcRequirements(testStandard: string, result: string): string {
  const parts: string[] = []
  const standard = testStandard.trim()
  const qcResult = result.trim()
  if (standard) parts.push(`测试标准:\n${standard}`)
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
    qualityCheckRequirements: formatRecipeQcRequirements(recipe.qcTestStandard, recipe.qcResult),
    packagingRequirements: recipe.packagingRequirements,
    productionNotes: recipe.productionNotes,
  }
}
