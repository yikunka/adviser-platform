export type ProcessFlowProduct = {
  productName: string
  quantityRatio?: string | null
  usageMethod: string
  notes?: string | null
  irMinutes?: number | string | null
  irTemperature?: number | string | null
  uvEnergy?: number | string | null
}

function formatValue(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === '') return null
  return String(value)
}

export function buildProcessFlowDocument(products: ProcessFlowProduct[]) {
  if (products.length === 0) return ''

  const lines = ['完整工艺流程']

  products.forEach((product, index) => {
    const irMinutes = formatValue(product.irMinutes)
    const irTemperature = formatValue(product.irTemperature)
    const uvEnergy = formatValue(product.uvEnergy)

    lines.push(`${index + 1}. 产品：${product.productName}`)
    if (product.quantityRatio) lines.push(`   用量比例：${product.quantityRatio}`)
    lines.push(`   施工步骤：${product.usageMethod}`)
    if (irMinutes || irTemperature) {
      lines.push(`   IR：${irMinutes ?? '-'} 分钟 / ${irTemperature ?? '-'} °C`)
    }
    if (uvEnergy) lines.push(`   UV能量：${uvEnergy} MJ/CM²`)
    if (product.notes) lines.push(`   备注：${product.notes}`)
  })

  return lines.join('\n')
}
