import { Prisma } from '@prisma/client'
import { z } from 'zod'

export const VISCOSITY_UNITS = ['S', 'KU'] as const
export type ViscosityUnit = (typeof VISCOSITY_UNITS)[number]

const optionalViscosityDecimal = z
  .union([z.coerce.number().min(0), z.literal(''), z.null()])
  .optional()
  .transform(value => (value === '' || value === undefined ? undefined : value))

export const viscosityFieldsSchema = {
  viscosity: optionalViscosityDecimal,
  viscosityUnit: z.enum(VISCOSITY_UNITS).nullable().optional(),
}

export function toViscosityDbData(data: {
  viscosity?: number | null
  viscosityUnit?: string | null
}) {
  if (data.viscosity == null) {
    return {
      viscosity: null,
      viscosityUnit: null,
    }
  }
  return {
    viscosity: new Prisma.Decimal(Number(data.viscosity)),
    viscosityUnit: data.viscosityUnit ?? 'S',
  }
}

/** DB row shape; use when Prisma client types lag behind schema migrations. */
export type ProductViscosityRecord = {
  viscosity?: unknown
  viscosityUnit?: string | null
}

/** CosTableProduct columns added after an outdated `prisma generate`. */
export type CosTableProductExtendedFields = ProductViscosityRecord & {
  irCuringTime?: number | null
  irCuringTemp?: number | null
  uvCuringIntensity?: unknown
  uvCuringUnit?: string | null
  requiresCompatibility?: boolean
  mixingRatio?: string | null
  compatibleProducts?: string | null
}

export function mergeViscosityPatch(
  current: ProductViscosityRecord,
  patch: {
    viscosity?: number | null
    viscosityUnit?: string | null | undefined
  },
) {
  return toViscosityDbData({
    viscosity:
      patch.viscosity !== undefined
        ? patch.viscosity
        : current.viscosity != null
          ? Number(current.viscosity)
          : null,
    viscosityUnit:
      patch.viscosityUnit !== undefined ? patch.viscosityUnit : current.viscosityUnit,
  })
}

export function serializeViscosity(value: unknown): number | null {
  return value != null ? Number(value) : null
}
