import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'
import { logAudit } from '@/lib/audit/logger'

type RouteCtx = { params: Promise<{ id: string; recordId: string }> }

export async function DELETE(_req: NextRequest, { params }: RouteCtx) {
  const { session, error } = await requireRole('STAFF', { adminMenu: 'companies' })
  if (error) return error

  const { id: companyId, recordId } = await params
  const record = await prisma.companyFileManagementRecord.findFirst({
    where: { id: recordId, companyId },
  })
  if (!record) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.companyFileManagementRecord.delete({ where: { id: recordId } })
  await logAudit(session!.user.id, 'DELETE', 'CompanyFileManagementRecord', recordId, record, null)
  return NextResponse.json({ ok: true })
}
