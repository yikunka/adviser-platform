export const PROCESS_KIT_MATERIALS = [
  { id: 'ABS', label: 'ABS' },
  { id: 'SAN', label: 'SAN' },
  { id: 'PC', label: 'PC' },
  { id: 'PC_BF', label: 'PC+ 玻纖' },
  { id: 'PP', label: 'PP' },
  { id: 'PETG', label: 'PETG' },
  { id: 'PET', label: 'PET' },
  { id: 'PCTA', label: 'PCTA' },
  { id: 'PS', label: 'PS' },
  { id: 'PE', label: 'PE' },
  { id: 'PMMA', label: 'PMMA' },
  { id: 'NYLON', label: '尼龍' },
  { id: 'ALUMINUM', label: '鋁合金' },
  { id: 'ZINC', label: '鋅合金' },
  { id: 'STAINLESS_302', label: '302' },
  { id: 'STAINLESS_304', label: '304' },
  { id: 'COPPER', label: '銅' },
  { id: 'GLASS', label: '玻璃' },
  { id: 'OTHER', label: '其他 (需註明)' },
] as const

const MATERIAL_LABEL_BY_ID = new Map(PROCESS_KIT_MATERIALS.map(material => [material.id, material.label]))

export function formatProcessKitMaterialLabel(id: string): string {
  return MATERIAL_LABEL_BY_ID.get(id as (typeof PROCESS_KIT_MATERIALS)[number]['id']) ?? id
}

export function formatProcessKitMaterialsSummary(
  materialIds: readonly string[],
  otherNote?: string | null,
): string | null {
  const labels = materialIds
    .filter(id => id !== 'OTHER')
    .map(formatProcessKitMaterialLabel)

  if (materialIds.includes('OTHER')) {
    labels.push(otherNote?.trim() ? `其他（${otherNote.trim()}）` : '其他')
  }

  return labels.length > 0 ? labels.join('、') : null
}

export function formatProcessKitProductsSummary(
  products: readonly { productName: string }[],
): string | null {
  const names = [...new Set(products.map(product => product.productName.trim()).filter(Boolean))]
  return names.length > 0 ? names.join('、') : null
}
