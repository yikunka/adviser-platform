export function formatFactoryProductDisplayName(product: {
  productCode: string
  name: string
}) {
  return `${product.productCode} · ${product.name}`
}
