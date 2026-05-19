import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireRole } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'
import { logAudit } from '@/lib/audit/logger'

const patchDocSchema = z.object({
  notes:              z.string().max(500).optional().nullable(),
  submissionDate:     z.string().optional().nullable(),
  customDocumentType: z.string().max(100).trim().optional().nullable(),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, error } = await requireRole('STAFF', { adminMenu: 'companies' })
  if (error) return error

  const { id } = await params
  const body = await req.json().catch(() => null)
  const parsed = patchDocSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 })

  const doc = await prisma.document.findUnique({ where: { id } })
  if (!doc || doc.deletedAt) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const updated = await prisma.document.update({
    where: { id },
    data: {
      ...(parsed.data.notes              !== undefined ? { notes:              parsed.data.notes              || null } : {}),
      ...(parsed.data.submissionDate     !== undefined ? { submissionDate:     parsed.data.submissionDate ? new Date(parsed.data.submissionDate) : null } : {}),
      ...(parsed.data.customDocumentType !== undefined ? { customDocumentType: parsed.data.customDocumentType || null } : {}),
    },
  })
  await logAudit(session!.user.id, 'UPDATE', 'Document', id, doc, updated)
  return NextResponse.json({ document: updated })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, error } = await requireRole('STAFF', { adminMenu: 'companies' })
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
