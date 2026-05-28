import { Prisma } from '@prisma/client'
import { z } from 'zod'

export const UV_CURING_UNITS = ['mj/cm²', 'J/m²'] as const
export type UvCuringUnit = (typeof UV_CURING_UNITS)[number]

const optionalCuringInt = z
  .union([z.coerce.number().int().min(0), z.literal(''), z.null()])
  .optional()
  .transform(value => (value === '' || value === undefined ? undefined : value))

const optionalCuringDecimal = z
  .union([z.coerce.number().min(0), z.literal(''), z.null()])
  .optional()
  .transform(value => (value === '' || value === undefined ? undefined : value))

export const curingFieldsSchema = {
  irCuringTime: optionalCuringInt,
  irCuringTemp: optionalCuringInt,
  uvCuringIntensity: optionalCuringDecimal,
  uvCuringUnit: z.enum(UV_CURING_UNITS).nullable().optional(),
}

export function toCuringDbData(data: {
  irCuringTime?: number | null
  irCuringTemp?: number | null
  uvCuringIntensity?: number | null
  uvCuringUnit?: string | null
}) {
  const hasUvIntensity = data.uvCuringIntensity != null
  return {
    irCuringTime: data.irCuringTime ?? null,
    irCuringTemp: data.irCuringTemp ?? null,
    uvCuringIntensity:
      data.uvCuringIntensity != null ? new Prisma.Decimal(data.uvCuringIntensity) : null,
    uvCuringUnit: hasUvIntensity ? (data.uvCuringUnit ?? 'mj/cm²') : null,
  }
}

export function serializeUvCuringIntensity(value: unknown): number | null {
  return value != null ? Number(value) : null
}
