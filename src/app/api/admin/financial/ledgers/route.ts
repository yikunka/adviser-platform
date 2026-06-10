import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { requireRole } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'
import { ledgerFilterSchema } from '@/lib/financial/schemas'
import { serializeLedgerEntry } from '@/lib/financial/serializers'
import { trialBalanceColumns } from '@/lib/financial/report-balances'
import { roundMoney } from '@/lib/financial/utils'
import {
  addLedgerMovementsToOpeningBalances,
  calculateLedgerRunningBalances,
  signedOpeningBalance,
} from '@/lib/financial/ledger-balances'
import {
  assertCompanyAccessible,
  resolveCompanyAccess,
} from '@/lib/company-access'

function apiError(error: string, status = 400) {
  return NextResponse.json({ error, toast: error }, { status })
}

function periodRange(period: string) {
  const [year, month] = period.split('-').map(Number)
  const start = new Date(Date.UTC(year, month - 1, 1))
  const end = new Date(Date.UTC(year, month, 1))
  return { start, end }
}

function parseYmdDate(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day))
}

function nextUtcDay(value: string) {
  const date = parseYmdDate(value)
  date.setUTCDate(date.getUTCDate() + 1)
  return date
}

function ledgerDateBounds(input: { period?: string; startDate?: string; endDate?: string }) {
  const period = input.period ? periodRange(input.period) : null
  let gte = period?.start
  let lt = period?.end

  if (input.startDate) {
    const start = parseYmdDate(input.startDate)
    gte = gte && gte > start ? gte : start
  }

  if (input.endDate) {
    const end = nextUtcDay(input.endDate)
    lt = lt && lt < end ? lt : end
  }

  return { gte, lt }
}

function ledgerDateFilter(input: { period?: string; startDate?: string; endDate?: string }) {
  const { gte, lt } = ledgerDateBounds(input)
  if (!gte && !lt) return undefined
  return {
    ...(gte ? { gte } : {}),
    ...(lt ? { lt } : {}),
  }
}

function periodForDate(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
}

function periodStartDate(period: string) {
  const [year, month] = period.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, 1))
}

