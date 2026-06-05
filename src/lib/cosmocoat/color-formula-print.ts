import { computeItemPercentage } from '@/lib/cosmocoat/recipes'

export type ColorFormulaPrintItem = {
  productionCode: string
  name: string
  quantity: number
  percentage: number
  notes: string
}

export function scaleColorFormulaItemsForProduction(
  items: Array<{
    productionCode: string
    name: string
    quantity: number
    notes: string
  }>,
  totalQuantity: number,
  targetKg: number,
): ColorFormulaPrintItem[] {
  if (items.length === 0) return []

  return items.map(item => {
    const percentage = computeItemPercentage(item.quantity, totalQuantity)
    const quantity = totalQuantity > 0 && targetKg > 0
      ? (item.quantity / totalQuantity) * targetKg
      : 0

    return {
      productionCode: item.productionCode,
      name: item.name,
      quantity,
      percentage,
      notes: item.notes,
    }
  })
}
