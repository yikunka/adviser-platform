import { NextRequest, NextResponse } from 'next/server'
import { Prisma, type AccountType } from '@prisma/client'
import { requireRole } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'
import { assertCompanyAccessible, resolveCompanyAccess } from '@/lib/company-access'
import { getJournalAccountPickerAccounts } from '@/lib/financial/journal-account-picker'
import { ensureDefaultChartOfAccounts } from '@/lib/financial/default-chart-of-accounts'
import { trialBalanceColumns } from '@/lib/financial/report-balances'
import { roundMoney, signedLineAmount } from '@/lib/financial/utils'

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
}

async function accountBalanceColumns(companyId: string, accounts: PickerAccount[]) {
  const accountIds = accounts.map(account => account.id)
  if (accountIds.length === 0) return new Map<string, { balanceDebit: number; balanceCredit: number }>()

  const latestLedgerRows = await prisma.$queryRaw<Array<{ accountId: string; balance: Prisma.Decimal }>>(Prisma.sql`
    SELECT DISTINCT ON ("accountId") "accountId", "balance"
    FROM "adv_ledger"
    WHERE "companyId" = ${companyId}
      AND "accountId" IN (${Prisma.join(accountIds)})
    ORDER BY "accountId", "date" DESC, "lineNum" DESC, "id" DESC
  `)
  const latestLedgerBalanceByAccount = new Map(
    latestLedgerRows.map(row => [row.accountId, Number(row.balance)]),
  )

  const balanceRows = await prisma.accountBalance.findMany({
    where: { accountId: { in: accountIds } },
    orderBy: [{ period: 'desc' }],
    select: {
      accountId: true,
      openingDebit: true,
      openingCredit: true,
      closingDebit: true,
      closingCredit: true,
    },
  })
  const latestStoredBalanceByAccount = new Map<string, typeof balanceRows[number]>()
  for (const row of balanceRows) {
    if (!latestStoredBalanceByAccount.has(row.accountId)) latestStoredBalanceByAccount.set(row.accountId, row)
  }

  const balances = new Map<string, { balanceDebit: number; balanceCredit: number }>()
  for (const account of accounts) {
    const ledgerBalance = latestLedgerBalanceByAccount.get(account.id)
    const storedBalance = latestStoredBalanceByAccount.get(account.id)
    const closingDebit = Number(storedBalance?.closingDebit ?? 0)
    const closingCredit = Number(storedBalance?.closingCredit ?? 0)
    const hasClosing = closingDebit !== 0 || closingCredit !== 0
    const signedBalance = ledgerBalance ?? (storedBalance
      ? signedLineAmount({
          accountId: account.id,
          accountType: account.type,
          accountCode: account.code,
          debit: hasClosing ? closingDebit : Number(storedBalance.openingDebit),
          credit: hasClosing ? closingCredit : Number(storedBalance.openingCredit),
        })
      : 0)
    const columns = trialBalanceColumns(roundMoney(signedBalance), account.type, account.code)
    balances.set(account.id, {
      balanceDebit: columns.closingDebit,
      balanceCredit: columns.closingCredit,
    })
  }

  return balances
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
      select: { id: true, code: true, name: true, type: true, parentId: true, level: true, sortOrder: true },
      take: 1,
    })
    const balances = await accountBalanceColumns(companyId, accounts)
    return NextResponse.json({ items: withBalances(accounts, balances) })
  }

  const accounts = await prisma.finAccount.findMany({
    where: { companyId },
    select: { id: true, code: true, name: true, type: true, parentId: true, level: true, sortOrder: true },
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
