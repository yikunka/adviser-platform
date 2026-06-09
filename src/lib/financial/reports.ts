import type { AccountType, Prisma } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'
import { isDebitNormalAccountType, isProfitAndLossExpenseType } from '@/lib/financial/account-types'
import {
  buildBalanceSheetSections,
  isCurrentAssetAccount,
  isCurrentLiabilityAccount,
  isNonCurrentAssetAccount,
  type BalanceSheetSection,
} from '@/lib/financial/balance-sheet-sections'
import {
  buildLeafAccountIdsByAccount,
  buildYearToDateTotalsByAccount,
  type ReportRollupAccount,
} from '@/lib/financial/report-account-rollups'
import { trialBalanceColumns } from '@/lib/financial/report-balances'
import type { ReportAccountRow, StatementLineRow } from '@/lib/financial/report-line-types'
import { shouldIncludeAccountInTrialBalance } from '@/lib/financial/trial-balance-inclusion'
import { roundMoney } from '@/lib/financial/utils'

export type { BalanceSheetSection } from '@/lib/financial/balance-sheet-sections'
export type { ReportAccountRow, StatementLineRow } from '@/lib/financial/report-line-types'

type MovementTotals = {
  debit: number
  credit: number
}

export type TrialBalanceRow = ReportAccountRow & {
  sortOrder: number
  periodDebit: number
  periodCredit: number
  closingDebit: number
  closingCredit: number
  /**
   * When true this row is a computed summary (e.g. "本年利润") derived from
   * other accounts rather than a directly posted journal-entry balance.
   * It is shown for informational purposes only and is NOT counted in the
   * trial-balance debit/credit totals (to avoid double-counting).
   */
  isComputed?: boolean
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

export type AccountingEquationCheck = {
  totalAssets: number
  totalLiabilities: number
  totalEquity: number
  totalLiabilitiesAndEquity: number
  balanced: boolean
  difference: number
}

export type BalanceSheetReport = {
  period: string
  asOfDate: string
  currency: 'HKD'
  standard: 'HKFRS'
  assetSections: BalanceSheetSection[]
  liabilitySections: BalanceSheetSection[]
  equitySection: BalanceSheetSection
  assets: StatementLineRow[]
  liabilities: StatementLineRow[]
  equity: StatementLineRow[]
  totalAssets: number
  totalLiabilities: number
  totalEquity: number
  totalLiabilitiesAndEquity: number
  balanced: boolean
  equation: AccountingEquationCheck
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
    equation: AccountingEquationCheck
  }
  incomeStatement: IncomeStatementReport
  balanceSheet: BalanceSheetReport
  cashFlow: CashFlowReport
}

const EQUATION_TOLERANCE = 0.01

