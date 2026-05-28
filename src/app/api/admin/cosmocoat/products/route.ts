import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { revalidatePath } from 'next/cache'
import { requireRole } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'
import { ossImg } from '@/lib/oss-img'
import { getAllProducts, HOME_FEATURED_PIDS } from '@/app/cosmocoat/data/products'
import { curingFieldsSchema, serializeUvCuringIntensity, toCuringDbData } from '@/lib/cosmocoat/product-curing'
import { compatibilityFieldsSchema, toCompatibilityDbData } from '@/lib/cosmocoat/product-compatibility'
import { viscosityFieldsSchema, serializeViscosity, toViscosityDbData } from '@/lib/cosmocoat/product-viscosity'

const productSchema = z.object({
  pid: z.string().trim().min(1).max(64),
  type: z.enum(['feel', 'lacquer', 'uv', 'special']),
  title: z.string().trim().min(1).max(160),
  teaser: z.string().trim().max(500).optional().default(''),
  detail: z.string().trim().min(1),
  imagePath: z.string().trim().min(1).max(500),
  sortOrder: z.coerce.number().int().min(0).max(999999).optional().default(0),
  isFeatured: z.boolean().optional().default(false),
  isVisible: z.boolean().optional().default(true),
  ...curingFieldsSchema,
  ...viscosityFieldsSchema,
  ...compatibilityFieldsSchema,
})

function revalidateCosmoCoat() {
  revalidatePath('/cosmocoat')
  revalidatePath('/cosmocoat/products')
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

async function seedExistingProductsIfEmpty() {
  const count = await prisma.cosTableProduct.count()
  if (count > 0) return

  const featured = new Set(HOME_FEATURED_PIDS)
  await prisma.cosTableProduct.createMany({
    data: getAllProducts().map((product, index) => ({
      pid: product.pid,
      type: product.category,
      title: product.title,
      teaser: product.teaser,
      detail: product.summary,
      imagePath: product.imageFile,
      sortOrder: index + 1,
      isFeatured: featured.has(product.pid),
      isVisible: true,
    })),
    skipDuplicates: true,
  })
}

function missingProductsTableResponse() {
  return NextResponse.json(
    {
      error: 'CosmoCoat products table is missing. Run the Prisma migration to create cos_table_products.',
      migration: '20260516090000_create_cos_table_products',
    },
    { status: 503 },
  )
}

function isMissingProductsTable(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2021'
}

export async function GET(req: NextRequest) {
  const { error } = await requireRole('STAFF')
  if (error) return error

  try {
    await seedExistingProductsIfEmpty()
  } catch (error) {
    if (isMissingProductsTable(error)) return missingProductsTableResponse()
    throw error
  }

  const q = req.nextUrl.searchParams.get('q')?.trim() ?? ''
  const type = req.nextUrl.searchParams.get('type')?.trim() ?? ''

  let products
  try {
    products = await prisma.cosTableProduct.findMany({
      where: {
        ...(type ? { type } : {}),
        ...(q
          ? {
              OR: [
                { pid: { contains: q, mode: 'insensitive' } },
                { title: { contains: q, mode: 'insensitive' } },
                { teaser: { contains: q, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
      take: 500,
    })
  } catch (error) {
    if (isMissingProductsTable(error)) return missingProductsTableResponse()
    throw error
  }

  return NextResponse.json({ products: products.map(productWithImageUrl) })
}

export async function POST(req: NextRequest) {
  const { error } = await requireRole('STAFF')
  if (error) return error

  const body = await req.json().catch(() => null)
  const parsed = productSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  let existing
  try {
    existing = await prisma.cosTableProduct.findUnique({ where: { pid: parsed.data.pid } })
    if (existing) {
      return NextResponse.json({ error: 'Product ID already exists' }, { status: 409 })
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
    const product = await prisma.cosTableProduct.create({
      data: {
        ...rest,
        ...toCuringDbData({ irCuringTime, irCuringTemp, uvCuringIntensity, uvCuringUnit }),
        ...toViscosityDbData({ viscosity, viscosityUnit }),
        ...toCompatibilityDbData({ requiresCompatibility, mixingRatio, compatibleProducts }),
      } as Prisma.CosTableProductUncheckedCreateInput,
    })
    revalidateCosmoCoat()
    return NextResponse.json({ product: productWithImageUrl(product) }, { status: 201 })
  } catch (error) {
    if (isMissingProductsTable(error)) return missingProductsTableResponse()
    throw error
  }
}
