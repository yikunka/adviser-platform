import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { requireRole } from '@/lib/auth/rbac'
import {
  loadRecipeForProduction,
  recipeItemsForProduction,
} from '@/lib/cosmocoat/production-orders'

function isMissingTable(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2021'
}

/**
 * Recipe data needed to build a production order's material feed detail.
 * Gated by the production-orders menu (not recipe management) and trimmed to
 * the production fields only — no pricing/cost is exposed.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ recipeId: string }> },
) {
  const { error } = await requireRole('STAFF', { adminMenu: 'cosmocoatProductionOrders' })
  if (error) return error

  const { recipeId } = await params
  try {
    const recipe = await loadRecipeForProduction(recipeId)
    if (!recipe) return NextResponse.json({ error: '配方不存在' }, { status: 404 })

    return NextResponse.json({
      recipe: {
        id: recipe.id,
        code: recipe.code,
        name: recipe.name,
        viscosity: recipe.viscosity,
        viscosityUnit: recipe.viscosityUnit,
        productionSpeedRequirements: recipe.productionSpeedRequirements,
        productionTimeRequirements: recipe.productionTimeRequirements,
        packagingRequirements: recipe.packagingRequirements,
        productionNotes: recipe.productionNotes,
        qcTestStandard: recipe.qcTestStandard,
        qcTestItems: recipe.qcTestItems,
        qcResult: recipe.qcResult,
        items: recipeItemsForProduction(recipe.items),
      },
    })
  } catch (err) {
    if (isMissingTable(err)) {
      return NextResponse.json({ error: '配方表不存在，请先运行数据库迁移' }, { status: 503 })
    }
    throw err
  }
}
