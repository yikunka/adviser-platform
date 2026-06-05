import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { requireRole } from '@/lib/auth/rbac'
import { listRecipeFactoryProductPickerCategories, listRecipeFactoryProductPickerOptions } from '@/lib/cosmocoat/recipe-factory-product-picker'

export const dynamic = 'force-dynamic'

function isMissingTable(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2021'
}

export async function GET(req: NextRequest) {
  const { error } = await requireRole('STAFF', { adminMenu: 'cosmocoatRecipes' })
  if (error) return error

  const q = req.nextUrl.searchParams.get('q')?.trim() ?? ''
  const categoryId = req.nextUrl.searchParams.get('categoryId')?.trim() ?? ''
  const limit = Math.min(
    500,
    Math.max(1, Number(req.nextUrl.searchParams.get('limit') ?? '200') || 200),
  )

  try {
    const [items, categories] = await Promise.all([
      listRecipeFactoryProductPickerOptions({ q, categoryId, limit }),
      listRecipeFactoryProductPickerCategories(),
    ])
    return NextResponse.json({ items, categories })
  } catch (err) {
    if (isMissingTable(err)) {
      return NextResponse.json({ error: '工厂产品表不存在，请先运行数据库迁移' }, { status: 503 })
    }
    throw err
  }
}
