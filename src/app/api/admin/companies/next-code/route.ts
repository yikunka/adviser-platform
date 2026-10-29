import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/rbac'
import { COMPANY_JURISDICTIONS } from '@/lib/company/jurisdiction'
import { nextCompanyCode } from '@/lib/company/next-company-code'

/** Preview the next company code for a jurisdiction (does not reserve it). */
export async function GET(req: NextRequest) {
  const { error } = await requireRole('STAFF', { adminMenu: 'companies' })
  if (error) return error

  const jurisdiction = req.nextUrl.searchParams.get('jurisdiction') ?? ''
  if (!(COMPANY_JURISDICTIONS as readonly string[]).includes(jurisdiction)) {
    return NextResponse.json({ error: 'Invalid jurisdiction' }, { status: 400 })
  }

  const code = await nextCompanyCode(jurisdiction)
  return NextResponse.json({ code, jurisdiction })
}
