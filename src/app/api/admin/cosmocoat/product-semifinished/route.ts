import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { requireRole } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'
import {
  DEFAULT_SEMIFINISHED_CATEGORY,
  productSemifinishedListInclude,
  serializeProductSemifinished,
} from '@/lib/cosmocoat/product-semifinished'

function isMissingTable(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2021'
}

export async function GET(req: NextRequest) {
  const { error } = await requireRole('STAFF', { adminMenu: 'cosmocoatRecipes' })
  if (error) return error

  const q = req.nextUrl.searchParams.get('q')?.trim() ?? ''
  const category = req.nextUrl.searchParams.get('category')?.trim() ?? ''
  const page = Math.max(1, Number(req.nextUrl.searchParams.get('page') ?? '1') || 1)
  const limit = Math.min(200, Math.max(1, Number(req.nextUrl.searchParams.get('limit') ?? '50') || 50))
  const skip = (page - 1) * limit

  const where: Prisma.CosTableProductSemifinishedWhereInput = {
    ...(category ? { category } : {}),
    ...(q
      ? {
          OR: [
            { code: { contains: q, mode: 'insensitive' } },
            { name: { contains: q, mode: 'insensitive' } },
            { description: { contains: q, mode: 'insensitive' } },
          ],
        }
      : {}),
  }

  try {
    const [total, items, categories] = await Promise.all([
      prisma.cosTableProductSemifinished.count({ where }),
      prisma.cosTableProductSemifinished.findMany({
        where,
        include: productSemifinishedListInclude,
        orderBy: [{ category: 'asc' }, { code: 'asc' }],
        skip,
        take: limit,
      }),
      prisma.cosTableProductSemifinished.findMany({
        distinct: ['category'],
        select: { category: true },
        orderBy: { category: 'asc' },
      }),
    ])

    return NextResponse.json({
      items: items.map(serializeProductSemifinished),
      categories: categories.map(row => row.category).filter(Boolean),
      defaultCategory: DEFAULT_SEMIFINISHED_CATEGORY,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    })
  } catch (err) {
    if (isMissingTable(err)) {
      return NextResponse.json({ error: '半成品表不存在，请先运行数据库迁移' }, { status: 503 })
    }
    throw err
  }
}
