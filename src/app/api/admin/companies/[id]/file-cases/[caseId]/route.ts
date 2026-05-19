import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireRole } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'

const patchSchema = z.object({
  name:     z.string().trim().min(1).max(200).optional(),
  caseDate: z.string().optional().nullable(),
  remark:   z.string().trim().max(1000).optional().nullable(),
})

type RouteCtx = { params: Promise<{ id: string; caseId: string }> }

export async function PATCH(req: NextRequest, { params }: RouteCtx) {
  const { error } = await requireRole('STAFF', { adminMenu: 'companies' })
  if (error) return error

  const { id, caseId } = await params
  const body = await req.json().catch(() => null)
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 })

  const fc = await prisma.companyFileCase.findFirst({ where: { id: caseId, companyId: id } })
  if (!fc) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const updated = await prisma.companyFileCase.update({
    where: { id: caseId },
    data: {
      ...(parsed.data.name     !== undefined ? { name: parsed.data.name }                                         : {}),
      ...(parsed.data.remark   !== undefined ? { remark: parsed.data.remark || null }                             : {}),
      ...(parsed.data.caseDate !== undefined ? { caseDate: parsed.data.caseDate ? new Date(parsed.data.caseDate) : null } : {}),
    },
    include: { documents: { where: { deletedAt: null }, orderBy: { createdAt: 'desc' } } },
  })

  return NextResponse.json({ fileCase: updated })
}

export async function DELETE(_req: NextRequest, { params }: RouteCtx) {
  const { error } = await requireRole('STAFF', { adminMenu: 'companies' })
  if (error) return error

  const { id, caseId } = await params
  const fc = await prisma.companyFileCase.findFirst({ where: { id: caseId, companyId: id } })
  if (!fc) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Soft-delete all documents in the case, then delete the case itself
  await prisma.document.updateMany({ where: { fileCaseId: caseId }, data: { deletedAt: new Date() } })
  await prisma.companyFileCase.delete({ where: { id: caseId } })

  return NextResponse.json({ message: 'Deleted' })
}
