import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/rbac'
import { assertCompanyAccessible, resolveCompanyAccess } from '@/lib/company-access'
import { companyBillingSnapshot } from '@/lib/invoice/company-billing'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ companyId: string }> },
) {
  const { session, error } = await requireRole('STAFF', { adminMenu: 'invoices' })
  if (error) return error

  const { companyId } = await params
  const access = await resolveCompanyAccess(session!.user.id, session!.user.role)
  if (!(await assertCompanyAccessible(access, companyId))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const billing = await companyBillingSnapshot(companyId)
  if (!billing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(billing)
}
