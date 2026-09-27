import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/rbac'
import { buildAnnualPlComparison } from '@/lib/financial/annual-pl-comparison-build'
import { financialAnnualComparisonFilterSchema } from '@/lib/financial/schemas'
import { resolveCompanyAccess } from '@/lib/company-access'
import { resolveFinancialReportScope } from '@/lib/financial/report-scope'

function apiError(error: string, status = 400) {
  return NextResponse.json({ error, toast: error }, { status })
}

export async function GET(req: NextRequest) {
  const { session, error } = await requireRole('STAFF', { adminMenu: 'financial' })
  if (error) return error

  const yearRaw = req.nextUrl.searchParams.get('year')
  const companyId = req.nextUrl.searchParams.get('companyId') ?? undefined
  const parsed = financialAnnualComparisonFilterSchema.safeParse({
    year: yearRaw ? Number(yearRaw) : undefined,
    companyId,
  })
  if (!parsed.success) {
    return apiError('Year is required as YYYY (2000–2100).')
  }

  try {
    const access = await resolveCompanyAccess(session!.user.id, session!.user.role)
    const scope = await resolveFinancialReportScope(access, parsed.data)
    const report = await buildAnnualPlComparison(parsed.data.year, {
      companyId: scope.companyId,
    })
    return NextResponse.json({ report })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to generate annual P&L comparison.'
    return apiError(
      message,
      message === 'Forbidden' ? 403 : message === 'Financial company not found' ? 404 : 500,
    )
  }
}
