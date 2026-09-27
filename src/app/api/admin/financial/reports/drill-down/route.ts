import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireRole } from '@/lib/auth/rbac'
import { resolveCompanyAccess } from '@/lib/company-access'
import { loadReportDrillDown } from '@/lib/financial/report-drill-down'
import { resolveFinancialReportScope } from '@/lib/financial/report-scope'

function apiError(error: string, status = 400) {
  return NextResponse.json({ error, toast: error }, { status })
}

const schema = z.object({
  period: z.string().regex(/^\d{4}-\d{2}$/),
  accountId: z.string().min(1).max(120),
  mode: z.enum(['period', 'ytd']).default('period'),
  companyId: z.string().cuid(),
})

export async function GET(req: NextRequest) {
  const { session, error } = await requireRole('STAFF', { adminMenu: 'financial' })
  if (error) return error

  const parsed = schema.safeParse({
    period: req.nextUrl.searchParams.get('period') || undefined,
    accountId: req.nextUrl.searchParams.get('accountId') || undefined,
    mode: req.nextUrl.searchParams.get('mode') || 'period',
    companyId: req.nextUrl.searchParams.get('companyId') || undefined,
  })
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? 'Invalid drill-down filters.')
  }

  try {
    const access = await resolveCompanyAccess(session!.user.id, session!.user.role)
    const scope = await resolveFinancialReportScope(access, {
      companyId: parsed.data.companyId,
    })
    const companyIds = scope.companyId ? [scope.companyId] : []
    if (companyIds.length === 0) {
      return apiError('Financial company not found', 404)
    }

    const drillDown = await loadReportDrillDown({
      accountId: parsed.data.accountId,
      period: parsed.data.period,
      mode: parsed.data.mode,
      companyIds,
    })
    return NextResponse.json({ drillDown })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load report drill-down.'
    return apiError(
      message,
      message === 'Forbidden' ? 403 : message === 'Financial company not found' ? 404 : 500,
    )
  }
}
