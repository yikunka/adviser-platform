import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { requireRole } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'
import { generateRecipeCode } from '@/lib/cosmocoat/recipe-code'
import { computeRecipeTotals, normalizeRecipeItems, type RecipeItemInput } from '@/lib/cosmocoat/recipes'
import { recipeItemToPrismaCreate } from '@/lib/cosmocoat/recipe-items'
import { RecipeItemValidationError, validateAndEnrichRecipeItems } from '@/lib/cosmocoat/recipe-item-validation'
import { recipeItemSchema } from '@/lib/cosmocoat/recipe-api-schemas'
import { refreshAllFormulaIsUsedCache } from '@/lib/cosmocoat/recipe-usage'
import { serializeFullRecipe } from '@/lib/cosmocoat/recipe-serializer'
import { recipeViscosityFieldsSchema, toRecipeViscosityDbData } from '@/lib/cosmocoat/recipe-viscosity'

const itemSchema = recipeItemSchema

const recipeSchema = z.object({
  categoryId: z.string().trim().min(1),
  code: z.string().trim().max(32).optional(),
  name: z.string().trim().min(1).max(160),
  batchQuantity: z.coerce.number().min(0.001).optional().default(100),
  ...recipeViscosityFieldsSchema,
  notes: z.string().trim().max(1000).optional().default(''),
  productionSpeedRequirements: z.string().trim().max(2000).optional().default(''),
  productionTimeRequirements: z.string().trim().max(2000).optional().default(''),
  packagingRequirements: z.string().trim().max(2000).optional().default(''),
  productionNotes: z.string().trim().max(2000).optional().default(''),
  qcTestStandard: z.string().trim().max(2000).optional().default(''),
  qcTestItems: z.array(z.enum(['VISCOSITY', 'CROSSHATCH', 'BOILING_WATER_80C30M', 'WET_OIL_APPEARANCE', 'DRY_PLATE_APPEARANCE'])).optional().default([]),
  qcResult: z.string().trim().max(2000).optional().default(''),
  items: z.array(itemSchema).optional().default([]),
})

function isMissingTable(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2021'
}

async function saveRecipeItems(recipeId: string, items: RecipeItemInput[], batchQuantity: number) {
  const enriched = await validateAndEnrichRecipeItems(items, recipeId)
  const normalized = normalizeRecipeItems(enriched, batchQuantity)
  await prisma.cosTableRecipeItem.deleteMany({ where: { recipeId } })
  if (normalized.length > 0) {
    await prisma.cosTableRecipeItem.createMany({
      data: normalized.map(item => recipeItemToPrismaCreate(recipeId, item)),
    })
  }
  return normalized
}

