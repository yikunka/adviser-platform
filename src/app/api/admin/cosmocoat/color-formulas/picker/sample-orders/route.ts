import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { requireRole } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'

function isMissingTable(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2021'
}

export async function GET(req: NextRequest) {
  const { error } = await requireRole('STAFF', { adminMenu: 'cosmocoatColorFormulas' })
  if (error) return error

  const q = req.nextUrl.searchParams.get('q')?.trim() ?? ''
  const limit = Math.min(50, Math.max(1, Number(req.nextUrl.searchParams.get('limit') ?? '20') || 20))

  const where: Prisma.CosSampleOrderWhereInput = q
    ? {
        OR: [
          { code: { contains: q, mode: 'insensitive' } },
          { sampleKind: { contains: q, mode: 'insensitive' } },
          { notes: { contains: q, mode: 'insensitive' } },
          { customer: { code: { contains: q, mode: 'insensitive' } } },
          { customer: { name: { contains: q, mode: 'insensitive' } } },
          { salesEmployee: { is: { code: { contains: q, mode: 'insensitive' } } } },
          { salesEmployee: { is: { name: { contains: q, mode: 'insensitive' } } } },
          { technicalEmployee: { is: { code: { contains: q, mode: 'insensitive' } } } },
          { technicalEmployee: { is: { name: { contains: q, mode: 'insensitive' } } } },
        ],
      }
    : {}

  try {
    const items = await prisma.cosSampleOrder.findMany({
      where,
      select: {
        id: true,
        code: true,
        status: true,
        sampleKind: true,
        createdAt: true,
        customer: { select: { id: true, code: true, name: true } },
        salesEmployee: { select: { id: true, code: true, name: true } },
        technicalEmployee: { select: { id: true, code: true, name: true } },
      },
      orderBy: [{ createdAt: 'desc' }],
      take: limit,
    })

    return NextResponse.json({
      items: items.map(item => ({
        id: item.id,
        code: item.code,
        status: item.status,
        sampleKind: item.sampleKind,
        createdAt: item.createdAt.toISOString(),
        customer: item.customer,
        salesEmployee: item.salesEmployee,
        technicalEmployee: item.technicalEmployee,
      })),
    })
  } catch (err) {
    if (isMissingTable(err)) {
      return NextResponse.json({ error: '打样单表不存在，请先运行数据库迁移' }, { status: 503 })
    }
    throw err
  }
}
