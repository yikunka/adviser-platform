import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'

export async function GET() {
  const { error } = await requireRole('STAFF', { adminMenu: 'companies' })
  if (error) return error

  const users = await prisma.user.findMany({
    where: {
      isActive: true,
      role: { in: ['STAFF', 'COMPLIANCE', 'SUPER_ADMIN'] },
    },
    orderBy: [{ nameEn: 'asc' }, { email: 'asc' }],
    select: {
      id: true,
      email: true,
      nameEn: true,
      role: true,
    },
  })

  return NextResponse.json({ users })
}
