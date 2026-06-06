import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { requireRole } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'
import { customerInclude, serializeCustomer } from '@/lib/cosmocoat/customers'

function isMissingTable(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2021'
}

export async function GET(req: NextRequest) {
  const { error } = await requireRole('STAFF', { adminMenu: 'cosmocoatSampleOrders' })
  if (error) return error

  const q = req.nextUrl.searchParams.get('q')?.trim() ?? ''
  const limit = Math.min(200, Math.max(1, Number(req.nextUrl.searchParams.get('limit') ?? '100') || 100))

  const where: Prisma.CosCustomerWhereInput = q
    ? {
        OR: [
          { code: { contains: q, mode: 'insensitive' } },
          { name: { contains: q, mode: 'insensitive' } },
          { phone: { contains: q, mode: 'insensitive' } },
        ],
      }
    : {}

  try {
    const items = await prisma.cosCustomer.findMany({
      where,
      include: customerInclude,
      orderBy: [{ name: 'asc' }],
      take: limit,
    })

    return NextResponse.json({
      customers: items.map(c => {
        const row = serializeCustomer(c)
        return { id: row.id, code: row.code, name: row.name, phone: row.phone }
      }),
    })
  } catch (err) {
    if (isMissingTable(err)) {
      return NextResponse.json({ error: '客户表不存在，请先运行数据库迁移' }, { status: 503 })
    }
    throw err
  }
}
