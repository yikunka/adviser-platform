type ProductionOrderItemDisplaySource = {
  itemType?: 'raw_material' | 'component_recipe' | 'product_semifinished'
  productionCode: string
  materialName: string
  componentRecipe?: { id: string; code?: string; name: string } | null
  productSemifinished?: { id: string; code?: string; name: string } | null
}

export function productionOrderItemDisplayCode(item: ProductionOrderItemDisplaySource) {
  if (item.componentRecipe) return item.componentRecipe.name || item.materialName || item.productionCode
  if (item.productSemifinished) return item.productSemifinished.name || item.materialName || item.productionCode
  if (item.itemType === 'component_recipe' || item.itemType === 'product_semifinished') {
    return item.materialName || item.productionCode
  }
  return item.productionCode
}
