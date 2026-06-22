export type FactoryProductLabelSource = {
  productCode: string
  name: string
  unit: string
  category?: { name: string } | null
  viscosityLabel?: string | null
  viscosity?: string | null
  currentRecipe?: { code: string; name: string } | null
}

export type FactoryProductLabelDraft = {
  title: string
  productName: string
  quantity: string
  currentRecipe: string
}

export function buildFactoryProductLabelDraft(product: FactoryProductLabelSource): FactoryProductLabelDraft {
  return {
    title: product.productCode,
    productName: product.name,
    quantity: product.unit,
    currentRecipe: product.currentRecipe ? `${product.currentRecipe.code} ${product.currentRecipe.name}` : '—',
  }
}
