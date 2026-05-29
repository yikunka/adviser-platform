import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/rbac'
import { buildFinancialReports } from '@/lib/financial/reports'
import { financialReportFilterSchema } from '@/lib/financial/schemas'

function apiError(error: string, status = 400) {
  return NextResponse.json({ error, toast: error }, { status })
}

export async function GET(req: NextRequest) {
  const { error } = await requireRole('STAFF', { adminMenu: 'financial' })
  if (error) return error

  const period = req.nextUrl.searchParams.get('period')
  const companyId = req.nextUrl.searchParams.get('companyId') ?? undefined
  const groupId = req.nextUrl.searchParams.get('groupId') ?? undefined
  const parsed = financialReportFilterSchema.safeParse({ period, companyId, groupId })
  if (!parsed.success) {
    return apiError('Period is required in YYYY-MM format.')
  }

  try {
    const reports = await buildFinancialReports(parsed.data.period, {
      companyId: parsed.data.companyId,
      groupId: parsed.data.groupId,
    })
    return NextResponse.json({ reports })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to generate financial reports.'
    return apiError(message, 500)
  }
}
