import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'
import { logAudit } from '@/lib/audit/logger'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, error } = await requireRole('STAFF')
  if (error) return error

  const { id } = await params
  const doc = await prisma.document.findUnique({ where: { id } })
  if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const updated = await prisma.document.update({
    where: { id },
    data: { deletedAt: new Date() },
  })
  await logAudit(session!.user.id, 'DELETE', 'Document', id, doc, updated)
  return NextResponse.json({ message: 'Deleted' })
}
