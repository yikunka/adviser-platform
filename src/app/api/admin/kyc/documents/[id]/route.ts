import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'
import { logAudit } from '@/lib/audit/logger'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, error } = await requireRole('STAFF', { adminMenu: 'kyc' })
  if (error) return error

  const { id } = await params
  const doc = await prisma.kYCDocument.findUnique({ where: { id } })
  if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.kYCDocument.delete({ where: { id } })
  await logAudit(session!.user.id, 'DELETE', 'KYCDocument', id, doc, null)

  return NextResponse.json({ message: 'Deleted' })
}
