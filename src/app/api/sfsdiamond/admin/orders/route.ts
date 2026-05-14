import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth'
import { prisma } from '@/lib/db/prisma'

const ADMIN_ROLES = new Set(['STAFF', 'COMPLIANCE', 'SUPER_ADMIN'])

export async function GET(_req: NextRequest) {
  const session = await auth()
  if (!session || !ADMIN_ROLES.has(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const orders = await prisma.sfsOrder.findMany({
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { steps: true } } },
  })

  return NextResponse.json(orders)
}
