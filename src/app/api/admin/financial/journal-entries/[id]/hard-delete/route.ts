import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/rbac'
import { assertCompanyAccessible, resolveCompanyAccess } from '@/lib/company-access'
import { prisma } from '@/lib/db/prisma'

function apiError(error: string, status = 400) {
  return NextResponse.json({ error, toast: error }, { status })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, error } = await requireRole('STAFF', { adminMenu: 'financial' })
  if (error) return error

  const { id } = await params
  const entry = await prisma.journalEntry.findUnique({
    where: { id },
    select: { id: true, voucherNo: true, status: true, companyId: true },
  })
  if (!entry) return apiError('Journal entry not found.', 404)
  if (entry.status !== 'CANCELLED') return apiError('Only cancelled journal entries can be permanently deleted.')

  const access = await resolveCompanyAccess(session.user.id, session.user.role)
  if (!entry.companyId || !(await assertCompanyAccessible(access, entry.companyId))) return apiError('Forbidden', 403)

  await prisma.$transaction(async tx => {
    await tx.ledger.deleteMany({ where: { entryId: id } })
    await tx.auditLog.deleteMany({ where: { entityType: 'JournalEntry', entityId: id } })
    await tx.$executeRaw`
      DELETE FROM "audit_logs"
      WHERE POSITION(${id} IN COALESCE("beforeData"::text, '')) > 0
         OR POSITION(${id} IN COALESCE("afterData"::text, '')) > 0
         OR POSITION(${entry.voucherNo} IN COALESCE("beforeData"::text, '')) > 0
         OR POSITION(${entry.voucherNo} IN COALESCE("afterData"::text, '')) > 0
    `
    await tx.journalEntry.delete({ where: { id } })
  })

  return NextResponse.json({
    id,
    voucherNo: entry.voucherNo,
    message: 'Journal entry permanently deleted.',
    toast: 'Journal entry permanently deleted.',
  })
}
