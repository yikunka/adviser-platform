import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { requireRole } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'
import { computeItemAmount, computeRecipeTotals } from '@/lib/cosmocoat/recipes'
import { serializeFullRecipe } from '@/lib/cosmocoat/recipe-serializer'

function isMissingTable(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2021'
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await requireRole('STAFF', { adminMenu: 'cosmocoatRecipes' })
  if (error) return error

  const { id } = await params

  try {
    const recipe = await prisma.cosTableRecipe.findUnique({
      where: { id },
      include: {
        items: { include: { rawMaterial: true } },
      },
    })
    if (!recipe) return NextResponse.json({ error: '配方不存在' }, { status: 404 })

    for (const item of recipe.items) {
      const unitPrice = item.rawMaterial.primaryPricePerKg != null
        ? Number(item.rawMaterial.primaryPricePerKg)
        : null
      const amount = computeItemAmount(Number(item.quantity), unitPrice)
      await prisma.cosTableRecipeItem.update({
        where: { id: item.id },
        data: { unitPrice, amount },
      })
    }

    const updatedItems = await prisma.cosTableRecipeItem.findMany({ where: { recipeId: id } })
    const totals = computeRecipeTotals(
      updatedItems.map(item => ({
        quantity: Number(item.quantity),
        amount: Number(item.amount ?? 0),
      })),
      Number(recipe.batchQuantity),
    )

    await prisma.cosTableRecipe.update({
      where: { id },
      data: { unitCost: totals.unitCost },
    })

    const full = await serializeFullRecipe(id)
    return NextResponse.json({ recipe: full })
  } catch (err) {
    if (isMissingTable(err)) {
      return NextResponse.json({ error: '配方表不存在，请先运行数据库迁移' }, { status: 503 })
    }
    throw err
  }
}
