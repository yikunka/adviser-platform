import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/rbac'
import { buildFinancialReports } from '@/lib/financial/reports'
import { financialReportFilterSchema } from '@/lib/financial/schemas'
import {
  resolveCompanyAccess,
} from '@/lib/company-access'
import { resolveFinancialReportScope } from '@/lib/financial/report-scope'

function apiError(error: string, status = 400) {
  return NextResponse.json({ error, toast: error }, { status })
}

export async function GET(req: NextRequest) {
  const { session, error } = await requireRole('STAFF', { adminMenu: 'financial' })
  if (error) return error

  const period = req.nextUrl.searchParams.get('period')
  const companyId = req.nextUrl.searchParams.get('companyId') ?? undefined
  const reportGroupId = req.nextUrl.searchParams.get('reportGroupId') ?? undefined
  const parsed = financialReportFilterSchema.safeParse({ period, companyId, reportGroupId })
  if (!parsed.success) {
    return apiError('Period is required in YYYY-MM format.')
  }

  try {
    const access = await resolveCompanyAccess(session!.user.id, session!.user.role)
    const scope = await resolveFinancialReportScope(access, parsed.data)
    const reports = await buildFinancialReports(parsed.data.period, {
      companyId: scope.companyId,
      companyIds: scope.companyIds,
    })
    return NextResponse.json({ reports })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to generate financial reports.'
    return apiError(
      message,
      message === 'Forbidden' ? 403 : message === 'Financial company not found' ? 404 : 500,
    )
  }
}
