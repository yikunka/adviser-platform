import type { AccountType, Prisma } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'
import { isDebitNormalAccountType, isProfitAndLossExpenseType } from '@/lib/financial/account-types'
import { trialBalanceColumns } from '@/lib/financial/report-balances'
import { roundMoney } from '@/lib/financial/utils'

export type ReportAccountRow = {
  accountId: string
  code: string
  name: string
  type: AccountType
  level: number
}

type MovementTotals = {
  debit: number
  credit: number
}

export type TrialBalanceRow = ReportAccountRow & {
  periodDebit: number
  periodCredit: number
  closingDebit: number
  closingCredit: number
}

export type StatementLineRow = ReportAccountRow & {
  amount: number
}

export type IncomeStatementReport = {
  period: string
  currency: 'HKD'
  standard: 'HKFRS'
  revenue: StatementLineRow[]
  expenses: StatementLineRow[]
  totalRevenue: number
  totalExpenses: number
  netProfit: number
}

export type BalanceSheetReport = {
  period: string
  asOfDate: string
  currency: 'HKD'
  standard: 'HKFRS'
  assets: StatementLineRow[]
  liabilities: StatementLineRow[]
  equity: StatementLineRow[]
  totalAssets: number
  totalLiabilities: number
  totalEquity: number
  totalLiabilitiesAndEquity: number
  balanced: boolean
}

export type CashFlowSection = {
  label: string
  amount: number
}

export type CashFlowReport = {
  period: string
  currency: 'HKD'
  standard: 'HKFRS'
  method: 'indirect'
  operating: CashFlowSection[]
  investing: CashFlowSection[]
  financing: CashFlowSection[]
  netCashChange: number
  openingCash: number
  closingCash: number
}

export type FinancialReportsBundle = {
  period: string
  generatedAt: string
  trialBalance: {
    rows: TrialBalanceRow[]
    totalDebit: number
    totalCredit: number
    balanced: boolean
  }
  incomeStatement: IncomeStatementReport
  balanceSheet: BalanceSheetReport
  cashFlow: CashFlowReport
}

export function periodRange(period: string) {
  const [year, month] = period.split('-').map(Number)
  if (!year || !month || month < 1 || month > 12) {
    throw new Error('Invalid period. Use YYYY-MM.')
  }
  const start = new Date(Date.UTC(year, month - 1, 1))
  const end = new Date(Date.UTC(year, month, 1))
  const asOfDate = new Date(Date.UTC(year, month, 0))
  return { start, end, asOfDate, label: period }
}

function signedBalance(amount: number, type: AccountType, code?: string) {
  if (isDebitNormalAccountType(type, code)) return roundMoney(amount)
  return roundMoney(-amount)
}

function isCashAccount(account: { code: string; name: string }) {
  return /^(1001|1002|1010|1020)/.test(account.code) || /cash|bank|現金|銀行/i.test(account.name)
}

function isCurrentAsset(account: { code: string; type: AccountType }) {
  return account.type === 'ASSET' && /^1[1-4]/.test(account.code)
}

function isCurrentLiability(account: { code: string; type: AccountType }) {
  if (account.type === 'CURRENT_ACCOUNT') return /^2/.test(account.code)
  return account.type === 'LIABILITY' && /^2[12]/.test(account.code)
}

function isCurrentAccountReceivable(account: { code: string; type: AccountType }) {
  return account.type === 'CURRENT_ACCOUNT' && /^1/.test(account.code)
}

function isWorkingCapitalAccount(account: { code: string; type: AccountType }) {
  return (
    isCurrentAsset(account)
    || isCurrentLiability(account)
    || isCurrentAccountReceivable(account)
    || (account.type === 'CURRENT_ACCOUNT' && /^2/.test(account.code))
  )
}

function isNonCurrentAsset(account: ReportAccountRow) {
  return account.type === 'ASSET' && !isCashAccount(account) && !isCurrentAsset(account)
}

function isFinancingAccount(account: { code: string; type: AccountType }) {
  return account.type === 'EQUITY' || (account.type === 'LIABILITY' && /^2[3-9]/.test(account.code))
}

