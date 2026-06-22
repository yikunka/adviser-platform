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
  category: string
  unit: string
  viscosity: string
  currentRecipe: string
}

export function buildFactoryProductLabelDraft(product: FactoryProductLabelSource): FactoryProductLabelDraft {
  return {
    title: product.productCode,
    productName: product.name,
    category: product.category?.name ?? '—',
    unit: product.unit,
    viscosity: product.viscosityLabel ?? product.viscosity ?? '—',
    currentRecipe: product.currentRecipe ? `${product.currentRecipe.code} ${product.currentRecipe.name}` : '—',
  }
}
