import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { requireRole } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'

function isMissingTable(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2021'
}

export async function GET(req: NextRequest) {
  const { error } = await requireRole('STAFF', { adminMenu: 'cosmocoatCustomers' })
  if (error) return error

  const employeeType = req.nextUrl.searchParams.get('employeeType')?.trim() ?? ''
  if (employeeType !== 'SALES' && employeeType !== 'TECHNICAL') {
    return NextResponse.json({ error: '无效的员工类型' }, { status: 400 })
  }

  const q = req.nextUrl.searchParams.get('q')?.trim() ?? ''
  const limit = Math.min(100, Math.max(1, Number(req.nextUrl.searchParams.get('limit') ?? '50') || 50))

  const where: Prisma.CosEmployeeWhereInput = {
    employeeType,
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
      orderBy: [{ name: 'asc' }, { code: 'asc' }],
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
