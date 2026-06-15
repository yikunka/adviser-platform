import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireFinancialWriteRole } from '@/lib/financial/api-guard'
import { postJournalEntriesBatch } from '@/lib/financial/post-journal-entry'

const batchPostSchema = z.object({
  ids: z.array(z.string().trim().min(1)).min(1, '至少选择一条日记账。').max(100, '一次最多过账 100 条日记账。'),
})

function apiError(error: string, status = 400) {
  return NextResponse.json({ error, toast: error }, { status })
}

export async function POST(req: NextRequest) {
  const { session, error } = await requireFinancialWriteRole()
  if (error) return error

  const body = await req.json().catch(() => null)
  const parsed = batchPostSchema.safeParse(body)
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message || '请求参数无效。'
    return apiError(message)
  }

  const { posted, errors } = await postJournalEntriesBatch(parsed.data.ids, session)

  if (posted.length === 0) {
    const firstError = errors[0]?.error || '批量过账失败。'
    return apiError(firstError)
  }

  const message =
    errors.length > 0
      ? `已成功过账 ${posted.length} 条，${errors.length} 条失败。`
      : `已成功过账 ${posted.length} 条日记账。`

  return NextResponse.json({
    posted,
    errors,
    message,
    toast: message,
  })
}
