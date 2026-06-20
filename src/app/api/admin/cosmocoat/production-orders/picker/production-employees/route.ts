import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { requirePermission } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'

function isMissingTable(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2021'
}

export async function GET(req: NextRequest) {
  const { error } = await requirePermission('cosmocoatProductionOrders.edit', 'STAFF')
  if (error) return error

  const q = req.nextUrl.searchParams.get('q')?.trim() ?? ''
  const limit = Math.min(200, Math.max(1, Number(req.nextUrl.searchParams.get('limit') ?? '200') || 200))

  const where: Prisma.CosEmployeeWhereInput = {
    employeeType: 'PRODUCTION',
    isActive: true,
    ...(q
      ? {
          OR: [
            { code: { contains: q, mode: 'insensitive' } },
            { name: { contains: q, mode: 'insensitive' } },
            { phone: { contains: q, mode: 'insensitive' } },
            { email: { contains: q, mode: 'insensitive' } },
            { position: { contains: q, mode: 'insensitive' } },
            { department: { contains: q, mode: 'insensitive' } },
          ],
        }
      : {}),
  }

  try {
    const employees = await prisma.cosEmployee.findMany({
      where,
      select: {
        id: true,
        code: true,
        name: true,
        employeeType: true,
        position: true,
        department: true,
        phone: true,
        email: true,
        isActive: true,
      },
      orderBy: [{ code: 'asc' }, { name: 'asc' }],
      take: limit,
    })

    return NextResponse.json({ employees })
  } catch (err) {
    if (isMissingTable(err)) {
      return NextResponse.json({ error: '员工表不存在，请先运行数据库迁移' }, { status: 503 })
    }
    throw err
  }
}
