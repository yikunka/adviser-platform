import { NextRequest, NextResponse } from 'next/server'
import { type AccountType } from '@prisma/client'
import { requireRole } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'
import { assertCompanyAccessible, resolveCompanyAccess } from '@/lib/company-access'
import { getJournalAccountPickerAccounts } from '@/lib/financial/journal-account-picker'
import { ensureDefaultChartOfAccounts } from '@/lib/financial/default-chart-of-accounts'
import {
  calculateJournalAccountPickerBalances,
  type MovementTotals,
} from '@/lib/financial/journal-account-picker-balances'

function apiError(error: string, status = 400) {
  return NextResponse.json({ error, toast: error }, { status })
}

type PickerAccount = {
  id: string
  code: string
  name: string
  type: AccountType
  parentId: string | null
  level: number
  sortOrder: number
  yearToDateAmount?: unknown
  yearToDateDebit: unknown
  yearToDateCredit: unknown
}

async function accountBalanceColumns(companyId: string, accounts: PickerAccount[]) {
  const accountIds = accounts.map(account => account.id)
  if (accountIds.length === 0) return new Map<string, { balanceDebit: number; balanceCredit: number }>()

  const [journalLines, balanceRows] = await Promise.all([
    prisma.journalLine.findMany({
      where: {
        accountId: { in: accountIds },
        entry: {
          companyId,
          status: 'POSTED',
        },
      },
      select: {
        accountId: true,
        debit: true,
        credit: true,
      },
    }),
    prisma.accountBalance.findMany({
      where: { accountId: { in: accountIds } },
      orderBy: [{ period: 'desc' }],
      select: {
        accountId: true,
        openingDebit: true,
        openingCredit: true,
        closingDebit: true,
        closingCredit: true,
      },
    }),
  ])

  const movementTotalsByAccount = new Map<string, MovementTotals>()
  for (const line of journalLines) {
    const current = movementTotalsByAccount.get(line.accountId) ?? { debit: 0, credit: 0 }
    movementTotalsByAccount.set(line.accountId, {
      debit: current.debit + Number(line.debit),
      credit: current.credit + Number(line.credit),
    })
  }

  const latestStoredBalanceByAccount = new Map<string, typeof balanceRows[number]>()
  for (const row of balanceRows) {
    if (!latestStoredBalanceByAccount.has(row.accountId)) latestStoredBalanceByAccount.set(row.accountId, row)
  }

  const storedBalanceTotalsByAccount = new Map<string, MovementTotals>()
  for (const [accountId, storedBalance] of latestStoredBalanceByAccount) {
    const closingDebit = Number(storedBalance?.closingDebit ?? 0)
    const closingCredit = Number(storedBalance?.closingCredit ?? 0)
    const hasClosing = closingDebit !== 0 || closingCredit !== 0
    storedBalanceTotalsByAccount.set(accountId, {
      debit: hasClosing ? closingDebit : Number(storedBalance.openingDebit),
      credit: hasClosing ? closingCredit : Number(storedBalance.openingCredit),
    })
  }

  return calculateJournalAccountPickerBalances({
    accounts: accounts.map(account => ({
      ...account,
      yearToDateAmount: Number(account.yearToDateAmount ?? 0),
      yearToDateDebit: Number(account.yearToDateDebit ?? 0),
      yearToDateCredit: Number(account.yearToDateCredit ?? 0),
    })),
    movementTotalsByAccount,
    storedBalanceTotalsByAccount,
  })
}

function withBalances<T extends PickerAccount>(
  accounts: T[],
  balances: Map<string, { balanceDebit: number; balanceCredit: number }>,
) {
  return accounts.map(account => ({
    ...account,
    ...(balances.get(account.id) ?? { balanceDebit: 0, balanceCredit: 0 }),
  }))
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
  const mode = req.nextUrl.searchParams.get('mode')
  const limit = Math.min(Number(req.nextUrl.searchParams.get('limit') || 50), 500)

  await ensureDefaultChartOfAccounts(companyId, prisma)

  if (id) {
    const accounts = await prisma.finAccount.findMany({
      where: { companyId, id },
      select: {
        id: true,
        code: true,
        name: true,
        type: true,
        parentId: true,
        level: true,
        sortOrder: true,
        yearToDateAmount: true,
        yearToDateDebit: true,
        yearToDateCredit: true,
      },
      take: 1,
    })
    const balances = await accountBalanceColumns(companyId, accounts)
    return NextResponse.json({ items: withBalances(accounts, balances) })
  }

  const accounts = await prisma.finAccount.findMany({
    where: { companyId },
    select: {
      id: true,
      code: true,
      name: true,
      type: true,
      parentId: true,
      level: true,
      sortOrder: true,
      yearToDateAmount: true,
      yearToDateDebit: true,
      yearToDateCredit: true,
    },
    orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
  })
  const balances = await accountBalanceColumns(companyId, accounts)

  const query = q.toLowerCase()
  if (mode === 'tree') {
    const items = accounts
      .filter(account => account.level <= 3)
      .filter(account => {
        if (!query) return true
        return account.code.toLowerCase().includes(query) || account.name.toLowerCase().includes(query)
      })
      .slice(0, limit)

    return NextResponse.json({ items: withBalances(items, balances) })
  }

  const items = getJournalAccountPickerAccounts(accounts)
    .filter(account => {
      if (!query) return true
      return account.code.toLowerCase().includes(query) || account.name.toLowerCase().includes(query)
    })
    .slice(0, limit)

  return NextResponse.json({ items: withBalances(items, balances) })
}
