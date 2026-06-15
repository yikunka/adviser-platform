import { NextRequest, NextResponse } from 'next/server'
import { assertCompanyAccessible, resolveCompanyAccess } from '@/lib/company-access'
import { prisma } from '@/lib/db/prisma'
import { assertFinancialManager, requireFinancialWriteRole } from '@/lib/financial/api-guard'

function apiError(error: string, status = 400) {
  return NextResponse.json({ error, toast: error }, { status })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, error } = await requireFinancialWriteRole()
  if (error) return error

  const { id } = await params
  const entry = await prisma.journalEntry.findUnique({
    where: { id },
    select: { id: true, voucherNo: true, status: true, companyId: true },
  })
  if (!entry) return apiError('日记账不存在。', 404)
  if (entry.status !== 'CANCELLED') return apiError('只有已取消的日记账可以彻底删除。')

  const access = await resolveCompanyAccess(session.user.id, session.user.role)
  if (!entry.companyId || !(await assertCompanyAccessible(access, entry.companyId))) return apiError('无权操作该日记账。', 403)
  const managerError = await assertFinancialManager(session, entry.companyId)
  if (managerError) return managerError

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
    message: '日记账已彻底删除。',
    toast: '日记账已彻底删除。',
  })
}
