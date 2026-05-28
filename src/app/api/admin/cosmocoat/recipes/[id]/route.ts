import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { requireRole } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'
import { computeRecipeTotals, normalizeRecipeItems } from '@/lib/cosmocoat/recipes'
import { recipeItemToPrismaCreate } from '@/lib/cosmocoat/recipe-items'
import { RecipeItemValidationError, validateAndEnrichRecipeItems } from '@/lib/cosmocoat/recipe-item-validation'
import { recipeItemSchema } from '@/lib/cosmocoat/recipe-api-schemas'
import { serializeFullRecipe } from '@/lib/cosmocoat/recipe-serializer'

const itemSchema = recipeItemSchema

const patchSchema = z.object({
  categoryId: z.string().trim().min(1).optional(),
  code: z.string().trim().min(1).max(32).optional(),
  name: z.string().trim().min(1).max(160).optional(),
  batchQuantity: z.coerce.number().min(0.001).optional(),
  notes: z.string().trim().max(1000).optional(),
  items: z.array(itemSchema).optional(),
})

function isMissingTable(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2021'
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await requireRole('STAFF', { adminMenu: 'cosmocoatRecipes' })
  if (error) return error

  const { id } = await params
  try {
    const recipe = await serializeFullRecipe(id)
    if (!recipe) return NextResponse.json({ error: '配方不存在' }, { status: 404 })
    return NextResponse.json({ recipe })
  } catch (err) {
    if (isMissingTable(err)) {
      return NextResponse.json({ error: '配方表不存在，请先运行数据库迁移' }, { status: 503 })
    }
    throw err
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await requireRole('STAFF', { adminMenu: 'cosmocoatRecipes' })
  if (error) return error

  const { id } = await params
  const body = await req.json().catch(() => null)
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  const current = await prisma.cosTableRecipe.findUnique({ where: { id } })
  if (!current) return NextResponse.json({ error: '配方不存在' }, { status: 404 })

  if (parsed.data.code && parsed.data.code !== current.code) {
    const conflict = await prisma.cosTableRecipe.findUnique({ where: { code: parsed.data.code } })
    if (conflict) return NextResponse.json({ error: '配方编号已存在' }, { status: 409 })
  }

  if (parsed.data.categoryId) {
    const category = await prisma.cosTableRecipeCategory.findUnique({ where: { id: parsed.data.categoryId } })
    if (!category) return NextResponse.json({ error: '目录不存在' }, { status: 404 })
  }

  try {
    if (parsed.data.items) {
      const enriched = await validateAndEnrichRecipeItems(parsed.data.items, id)
      const normalized = normalizeRecipeItems(enriched)
      await prisma.cosTableRecipeItem.deleteMany({ where: { recipeId: id } })
      if (normalized.length > 0) {
        await prisma.cosTableRecipeItem.createMany({
          data: normalized.map(item => recipeItemToPrismaCreate(id, item)),
        })
      }
    }

    const batchQuantity = parsed.data.batchQuantity ?? Number(current.batchQuantity)
    const items = await prisma.cosTableRecipeItem.findMany({ where: { recipeId: id } })
    const totals = computeRecipeTotals(
      items.map(item => ({
        quantity: Number(item.quantity),
        amount: Number(item.amount ?? 0),
      })),
      batchQuantity,
    )

    await prisma.cosTableRecipe.update({
      where: { id },
      data: {
        categoryId: parsed.data.categoryId,
        code: parsed.data.code,
        name: parsed.data.name,
        batchQuantity: parsed.data.batchQuantity,
        notes: parsed.data.notes,
        unitCost: totals.unitCost,
      },
    })

    const recipe = await serializeFullRecipe(id)
    return NextResponse.json({ recipe })
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

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await requireRole('STAFF', { adminMenu: 'cosmocoatRecipes' })
  if (error) return error

  const { id } = await params
  const current = await prisma.cosTableRecipe.findUnique({ where: { id } })
  if (!current) return NextResponse.json({ error: '配方不存在' }, { status: 404 })

  await prisma.cosTableRecipe.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
