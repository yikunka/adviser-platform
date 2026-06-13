import { NextRequest, NextResponse } from 'next/server'
import { logAudit } from '@/lib/audit/logger'
import { prisma } from '@/lib/db/prisma'
import { apiError, guardFinancialCompany, handleFinancialError } from '@/lib/financial/api-guard'
import { voidCreditNote } from '@/lib/financial/fin-credit-notes'
import { serializeCreditNote } from '@/lib/financial/subledger-serializers'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const before = await prisma.finCreditNote.findUnique({ where: { id }, select: { companyId: true, noteNo: true } })
  if (!before) return apiError('通知单不存在。', 404)

  const guard = await guardFinancialCompany(before.companyId, { requireManager: true })
  if (guard.error) return guard.error

  const body = await req.json().catch(() => ({}))
  const reason = typeof body?.reason === 'string' ? body.reason.trim().slice(0, 500) : ''

  try {
    const note = await voidCreditNote({
      id,
      companyId: before.companyId,
      userId: guard.session.user.id,
      reason,
    })
    await logAudit(guard.session.user.id, 'VOID', 'FinCreditNote', id, null, { noteNo: before.noteNo, reason })
    return NextResponse.json({
      note: note ? serializeCreditNote(note) : null,
      toast: note ? `通知单 ${note.noteNo} 已作废（红冲）。` : `草稿通知单 ${before.noteNo} 已删除。`,
    })
  } catch (err) {
    return handleFinancialError(err)
  }
}
