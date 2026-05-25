import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth'
import { prisma } from '@/lib/db/prisma'

const STAFF_ROLES = new Set(['STAFF', 'COMPLIANCE', 'SUPER_ADMIN'])

export async function GET() {
  const session = await auth()
  if (!session?.user?.id || !STAFF_ROLES.has(session.user.role)) {
    return NextResponse.json({ ok: false }, { status: 401 })
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, isActive: true },
  })
  if (!user?.isActive) {
    return NextResponse.json({ ok: false }, { status: 401 })
  }

  return NextResponse.json({ ok: true })
}
