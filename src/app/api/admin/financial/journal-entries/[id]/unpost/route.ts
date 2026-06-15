import { NextRequest, NextResponse } from 'next/server'
import type { Session } from 'next-auth'
import { requireFinancialWriteRole } from '@/lib/financial/api-guard'
import { unpostJournalEntryById } from '@/lib/financial/post-journal-entry'

function apiError(error: string, status = 400) {
  return NextResponse.json({ error, toast: error }, { status })
}

async function handleUnpost(id: string, session: Session) {
  const result = await unpostJournalEntryById(id, session)
  if (!result.ok) return apiError(result.error, result.status)
  return NextResponse.json({
    entry: result.entry,
    message: 'Journal entry unposted.',
    toast: '日记账已撤销过账并恢复为待过账。',
  })
}

export async function PUT(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, error } = await requireFinancialWriteRole()
  if (error) return error

  const { id } = await params
  return handleUnpost(id, session)
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, error } = await requireFinancialWriteRole()
  if (error) return error

  const { id } = await params
  return handleUnpost(id, session)
}