export type FinancialReportScope = {
  companyId?: string
  companyIds?: string[]
}

type InternalReportAccountRow = ReportAccountRow & {
  sourceAccountIds: string[]
}

function scopeCompanyIds(scope?: FinancialReportScope) {
  if (scope?.companyIds?.length) return Array.from(new Set(scope.companyIds))
  if (scope?.companyId) return [scope.companyId]
  return undefined
}

async function aggregateLedgerMovements(
  beforeEnd?: Date,
  fromStart?: Date,
  scope?: FinancialReportScope,
) {
  const companyIds = scopeCompanyIds(scope)
  const where: Prisma.LedgerWhereInput = {
    entry: {
      status: 'POSTED',
      ...(companyIds ? { companyId: { in: companyIds } } : {}),
    },
  }

  if (beforeEnd && fromStart) {
    where.date = { gte: fromStart, lt: beforeEnd }
  } else if (beforeEnd) {
    where.date = { lt: beforeEnd }
  } else if (fromStart) {
    where.date = { gte: fromStart }
  }

  const lines = await prisma.ledger.findMany({
    where,
    select: {
      accountId: true,
      debit: true,
      credit: true,
      account: { select: { type: true } },
    },
  })

  const map = new Map<string, MovementTotals>()
  for (const line of lines) {
    const current = map.get(line.accountId) ?? { debit: 0, credit: 0 }
    current.debit = roundMoney(current.debit + Number(line.debit))
    current.credit = roundMoney(current.credit + Number(line.credit))
    map.set(line.accountId, current)
  }
  return map
}

function movementSignedBalance(totals: MovementTotals, type: AccountType, code?: string) {
  const net = roundMoney(totals.debit - totals.credit)
  return signedBalance(net, type, code)
}

function periodBeforeDate(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
}

async function aggregateOpeningBalanceMovements(
  beforeEnd: Date,
  scope?: FinancialReportScope,
) {
  const companyIds = scopeCompanyIds(scope)
  const rows = await prisma.accountBalance.findMany({
    where: {
      period: { lte: periodBeforeDate(beforeEnd) },
      account: {
        ...(companyIds ? { companyId: { in: companyIds } } : {}),
      },
    },
    orderBy: [{ period: 'desc' }],
    select: {
      accountId: true,
      period: true,
      openingDebit: true,
      openingCredit: true,
    },
  })

  const latestByAccount = new Map<string, { debit: number; credit: number }>()
  for (const row of rows) {
    if (latestByAccount.has(row.accountId)) continue
    latestByAccount.set(row.accountId, {
      debit: Number(row.openingDebit),
      credit: Number(row.openingCredit),
    })
  }

  return latestByAccount
}

function mergeMovementMaps(base: Map<string, MovementTotals>, extra: Map<string, MovementTotals>) {
  const merged = new Map(base)
  for (const [accountId, totals] of extra) {
    const current = merged.get(accountId) ?? { debit: 0, credit: 0 }
    merged.set(accountId, {
      debit: roundMoney(current.debit + totals.debit),
      credit: roundMoney(current.credit + totals.credit),
    })
  }
  return merged
}

function sumMovements(map: Map<string, MovementTotals>, accountIds: string[]) {
  return accountIds.reduce<MovementTotals>((sum, accountId) => {
    const totals = map.get(accountId)
    if (!totals) return sum
    return {
      debit: roundMoney(sum.debit + totals.debit),
      credit: roundMoney(sum.credit + totals.credit),
    }
  }, { debit: 0, credit: 0 })
}

