import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { requireRole } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'
import { assertCompanyAccessible, resolveEntityGroupAccess } from '@/lib/entity-groups/access'

function apiError(error: string, status = 400) {
  return NextResponse.json({ error, toast: error }, { status })
}

export async function GET(req: NextRequest) {
  const { session, error } = await requireRole('STAFF', { adminMenu: 'financial' })
  if (error) return error

  const companyId = req.nextUrl.searchParams.get('companyId')
  if (!companyId) return apiError('Company is required.')

  const access = await resolveEntityGroupAccess(session!.user.id, session!.user.role)
  if (!(await assertCompanyAccessible(access, companyId))) return apiError('Forbidden', 403)

  try {
    const [totalAccounts, draftJournals, postedJournals, ledgerEntries] = await Promise.all([
      prisma.finAccount.count({ where: { companyId } }),
      prisma.journalEntry.count({ where: { companyId, status: 'DRAFT' } }),
      prisma.journalEntry.count({ where: { companyId, status: 'POSTED' } }),
      prisma.ledger.count({ where: { companyId } }),
    ])

    return NextResponse.json({
      stats: { totalAccounts, draftJournals, postedJournals, ledgerEntries },
    })
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2021') {
      return NextResponse.json({
        stats: { totalAccounts: 0, draftJournals: 0, postedJournals: 0, ledgerEntries: 0 },
      })
    }
    throw err
  }
}
