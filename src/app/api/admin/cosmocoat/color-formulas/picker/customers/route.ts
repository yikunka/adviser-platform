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
  const limit = Math.min(100, Math.max(1, Number(req.nextUrl.searchParams.get('limit') ?? '30') || 30))

  const where: Prisma.CosCustomerWhereInput = q
    ? {
        OR: [
          { code: { contains: q, mode: 'insensitive' } },
          { name: { contains: q, mode: 'insensitive' } },
          { phone: { contains: q, mode: 'insensitive' } },
          { address: { contains: q, mode: 'insensitive' } },
        ],
      }
    : {}

  try {
    const customers = await prisma.cosCustomer.findMany({
      where,
      select: {
        id: true,
        code: true,
        name: true,
        phone: true,
      },
      orderBy: [{ name: 'asc' }],
      take: limit,
    })

    return NextResponse.json({ customers })
  } catch (err) {
    if (isMissingTable(err)) {
      return NextResponse.json({ error: '客户表不存在，请先运行数据库迁移' }, { status: 503 })
    }
    throw err
  }
}
