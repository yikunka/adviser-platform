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
        items: {
          include: {
            rawMaterial: true,
            componentRecipe: true,
            productSemifinished: true,
          },
        },
      },
    })
    if (!recipe) return NextResponse.json({ error: '配方不存在' }, { status: 404 })

    for (const item of recipe.items) {
      const unitPrice = item.componentRecipe
        ? (item.componentRecipe.unitCost != null ? Number(item.componentRecipe.unitCost) : null)
        : item.productSemifinished
          ? (item.productSemifinished.unitPrice != null ? Number(item.productSemifinished.unitPrice) : null)
          : (item.rawMaterial?.primaryPricePerKg != null ? Number(item.rawMaterial.primaryPricePerKg) : null)
      const quantity = Number(item.quantity)
      const amount = computeItemAmount(
        quantity,
        unitPrice,
        recipe.items.reduce((sum, i) => sum + Number(i.quantity), 0),
        Number(recipe.batchQuantity),
      )
      await prisma.cosTableRecipeItem.update({
        where: { id: item.id },
        data: { unitPrice, amount },
      })
    }

    const updatedItems = await prisma.cosTableRecipeItem.findMany({ where: { recipeId: id } })
    const batchQuantity = Number(recipe.batchQuantity)
    const totalQuantity = updatedItems.reduce((sum, item) => sum + Number(item.quantity), 0)
    const totals = computeRecipeTotals(
      updatedItems.map(item => {
        const quantity = Number(item.quantity)
        const unitPrice = item.unitPrice != null ? Number(item.unitPrice) : null
        return {
          quantity,
          unitPrice,
          amount: computeItemAmount(quantity, unitPrice, totalQuantity, batchQuantity),
        }
      }),
      batchQuantity,
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