export async function buildFinancialReports(
  period: string,
  scope?: FinancialReportScope,
): Promise<FinancialReportsBundle> {
  const { start, end, asOfDate } = periodRange(period)
  const companyIds = scopeCompanyIds(scope)

  const rawAccounts = await prisma.finAccount.findMany({
    where: {
      ...(companyIds ? { companyId: { in: companyIds } } : {}),
    },
    orderBy: [{ type: 'asc' }, { code: 'asc' }],
    select: { id: true, code: true, name: true, type: true, level: true },
  })
  const shouldConsolidateAccounts = (companyIds?.length ?? 0) > 1
  const accounts: InternalReportAccountRow[] = shouldConsolidateAccounts
    ? Array.from(rawAccounts.reduce<Map<string, InternalReportAccountRow>>((map, account) => {
        const key = `${account.type}:${account.code}`
        const existing = map.get(key)
        if (existing) {
          existing.sourceAccountIds.push(account.id)
          existing.level = Math.min(existing.level, account.level)
        } else {
          map.set(key, {
            accountId: key,
            code: account.code,
            name: account.name,
            type: account.type,
            level: account.level,
            sourceAccountIds: [account.id],
          })
        }
        return map
      }, new Map()).values())
    : rawAccounts.map(({ id, ...rest }) => ({
        accountId: id,
        sourceAccountIds: [id],
        ...rest,
      }))

  const [ledgerOpeningMovements, periodMovements, ledgerClosingMovements, openingBalances, closingBalances] = await Promise.all([
    aggregateLedgerMovements(start, undefined, scope),
    aggregateLedgerMovements(end, start, scope),
    aggregateLedgerMovements(end, undefined, scope),
    aggregateOpeningBalanceMovements(start, scope),
    aggregateOpeningBalanceMovements(end, scope),
  ])
  const openingMovements = mergeMovementMaps(ledgerOpeningMovements, openingBalances)
  const closingMovements = mergeMovementMaps(ledgerClosingMovements, closingBalances)

  const trialRows: TrialBalanceRow[] = []
  let totalDebit = 0
  let totalCredit = 0

  const revenueLines: StatementLineRow[] = []
  const expenseLines: StatementLineRow[] = []
  const assetLines: StatementLineRow[] = []
  const liabilityLines: StatementLineRow[] = []
  const equityLines: StatementLineRow[] = []

  const openingByAccount = new Map<string, number>()
  const closingByAccount = new Map<string, number>()

  for (const account of accounts) {
    const openingTotals = sumMovements(openingMovements, account.sourceAccountIds)
    const periodTotals = sumMovements(periodMovements, account.sourceAccountIds)
    const closingTotals = sumMovements(closingMovements, account.sourceAccountIds)

    const openingBalance = movementSignedBalance(openingTotals, account.type, account.code)
    const periodNet = movementSignedBalance(periodTotals, account.type, account.code)
    const closingBalance = movementSignedBalance(closingTotals, account.type, account.code)

    openingByAccount.set(account.accountId, openingBalance)
    closingByAccount.set(account.accountId, closingBalance)

    const tbCols = trialBalanceColumns(closingBalance, account.type, account.code)
    if (periodTotals.debit > 0 || periodTotals.credit > 0 || closingBalance !== 0) {
      trialRows.push({
        ...account,
        periodDebit: periodTotals.debit,
        periodCredit: periodTotals.credit,
        ...tbCols,
      })
      totalDebit = roundMoney(totalDebit + tbCols.closingDebit)
      totalCredit = roundMoney(totalCredit + tbCols.closingCredit)
    }

    const row = { ...account, amount: Math.abs(periodNet) }
    if (account.type === 'REVENUE' && periodNet !== 0) revenueLines.push(row)
    if (isProfitAndLossExpenseType(account.type) && periodNet !== 0) expenseLines.push(row)
    if (account.type === 'ASSET' && closingBalance !== 0) assetLines.push({ ...row, amount: closingBalance })
    if (account.type === 'LIABILITY' && closingBalance !== 0) liabilityLines.push({ ...row, amount: closingBalance })
    if (account.type === 'EQUITY' && closingBalance !== 0) equityLines.push({ ...row, amount: closingBalance })
    if (isCurrentAccountReceivable(account) && closingBalance !== 0) {
      assetLines.push({ ...row, amount: closingBalance })
    }
    if (account.type === 'CURRENT_ACCOUNT' && /^2/.test(account.code) && closingBalance !== 0) {
      liabilityLines.push({ ...row, amount: closingBalance })
    }
  }

  const totalRevenue = roundMoney(revenueLines.reduce((sum, row) => sum + row.amount, 0))
  const totalExpenses = roundMoney(expenseLines.reduce((sum, row) => sum + row.amount, 0))
  const netProfit = roundMoney(totalRevenue - totalExpenses)

  const totalAssets = roundMoney(assetLines.reduce((sum, row) => sum + row.amount, 0))
  const totalLiabilities = roundMoney(liabilityLines.reduce((sum, row) => sum + row.amount, 0))
  const totalEquity = roundMoney(equityLines.reduce((sum, row) => sum + row.amount, 0))
  const totalLiabilitiesAndEquity = roundMoney(totalLiabilities + totalEquity + netProfit)

  const cashFlow = buildIndirectCashFlow({
    period,
    accounts,
    openingByAccount,
    closingByAccount,
    netProfit,
  })

  return {
    period,
    generatedAt: new Date().toISOString(),
    trialBalance: {
      rows: trialRows,
      totalDebit,
      totalCredit,
      balanced: Math.abs(totalDebit - totalCredit) < 0.01,
    },
    incomeStatement: {
      period,
      currency: 'HKD',
      standard: 'HKFRS',
      revenue: revenueLines,
      expenses: expenseLines,
      totalRevenue,
      totalExpenses,
      netProfit,
    },
    balanceSheet: {
      period,
      asOfDate: asOfDate.toISOString(),
      currency: 'HKD',
      standard: 'HKFRS',
      assets: assetLines,
      liabilities: liabilityLines,
      equity: [
        ...equityLines,
        ...(netProfit !== 0
          ? [{
              accountId: 'current-year-earnings',
              code: '3999',
              name: 'Profit for the period',
              type: 'EQUITY' as AccountType,
              level: 1,
              amount: netProfit,
            }]
          : []),
      ],
      totalAssets,
      totalLiabilities,
      totalEquity: roundMoney(totalEquity + netProfit),
      totalLiabilitiesAndEquity,
      balanced: Math.abs(totalAssets - totalLiabilitiesAndEquity) < 0.01,
    },
    cashFlow,
  }
}

