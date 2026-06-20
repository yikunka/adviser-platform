import type { AccountType, JournalSourceType, Prisma } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'
import { isFinancingAccount } from '@/lib/financial/cash-flow-classification'
import { classifyCurrentAccountBalance } from '@/lib/financial/current-account-classification'
import { isDebitNormalAccountType } from '@/lib/financial/account-types'
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
import { shouldIncludeAccountInBalanceSheet } from '@/lib/financial/balance-sheet-inclusion'
import { shouldIncludeAccountInTrialBalance, shouldShowLevel1SummaryInTrialBalance } from '@/lib/financial/trial-balance-inclusion'
import {
  assembleTrialBalanceRows,
  buildLevel1GroupingMaps,
  calculateTrialBalanceLevel1Totals,
  type TrialBalanceDisplayRow,
} from '@/lib/financial/trial-balance-rows'
import { roundMoney } from '@/lib/financial/utils'
import {
  buildIncomeStatementExpenseCategories,
  classifyIncomeStatementExpenseCategory,
  inferProfitAndLossStatementType,
  shouldIncludeIncomeStatementLine,
  type IncomeStatementExpenseCategory,
  type IncomeStatementExpenseCategoryKey,
  type ProfitAndLossStatementType,
} from '@/lib/financial/income-statement'

export type { BalanceSheetSection } from '@/lib/financial/balance-sheet-sections'
export type { ReportAccountRow, StatementLineRow } from '@/lib/financial/report-line-types'

type MovementTotals = {
  debit: number
  credit: number
}

export type TrialBalanceRow = TrialBalanceDisplayRow

