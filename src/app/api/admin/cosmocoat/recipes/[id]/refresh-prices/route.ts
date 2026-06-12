import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { requireRole } from '@/lib/auth/rbac'
import {
  applyRecipeUpdate,
  createRecipeChangeRequest,
  listRecipeChangeRequests,
  RecipeChangeRequestError,
  rejectPendingRecipeChangeRequests,
} from '@/lib/cosmocoat/recipe-change-requests'
import { serializeFullRecipe } from '@/lib/cosmocoat/recipe-serializer'

function isMissingTable(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2021'
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, error } = await requireRole('STAFF', { adminMenu: 'cosmocoatRecipes' })
  if (error) return error

  const { id } = await params

  try {
    const recipe = await serializeFullRecipe(id)
    if (!recipe) return NextResponse.json({ error: '配方不存在' }, { status: 404 })

    if (session!.user.role !== 'SUPER_ADMIN') {
      const changeRequest = await createRecipeChangeRequest({
        recipeId: id,
        action: 'UPDATE',
        payload: { refreshPrices: true },
        requestedById: session!.user.id,
      })
      return NextResponse.json(
        {
          changeRequest,
          message: '价格刷新请求已提交，等待超级管理员审批',
        },
        { status: 202 },
      )
    }

    await rejectPendingRecipeChangeRequests(id, session!.user.id, '超级管理员已直接执行变更')
    const full = await applyRecipeUpdate(id, { refreshPrices: true })
    return NextResponse.json({ recipe: full })
  } catch (err) {
    if (err instanceof RecipeChangeRequestError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    if (isMissingTable(err)) {
      return NextResponse.json({ error: '配方表不存在，请先运行数据库迁移' }, { status: 503 })
    }
    throw err
  }
}