export async function GET(req: NextRequest) {
  const { error } = await requireRole('STAFF', { adminMenu: 'cosmocoatRecipes' })
  if (error) return error

  const q = req.nextUrl.searchParams.get('q')?.trim() ?? ''
  const categoryId = req.nextUrl.searchParams.get('categoryId')?.trim() ?? ''
  const semiFinishedOnly = req.nextUrl.searchParams.get('semiFinished') === 'true'
  const usedByFactoryProduct = req.nextUrl.searchParams.get('usedByFactoryProduct')?.trim() ?? ''
  const excludeId = req.nextUrl.searchParams.get('excludeId')?.trim() ?? ''
  const page = Math.max(1, Number(req.nextUrl.searchParams.get('page') ?? '1') || 1)
  const limit = Math.min(200, Math.max(1, Number(req.nextUrl.searchParams.get('limit') ?? '50') || 50))
  const skip = (page - 1) * limit

  const where: Prisma.CosTableRecipeWhereInput = {
    ...(categoryId ? { categoryId } : {}),
    ...(excludeId ? { id: { not: excludeId } } : {}),
    ...(usedByFactoryProduct === 'true' ? { formulaIsUsed: true } : {}),
    ...(usedByFactoryProduct === 'false' ? { formulaIsUsed: false } : {}),
    ...(semiFinishedOnly
      ? { category: { name: { contains: '半成品', mode: 'insensitive' } } }
      : {}),
    ...(q
      ? {
          OR: [
            { code: { contains: q, mode: 'insensitive' } },
            { name: { contains: q, mode: 'insensitive' } },
            { notes: { contains: q, mode: 'insensitive' } },
          ],
        }
      : {}),
  }

  try {
    const [total, items, categories] = await Promise.all([
      prisma.cosTableRecipe.count({ where }),
      prisma.cosTableRecipe.findMany({
        where,
        include: {
          category: { select: { id: true, code: true, name: true } },
          _count: { select: { items: true } },
        },
        orderBy: [{ updatedAt: 'desc' }],
        skip,
        take: limit,
      }),
      prisma.cosTableRecipeCategory.findMany({
        orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
        select: { id: true, code: true, name: true, sortOrder: true },
      }),
    ])

    return NextResponse.json({
      items: items.map(recipe => ({
        id: recipe.id,
        code: recipe.code,
        name: recipe.name,
        batchQuantity: Number(recipe.batchQuantity),
        unitCost: recipe.unitCost != null ? Number(recipe.unitCost) : null,
        notes: recipe.notes,
        formulaIsUsed: recipe.formulaIsUsed,
        updatedAt: recipe.updatedAt.toISOString(),
        itemCount: recipe._count.items,
        category: recipe.category,
      })),
      categories,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    })
  } catch (err) {
    if (isMissingTable(err)) {
      return NextResponse.json({ error: '配方表不存在，请先运行数据库迁移' }, { status: 503 })
    }
    throw err
  }
}

export async function POST(req: NextRequest) {
  const { error } = await requireRole('STAFF', { adminMenu: 'cosmocoatRecipes' })
  if (error) return error

  const body = await req.json().catch(() => null)
  const parsed = recipeSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  try {
    const category = await prisma.cosTableRecipeCategory.findUnique({ where: { id: parsed.data.categoryId } })
    if (!category) return NextResponse.json({ error: '目录不存在' }, { status: 404 })

    const code = parsed.data.code?.trim() || await generateRecipeCode()

    const existing = await prisma.cosTableRecipe.findUnique({ where: { code } })
    if (existing) return NextResponse.json({ error: '配方编号已存在' }, { status: 409 })

    const enrichedItems = await validateAndEnrichRecipeItems(parsed.data.items)
    const normalized = normalizeRecipeItems(enrichedItems, parsed.data.batchQuantity)
    const totals = computeRecipeTotals(
      normalized.map(item => ({
        quantity: item.quantity,
        amount: item.amount,
        unitPrice: item.unitPrice,
      })),
      parsed.data.batchQuantity,
    )

    const recipe = await prisma.cosTableRecipe.create({
      data: {
        categoryId: parsed.data.categoryId,
        code,
        name: parsed.data.name,
        batchQuantity: parsed.data.batchQuantity,
        unitCost: totals.unitCost,
        ...toRecipeViscosityDbData(parsed.data),
        notes: parsed.data.notes,
        productionSpeedRequirements: parsed.data.productionSpeedRequirements,
        productionTimeRequirements: parsed.data.productionTimeRequirements,
        packagingRequirements: parsed.data.packagingRequirements,
        productionNotes: parsed.data.productionNotes,
        qcTestStandard: parsed.data.qcTestStandard,
        qcTestItems: parsed.data.qcTestItems,
        qcResult: parsed.data.qcResult,
      },
    })

    await saveRecipeItems(recipe.id, enrichedItems, parsed.data.batchQuantity)
    await refreshAllFormulaIsUsedCache()
    const full = await serializeFullRecipe(recipe.id)
    return NextResponse.json({ recipe: full }, { status: 201 })
  } catch (err) {
    if (err instanceof RecipeItemValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 })
    }
    if (isMissingTable(err)) {
      return NextResponse.json({ error: '配方表不存在，请先运行数据库迁移' }, { status: 503 })
    }
    throw err
  }
}
