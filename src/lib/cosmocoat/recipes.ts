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
  rawMaterialId: string
  sortOrder: number
  quantity: number
  unitPrice: number | null
  notes: string
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

export function computeItemAmount(quantity: number, unitPrice: number | null): number {
  if (unitPrice == null) return 0
  return quantity * unitPrice
}

/** 物料占比 = 该物料数量 / 配方物料数量合计 × 100% */
export function computeItemPercentage(quantity: number, totalQuantity: number): number {
  if (totalQuantity <= 0 || quantity <= 0) return 0
  return (quantity / totalQuantity) * 100
}

export function computeRecipeTotals(
  items: { quantity: number; amount: number }[],
  batchQuantity: number,
): RecipeTotals {
  const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0)
  const totalAmount = items.reduce((sum, item) => sum + item.amount, 0)
  const unitCost = batchQuantity > 0 ? totalAmount / batchQuantity : 0
  return { totalQuantity, totalAmount, unitCost }
}

export function normalizeRecipeItems(items: RecipeItemInput[]): Array<RecipeItemInput & { amount: number; percentage: number }> {
  const withAmount = items.map((item, index) => {
    const quantity = item.quantity
    const unitPrice = item.unitPrice
    const amount = computeItemAmount(quantity, unitPrice)
    return {
      ...item,
      sortOrder: item.sortOrder ?? index + 1,
      amount,
    }
  })
  const totalQuantity = withAmount.reduce((sum, item) => sum + item.quantity, 0)
  return withAmount.map(item => ({
    ...item,
    percentage: computeItemPercentage(item.quantity, totalQuantity),
  }))
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

export function buildProductionOrderItems(
  recipeItems: Array<{
    sortOrder: number
    quantity: number
    percentage: number | null
    notes: string
    rawMaterial: {
      id: string
      productionCode: string
      name: string
    }
  }>,
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
