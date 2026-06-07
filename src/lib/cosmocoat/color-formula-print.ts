import { computeItemPercentage } from '@/lib/cosmocoat/recipes'

export type ColorFormulaPrintItem = {
  productionCode: string
  name: string
  quantity: number
  percentage: number
  actualWeight: number | null
  notes: string
}

function scaleToTarget(value: number, totalQuantity: number, targetKg: number) {
  return totalQuantity > 0 && targetKg > 0 ? (value / totalQuantity) * targetKg : 0
}

export function scaleColorFormulaItemsForProduction(
  items: Array<{
    productionCode: string
    name: string
    quantity: number
    actualWeight?: number | null
    notes: string
  }>,
  totalQuantity: number,
  targetKg: number,
): ColorFormulaPrintItem[] {
  if (items.length === 0) return []

  return items.map(item => {
    const percentage = computeItemPercentage(item.quantity, totalQuantity)
    const quantity = scaleToTarget(item.quantity, totalQuantity, targetKg)
    const actualWeight = item.actualWeight != null
      ? scaleToTarget(item.actualWeight, totalQuantity, targetKg)
      : null

    return {
      productionCode: item.productionCode,
      name: item.name,
      quantity,
      percentage,
      actualWeight,
      notes: item.notes,
    }
  })
}