function buildIndirectCashFlow(input: {
  period: string
  accounts: ReportAccountRow[]
  openingByAccount: Map<string, number>
  closingByAccount: Map<string, number>
  netProfit: number
}): CashFlowReport {
  const { accounts, openingByAccount, closingByAccount, netProfit } = input

  let workingCapitalChange = 0
  let investingChange = 0
  let financingChange = 0
  let openingCash = 0
  let closingCash = 0

  for (const account of accounts) {
    const opening = openingByAccount.get(account.accountId) ?? 0
    const closing = closingByAccount.get(account.accountId) ?? 0
    const change = roundMoney(closing - opening)

    if (isCashAccount(account)) {
      openingCash = roundMoney(openingCash + opening)
      closingCash = roundMoney(closingCash + closing)
      continue
    }

    if (isWorkingCapitalAccount(account)) {
      workingCapitalChange = roundMoney(workingCapitalChange - change)
      continue
    }

    if (isNonCurrentAsset(account)) {
      investingChange = roundMoney(investingChange - change)
      continue
    }

    if (isFinancingAccount(account)) {
      financingChange = roundMoney(financingChange + change)
    }
  }

  const operatingTotal = roundMoney(netProfit + workingCapitalChange)
  const investingTotal = investingChange
  const financingTotal = financingChange
  const netCashChange = roundMoney(operatingTotal + investingTotal + financingTotal)

  return {
    period: input.period,
    currency: 'HKD',
    standard: 'HKFRS',
    method: 'indirect',
    operating: [
      { label: 'Profit for the period', amount: netProfit },
      { label: 'Changes in working capital', amount: workingCapitalChange },
      { label: 'Net cash from operating activities', amount: operatingTotal },
    ],
    investing: [
      { label: 'Purchase / disposal of non-current assets', amount: investingTotal },
      { label: 'Net cash from investing activities', amount: investingTotal },
    ],
    financing: [
      { label: 'Changes in borrowings and equity', amount: financingTotal },
      { label: 'Net cash from financing activities', amount: financingTotal },
    ],
    netCashChange,
    openingCash,
    closingCash,
  }
}
