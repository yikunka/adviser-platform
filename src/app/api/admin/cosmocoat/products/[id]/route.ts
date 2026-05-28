import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { revalidatePath } from 'next/cache'
import { requireRole } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'
import { ossImg } from '@/lib/oss-img'
import { curingFieldsSchema, serializeUvCuringIntensity, toCuringDbData } from '@/lib/cosmocoat/product-curing'
import { compatibilityFieldsSchema, toCompatibilityDbData } from '@/lib/cosmocoat/product-compatibility'
import {
  type CosTableProductExtendedFields,
  mergeViscosityPatch,
  serializeViscosity,
  viscosityFieldsSchema,
} from '@/lib/cosmocoat/product-viscosity'

const patchSchema = z.object({
  pid: z.string().trim().min(1).max(64).optional(),
  type: z.enum(['feel', 'lacquer', 'uv', 'special']).optional(),
  title: z.string().trim().min(1).max(160).optional(),
  teaser: z.string().trim().max(500).optional(),
  detail: z.string().trim().min(1).optional(),
  imagePath: z.string().trim().min(1).max(500).optional(),
  sortOrder: z.coerce.number().int().min(0).max(999999).optional(),
  isFeatured: z.boolean().optional(),
  isVisible: z.boolean().optional(),
  ...curingFieldsSchema,
  ...viscosityFieldsSchema,
  ...compatibilityFieldsSchema,
})

function revalidateCosmoCoat(pid?: string) {
  revalidatePath('/cosmocoat')
  revalidatePath('/cosmocoat/products')
  if (pid) revalidatePath(`/cosmocoat/products/${pid}`)
}

function normalizeProductImagePath(path: string): string {
  const trimmed = path.trim()
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  if (trimmed.startsWith('/')) return trimmed
  if (trimmed.startsWith('cosmocoat/')) return `/${trimmed}`
  return `/cosmocoat/${trimmed}`
}

function productWithImageUrl<T extends { imagePath: string; uvCuringIntensity?: unknown; viscosity?: unknown }>(
  product: T,
) {
  const imagePath = normalizeProductImagePath(product.imagePath)
  const { uvCuringIntensity, viscosity, ...rest } = product
  return {
    ...rest,
    imagePath,
    uvCuringIntensity: serializeUvCuringIntensity(uvCuringIntensity),
    viscosity: serializeViscosity(viscosity),
    imageUrl: /^https?:\/\//i.test(imagePath) ? imagePath : ossImg(imagePath, { w: 500 }),
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await requireRole('STAFF')
  if (error) return error

  const { id } = await params
  const body = await req.json().catch(() => null)
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  const currentRaw = await prisma.cosTableProduct.findUnique({ where: { id } })
  if (!currentRaw) return NextResponse.json({ error: 'Product not found' }, { status: 404 })
  const current = currentRaw as typeof currentRaw & CosTableProductExtendedFields

  if (parsed.data.pid && parsed.data.pid !== current.pid) {
    const conflict = await prisma.cosTableProduct.findUnique({ where: { pid: parsed.data.pid } })
    if (conflict) return NextResponse.json({ error: 'Product ID already exists' }, { status: 409 })
  }

  const {
    irCuringTime,
    irCuringTemp,
    uvCuringIntensity,
    uvCuringUnit,
    viscosity,
    viscosityUnit,
    requiresCompatibility,
    mixingRatio,
    compatibleProducts,
    ...rest
  } = parsed.data
  const curingKeys = ['irCuringTime', 'irCuringTemp', 'uvCuringIntensity', 'uvCuringUnit'] as const
  const viscosityKeys = ['viscosity', 'viscosityUnit'] as const
  const compatibilityKeys = ['requiresCompatibility', 'mixingRatio', 'compatibleProducts'] as const
  const hasCuringUpdate =
    body != null &&
    typeof body === 'object' &&
    curingKeys.some(key => key in body)
  const hasViscosityUpdate =
    body != null &&
    typeof body === 'object' &&
    viscosityKeys.some(key => key in body)
  const hasCompatibilityUpdate =
    body != null &&
    typeof body === 'object' &&
    compatibilityKeys.some(key => key in body)

  const product = await prisma.cosTableProduct.update({
    where: { id },
    data: {
      ...rest,
      ...(hasCuringUpdate
        ? toCuringDbData({
            irCuringTime: irCuringTime !== undefined ? irCuringTime : current.irCuringTime,
            irCuringTemp: irCuringTemp !== undefined ? irCuringTemp : current.irCuringTemp,
            uvCuringIntensity:
              uvCuringIntensity !== undefined
                ? uvCuringIntensity
                : current.uvCuringIntensity != null
                  ? Number(current.uvCuringIntensity)
                  : null,
            uvCuringUnit: uvCuringUnit !== undefined ? uvCuringUnit : current.uvCuringUnit,
          })
        : {}),
      ...(hasViscosityUpdate
        ? mergeViscosityPatch(current, {
            viscosity,
            viscosityUnit,
          })
        : {}),
      ...(hasCompatibilityUpdate
        ? toCompatibilityDbData({
            requiresCompatibility:
              requiresCompatibility !== undefined
                ? requiresCompatibility
                : current.requiresCompatibility,
            mixingRatio: mixingRatio !== undefined ? mixingRatio : current.mixingRatio,
            compatibleProducts:
              compatibleProducts !== undefined
                ? compatibleProducts
                : current.compatibleProducts,
          })
        : {}),
    } as Prisma.CosTableProductUncheckedUpdateInput,
  })

  revalidateCosmoCoat(current.pid)
  revalidateCosmoCoat(product.pid)
  return NextResponse.json({ product: productWithImageUrl(product) })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await requireRole('STAFF')
  if (error) return error

  const { id } = await params
  const current = await prisma.cosTableProduct.findUnique({ where: { id } })
  if (!current) return NextResponse.json({ error: 'Product not found' }, { status: 404 })

  await prisma.cosTableProduct.delete({ where: { id } })
  revalidateCosmoCoat(current.pid)
  return NextResponse.json({ success: true })
}
