import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { requireRole } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'

function isMissingTable(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2021'
}

export async function GET() {
  const { error } = await requireRole('STAFF', { adminMenu: 'cosmocoatProcessKits' })
  if (error) return error

  try {
    const testers = await prisma.cosEmployee.findMany({
      where: {
        employeeType: 'TECHNICAL',
        isActive: true,
      },
      orderBy: [{ code: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        code: true,
        name: true,
        position: true,
        department: true,
      },
    })

    return NextResponse.json({ testers })
  } catch (err) {
    if (isMissingTable(err)) {
      return NextResponse.json({ error: '员工表不存在，请先运行数据库迁移' }, { status: 503 })
    }
    throw err
  }
}
