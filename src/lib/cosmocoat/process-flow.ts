export type ProcessFlowProduct = {
  productName: string
  quantityRatio?: string | null
  usageMethod?: string | null
  hardenerProductName?: string | null
  hardenerRatio?: string | null
  thinnerProductName?: string | null
  thinnerRatio?: string | null
  notes?: string | null
  irMinutes?: number | string | null
  irTemperature?: number | string | null
  uvEnergy?: number | string | null
}

function formatValue(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === '') return null
  return String(value)
}

export function buildProcessFlowDocument(products: ProcessFlowProduct[], globalNote?: string | null) {
  if (products.length === 0 && !globalNote?.trim()) return ''

  const lines = ['完整工艺流程']

  products.forEach((product, index) => {
    const irMinutes = formatValue(product.irMinutes)
    const irTemperature = formatValue(product.irTemperature)
    const uvEnergy = formatValue(product.uvEnergy)

    lines.push(`${index + 1}. 产品：${product.productName}`)
    if (product.hardenerProductName) {
      lines.push(`   HD Hardener固化剂：${product.hardenerProductName}`)
      if (product.hardenerRatio) lines.push(`   固化剂与主产品比例：${product.hardenerRatio}`)
    }
    if (product.thinnerProductName) {
      lines.push(`   Durant稀释剂：${product.thinnerProductName}`)
      if (product.thinnerRatio) lines.push(`   稀释剂与主产品比例：${product.thinnerRatio}`)
    }
    if (irMinutes || irTemperature) {
      lines.push(`   IR：${irMinutes ?? '-'} 分钟 / ${irTemperature ?? '-'} °C`)
    }
    if (uvEnergy) lines.push(`   UV能量：${uvEnergy} MJ/CM²`)
    if (product.notes) lines.push(`   备注：${product.notes}`)
  })

  if (globalNote?.trim()) lines.push(`全局备注：${globalNote.trim()}`)

  return lines.join('\n')
}
