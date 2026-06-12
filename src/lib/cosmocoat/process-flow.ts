import type { Prisma } from '@prisma/client'
import {
  formatFilmThickness,
  formatIrMinutes,
  formatIrTemperature,
  formatSprayViscosity,
  formatUvEnergy,
} from '@/lib/cosmocoat/process-kit-parameters'

export type ProcessFlowBlock = {
  id: string
  text: string
}

export type ProcessFlowItemProduct = {
  id: string
  type: 'product'
  kitProductId: string
}

export type ProcessFlowItemProcess = {
  id: string
  type: 'process'
  text: string
}

export type ProcessFlowItem = ProcessFlowItemProduct | ProcessFlowItemProcess

export type ProcessFlowProduct = {
  id?: string
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
  processBlocks?: unknown
}

export function processFlowItemsForDb(items: ProcessFlowItem[]): Prisma.InputJsonValue {
  return items as unknown as Prisma.InputJsonValue
}

export function createProcessFlowItemId(prefix = 'flow') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
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

export function normalizeProcessFlowItems(value: unknown): ProcessFlowItem[] {
  if (!Array.isArray(value)) return []
  return value
    .map((item, index) => {
      if (!item || typeof item !== 'object') return null
      const raw = item as { id?: unknown; type?: unknown; kitProductId?: unknown; text?: unknown }
      const id = typeof raw.id === 'string' && raw.id.trim()
        ? raw.id.trim()
        : `flow-${index}`
      if (raw.type === 'product') {
        const kitProductId = typeof raw.kitProductId === 'string' ? raw.kitProductId.trim() : ''
        if (!kitProductId) return null
        return { id, type: 'product' as const, kitProductId }
      }
      if (raw.type === 'process') {
        const text = typeof raw.text === 'string' ? raw.text.trim() : ''
        if (!text) return null
        return { id, type: 'process' as const, text }
      }
      return null
    })
    .filter((item): item is ProcessFlowItem => Boolean(item))
}

export function deriveProcessFlowItemsFromLegacy(products: ProcessFlowProduct[]): ProcessFlowItem[] {
  const items: ProcessFlowItem[] = []
  products.forEach((product, index) => {
    const kitProductId = product.id ?? `legacy-product-${index}`
    items.push({
      id: `product-${kitProductId}`,
      type: 'product',
      kitProductId,
    })
    normalizeProcessBlocks(product.processBlocks).forEach(block => {
      items.push({
        id: block.id,
        type: 'process',
        text: block.text,
      })
    })
  })
  return items
}

export function resolveProcessFlowItems(
  stored: unknown,
  products: ProcessFlowProduct[],
): ProcessFlowItem[] {
  const normalized = normalizeProcessFlowItems(stored)
  if (normalized.length > 0) return normalized
  return deriveProcessFlowItemsFromLegacy(products)
}

export function appendProductFlowItem(
  items: ProcessFlowItem[],
  kitProductId: string,
): ProcessFlowItem[] {
  return [
    ...items,
    {
      id: createProcessFlowItemId('product'),
      type: 'product',
      kitProductId,
    },
  ]
}

export function removeProductFlowItems(
  items: ProcessFlowItem[],
  kitProductId: string,
): ProcessFlowItem[] {
  return items.filter(item => !(item.type === 'product' && item.kitProductId === kitProductId))
}

export function insertProcessFlowItemAfter(
  items: ProcessFlowItem[],
  afterItemId: string,
  text: string,
): ProcessFlowItem[] {
  const index = items.findIndex(item => item.id === afterItemId)
  const newItem: ProcessFlowItemProcess = {
    id: createProcessFlowItemId('process'),
    type: 'process',
    text: text.trim(),
  }
  if (index === -1) return [...items, newItem]
  const next = [...items]
  next.splice(index + 1, 0, newItem)
  return next
}

export function appendProcessFlowItem(
  items: ProcessFlowItem[],
  text: string,
): ProcessFlowItem[] {
  return [
    ...items,
    {
      id: createProcessFlowItemId('process'),
      type: 'process',
      text: text.trim(),
    },
  ]
}

export function updateProcessFlowItemText(
  items: ProcessFlowItem[],
  itemId: string,
  text: string,
): ProcessFlowItem[] {
  return items.map(item =>
    item.id === itemId && item.type === 'process'
      ? { ...item, text: text.trim() }
      : item,
  )
}

export function removeProcessFlowItem(
  items: ProcessFlowItem[],
  itemId: string,
): ProcessFlowItem[] {
  return items.filter(item => item.id !== itemId)
}

export function remapProcessFlowProductIds(
  items: ProcessFlowItem[],
  idMap: Map<string, string>,
): ProcessFlowItem[] {
  return items.map(item => {
    if (item.type !== 'product') return item
    const mapped = idMap.get(item.kitProductId)
    return mapped ? { ...item, kitProductId: mapped } : item
  })
}

function formatProductLines(product: ProcessFlowProduct, sequence: number): string[] {
  const irMinutes = formatIrMinutes(product.irMinutes)
  const irTemperature = formatIrTemperature(product.irTemperature)
  const uvEnergy = formatUvEnergy(product.uvEnergy)
  const filmThickness = formatFilmThickness(product.filmThickness)
  const sprayViscosity = formatSprayViscosity(product.sprayViscosity)

  const lines = [`${sequence}. 产品：${product.productName}`]
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
  return lines
}

export function buildProcessFlowDocumentFromItems(
  items: ProcessFlowItem[],
  products: ProcessFlowProduct[],
  globalNote?: string | null,
  processDescription?: string | null,
) {
  if (items.length === 0 && !globalNote?.trim() && !processDescription?.trim()) return ''

  const productsById = new Map(
    products
      .filter(product => product.id)
      .map(product => [product.id!, product]),
  )

  const lines = ['完整工艺流程']
  if (processDescription?.trim()) lines.push(`工艺：${processDescription.trim()}`)

  let sequence = 0
  items.forEach(item => {
    if (item.type === 'product') {
      const product = productsById.get(item.kitProductId)
      if (!product) return
      sequence += 1
      lines.push(...formatProductLines(product, sequence))
      return
    }
    sequence += 1
    lines.push(`${sequence}. 工艺：${item.text}`)
  })

  if (globalNote?.trim()) lines.push(`全局备注：${globalNote.trim()}`)

  return lines.join('\n')
}

/** @deprecated Use buildProcessFlowDocumentFromItems with resolveProcessFlowItems instead. */
export function buildProcessFlowDocument(
  products: ProcessFlowProduct[],
  globalNote?: string | null,
  processDescription?: string | null,
) {
  const items = deriveProcessFlowItemsFromLegacy(products)
  return buildProcessFlowDocumentFromItems(items, products, globalNote, processDescription)
}
