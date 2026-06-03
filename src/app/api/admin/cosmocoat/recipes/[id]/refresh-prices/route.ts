import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { requireRole } from '@/lib/auth/rbac'
import { refreshRecipeCostsCascade } from '@/lib/cosmocoat/recipe-cost-refresh'
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
    const recipe = await serializeFullRecipe(id)
    if (!recipe) return NextResponse.json({ error: '配方不存在' }, { status: 404 })

    const costRefresh = await refreshRecipeCostsCascade([id])
    const full = await serializeFullRecipe(id)
    return NextResponse.json({ recipe: full, costRefresh })
  } catch (err) {
    if (isMissingTable(err)) {
      return NextResponse.json({ error: '配方表不存在，请先运行数据库迁移' }, { status: 503 })
    }
    throw err
  }
}