function buildAccountingEquationCheck(
  totalAssets: number,
  totalLiabilities: number,
  totalEquity: number,
): AccountingEquationCheck {
  const totalLiabilitiesAndEquity = roundMoney(totalLiabilities + totalEquity)
  const difference = roundMoney(totalAssets - totalLiabilitiesAndEquity)
  return {
    totalAssets,
    totalLiabilities,
    totalEquity,
    totalLiabilitiesAndEquity,
    balanced: Math.abs(difference) < EQUATION_TOLERANCE,
    difference,
  }
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

function isCurrentAccountReceivable(account: { code: string; type: AccountType }) {
  return account.type === 'CURRENT_ACCOUNT' && /^1/.test(account.code)
}

function isWorkingCapitalAccount(account: { code: string; type: AccountType; name: string }) {
  return (
    isCurrentAssetAccount(account)
    || isCurrentLiabilityAccount(account)
    || isCurrentAccountReceivable(account)
    || (account.type === 'CURRENT_ACCOUNT' && /^2/.test(account.code))
  )
}

function isNonCurrentAsset(account: ReportAccountRow & { name: string }) {
  return isNonCurrentAssetAccount(account)
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
  sortOrder: number
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
    orderBy: [{ type: 'asc' }, { sortOrder: 'asc' }, { code: 'asc' }],
    select: {
      id: true,
      code: true,
      name: true,
      type: true,
      level: true,
      parentId: true,
      sortOrder: true,
      yearToDateDebit: true,
      yearToDateCredit: true,
    },
  })
  const shouldConsolidateAccounts = (companyIds?.length ?? 0) > 1
  const rollupAccounts: ReportRollupAccount[] = rawAccounts.map(account => ({
    id: account.id,
    parentId: account.parentId,
    name: account.name,
    type: account.type,
    code: account.code,
    yearToDateDebit: Number(account.yearToDateDebit),
    yearToDateCredit: Number(account.yearToDateCredit),
  }))
  const { childrenByParent, leafIdsByAccount } = buildLeafAccountIdsByAccount(rawAccounts)
  const yearToDateTotalsByAccount = buildYearToDateTotalsByAccount(rollupAccounts)
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
            sortOrder: account.sortOrder,
            sourceAccountIds: [account.id],
          })
        }
        return map
      }, new Map()).values())
    : rawAccounts.map(({ id, sortOrder, ...rest }) => ({
        accountId: id,
        sortOrder,
        sourceAccountIds: leafIdsByAccount.get(id) ?? [id],
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

  function accountHasChildren(account: InternalReportAccountRow): boolean {
    if (shouldConsolidateAccounts) {
      return rawAccounts.some(
        rawAccount => rawAccount.code === account.code
          && rawAccount.type === account.type
          && (childrenByParent.get(rawAccount.id) ?? []).length > 0,
      )
    }
    return (childrenByParent.get(account.accountId) ?? []).length > 0
  }

  for (const account of accounts) {
    const openingTotals = sumMovements(openingMovements, account.sourceAccountIds)
    const periodTotals = sumMovements(periodMovements, account.sourceAccountIds)
    const closingTotals = sumMovements(closingMovements, account.sourceAccountIds)

    const openingBalance = movementSignedBalance(openingTotals, account.type, account.code)
    const periodNet = movementSignedBalance(periodTotals, account.type, account.code)
    const ledgerClosingBalance = movementSignedBalance(closingTotals, account.type, account.code)
    const yearToDateTotals = shouldConsolidateAccounts
      ? undefined
      : yearToDateTotalsByAccount.get(account.accountId)
    const yearToDateBalance = yearToDateTotals?.balance ?? 0
    const closingBalance = roundMoney(ledgerClosingBalance + yearToDateBalance)

    openingByAccount.set(account.accountId, openingBalance)
    closingByAccount.set(account.accountId, closingBalance)

    const reportRow: ReportAccountRow = {
      accountId: account.accountId,
      code: account.code,
      name: account.name,
      type: account.type,
      level: account.level,
    }

    const tbCols = trialBalanceColumns(closingBalance, account.type, account.code)

    if (shouldIncludeAccountInTrialBalance({
      level: account.level,
      hasChildren: accountHasChildren(account),
      periodTotals,
      openingTotals,
      closingBalance,
      yearToDateTotals,
    })) {
      trialRows.push({
        ...reportRow,
        sortOrder: account.sortOrder,
        periodDebit: periodTotals.debit,
        periodCredit: periodTotals.credit,
        ...tbCols,
      })
      totalDebit = roundMoney(totalDebit + tbCols.closingDebit)
      totalCredit = roundMoney(totalCredit + tbCols.closingCredit)
    }

    const row: StatementLineRow = { ...reportRow, amount: Math.abs(periodNet) }
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

  const equityLinesWithProfit = [
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
  ]

  const balanceSheetLayout = buildBalanceSheetSections({
    assetLines,
    liabilityLines,
    equityLines: equityLinesWithProfit,
  })
  const totalAssets = balanceSheetLayout.totalAssets
  const totalLiabilities = balanceSheetLayout.totalLiabilities
  const totalEquityWithProfit = roundMoney(balanceSheetLayout.totalEquity)
  const totalLiabilitiesAndEquity = roundMoney(totalLiabilities + totalEquityWithProfit)
  const balanceSheetEquation = buildAccountingEquationCheck(totalAssets, totalLiabilities, totalEquityWithProfit)
  const trialBalanceEquation = buildAccountingEquationCheck(totalAssets, totalLiabilities, totalEquityWithProfit)

  trialRows.sort((a, b) => a.sortOrder - b.sortOrder || a.code.localeCompare(b.code) || a.level - b.level)

  // Append a computed "本年利润" row when net profit is non-zero.
  // This row is purely informational — it is NOT counted in the debit/credit totals,
  // because revenue and expense accounts are already included in the trial balance
  // (adding profit again would double-count).  It shows at the very end so users can
  // see where the balance-sheet equity figure comes from before period-end closing entries.
  if (netProfit !== 0) {
    const computedProfitRow: TrialBalanceRow = {
      accountId: 'current-year-earnings',
      code: '——',
      name: '本年利润（期末计算，未结转）',
      type: 'EQUITY' as AccountType,
      level: 1,
      sortOrder: 999999,
      periodDebit: 0,
      periodCredit: 0,
      closingDebit: netProfit < 0 ? roundMoney(-netProfit) : 0,
      closingCredit: netProfit > 0 ? netProfit : 0,
      isComputed: true,
    }
    trialRows.push(computedProfitRow)
  }

  const cashFlow = buildIndirectCashFlow({
    period,
    accounts: accounts.map(({ accountId, code, name, type, level }) => ({
      accountId,
      code,
      name,
      type,
      level,
    })),
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
      balanced: Math.abs(totalDebit - totalCredit) < EQUATION_TOLERANCE,
      equation: trialBalanceEquation,
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
      assetSections: balanceSheetLayout.assetSections,
      liabilitySections: balanceSheetLayout.liabilitySections,
      equitySection: balanceSheetLayout.equitySection,
      assets: balanceSheetLayout.assets,
      liabilities: balanceSheetLayout.liabilities,
      equity: balanceSheetLayout.equity,
      totalAssets,
      totalLiabilities,
      totalEquity: totalEquityWithProfit,
      totalLiabilitiesAndEquity,
      balanced: balanceSheetEquation.balanced,
      equation: balanceSheetEquation,
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
