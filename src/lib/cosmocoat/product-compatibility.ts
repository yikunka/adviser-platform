import { z } from 'zod'

const optionalCompatibilityString = z
  .union([z.string(), z.literal(''), z.null()])
  .optional()
  .transform(value => (value === '' || value === undefined ? undefined : value))

export const compatibilityFieldsSchema = {
  requiresCompatibility: z.boolean().optional().default(false),
  mixingRatio: optionalCompatibilityString,
  compatibleProducts: optionalCompatibilityString,
}

export function parseCompatibleProductCodes(value: string | null | undefined): string[] {
  if (!value?.trim()) return []
  return value
    .split(/[\n,]+/)
    .map(code => code.trim())
    .filter(Boolean)
}

export function countCompatibleProducts(value: string | null | undefined): number {
  return parseCompatibleProductCodes(value).length
}

/** Normalize multiline or comma-separated input to stored comma-separated list. */
export function normalizeCompatibleProducts(value?: string | null): string | null {
  const codes = parseCompatibleProductCodes(value)
  if (codes.length === 0) return null
  return codes.join(', ')
}

/** Format stored value for multiline textarea editing. */
export function compatibleProductsToTextarea(value: string | null | undefined): string {
  return parseCompatibleProductCodes(value).join('\n')
}

export function toCompatibilityDbData(data: {
  requiresCompatibility?: boolean
  mixingRatio?: string | null
  compatibleProducts?: string | null
}) {
  if (!data.requiresCompatibility) {
    return {
      requiresCompatibility: false,
      mixingRatio: null,
      compatibleProducts: null,
    }
  }

  return {
    requiresCompatibility: true,
    mixingRatio: data.mixingRatio?.trim() || null,
    compatibleProducts: normalizeCompatibleProducts(data.compatibleProducts),
  }
}
