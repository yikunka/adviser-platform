import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { requireRole } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'
import { serializeColorFormula } from '@/lib/cosmocoat/color-formulas'

function isMissingTable(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2021'
}

export async function GET(req: NextRequest) {
  const { error } = await requireRole('STAFF', { adminMenu: 'cosmocoatSampleOrders' })
  if (error) return error

  const q = req.nextUrl.searchParams.get('q')?.trim() ?? ''
  const limit = Math.min(50, Math.max(1, Number(req.nextUrl.searchParams.get('limit') ?? '20') || 20))

  const where: Prisma.CosTableColorFormulaWhereInput = q
    ? {
        OR: [
          { code: { contains: q, mode: 'insensitive' } },
          { name: { contains: q, mode: 'insensitive' } },
          { targetColor: { contains: q, mode: 'insensitive' } },
          { customerName: { contains: q, mode: 'insensitive' } },
        ],
      }
    : {}

  try {
    const rows = await prisma.cosTableColorFormula.findMany({
      where,
      include: {
        subcategory: { select: { id: true, parentCategory: true, code: true, name: true } },
        factoryProduct: {
          select: {
            id: true,
            productCode: true,
            name: true,
            category: { select: { id: true, name: true, slug: true } },
          },
        },
        sourceRecipe: { select: { id: true, code: true, name: true } },
        _count: { select: { items: true } },
      },
      orderBy: [{ updatedAt: 'desc' }],
      take: limit,
    })

    return NextResponse.json({
      items: rows.map(row => {
        const serialized = serializeColorFormula(row)
        return {
          id: serialized.id,
          code: serialized.code,
          name: serialized.name,
          categoryLabel: serialized.categoryLabel,
          targetColor: serialized.targetColor,
        }
      }),
    })
  } catch (err) {
    if (isMissingTable(err)) {
      return NextResponse.json({ error: '调色配方表不存在，请先运行数据库迁移' }, { status: 503 })
    }
    throw err
  }
}
