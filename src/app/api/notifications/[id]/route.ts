import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'

export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, error } = await requireRole('CLIENT')
  if (error) return error

  const { id } = await params

  const notification = await prisma.notification.findUnique({ where: { id } })
  if (!notification) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (notification.userId !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const updated = await prisma.notification.update({
    where: { id },
    data: { isRead: true },
  })

  return NextResponse.json(updated)
}
