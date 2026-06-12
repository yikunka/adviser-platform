const SEMIFINISHED_TYPE_KEYS = new Set(['sol', 'sol.', 'product_semifinished'])

export function isSemifinishedMaterialType(type: string) {
  return SEMIFINISHED_TYPE_KEYS.has(type.trim().toLowerCase())
}

export function resolveColorFormulaMaterialOptionSources(types: readonly string[]) {
  const normalizedTypes = types.map(type => type.trim()).filter(Boolean)
  const rawTypes = normalizedTypes.filter(type => !isSemifinishedMaterialType(type))
  const hasExplicitTypes = normalizedTypes.length > 0

  return {
    rawTypes,
    includeRawMaterials: !hasExplicitTypes || rawTypes.length > 0,
    includeSemifinished: !hasExplicitTypes || normalizedTypes.some(isSemifinishedMaterialType),
  }
}
