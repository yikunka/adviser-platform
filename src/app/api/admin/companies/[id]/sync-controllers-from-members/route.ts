import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'
import { logAudit } from '@/lib/audit/logger'
import { syncControllersFromMembers } from '@/lib/company/sync-controllers-from-members'

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, error } = await requireRole('STAFF', { adminMenu: 'companies' })
  if (error) return error

  const { id: companyId } = await params
  const company = await prisma.company.findUnique({ where: { id: companyId }, select: { id: true } })
  if (!company) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const result = await syncControllersFromMembers(companyId)
  await logAudit(
    session!.user.id,
    'SYNC_CONTROLLERS_FROM_MEMBERS',
    'Company',
    companyId,
    null,
    result,
  )
  return NextResponse.json(result)
}
