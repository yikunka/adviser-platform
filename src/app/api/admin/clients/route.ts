import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'

/** Portal client accounts for linking companies (admin). */
export async function GET(req: NextRequest) {
  const { error } = await requireRole('STAFF')
  if (error) return error

  const signedUpOnly = req.nextUrl.searchParams.get('signedUpOnly') === 'true'

  const clients = await prisma.user.findMany({
    where: {
      role: 'CLIENT',
      ...(signedUpOnly ? { emailVerified: { not: null } } : {}),
    },
    select: {
      id: true,
      email: true,
      nameEn: true,
      nameZh: true,
      emailVerified: true,
    },
    orderBy: { email: 'asc' },
    take: 1000,
  })

  return NextResponse.json({ clients })
}
