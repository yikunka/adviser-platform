import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { logAudit } from '@/lib/audit/logger'
import { prisma } from '@/lib/db/prisma'
import { apiError, guardFinancialCompany, handleFinancialError } from '@/lib/financial/api-guard'
import { createCreditNote, creditNoteInclude } from '@/lib/financial/fin-credit-notes'
import { creditNoteCreateSchema } from '@/lib/financial/schemas'
import { serializeCreditNote } from '@/lib/financial/subledger-serializers'

export async function GET(req: NextRequest) {
  const companyId = req.nextUrl.searchParams.get('companyId')
  const guard = await guardFinancialCompany(companyId)
  if (guard.error) return guard.error

  const kind = req.nextUrl.searchParams.get('kind')
  const partyId = req.nextUrl.searchParams.get('partyId')

  const where: Prisma.FinCreditNoteWhereInput = {
    companyId: companyId!,
    ...(kind === 'CUSTOMER' || kind === 'SUPPLIER' ? { kind } : {}),
    ...(partyId ? { partyId } : {}),
  }

  const notes = await prisma.finCreditNote.findMany({
    where,
    include: creditNoteInclude,
    orderBy: [{ issueDate: 'desc' }, { noteNo: 'desc' }],
  })
  return NextResponse.json({ notes: notes.map(serializeCreditNote) })
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const parsed = creditNoteCreateSchema.safeParse(body)
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message || '请检查通知单表单。')
  }

  const guard = await guardFinancialCompany(parsed.data.companyId)
  if (guard.error) return guard.error

  try {
    const note = await createCreditNote({ ...parsed.data, createdById: guard.session.user.id })
    await logAudit(guard.session.user.id, 'CREATE', 'FinCreditNote', note.id, null, { noteNo: note.noteNo })
    return NextResponse.json(
      { note: serializeCreditNote(note), toast: `通知单 ${note.noteNo} 已创建（草稿）。` },
      { status: 201 },
    )
  } catch (err) {
    return handleFinancialError(err)
  }
}
