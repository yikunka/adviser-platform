import { NextRequest, NextResponse } from 'next/server'
import { logAudit } from '@/lib/audit/logger'
import { prisma } from '@/lib/db/prisma'
import { apiError, guardFinancialCompany, handleFinancialError } from '@/lib/financial/api-guard'
import { postCreditNote } from '@/lib/financial/fin-credit-notes'
import { serializeCreditNote } from '@/lib/financial/subledger-serializers'

export async function PUT(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const before = await prisma.finCreditNote.findUnique({ where: { id }, select: { companyId: true } })
  if (!before) return apiError('通知单不存在。', 404)

  const guard = await guardFinancialCompany(before.companyId)
  if (guard.error) return guard.error

  try {
    const note = await postCreditNote({ id, companyId: before.companyId, userId: guard.session.user.id })
    await logAudit(guard.session.user.id, 'POST', 'FinCreditNote', id, null, { noteNo: note.noteNo })
    return NextResponse.json({ note: serializeCreditNote(note), toast: `通知单 ${note.noteNo} 已过账。` })
  } catch (err) {
    return handleFinancialError(err)
  }
}
