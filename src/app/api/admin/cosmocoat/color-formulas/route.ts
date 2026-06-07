import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { requireRole } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'
import { isColorFormulaCategory } from '@/lib/cosmocoat/color-formula-categories'
import { validateColorFormulaFactoryProduct } from '@/lib/cosmocoat/color-formula-factory-products'
import { generateColorFormulaCode } from '@/lib/cosmocoat/color-formula-code'
import {
  buildColorFormulaListWhere,
  enrichColorFormulaItemsFromRawMaterials,
  getColorFormulaById,
  saveColorFormulaItems,
  serializeColorFormula,
  type ColorFormulaItemInput,
} from '@/lib/cosmocoat/color-formulas'

const itemSchema = z.object({
  rawMaterialId: z.string().trim().min(1).nullable().optional(),
  productSemifinishedId: z.string().trim().min(1).nullable().optional(),
  productionCode: z.string().trim().max(64).optional().default(''),
  name: z.string().trim().max(500).optional().default(''),
  attributeCode: z.string().trim().max(64).optional().default(''),
  sortOrder: z.coerce.number().int().min(0).optional().default(0),
  quantity: z.coerce.number().min(0),
  actualWeight: z.coerce.number().min(0).nullable().optional(),
  unitPrice: z.coerce.number().nullable().optional(),
  notes: z.string().trim().max(500).optional().default(''),
}).refine(item => !(item.rawMaterialId && item.productSemifinishedId), {
  message: '每条明细不能同时选择原料和半成品',
})

const formulaSchema = z.object({
  code: z.string().trim().max(32).optional(),
  name: z.string().trim().min(1).max(160),
  category: z.string().trim().min(1),
  factoryProductId: z.string().trim().min(1).nullable().optional(),
  colorCode: z.string().trim().max(64).optional().default(''),
  customerName: z.string().trim().max(120).optional().default(''),
  targetColor: z.string().trim().max(120).optional().default(''),
  batchQuantity: z.coerce.number().min(0.001).optional().default(100),
  notes: z.string().trim().max(2000).optional().default(''),
  items: z.array(itemSchema).optional().default([]),
})

function isMissingTable(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2021'
}

export async function GET(req: NextRequest) {
  const { error } = await requireRole('STAFF', { adminMenu: 'cosmocoatColorFormulas' })
  if (error) return error

  const q = req.nextUrl.searchParams.get('q')?.trim() ?? ''
  const categoryParam = req.nextUrl.searchParams.get('category')?.trim() ?? ''
  const category = isColorFormulaCategory(categoryParam) ? categoryParam : undefined
  const factoryProductId = req.nextUrl.searchParams.get('factoryProductId')?.trim() ?? undefined
  const subcategoryId = req.nextUrl.searchParams.get('subcategoryId')?.trim() ?? undefined
  const page = Math.max(1, Number(req.nextUrl.searchParams.get('page') ?? '1') || 1)
  const limit = Math.min(200, Math.max(1, Number(req.nextUrl.searchParams.get('limit') ?? '50') || 50))
  const skip = (page - 1) * limit

  const where = buildColorFormulaListWhere({ q, category, factoryProductId, subcategoryId })

  try {
    const [total, rows] = await Promise.all([
      prisma.cosTableColorFormula.count({ where }),
      prisma.cosTableColorFormula.findMany({
        where,
        include: {
          subcategory: { select: { id: true, parentCategory: true, code: true, name: true } },
          factoryProduct: {
            select: {
              id: true,
              productCode: true,
              name: true,
              category: { select: { id: true, name: true, slug: true } },
            },
          },
          sourceRecipe: { select: { id: true, code: true, name: true } },
          _count: { select: { items: true } },
        },
        orderBy: [{ updatedAt: 'desc' }],
        skip,
        take: limit,
      }),
    ])

    return NextResponse.json({
      items: rows.map(serializeColorFormula),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    })
  } catch (err) {
    if (isMissingTable(err)) {
      return NextResponse.json({ error: '调色配方表不存在，请先运行数据库迁移' }, { status: 503 })
    }
    throw err
  }
}

export async function POST(req: NextRequest) {
  const { error } = await requireRole('STAFF', { adminMenu: 'cosmocoatColorFormulas' })
  if (error) return error

  const body = await req.json().catch(() => null)
  const parsed = formulaSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  if (!isColorFormulaCategory(parsed.data.category)) {
    return NextResponse.json({ error: '无效的配方类别' }, { status: 400 })
  }

  const productCheck = await validateColorFormulaFactoryProduct({
    category: parsed.data.category,
    factoryProductId: parsed.data.factoryProductId,
  })
  if (!productCheck.ok) {
    return NextResponse.json({ error: productCheck.error }, { status: 400 })
  }

  try {
    const code = parsed.data.code?.trim() || (await generateColorFormulaCode())
    const existing = await prisma.cosTableColorFormula.findUnique({ where: { code } })
    if (existing) return NextResponse.json({ error: '配方编号已存在' }, { status: 409 })

    const enriched = await enrichColorFormulaItemsFromRawMaterials(parsed.data.items as ColorFormulaItemInput[])

    const formula = await prisma.cosTableColorFormula.create({
      data: {
        code,
        name: parsed.data.name,
        category: parsed.data.category,
        factoryProductId: productCheck.factoryProductId,
        colorCode: parsed.data.colorCode,
        customerName: parsed.data.customerName,
        targetColor: parsed.data.targetColor,
        batchQuantity: parsed.data.batchQuantity,
        notes: parsed.data.notes,
      },
    })

    await saveColorFormulaItems(formula.id, enriched, parsed.data.batchQuantity)
    const full = await getColorFormulaById(formula.id)
    return NextResponse.json({ formula: full }, { status: 201 })
  } catch (err) {
    if (isMissingTable(err)) {
      return NextResponse.json({ error: '调色配方表不存在，请先运行数据库迁移' }, { status: 503 })
    }
    throw err
  }
}