export type IncomeStatementReport = {
  period: string
  currency: 'HKD'
  standard: 'HKFRS'
  revenue: StatementLineRow[]
  costOfSales: StatementLineRow[]
  expenses: StatementLineRow[]
  expenseCategories: IncomeStatementExpenseCategory[]
  totalRevenue: number
  totalCostOfSales: number
  grossProfit: number
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

function periodAfter(period: string) {
  const { end } = periodRange(period)
  return `${end.getUTCFullYear()}-${String(end.getUTCMonth() + 1).padStart(2, '0')}`
}

function signedBalance(amount: number, type: AccountType, code?: string) {
  if (isDebitNormalAccountType(type, code)) return roundMoney(amount)
  return roundMoney(-amount)
}

function isCashAccount(account: { code: string; name: string }) {
  return /^(1001|1002|1010|1020)/.test(account.code) || /cash|bank|現金|銀行/i.test(account.name)
}

function isWorkingCapitalAccount(account: { code: string; type: AccountType; name: string }) {
  return (
    isCurrentAssetAccount(account)
    || isCurrentLiabilityAccount(account)
    || account.type === 'CURRENT_ACCOUNT'
  )
}

function isNonCurrentAsset(account: ReportAccountRow & { name: string }) {
  return isNonCurrentAssetAccount(account)
}

export type FinancialReportScope = {
  companyId?: string
  companyIds?: string[]
}

type InternalReportAccountRow = ReportAccountRow & {
  parentId?: string | null
  sourceAccountIds: string[]
  sortOrder: number
}

function scopeCompanyIds(scope?: FinancialReportScope) {
  if (scope?.companyIds?.length) return Array.from(new Set(scope.companyIds))
  if (scope?.companyId) return [scope.companyId]
  return undefined
}

async function aggregatePostedJournalMovements(
  beforePeriod?: string,
  fromPeriod?: string,
  scope?: FinancialReportScope,
  options?: { excludeSourceTypes?: JournalSourceType[] },
) {
  const companyIds = scopeCompanyIds(scope)
  const entryWhere: Prisma.JournalEntryWhereInput = {
    status: 'POSTED',
    ...(companyIds ? { companyId: { in: companyIds } } : {}),
    ...(options?.excludeSourceTypes?.length ? { sourceType: { notIn: options.excludeSourceTypes } } : {}),
  }

  if (beforePeriod && fromPeriod) {
    entryWhere.period = { gte: fromPeriod, lt: beforePeriod }
  } else if (beforePeriod) {
    entryWhere.period = { lt: beforePeriod }
  } else if (fromPeriod) {
    entryWhere.period = { gte: fromPeriod }
  }

  const lines = await prisma.journalLine.findMany({
    where: { entry: entryWhere },
    select: {
      accountId: true,
      debit: true,
      credit: true,
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

async function resolvePostedJournalAccountIdsWithAncestors(
  beforePeriod: string,
  scope?: FinancialReportScope,
) {
  const companyIds = scopeCompanyIds(scope)
  const entryWhere: Prisma.JournalEntryWhereInput = {
    status: 'POSTED',
    period: { lte: beforePeriod },
    ...(companyIds ? { companyId: { in: companyIds } } : {}),
  }
  const lineAccounts = await prisma.journalLine.findMany({
    where: { entry: entryWhere },
    distinct: ['accountId'],
    select: { accountId: true },
  })

  const accountIds = new Set(lineAccounts.map(line => line.accountId))
  let pendingParentIds = Array.from(accountIds)

  while (pendingParentIds.length > 0) {
    const accounts = await prisma.finAccount.findMany({
      where: { id: { in: pendingParentIds } },
      select: { id: true, parentId: true },
    })
    pendingParentIds = accounts
      .map(account => account.parentId)
      .filter((parentId): parentId is string => parentId !== null)
      .filter(parentId => !accountIds.has(parentId))
    for (const parentId of pendingParentIds) {
      accountIds.add(parentId)
    }
  }

  return Array.from(accountIds)
}

function movementSignedBalance(totals: MovementTotals, type: AccountType, code?: string) {
  const net = roundMoney(totals.debit - totals.credit)
  return signedBalance(net, type, code)
}

function profitAndLossMovementAmount(totals: MovementTotals, type: ProfitAndLossStatementType) {
  if (type === 'REVENUE') return roundMoney(totals.credit - totals.debit)
  if (type === 'CGS' || type === 'EXPENSE') return roundMoney(totals.debit - totals.credit)
  return 0
}

function profitAndLossTotalsFromAmount(amount: number, type: ProfitAndLossStatementType): MovementTotals {
  const value = roundMoney(amount)
  if (value === 0) return { debit: 0, credit: 0 }
  if (type === 'REVENUE') {
    return value >= 0
      ? { debit: 0, credit: value }
      : { debit: Math.abs(value), credit: 0 }
  }
  return value >= 0
    ? { debit: value, credit: 0 }
    : { debit: 0, credit: Math.abs(value) }
}

function trialBalanceTotalsFromBalance(balance: number, type: AccountType, code?: string): MovementTotals {
  const columns = trialBalanceColumns(balance, type, code)
  return {
    debit: columns.closingDebit,
    credit: columns.closingCredit,
  }
}

function hasMovement(totals: MovementTotals) {
  return totals.debit !== 0 || totals.credit !== 0
}

function periodBeforeDate(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
}

async function aggregateOpeningBalanceMovements(
  beforeEnd: Date,
  scope?: FinancialReportScope,
  side: 'opening' | 'closing' = 'opening',
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
      closingDebit: true,
      closingCredit: true,
    },
  })

  const latestByAccount = new Map<string, { debit: number; credit: number }>()
  for (const row of rows) {
    if (latestByAccount.has(row.accountId)) continue
    const closingDebit = Number(row.closingDebit)
    const closingCredit = Number(row.closingCredit)
    const hasClosing = closingDebit !== 0 || closingCredit !== 0
    latestByAccount.set(row.accountId, {
      debit: side === 'closing' && hasClosing ? closingDebit : Number(row.openingDebit),
      credit: side === 'closing' && hasClosing ? closingCredit : Number(row.openingCredit),
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
  const referencedAccountIds = companyIds
    ? await resolvePostedJournalAccountIdsWithAncestors(period, scope)
    : []

  const rawAccounts = await prisma.finAccount.findMany({
    where: {
      ...(companyIds
        ? {
            OR: [
              { companyId: { in: companyIds } },
              ...(referencedAccountIds.length ? [{ id: { in: referencedAccountIds } }] : []),
            ],
          }
        : {}),
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
      yearToDateAmount: true,
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
    yearToDateAmount: Number(account.yearToDateAmount ?? 0),
    yearToDateDebit: Number(account.yearToDateDebit ?? 0),
    yearToDateCredit: Number(account.yearToDateCredit ?? 0),
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

  const [ledgerOpeningMovements, periodMovements, ledgerClosingMovements, openingBalances, closingBalances, plSourceMovements, bsLedgerClosingMovements] = await Promise.all([
    aggregatePostedJournalMovements(period, undefined, scope),
    aggregatePostedJournalMovements(periodAfter(period), period, scope),
    aggregatePostedJournalMovements(periodAfter(period), undefined, scope),
    aggregateOpeningBalanceMovements(start, scope),
    aggregateOpeningBalanceMovements(end, scope, 'closing'),
    aggregatePostedJournalMovements(periodAfter(period), period, scope, { excludeSourceTypes: ['CLOSING'] }),
    aggregatePostedJournalMovements(periodAfter(period), undefined, scope, { excludeSourceTypes: ['CLOSING'] }),
  ])
  const openingMovements = mergeMovementMaps(ledgerOpeningMovements, openingBalances)
  const closingMovements = mergeMovementMaps(ledgerClosingMovements, closingBalances)
  // Balance sheet uses closing movements excluding CLOSING entries so that profit transferred
  // via 结转本年利润 is not double-counted when netProfit is added to equity below.
  const bsClosingMovements = mergeMovementMaps(bsLedgerClosingMovements, closingBalances)

  // For income statement: exclude CLOSING entries (结转本年利润) so that period-end transfer
  // vouchers do not cancel out the revenue/expense figures.
  // Trial balance still uses the full periodMovements (including CLOSING) to show true movements.
  const plPeriodMovements = new Map(plSourceMovements)
  if (!shouldConsolidateAccounts) {
    for (const rawAccount of rawAccounts) {
      const statementType = inferProfitAndLossStatementType(rawAccount)
      if (!statementType) continue
      const ytdDebit = Number(rawAccount.yearToDateDebit ?? 0)
      const ytdCredit = Number(rawAccount.yearToDateCredit ?? 0)
      const ytdAmount = Number(rawAccount.yearToDateAmount ?? 0)
      if (ytdDebit === 0 && ytdCredit === 0 && ytdAmount === 0) continue
      const existing = plPeriodMovements.get(rawAccount.id) ?? { debit: 0, credit: 0 }
      const legacyTotals = ytdDebit === 0 && ytdCredit === 0
        ? profitAndLossTotalsFromAmount(ytdAmount, statementType)
        : { debit: ytdDebit, credit: ytdCredit }
      plPeriodMovements.set(rawAccount.id, {
        debit: roundMoney(existing.debit + legacyTotals.debit),
        credit: roundMoney(existing.credit + legacyTotals.credit),
      })
    }

    for (const rawAccount of rawAccounts) {
      if (!inferProfitAndLossStatementType(rawAccount)) continue
      const existing = plPeriodMovements.get(rawAccount.id)
      if (existing && hasMovement(existing)) continue
      const balanceTotals = closingBalances.get(rawAccount.id)
      if (!balanceTotals || !hasMovement(balanceTotals)) continue

      const balance = movementSignedBalance(balanceTotals, rawAccount.type, rawAccount.code)
      const fallbackTotals = trialBalanceTotalsFromBalance(balance, rawAccount.type, rawAccount.code)
      if (!hasMovement(fallbackTotals)) continue
      plPeriodMovements.set(rawAccount.id, fallbackTotals)
    }
  }

  const { level1AccountIdByReportAccountId, level1SortOrderById } = buildLevel1GroupingMaps(
    rawAccounts,
    accounts.map(({ accountId, code }) => ({ accountId, code })),
  )
  const rawAccountsById = new Map(rawAccounts.map(account => [account.id, account]))

  const trialRows: TrialBalanceRow[] = []
  const summaryRowsByLevel1Id = new Map<string, TrialBalanceRow>()

  const revenueLines: StatementLineRow[] = []
  const costOfSalesLines: StatementLineRow[] = []
  const expenseEntries: Array<{ line: StatementLineRow; category: IncomeStatementExpenseCategoryKey }> = []
  const uncoveredProfitAndLossCandidates: Array<{
    account: InternalReportAccountRow
    statementType: ProfitAndLossStatementType
    level1GroupId: string
    line: StatementLineRow
    sourceAccountIds: string[]
  }> = []
  const coveredProfitAndLossSourceAccountIds = new Set<string>()
  const assetLines: StatementLineRow[] = []
  const liabilityLines: StatementLineRow[] = []
  const equityLines: StatementLineRow[] = []

  const openingByAccount = new Map<string, number>()
  const closingByAccount = new Map<string, number>()
  let closingEquityEffect = 0

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

  function topLevelAccountHasChildren(account: InternalReportAccountRow, level1GroupId: string): boolean {
    if (shouldConsolidateAccounts) {
      const rawLevel1Ids = rawAccounts
        .filter(rawAccount => rawAccount.type === account.type && rawAccount.level === 1)
        .filter(rawAccount => rawAccount.id === level1GroupId || rawAccount.code === account.code)
        .map(rawAccount => rawAccount.id)

      return rawLevel1Ids.some(rawLevel1Id => (childrenByParent.get(rawLevel1Id) ?? []).length > 0)
    }

    return (childrenByParent.get(level1GroupId) ?? []).length > 0
  }

  function ownSourceAccountIds(account: InternalReportAccountRow) {
    if (shouldConsolidateAccounts) return account.sourceAccountIds
    return [account.accountId]
  }

  function statementSourceAccountIds(account: InternalReportAccountRow) {
    const sourceAccountIds = shouldConsolidateAccounts
      ? account.sourceAccountIds
      : [account.accountId, ...account.sourceAccountIds]
    const accountIds = sourceAccountIds.flatMap(accountId => [
      accountId,
      ...(leafIdsByAccount.get(accountId) ?? [accountId]),
    ])
    return Array.from(new Set(accountIds))
  }

  function expenseCategoryForAccount(
    account: InternalReportAccountRow,
    level1GroupId: string,
  ): IncomeStatementExpenseCategoryKey {
    const topLevelAccount = rawAccountsById.get(level1GroupId)
    return classifyIncomeStatementExpenseCategory({
      account,
      topLevelAccount,
    })
  }

  function addProfitAndLossLine(input: {
    account: InternalReportAccountRow
    statementType: ProfitAndLossStatementType
    level1GroupId: string
    line: StatementLineRow
    sourceAccountIds: string[]
  }) {
    let added = false
    if (input.statementType === 'REVENUE') {
      revenueLines.push(input.line)
      added = true
    }
    if (input.statementType === 'CGS') {
      costOfSalesLines.push(input.line)
      added = true
    }
    if (input.statementType === 'EXPENSE') {
      expenseEntries.push({
        line: input.line,
        category: expenseCategoryForAccount(input.account, input.level1GroupId),
      })
      added = true
    }
    if (added) {
      for (const accountId of input.sourceAccountIds) {
        coveredProfitAndLossSourceAccountIds.add(accountId)
      }
    }
  }

  for (const account of accounts) {
    const openingTotals = sumMovements(openingMovements, account.sourceAccountIds)
    const periodTotals = sumMovements(periodMovements, account.sourceAccountIds)
    const closingTotals = sumMovements(closingMovements, account.sourceAccountIds)
    const bsClosingTotals = sumMovements(bsClosingMovements, account.sourceAccountIds)
    const statementAccountIds = statementSourceAccountIds(account)
    const ownAccountIds = ownSourceAccountIds(account)
    const statementPeriodTotals = sumMovements(plPeriodMovements, statementAccountIds)
    const ownPeriodTotals = sumMovements(plPeriodMovements, ownAccountIds)
    const profitAndLossType = inferProfitAndLossStatementType(account)

    const openingBalance = movementSignedBalance(openingTotals, account.type, account.code)
    const statementPeriodNet = profitAndLossType
      ? profitAndLossMovementAmount(statementPeriodTotals, profitAndLossType)
      : movementSignedBalance(statementPeriodTotals, account.type, account.code)
    const ownPeriodNet = profitAndLossType
      ? profitAndLossMovementAmount(ownPeriodTotals, profitAndLossType)
      : movementSignedBalance(ownPeriodTotals, account.type, account.code)
    const ledgerClosingBalance = movementSignedBalance(closingTotals, account.type, account.code)
    const yearToDateTotals = shouldConsolidateAccounts
      ? undefined
      : yearToDateTotalsByAccount.get(account.accountId)
    const yearToDateBalance = yearToDateTotals?.balance ?? 0
    const closingBalance = roundMoney(ledgerClosingBalance + yearToDateBalance)
    // Balance sheet closing balance excludes CLOSING entries to avoid double-counting netProfit.
    const bsLedgerClosingBalance = movementSignedBalance(bsClosingTotals, account.type, account.code)
    const bsClosingBalance = roundMoney(bsLedgerClosingBalance + yearToDateBalance)

    openingByAccount.set(account.accountId, openingBalance)
    closingByAccount.set(account.accountId, closingBalance)

    const reportRow: ReportAccountRow = {
      accountId: account.accountId,
      parentId: account.parentId ?? null,
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
    }

    const level1GroupId = level1AccountIdByReportAccountId.get(account.accountId) ?? account.accountId
    if (shouldShowLevel1SummaryInTrialBalance({
      level: account.level,
      hasChildren: accountHasChildren(account),
      periodTotals,
      openingTotals,
      closingBalance,
      yearToDateTotals,
    })) {
      summaryRowsByLevel1Id.set(level1GroupId, {
        ...reportRow,
        sortOrder: account.sortOrder,
        periodDebit: periodTotals.debit,
        periodCredit: periodTotals.credit,
        ...tbCols,
        isSummary: true,
      })
    }

    const hasChildren = accountHasChildren(account)
    const topLevelHasChildren = topLevelAccountHasChildren(account, level1GroupId)
    const statementRow: StatementLineRow = {
      ...reportRow,
      ...(profitAndLossType ? { type: profitAndLossType } : {}),
      amount: statementPeriodNet,
      periodDebit: statementPeriodTotals.debit,
      periodCredit: statementPeriodTotals.credit,
    }
    if (profitAndLossType && shouldIncludeIncomeStatementLine({
      type: profitAndLossType,
      level: account.level,
      topLevelHasChildren,
      periodNet: statementPeriodNet,
    })) {
      addProfitAndLossLine({
        account,
        statementType: profitAndLossType,
        level1GroupId,
        line: statementRow,
        sourceAccountIds: statementAccountIds,
      })
    } else if (profitAndLossType && account.level === 1 && hasChildren && ownPeriodNet !== 0) {
      addProfitAndLossLine({
        account,
        statementType: profitAndLossType,
        level1GroupId,
        line: {
          ...reportRow,
          type: profitAndLossType,
          amount: ownPeriodNet,
          periodDebit: ownPeriodTotals.debit,
          periodCredit: ownPeriodTotals.credit,
        },
        sourceAccountIds: ownAccountIds,
      })
    }
    if (profitAndLossType && ownPeriodNet !== 0) {
      uncoveredProfitAndLossCandidates.push({
        account,
        statementType: profitAndLossType,
        level1GroupId,
        line: {
          ...reportRow,
          type: profitAndLossType,
          amount: ownPeriodNet,
          periodDebit: ownPeriodTotals.debit,
          periodCredit: ownPeriodTotals.credit,
        },
        sourceAccountIds: ownAccountIds,
      })
    }

    if (shouldIncludeAccountInBalanceSheet(account.level)) {
      if ((account.type === 'ASSET' || account.type === 'NON_CURRENT_ASSET') && closingBalance !== 0) {
        assetLines.push({ ...reportRow, amount: closingBalance })
      }
      if ((account.type === 'LIABILITY' || account.type === 'NON_CURRENT_LIABILITY') && closingBalance !== 0) {
        liabilityLines.push({ ...reportRow, amount: closingBalance })
      }
      if (account.type === 'EQUITY' && closingBalance !== 0) equityLines.push({ ...reportRow, amount: closingBalance })
      if (account.type === 'EQUITY') {
        // Track how much P&L was already transferred to equity via CLOSING entries,
        // so we don't double-count it when adding netProfit to totalEquity below.
        closingEquityEffect = roundMoney(closingEquityEffect + (closingBalance - bsClosingBalance))
      }
      if (account.type === 'CURRENT_ACCOUNT') {
        const currentAccountSide = classifyCurrentAccountBalance(closingBalance)
        if (currentAccountSide?.side === 'ASSET') {
          assetLines.push({ ...reportRow, amount: currentAccountSide.amount })
        }
        if (currentAccountSide?.side === 'LIABILITY') {
          liabilityLines.push({ ...reportRow, amount: currentAccountSide.amount })
        }
      }
    }
  }

  for (const candidate of uncoveredProfitAndLossCandidates) {
    const uncoveredSourceAccountIds = candidate.sourceAccountIds.filter(
      accountId => !coveredProfitAndLossSourceAccountIds.has(accountId),
    )
    if (uncoveredSourceAccountIds.length === 0) continue

    const uncoveredTotals = sumMovements(plPeriodMovements, uncoveredSourceAccountIds)
    const amount = profitAndLossMovementAmount(uncoveredTotals, candidate.statementType)
    if (amount === 0) continue

    addProfitAndLossLine({
      account: candidate.account,
      statementType: candidate.statementType,
      level1GroupId: candidate.level1GroupId,
      line: {
        ...candidate.line,
        amount,
        periodDebit: uncoveredTotals.debit,
        periodCredit: uncoveredTotals.credit,
      },
      sourceAccountIds: uncoveredSourceAccountIds,
    })
  }

  const expenseCategories = buildIncomeStatementExpenseCategories(expenseEntries)
  const expenseLines = expenseEntries.map(entry => entry.line)
  const totalRevenue = roundMoney(revenueLines.reduce((sum, row) => sum + row.amount, 0))
  const totalCostOfSales = roundMoney(costOfSalesLines.reduce((sum, row) => sum + row.amount, 0))
  const grossProfit = roundMoney(totalRevenue - totalCostOfSales)
  const totalExpenses = roundMoney(expenseCategories.reduce((sum, category) => sum + category.total, 0))
  const netProfit = roundMoney(grossProfit - totalExpenses)

  const balanceSheetLayout = buildBalanceSheetSections({
    assetLines,
    liabilityLines,
    equityLines,
    level1AccountIdByReportAccountId,
  })
  const totalAssets = balanceSheetLayout.totalAssets
  const totalLiabilities = balanceSheetLayout.totalLiabilities
  // Subtract closingEquityEffect (P&L already transferred to equity via CLOSING entries)
  // to avoid double-counting it alongside netProfit from the income statement.
  const totalEquityWithProfit = roundMoney(balanceSheetLayout.totalEquity + netProfit - closingEquityEffect)
  const totalLiabilitiesAndEquity = roundMoney(totalLiabilities + totalEquityWithProfit)
  const balanceSheetEquation = buildAccountingEquationCheck(totalAssets, totalLiabilities, totalEquityWithProfit)
  const trialBalanceEquation = buildAccountingEquationCheck(totalAssets, totalLiabilities, totalEquityWithProfit)

  const finalTrialRows = assembleTrialBalanceRows({
    detailRows: trialRows,
    summaryRowsByLevel1Id,
    level1AccountIdByReportAccountId,
    level1SortOrderById,
  })

  const { totalDebit, totalCredit } = calculateTrialBalanceLevel1Totals(finalTrialRows)

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
      rows: finalTrialRows,
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
      costOfSales: costOfSalesLines,
      expenses: expenseLines,
      expenseCategories,
      totalRevenue,
      totalCostOfSales,
      grossProfit,
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
      equitySection: {
        ...balanceSheetLayout.equitySection,
        total: totalEquityWithProfit,
      },
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
