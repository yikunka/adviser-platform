import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { requireRole } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'
import { generateRecipeCode } from '@/lib/cosmocoat/recipe-code'
import { computeRecipeTotals, normalizeRecipeItems, type RecipeItemInput } from '@/lib/cosmocoat/recipes'
import { serializeFullRecipe } from '@/lib/cosmocoat/recipe-serializer'

const itemSchema = z.object({
  rawMaterialId: z.string().trim().min(1),
  sortOrder: z.coerce.number().int().min(0).optional().default(0),
  quantity: z.coerce.number().min(0),
  unitPrice: z.coerce.number().min(0).nullable().optional().default(null),
  notes: z.string().trim().max(500).optional().default(''),
})

const recipeSchema = z.object({
  categoryId: z.string().trim().min(1),
  code: z.string().trim().max(32).optional(),
  name: z.string().trim().min(1).max(160),
  batchQuantity: z.coerce.number().min(0.001).optional().default(100),
  notes: z.string().trim().max(1000).optional().default(''),
  items: z.array(itemSchema).optional().default([]),
})

function isMissingTable(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2021'
}

async function saveRecipeItems(recipeId: string, items: RecipeItemInput[]) {
  const normalized = normalizeRecipeItems(items)
  await prisma.cosTableRecipeItem.deleteMany({ where: { recipeId } })
  if (normalized.length > 0) {
    await prisma.cosTableRecipeItem.createMany({
      data: normalized.map(item => ({
        recipeId,
        rawMaterialId: item.rawMaterialId,
        sortOrder: item.sortOrder,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        amount: item.amount,
        percentage: item.percentage,
        notes: item.notes,
      })),
    })
  }
  return normalized
}

export async function GET(req: NextRequest) {
  const { error } = await requireRole('STAFF', { adminMenu: 'cosmocoatRecipes' })
  if (error) return error

  const q = req.nextUrl.searchParams.get('q')?.trim() ?? ''
  const categoryId = req.nextUrl.searchParams.get('categoryId')?.trim() ?? ''
  const page = Math.max(1, Number(req.nextUrl.searchParams.get('page') ?? '1') || 1)
  const limit = Math.min(200, Math.max(1, Number(req.nextUrl.searchParams.get('limit') ?? '50') || 50))
  const skip = (page - 1) * limit

  const where: Prisma.CosTableRecipeWhereInput = {
    ...(categoryId ? { categoryId } : {}),
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

    const normalized = normalizeRecipeItems(parsed.data.items)
    const totals = computeRecipeTotals(
      normalized.map(item => ({ quantity: item.quantity, amount: item.amount })),
      parsed.data.batchQuantity,
    )

    const recipe = await prisma.cosTableRecipe.create({
      data: {
        categoryId: parsed.data.categoryId,
        code,
        name: parsed.data.name,
        batchQuantity: parsed.data.batchQuantity,
        unitCost: totals.unitCost,
        notes: parsed.data.notes,
      },
    })

    await saveRecipeItems(recipe.id, parsed.data.items)
    const full = await serializeFullRecipe(recipe.id)
    return NextResponse.json({ recipe: full }, { status: 201 })
  } catch (err) {
    if (isMissingTable(err)) {
      return NextResponse.json({ error: '配方表不存在，请先运行数据库迁移' }, { status: 503 })
    }
    throw err
  }
}
