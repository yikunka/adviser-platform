import { z } from 'zod'

import { VISCOSITY_UNITS } from '@/lib/cosmocoat/product-viscosity'

export const factoryViscosityFieldsSchema = {
  viscosity: z
    .union([z.string().trim().max(120), z.literal(''), z.null()])
    .optional()
    .transform(value => (value === '' || value === undefined ? undefined : value)),
  viscosityUnit: z.enum(VISCOSITY_UNITS).nullable().optional(),
}

export function toFactoryViscosityDbData(data: {
  viscosity?: string | null
  viscosityUnit?: string | null
}) {
  const text = data.viscosity?.trim() ?? ''
  if (!text) {
    return {
      viscosity: null,
      viscosityUnit: null,
    }
  }
  return {
    viscosity: text,
    viscosityUnit: data.viscosityUnit ?? 'S',
  }
}

export type FactoryProductViscosityRecord = {
  viscosity?: string | null
  viscosityUnit?: string | null
}

export function mergeFactoryViscosityPatch(
  current: FactoryProductViscosityRecord,
  patch: {
    viscosity?: string | null
    viscosityUnit?: string | null | undefined
  },
) {
  return toFactoryViscosityDbData({
    viscosity:
      patch.viscosity !== undefined
        ? patch.viscosity
        : current.viscosity,
    viscosityUnit:
      patch.viscosityUnit !== undefined ? patch.viscosityUnit : current.viscosityUnit,
  })
}

export function serializeFactoryViscosity(
  viscosity: string | null | undefined,
  viscosityUnit: string | null | undefined,
): string | null {
  const text = viscosity?.trim() ?? ''
  if (!text) return null
  const unit = viscosityUnit?.trim()
  return unit ? `${text} ${unit}` : text
}
