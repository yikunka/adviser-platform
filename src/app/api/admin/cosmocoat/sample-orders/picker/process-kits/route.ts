import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { requireRole } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'

function isMissingTable(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2021'
}

export async function GET(req: NextRequest) {
  const { error } = await requireRole('STAFF', { adminMenu: 'cosmocoatSampleOrders' })
  if (error) return error

  const q = req.nextUrl.searchParams.get('q')?.trim() ?? ''
  const limit = Math.min(50, Math.max(1, Number(req.nextUrl.searchParams.get('limit') ?? '20') || 20))

  const where: Prisma.CosProcessKitWhereInput = {
    status: { not: 'ARCHIVED' },
    ...(q
      ? {
          OR: [
            { code: { contains: q, mode: 'insensitive' } },
            { name: { contains: q, mode: 'insensitive' } },
          ],
        }
      : {}),
  }

  try {
    const items = await prisma.cosProcessKit.findMany({
      where,
      select: { id: true, code: true, name: true, status: true },
      orderBy: [{ updatedAt: 'desc' }],
      take: limit,
    })

    return NextResponse.json({ items })
  } catch (err) {
    if (isMissingTable(err)) {
      return NextResponse.json({ error: '工艺书表不存在，请先运行数据库迁移' }, { status: 503 })
    }
    throw err
  }
}
