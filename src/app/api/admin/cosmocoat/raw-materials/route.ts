import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { requireRole } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'
import {
  getRecipeUsageCountsByRawMaterialIds,
  serializeRawMaterial,
  serializeRawMaterialListRow,
  toPrismaCreateData,
} from '@/lib/cosmocoat/raw-materials'

const ynSchema = z.union([z.literal(''), z.literal('Y'), z.literal('N')])

const rawMaterialSchema = z.object({
  category: z.string().trim().min(1).max(64),
  attributeCode: z.string().trim().min(1).max(16),
  productionCode: z.string().trim().min(1).max(32),
  huaxingCode: z.string().trim().max(32).optional().default(''),
  name: z.string().trim().min(1).max(500),
  primarySupplierCode: z.string().trim().max(32).optional().default(''),
  primarySupplierName: z.string().trim().max(200).optional().default(''),
  primaryPackageKg: z.number().min(0).nullable().optional().default(null),
  primaryPricePerKg: z.number().min(0).nullable().optional().default(null),
  primaryTaxIncluded: ynSchema.optional().default(''),
  primaryFreightIncluded: ynSchema.optional().default(''),
  primaryNotes: z.string().trim().max(500).optional().default(''),
  secondarySupplierCode: z.string().trim().max(32).optional().default(''),
  secondarySupplierName: z.string().trim().max(200).optional().default(''),
  secondaryPackageKg: z.number().min(0).nullable().optional().default(null),
  secondaryPricePerKg: z.number().min(0).nullable().optional().default(null),
  secondaryTaxIncluded: ynSchema.optional().default(''),
  secondaryFreightIncluded: ynSchema.optional().default(''),
  secondaryNotes: z.string().trim().max(500).optional().default(''),
})

function missingTableResponse() {
  return NextResponse.json(
    {
      error: 'CosmoCoat raw materials table is missing. Run the Prisma migration to create cos_table_raw_materials.',
      migration: '20260524120000_create_cos_table_raw_materials',
    },
    { status: 503 },
  )
}

function isMissingTable(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2021'
}

export async function GET(req: NextRequest) {
  const { error } = await requireRole('STAFF', { adminMenu: 'cosmocoatRawMaterials' })
  if (error) return error

  const q = req.nextUrl.searchParams.get('q')?.trim() ?? ''
  const category = req.nextUrl.searchParams.get('category')?.trim() ?? ''
  const attribute = req.nextUrl.searchParams.get('attribute')?.trim() ?? ''
  const usedInRecipe = req.nextUrl.searchParams.get('usedInRecipe')?.trim() ?? ''
  const page = Math.max(1, Number(req.nextUrl.searchParams.get('page') ?? '1') || 1)
  const limit = Math.min(200, Math.max(1, Number(req.nextUrl.searchParams.get('limit') ?? '50') || 50))
  const skip = (page - 1) * limit

  const where: Prisma.CosTableRawMaterialWhereInput = {
    ...(category ? { category } : {}),
    ...(attribute ? { attributeCode: attribute } : {}),
    ...(usedInRecipe === 'true'
      ? { recipeItems: { some: { recipe: { formulaIsUsed: true } } } }
      : {}),
    ...(usedInRecipe === 'false'
      ? { recipeItems: { none: { recipe: { formulaIsUsed: true } } } }
      : {}),
    ...(q
      ? {
          OR: [
            { productionCode: { contains: q, mode: 'insensitive' } },
            { name: { contains: q, mode: 'insensitive' } },
            { huaxingCode: { contains: q, mode: 'insensitive' } },
            { primarySupplierName: { contains: q, mode: 'insensitive' } },
            { secondarySupplierName: { contains: q, mode: 'insensitive' } },
          ],
        }
      : {}),
  }

  try {
    const [total, items, categories, attributes] = await Promise.all([
      prisma.cosTableRawMaterial.count({ where }),
      prisma.cosTableRawMaterial.findMany({
        where,
        orderBy: [{ attributeCode: 'asc' }, { productionCode: 'asc' }],
        skip,
        take: limit,
      }),
      prisma.cosTableRawMaterial.findMany({
        distinct: ['category'],
        select: { category: true },
        orderBy: { category: 'asc' },
      }),
      prisma.cosTableRawMaterial.findMany({
        distinct: ['attributeCode'],
        select: { attributeCode: true },
        orderBy: { attributeCode: 'asc' },
      }),
    ])

    const usageCounts = await getRecipeUsageCountsByRawMaterialIds(items.map(i => i.id))

    return NextResponse.json({
      items: items.map(item =>
        serializeRawMaterialListRow(item, usageCounts.get(item.id) ?? 0),
      ),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      categories: categories.map(c => c.category).filter(Boolean),
      attributes: attributes.map(a => a.attributeCode).filter(Boolean),
    })
  } catch (err) {
    if (isMissingTable(err)) return missingTableResponse()
    throw err
  }
}

export async function POST(req: NextRequest) {
  const { error } = await requireRole('STAFF', { adminMenu: 'cosmocoatRawMaterials' })
  if (error) return error

  const body = await req.json().catch(() => null)
  const parsed = rawMaterialSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  try {
    const existing = await prisma.cosTableRawMaterial.findUnique({
      where: { productionCode: parsed.data.productionCode },
    })
    if (existing) {
      return NextResponse.json({ error: '生产号已存在' }, { status: 409 })
    }

    const item = await prisma.cosTableRawMaterial.create({
      data: toPrismaCreateData(parsed.data),
    })
    return NextResponse.json({ item: serializeRawMaterial(item) }, { status: 201 })
  } catch (err) {
    if (isMissingTable(err)) return missingTableResponse()
    throw err
  }
}

export { rawMaterialSchema }
