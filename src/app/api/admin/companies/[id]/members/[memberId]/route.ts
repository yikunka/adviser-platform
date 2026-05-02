import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'
import { logAudit } from '@/lib/audit/logger'
import { z } from 'zod'

const updateSchema = z.object({
  nameEn: z.string().min(1).max(200).optional(),
  nameZh: z.string().max(200).optional(),
  shareClass: z.enum(['ORDINARY', 'PREFERENCE', 'OTHER']).optional(),
  registeredAddress: z.string().min(1).max(500).optional(),
  occupation: z.string().max(200).optional(),
  status: z.enum(['ACTIVE', 'TRANSFERRED_OUT']).optional(),
})

type Params = { params: Promise<{ id: string; memberId: string }> }

export async function PATCH(req: NextRequest, { params }: Params) {
  const { session, error } = await requireRole('STAFF')
  if (error) return error

  const { id: companyId, memberId } = await params
  const before = await prisma.member.findFirst({ where: { id: memberId, companyId } })
  if (!before) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json().catch(() => null)
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })

  const member = await prisma.member.update({ where: { id: memberId }, data: parsed.data })
  await logAudit(session!.user.id, 'UPDATE', 'Member', memberId, before, member)
  return NextResponse.json(member)
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { session, error } = await requireRole('STAFF')
  if (error) return error

  const { id: companyId, memberId } = await params
  const member = await prisma.member.findFirst({ where: { id: memberId, companyId } })
  if (!member) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.member.delete({ where: { id: memberId } })
  await logAudit(session!.user.id, 'DELETE', 'Member', memberId, member, null)
  return NextResponse.json({ message: 'Deleted' })
}
