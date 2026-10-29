import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'

export async function GET() {
  const { error } = await requireRole('STAFF', { adminMenu: 'kyc' })
  if (error) return error

  // Advise / TCSP portal clients only — not SFS Diamond or other platforms
  const clients = await prisma.user.findMany({
    where: {
      role: 'CLIENT',
      platform: 'ADVISER',
      emailVerified: { not: null },
    },
    select: {
      id: true,
      email: true,
      nameEn: true,
      nameZh: true,
    },
    orderBy: { email: 'asc' },
    take: 1000,
  })

  return NextResponse.json({ clients })
}
