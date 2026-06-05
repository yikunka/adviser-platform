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
  sprayViscosity?: number | string | null
  processBlocks?: ProcessFlowBlock[] | null
}

export type ProcessFlowBlock = {
  id: string
  text: string
}

export function normalizeProcessBlocks(value: unknown): ProcessFlowBlock[] {
  if (!Array.isArray(value)) return []
  return value
    .map((item, index) => {
      if (typeof item === 'string') {
        const text = item.trim()
        return text ? { id: `legacy-${index}`, text } : null
      }
      if (!item || typeof item !== 'object') return null
      const maybeBlock = item as { id?: unknown; text?: unknown }
      const text = typeof maybeBlock.text === 'string' ? maybeBlock.text.trim() : ''
      if (!text) return null
      const id = typeof maybeBlock.id === 'string' && maybeBlock.id.trim()
        ? maybeBlock.id.trim()
        : `block-${index}`
      return { id, text }
    })
    .filter((item): item is ProcessFlowBlock => Boolean(item))
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

export function buildProcessFlowDocument(
  products: ProcessFlowProduct[],
  globalNote?: string | null,
  processDescription?: string | null,
) {
  if (products.length === 0 && !globalNote?.trim() && !processDescription?.trim()) return ''

  const lines = ['完整工艺流程']
  if (processDescription?.trim()) lines.push(`工艺：${processDescription.trim()}`)

  products.forEach((product, index) => {
    const irMinutes = formatWithUnit(product.irMinutes, '分钟', /(分钟|分|min|m\b)/i)
    const irTemperature = formatWithUnit(product.irTemperature, '°C', /(°C|℃|\bC\b)/i)
    const uvEnergy = formatWithUnit(product.uvEnergy, 'MJ/CM²', /(MJ\/?CM²|MJ\/?CM2|mJ\/?cm²|mJ\/?cm2)/i)
    const filmThickness = formatValue(product.filmThickness)
    const sprayViscosity = formatValue(product.sprayViscosity)

    lines.push(`${index + 1}. 产品：${product.productName}`)
    if (product.hardenerProductName) {
      lines.push(`   HD Hardener固化剂：${product.hardenerProductName}`)
      if (product.hardenerRatio) lines.push(`   固化剂与主产品比例：${product.hardenerRatio}`)
    }
    if (product.thinnerProductName) {
      lines.push(`   Diluent稀释剂：${product.thinnerProductName}`)
      if (product.thinnerRatio) lines.push(`   稀释剂与主产品比例：${product.thinnerRatio}`)
    }
    if (irMinutes || irTemperature) {
      lines.push(`   IR：${irMinutes ?? '-'} / ${irTemperature ?? '-'}`)
    }
    if (uvEnergy) lines.push(`   UV能量：${uvEnergy}`)
    if (filmThickness) lines.push(`   膜厚：${filmThickness}`)
    if (sprayViscosity) lines.push(`   噴塗粘度 2#杯/25C：${sprayViscosity}`)
    if (product.notes) lines.push(`   备注：${product.notes}`)
    normalizeProcessBlocks(product.processBlocks).forEach((block, blockIndex) => {
      lines.push(`   工艺${blockIndex + 1}：${block.text}`)
    })
  })

  if (globalNote?.trim()) lines.push(`全局备注：${globalNote.trim()}`)

  return lines.join('\n')
}
