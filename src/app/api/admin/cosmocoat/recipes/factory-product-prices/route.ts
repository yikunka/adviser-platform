import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { requireRole } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'

export const dynamic = 'force-dynamic'

function isMissingTable(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2021'
}

export async function GET(req: NextRequest) {
  const { error } = await requireRole('STAFF', { adminMenu: 'cosmocoatRecipes' })
  if (error) return error

  const ids = (req.nextUrl.searchParams.get('ids') ?? '')
    .split(',')
    .map(id => id.trim())
    .filter(Boolean)

  if (ids.length === 0) {
    return NextResponse.json({ prices: {} as Record<string, number | null> })
  }

  try {
    const products = await prisma.cosTableFactoryProduct.findMany({
      where: { id: { in: ids } },
      select: { id: true, currentRecipe: { select: { unitCost: true } } },
    })

    const prices = Object.fromEntries(
      products.map(product => [
        product.id,
        product.currentRecipe?.unitCost != null ? Number(product.currentRecipe.unitCost) : null,
      ]),
    )

    return NextResponse.json({ prices })
  } catch (err) {
    if (isMissingTable(err)) {
      return NextResponse.json({ error: '工厂产品表不存在，请先运行数据库迁移' }, { status: 503 })
    }
    throw err
  }
}
