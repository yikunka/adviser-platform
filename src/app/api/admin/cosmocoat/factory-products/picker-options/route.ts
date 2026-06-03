import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { requireRole } from '@/lib/auth/rbac'
import { listFactoryProductPickerOptions } from '@/lib/cosmocoat/factory-product-picker'

function isMissingTable(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2021'
}

export async function GET(req: NextRequest) {
  const { error } = await requireRole('STAFF', { adminMenu: 'cosmocoatProductionOrders' })
  if (error) return error

  const q = req.nextUrl.searchParams.get('q')?.trim() ?? ''
  const recipeId = req.nextUrl.searchParams.get('recipeId')?.trim() ?? ''
  const id = req.nextUrl.searchParams.get('id')?.trim() ?? ''
  const requireCurrentRecipe =
    req.nextUrl.searchParams.get('requireCurrentRecipe') !== 'false'
  const limit = Math.min(
    100,
    Math.max(1, Number(req.nextUrl.searchParams.get('limit') ?? '50') || 50),
  )

  try {
    const items = await listFactoryProductPickerOptions({
      q,
      recipeId: recipeId || undefined,
      id: id || undefined,
      requireCurrentRecipe,
      limit,
    })
    return NextResponse.json({ items })
  } catch (err) {
    if (isMissingTable(err)) {
      return NextResponse.json({ error: '产品表不存在，请先运行数据库迁移' }, { status: 503 })
    }
    throw err
  }
}
