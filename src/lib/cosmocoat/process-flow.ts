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
  filmThickness?: number | string | null
}

function formatValue(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === '') return null
  return String(value)
}

function formatWithUnit(value: number | string | null | undefined, unit: string, unitPattern: RegExp) {
  const formatted = formatValue(value)
  if (!formatted) return null
  return unitPattern.test(formatted) ? formatted : `${formatted} ${unit}`
}

export function buildProcessFlowDocument(products: ProcessFlowProduct[], globalNote?: string | null) {
  if (products.length === 0 && !globalNote?.trim()) return ''

  const lines = ['完整工艺流程']

  products.forEach((product, index) => {
    const irMinutes = formatWithUnit(product.irMinutes, '分钟', /(分钟|分|min|m\b)/i)
    const irTemperature = formatWithUnit(product.irTemperature, '°C', /(°C|℃|\bC\b)/i)
    const uvEnergy = formatWithUnit(product.uvEnergy, 'MJ/CM²', /(MJ\/?CM²|MJ\/?CM2|mJ\/?cm²|mJ\/?cm2)/i)
    const filmThickness = formatValue(product.filmThickness)

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
      lines.push(`   IR：${irMinutes ?? '-'} / ${irTemperature ?? '-'}`)
    }
    if (uvEnergy) lines.push(`   UV能量：${uvEnergy}`)
    if (filmThickness) lines.push(`   膜厚：${filmThickness}`)
    if (product.notes) lines.push(`   备注：${product.notes}`)
  })

  if (globalNote?.trim()) lines.push(`全局备注：${globalNote.trim()}`)

  return lines.join('\n')
}
