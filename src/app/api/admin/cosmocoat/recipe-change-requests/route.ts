import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { requireRole } from '@/lib/auth/rbac'
import { listRecipeChangeRequests } from '@/lib/cosmocoat/recipe-change-requests'

function isMissingTable(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2021'
}

export async function GET(req: NextRequest) {
  const { error } = await requireRole('STAFF', { adminMenu: 'cosmocoatRecipes' })
  if (error) return error

  const status = req.nextUrl.searchParams.get('status')?.trim() ?? 'PENDING'
  const recipeId = req.nextUrl.searchParams.get('recipeId')?.trim() ?? ''
  const limit = Number(req.nextUrl.searchParams.get('limit') ?? '50') || 50

  if (!['PENDING', 'APPROVED', 'REJECTED'].includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  }

  try {
    const items = await listRecipeChangeRequests({
      status: status as 'PENDING' | 'APPROVED' | 'REJECTED',
      recipeId: recipeId || undefined,
      limit,
    })
    return NextResponse.json({ items })
  } catch (err) {
    if (isMissingTable(err)) {
      return NextResponse.json({ error: '配方审批表不存在，请先运行数据库迁移' }, { status: 503 })
    }
    throw err
  }
}
