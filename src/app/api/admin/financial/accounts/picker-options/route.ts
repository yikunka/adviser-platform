import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'
import { assertCompanyAccessible, resolveCompanyAccess } from '@/lib/company-access'
import { getJournalAccountPickerAccounts } from '@/lib/financial/journal-account-picker'
import { ensureDefaultChartOfAccounts } from '@/lib/financial/default-chart-of-accounts'

function apiError(error: string, status = 400) {
  return NextResponse.json({ error, toast: error }, { status })
}

export async function GET(req: NextRequest) {
  const { session, error } = await requireRole('STAFF', { adminMenu: 'financial' })
  if (error) return error

  const companyId = req.nextUrl.searchParams.get('companyId')
  if (!companyId) return apiError('Company is required.')

  const access = await resolveCompanyAccess(session!.user.id, session!.user.role)
  if (!(await assertCompanyAccessible(access, companyId))) return apiError('Forbidden', 403)

  const q = (req.nextUrl.searchParams.get('q') || '').trim()
  const id = req.nextUrl.searchParams.get('id')
  const limit = Math.min(Number(req.nextUrl.searchParams.get('limit') || 50), 100)

  await ensureDefaultChartOfAccounts(companyId, prisma)

  if (id) {
    const accounts = await prisma.finAccount.findMany({
      where: { companyId, id },
      select: { id: true, code: true, name: true, type: true, parentId: true, level: true, sortOrder: true },
      take: 1,
    })
    return NextResponse.json({ items: accounts })
  }

  const accounts = await prisma.finAccount.findMany({
    where: { companyId },
    select: { id: true, code: true, name: true, type: true, parentId: true, level: true, sortOrder: true },
    orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
  })

  const query = q.toLowerCase()
  const items = getJournalAccountPickerAccounts(accounts)
    .filter(account => {
      if (!query) return true
      return account.code.toLowerCase().includes(query) || account.name.toLowerCase().includes(query)
    })
    .slice(0, limit)

  return NextResponse.json({ items })
}