export async function GET(req: NextRequest) {
  const { session, error } = await requireRole('STAFF', { adminMenu: 'financial' })
  if (error) return error

  const rawAccountId = req.nextUrl.searchParams.get('accountId') || undefined
  const rawAccountIds = req.nextUrl.searchParams.get('accountIds') || ''
  const requestedAccountIds = rawAccountIds
    .split(',')
    .map(id => id.trim())
    .filter(id => id && id !== 'ALL')
  const parsed = ledgerFilterSchema.safeParse({
    accountId: rawAccountId === 'ALL' ? undefined : rawAccountId,
    accountIds: requestedAccountIds.length > 0 ? requestedAccountIds : undefined,
    accountType: req.nextUrl.searchParams.get('accountType') || undefined,
    period: req.nextUrl.searchParams.get('period') || undefined,
    startDate: req.nextUrl.searchParams.get('startDate') || undefined,
    endDate: req.nextUrl.searchParams.get('endDate') || undefined,
    voucherNo: req.nextUrl.searchParams.get('voucherNo') || undefined,
    companyId: req.nextUrl.searchParams.get('companyId') || undefined,
  })
  if (!parsed.success) return apiError('Invalid ledger filters.')

  const access = await resolveCompanyAccess(session!.user.id, session!.user.role)
  if (parsed.data.companyId && !(await assertCompanyAccessible(access, parsed.data.companyId))) {
    return apiError('Forbidden', 403)
  }
  const dateBounds = ledgerDateBounds(parsed.data)
  const dateFilter = ledgerDateFilter(parsed.data)
  const selectedAccountIds = parsed.data.accountIds?.length
    ? parsed.data.accountIds
    : parsed.data.accountId
      ? [parsed.data.accountId]
      : null
  const companyScopeWhere = parsed.data.companyId
    ? { companyId: parsed.data.companyId }
    : access.kind === 'restricted'
      ? { companyId: { in: access.companyIds } }
      : {}
  const accountWhere: Prisma.FinAccountWhereInput = {
    ...(selectedAccountIds ? { id: { in: selectedAccountIds } } : {}),
    ...(parsed.data.accountType ? { type: parsed.data.accountType } : {}),
    ...companyScopeWhere,
  }
  const ledgerBalanceWhere: Prisma.LedgerWhereInput = {
    ...(selectedAccountIds ? { accountId: { in: selectedAccountIds } } : {}),
    ...(parsed.data.accountType ? { account: { type: parsed.data.accountType } } : {}),
    ...companyScopeWhere,
    ...(dateFilter ? { date: dateFilter } : {}),
    entry: { status: 'POSTED' },
  }
  const where: Prisma.LedgerWhereInput = {
    ...ledgerBalanceWhere,
    ...(parsed.data.voucherNo ? { voucherNo: { contains: parsed.data.voucherNo, mode: 'insensitive' } } : {}),
  }

  const [accounts, ledgers, balanceLedgers] = await Promise.all([
    prisma.finAccount.findMany({
      where: accountWhere,
      include: {
        accountBalances: {
          orderBy: [{ period: 'desc' }],
          select: {
            period: true,
            openingDebit: true,
            openingCredit: true,
          },
        },
      },
      orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
    }),
    prisma.ledger.findMany({
      where,
      include: {
        account: { select: { id: true, code: true, name: true, type: true } },
        company: { select: { id: true, nameEn: true, companyCode: true } },
      },
      orderBy: [{ date: 'asc' }, { lineNum: 'asc' }, { voucherNo: 'asc' }],
    }),
    parsed.data.voucherNo
      ? prisma.ledger.findMany({
          where: ledgerBalanceWhere,
          orderBy: [{ date: 'asc' }, { lineNum: 'asc' }, { voucherNo: 'asc' }],
          select: {
            id: true,
            accountId: true,
            debit: true,
            credit: true,
          },
        })
      : Promise.resolve(null),
  ])

  const accountsById = new Map(accounts.map(account => [account.id, account]))
  const accountIds = accounts.map(account => account.id)
  const openingBalanceByAccount = new Map<string, number>()
  const openingPeriodByAccount = new Map<string, string>()

  if (dateBounds.gte && accountIds.length > 0) {
    const [previousLedgers, openingBalances] = await Promise.all([
      prisma.ledger.findMany({
        where: {
          accountId: { in: accountIds },
          ...companyScopeWhere,
          date: { lt: dateBounds.gte },
          entry: { status: 'POSTED' },
        },
        orderBy: [{ date: 'asc' }, { lineNum: 'asc' }, { voucherNo: 'asc' }],
        select: {
          accountId: true,
          date: true,
          debit: true,
          credit: true,
        },
      }),
      prisma.accountBalance.findMany({
        where: {
          accountId: { in: accountIds },
          period: { lte: periodForDate(dateBounds.gte) },
        },
        orderBy: [{ period: 'desc' }],
        select: {
          accountId: true,
          period: true,
          openingDebit: true,
          openingCredit: true,
        },
      }),
    ])

    for (const row of openingBalances) {
      if (openingBalanceByAccount.has(row.accountId)) continue
      const account = accountsById.get(row.accountId)
      if (!account) continue
      openingBalanceByAccount.set(row.accountId, signedOpeningBalance(row, account))
      openingPeriodByAccount.set(row.accountId, row.period)
    }

    const previousMovements = previousLedgers.filter(row => {
      const openingPeriod = openingPeriodByAccount.get(row.accountId)
      return !openingPeriod || row.date >= periodStartDate(openingPeriod)
    })
    const balancesWithPreviousMovements = addLedgerMovementsToOpeningBalances(
      openingBalanceByAccount,
      previousMovements,
      accountsById,
    )
    openingBalanceByAccount.clear()
    for (const [accountId, balance] of balancesWithPreviousMovements) {
      openingBalanceByAccount.set(accountId, balance)
    }
  } else {
    for (const account of accounts) {
      const opening = account.accountBalances[0]
      if (!opening) continue
      openingBalanceByAccount.set(account.id, signedOpeningBalance({
        accountId: account.id,
        openingDebit: opening.openingDebit,
        openingCredit: opening.openingCredit,
      }, account))
      openingPeriodByAccount.set(account.id, opening.period)
    }
  }

  const runningSourceLedgers = balanceLedgers ?? ledgers
  const runningLedgers = calculateLedgerRunningBalances(runningSourceLedgers, accountsById, openingBalanceByAccount)
  const runningLedgerById = new Map(runningLedgers.map(entry => [entry.id, entry]))

  const entriesByAccount = new Map<string, typeof ledgers>()
  for (const entry of ledgers) {
    entriesByAccount.set(entry.accountId, [...(entriesByAccount.get(entry.accountId) ?? []), entry])
  }

  const ledgerAccounts = accounts
    .map(account => {
      const entries = entriesByAccount.get(account.id) ?? []
      const openingBalance = roundMoney(openingBalanceByAccount.get(account.id) ?? 0)
      const balanceColumns = trialBalanceColumns(openingBalance, account.type, account.code)
      return {
        accountId: account.id,
        accountCode: account.code,
        accountName: account.name,
        accountType: account.type,
        openingBalance,
        openingBalanceDebit: balanceColumns.closingDebit,
        openingBalanceCredit: balanceColumns.closingCredit,
        openingDate: dateBounds.gte?.toISOString() ?? null,
        openingPeriod: openingPeriodByAccount.get(account.id) ?? null,
        entries: entries.map(entry => {
          const calculatedBalance = runningLedgerById.get(entry.id)?.calculatedBalance ?? Number(entry.balance)
          const serialized = serializeLedgerEntry({ ...entry, balance: new Prisma.Decimal(calculatedBalance) })
          const entryBalanceColumns = trialBalanceColumns(serialized.balance, account.type, account.code)
          return {
            ...serialized,
            balanceDebit: entryBalanceColumns.closingDebit,
            balanceCredit: entryBalanceColumns.closingCredit,
          }
        }),
        totalDebit: roundMoney(entries.reduce((sum, entry) => sum + Number(entry.debit), 0)),
        totalCredit: roundMoney(entries.reduce((sum, entry) => sum + Number(entry.credit), 0)),
      }
    })
    .filter(account => (
      account.entries.length > 0
      || (!parsed.data.voucherNo && (
        account.openingBalanceDebit > 0
        || account.openingBalanceCredit > 0
      ))
    ))
    .sort((a, b) => a.accountCode.localeCompare(b.accountCode, undefined, { numeric: true }))

  return NextResponse.json({
    ledgers: ledgers.map(entry => {
      const calculatedBalance = runningLedgerById.get(entry.id)?.calculatedBalance ?? Number(entry.balance)
      const serialized = serializeLedgerEntry({ ...entry, balance: new Prisma.Decimal(calculatedBalance) })
      const balanceColumns = trialBalanceColumns(serialized.balance, serialized.accountType, serialized.accountCode)
      return {
        ...serialized,
        balanceDebit: balanceColumns.closingDebit,
        balanceCredit: balanceColumns.closingCredit,
      }
    }),
    ledgerAccounts,
  })
}
