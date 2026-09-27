import type { AccountType, JournalSourceType, Prisma } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'
import { isFinancingAccount } from '@/lib/financial/cash-flow-classification'
import { classifyCurrentAccountBalance } from '@/lib/financial/current-account-classification'
import { isDebitNormalAccountType } from '@/lib/financial/account-types'
import {
  buildBalanceSheetSections,
  buildBalanceSheetSectionsFromBuckets,
  isCurrentAssetAccount,
  isCurrentLiabilityAccount,
  isNonCurrentAssetAccount,
  type BalanceSheetSection,
} from '@/lib/financial/balance-sheet-sections'
import {
  loadReportStructureIndex,
  resolveBsSectionForAccount,
  resolvePlClassificationForAccount,
} from '@/lib/financial/report-structure'
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
  shouldIncludeIncomeStatementLine,
  type IncomeStatementExpenseCategory,
  type IncomeStatementExpenseCategoryKey,
  type ProfitAndLossStatementType,
} from '@/lib/financial/income-statement'
import { isCurrentYearProfitAccountName } from '@/lib/financial/year-to-date'

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
  totalRevenueYtd: number
  totalCostOfSalesYtd: number
  grossProfitYtd: number
  totalExpensesYtd: number
  netProfitYtd: number
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
const CURRENT_PERIOD_PROFIT_NOTE = '损益类科目期末尚未结转到本年利润的余额。余额表「本年利润」不含本行；如基础数据不平衡，资产负债表仍会显示差异。'
const UNCLOSED_PROFIT_AND_LOSS_ACCOUNT_ID = '__unclosed_profit_and_loss__'

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

/** Calendar-year start period `YYYY-01` for the year of the selected accounting period. */
function calendarYearStartPeriod(period: string) {
  const year = period.split('-')[0]
  if (!/^\d{4}$/.test(year ?? '')) {
    throw new Error('Invalid period. Use YYYY-MM.')
  }
  return `${year}-01`
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

function addOrUpdateStatementLine(lines: StatementLineRow[], line: StatementLineRow) {
  const existing = lines.find(existingLine => existingLine.accountId === line.accountId)
  if (existing) {
    existing.amount = roundMoney(existing.amount + line.amount)
    if (line.yearToDateAmount !== undefined) {
      existing.yearToDateAmount = roundMoney((existing.yearToDateAmount ?? 0) + line.yearToDateAmount)
    }
    if (line.note) existing.note = line.note
    if (line.noteAmount !== undefined) existing.noteAmount = line.noteAmount
    return existing
  }
  lines.push(line)
  return line
}

function addCurrentPeriodProfitToEquity(input: {
  equityLines: StatementLineRow[]
  accounts: InternalReportAccountRow[]
  level1AccountIdByReportAccountId: Map<string, string>
  profitAmount: number
}) {
  if (input.profitAmount === 0) return

  const currentYearProfitAccount = input.accounts.find(
    account => account.type === 'EQUITY' && isCurrentYearProfitAccountName(account.name),
  )

  // Keep 本年利润 on the balance sheet equal to the trial-balance closing balance.
  // Any P&L still sitting in income/expense accounts is shown on a separate computed line
  // so the equation can close without rewriting the ledger 本年利润 figure.
  if (currentYearProfitAccount) {
    addOrUpdateStatementLine(input.equityLines, {
      accountId: UNCLOSED_PROFIT_AND_LOSS_ACCOUNT_ID,
      parentId: null,
      code: 'P&L',
      name: '未结转损益',
      type: 'EQUITY',
      level: 1,
      amount: input.profitAmount,
      note: CURRENT_PERIOD_PROFIT_NOTE,
      noteAmount: input.profitAmount,
    })
    return
  }

  addOrUpdateStatementLine(input.equityLines, {
    accountId: '__current_period_profit__',
    parentId: null,
    code: 'P&L',
    name: '本期利润',
    type: 'EQUITY',
    level: 1,
    amount: input.profitAmount,
    note: CURRENT_PERIOD_PROFIT_NOTE,
    noteAmount: input.profitAmount,
  })
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
      companyId: true,
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
  const structureIndex = await loadReportStructureIndex(
    companyIds,
    rawAccounts.map(account => ({
      id: account.id,
      companyId: account.companyId,
      parentId: account.parentId,
      code: account.code,
      name: account.name,
      type: account.type,
      level: account.level,
    })),
  )
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

  const [ledgerOpeningMovements, periodMovements, ledgerClosingMovements, openingBalances, closingBalances, plSourceMovements, bsLedgerClosingMovements, plYearSourceMovements] = await Promise.all([
    aggregatePostedJournalMovements(period, undefined, scope),
    aggregatePostedJournalMovements(periodAfter(period), period, scope),
    aggregatePostedJournalMovements(periodAfter(period), undefined, scope),
    aggregateOpeningBalanceMovements(start, scope),
    aggregateOpeningBalanceMovements(end, scope, 'closing'),
    aggregatePostedJournalMovements(periodAfter(period), period, scope, { excludeSourceTypes: ['CLOSING'] }),
    aggregatePostedJournalMovements(periodAfter(period), undefined, scope, { excludeSourceTypes: ['CLOSING'] }),
    aggregatePostedJournalMovements(periodAfter(period), calendarYearStartPeriod(period), scope, { excludeSourceTypes: ['CLOSING'] }),
  ])
  const openingMovements = mergeMovementMaps(ledgerOpeningMovements, openingBalances)
  const closingMovements = mergeMovementMaps(ledgerClosingMovements, closingBalances)
  // Balance sheet uses closing movements excluding CLOSING entries so period-end
  // transfer vouchers do not automatically fold current-period profit into equity.
  const bsClosingMovements = mergeMovementMaps(bsLedgerClosingMovements, closingBalances)

  // For income statement: exclude CLOSING entries (结转本年利润) so that period-end transfer
  // vouchers do not cancel out the revenue/expense figures.
  // Trial balance still uses the full periodMovements (including CLOSING) to show true movements.
  const plPeriodMovements = new Map(plSourceMovements)
  const plClosingMovements = new Map(bsClosingMovements)
  const plYearToDateMovements = new Map(plYearSourceMovements)
  if (!shouldConsolidateAccounts) {
    for (const rawAccount of rawAccounts) {
      const statementType = resolvePlClassificationForAccount(structureIndex, {
        accountId: rawAccount.id,
        sourceAccountIds: [rawAccount.id],
        code: rawAccount.code,
        name: rawAccount.name,
        type: rawAccount.type,
      })?.statementType
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
      const existingClosing = plClosingMovements.get(rawAccount.id) ?? { debit: 0, credit: 0 }
      plClosingMovements.set(rawAccount.id, {
        debit: roundMoney(existingClosing.debit + legacyTotals.debit),
        credit: roundMoney(existingClosing.credit + legacyTotals.credit),
      })
      const existingYear = plYearToDateMovements.get(rawAccount.id) ?? { debit: 0, credit: 0 }
      plYearToDateMovements.set(rawAccount.id, {
        debit: roundMoney(existingYear.debit + legacyTotals.debit),
        credit: roundMoney(existingYear.credit + legacyTotals.credit),
      })
    }

    for (const rawAccount of rawAccounts) {
      if (!resolvePlClassificationForAccount(structureIndex, {
        accountId: rawAccount.id,
        sourceAccountIds: [rawAccount.id],
        code: rawAccount.code,
        name: rawAccount.name,
        type: rawAccount.type,
      })) continue
      const existing = plPeriodMovements.get(rawAccount.id)
      if (existing && hasMovement(existing)) continue
      const balanceTotals = closingBalances.get(rawAccount.id)
      if (!balanceTotals || !hasMovement(balanceTotals)) continue

      const balance = movementSignedBalance(balanceTotals, rawAccount.type, rawAccount.code)
      const fallbackTotals = trialBalanceTotalsFromBalance(balance, rawAccount.type, rawAccount.code)
      if (!hasMovement(fallbackTotals)) continue
      plPeriodMovements.set(rawAccount.id, fallbackTotals)
      if (!hasMovement(plClosingMovements.get(rawAccount.id) ?? { debit: 0, credit: 0 })) {
        plClosingMovements.set(rawAccount.id, fallbackTotals)
      }
      if (!hasMovement(plYearToDateMovements.get(rawAccount.id) ?? { debit: 0, credit: 0 })) {
        plYearToDateMovements.set(rawAccount.id, fallbackTotals)
      }
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
    expenseCategory?: IncomeStatementExpenseCategoryKey
    line: StatementLineRow
    sourceAccountIds: string[]
  }> = []
  const coveredProfitAndLossSourceAccountIds = new Set<string>()
  const uncoveredCumulativeProfitAndLossCandidates: Array<{
    statementType: ProfitAndLossStatementType
    sourceAccountIds: string[]
  }> = []
  const coveredCumulativeProfitAndLossSourceAccountIds = new Set<string>()
  let cumulativeProfitAndLoss = 0
  const assetLines: StatementLineRow[] = []
  const liabilityLines: StatementLineRow[] = []
  const equityLines: StatementLineRow[] = []
  const mappedCurrentAssets: StatementLineRow[] = []
  const mappedNonCurrentAssets: StatementLineRow[] = []
  const mappedCurrentLiabilities: StatementLineRow[] = []
  const mappedNonCurrentLiabilities: StatementLineRow[] = []
  const mappedEquity: StatementLineRow[] = []

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
    mappedCategory?: IncomeStatementExpenseCategoryKey,
  ): IncomeStatementExpenseCategoryKey {
    if (mappedCategory) return mappedCategory
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
    expenseCategory?: IncomeStatementExpenseCategoryKey
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
        category: expenseCategoryForAccount(input.account, input.level1GroupId, input.expenseCategory),
      })
      added = true
    }
    if (added) {
      for (const accountId of input.sourceAccountIds) {
        coveredProfitAndLossSourceAccountIds.add(accountId)
      }
    }
  }

  function addCumulativeProfitAndLossSource(input: {
    amount: number
    statementType: ProfitAndLossStatementType
    sourceAccountIds: string[]
  }) {
    if (input.amount === 0) return
    // `profitAndLossMovementAmount` returns positive magnitudes for every P&L type
    // (revenue = credit-debit, cost/expense = debit-credit). Profit is revenue minus
    // cost/expense, so revenue adds to equity while cost/expense subtracts from it.
    const signedAmount = input.statementType === 'REVENUE' ? input.amount : -input.amount
    cumulativeProfitAndLoss = roundMoney(cumulativeProfitAndLoss + signedAmount)
    for (const accountId of input.sourceAccountIds) {
      coveredCumulativeProfitAndLossSourceAccountIds.add(accountId)
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
    // Residual unclosed P&L must use full closing (including CLOSING transfers), so only
    // amounts still sitting in income/expense accounts are folded into equity.
    const cumulativeStatementTotals = sumMovements(closingMovements, statementAccountIds)
    const cumulativeOwnTotals = sumMovements(closingMovements, ownAccountIds)
    const statementYearToDateTotals = sumMovements(plYearToDateMovements, statementAccountIds)
    const ownYearToDateTotals = sumMovements(plYearToDateMovements, ownAccountIds)
    const level1GroupIdForPl = level1AccountIdByReportAccountId.get(account.accountId) ?? account.accountId
    const plClassification = resolvePlClassificationForAccount(
      structureIndex,
      account,
      rawAccountsById.get(level1GroupIdForPl) ?? null,
    )
    const profitAndLossType = plClassification?.statementType ?? null
    const mappedExpenseCategory = plClassification?.expenseCategory

    const openingBalance = movementSignedBalance(openingTotals, account.type, account.code)
    const statementPeriodNet = profitAndLossType
      ? profitAndLossMovementAmount(statementPeriodTotals, profitAndLossType)
      : movementSignedBalance(statementPeriodTotals, account.type, account.code)
    const ownPeriodNet = profitAndLossType
      ? profitAndLossMovementAmount(ownPeriodTotals, profitAndLossType)
      : movementSignedBalance(ownPeriodTotals, account.type, account.code)
    const cumulativeStatementNet = profitAndLossType
      ? profitAndLossMovementAmount(cumulativeStatementTotals, profitAndLossType)
      : 0
    const cumulativeOwnNet = profitAndLossType
      ? profitAndLossMovementAmount(cumulativeOwnTotals, profitAndLossType)
      : 0
    const statementYearToDateNet = profitAndLossType
      ? profitAndLossMovementAmount(statementYearToDateTotals, profitAndLossType)
      : 0
    const ownYearToDateNet = profitAndLossType
      ? profitAndLossMovementAmount(ownYearToDateTotals, profitAndLossType)
      : 0
    const ledgerClosingBalance = movementSignedBalance(closingTotals, account.type, account.code)
    const yearToDateTotals = shouldConsolidateAccounts
      ? undefined
      : yearToDateTotalsByAccount.get(account.accountId)
    const yearToDateBalance = yearToDateTotals?.balance ?? 0
    const closingBalance = roundMoney(ledgerClosingBalance + yearToDateBalance)
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
    // 本年利润 must match the trial-balance closing (includes period-end CLOSING transfers).
    const balanceSheetClosingBalance = (
      account.type === 'EQUITY' && isCurrentYearProfitAccountName(account.name)
    )
      ? closingBalance
      : bsClosingBalance
    const statementRow: StatementLineRow = {
      ...reportRow,
      ...(profitAndLossType ? { type: profitAndLossType } : {}),
      amount: statementPeriodNet,
      yearToDateAmount: statementYearToDateNet,
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
        expenseCategory: mappedExpenseCategory,
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
          yearToDateAmount: ownYearToDateNet,
          periodDebit: ownPeriodTotals.debit,
          periodCredit: ownPeriodTotals.credit,
        },
        sourceAccountIds: ownAccountIds,
        expenseCategory: mappedExpenseCategory,
      })
    }
    if (profitAndLossType && ownPeriodNet !== 0 && account.level === 1) {
      uncoveredProfitAndLossCandidates.push({
        account,
        statementType: profitAndLossType,
        level1GroupId,
        expenseCategory: mappedExpenseCategory,
        line: {
          ...reportRow,
          type: profitAndLossType,
          amount: ownPeriodNet,
          yearToDateAmount: ownYearToDateNet,
          periodDebit: ownPeriodTotals.debit,
          periodCredit: ownPeriodTotals.credit,
        },
        sourceAccountIds: ownAccountIds,
      })
    }
    if (profitAndLossType && shouldIncludeIncomeStatementLine({
      type: profitAndLossType,
      level: account.level,
      topLevelHasChildren,
      periodNet: cumulativeStatementNet,
    })) {
      addCumulativeProfitAndLossSource({
        amount: cumulativeStatementNet,
        statementType: profitAndLossType,
        sourceAccountIds: statementAccountIds,
      })
    } else if (profitAndLossType && account.level === 1 && hasChildren && cumulativeOwnNet !== 0) {
      addCumulativeProfitAndLossSource({
        amount: cumulativeOwnNet,
        statementType: profitAndLossType,
        sourceAccountIds: ownAccountIds,
      })
    }
    if (profitAndLossType && cumulativeOwnNet !== 0) {
      uncoveredCumulativeProfitAndLossCandidates.push({
        statementType: profitAndLossType,
        sourceAccountIds: ownAccountIds,
      })
    }

    if (shouldIncludeAccountInBalanceSheet(account.level)) {
      if (structureIndex.bsConfigured) {
        if (balanceSheetClosingBalance !== 0) {
          const bsSection = resolveBsSectionForAccount(structureIndex, account)
          const row = { ...reportRow, amount: balanceSheetClosingBalance }
          if (bsSection === 'BS_CURRENT_ASSETS') mappedCurrentAssets.push(row)
          if (bsSection === 'BS_NON_CURRENT_ASSETS') mappedNonCurrentAssets.push(row)
          if (bsSection === 'BS_CURRENT_LIABILITIES') mappedCurrentLiabilities.push(row)
          if (bsSection === 'BS_NON_CURRENT_LIABILITIES') mappedNonCurrentLiabilities.push(row)
          if (bsSection === 'BS_EQUITY') mappedEquity.push(row)
        }
      } else {
        if ((account.type === 'ASSET' || account.type === 'NON_CURRENT_ASSET') && balanceSheetClosingBalance !== 0) {
          assetLines.push({ ...reportRow, amount: balanceSheetClosingBalance })
        }
        if ((account.type === 'LIABILITY' || account.type === 'NON_CURRENT_LIABILITY') && balanceSheetClosingBalance !== 0) {
          liabilityLines.push({ ...reportRow, amount: balanceSheetClosingBalance })
        }
        if (account.type === 'EQUITY' && balanceSheetClosingBalance !== 0) {
          equityLines.push({ ...reportRow, amount: balanceSheetClosingBalance })
        }
        if (account.type === 'CURRENT_ACCOUNT') {
          const currentAccountSide = classifyCurrentAccountBalance(balanceSheetClosingBalance)
          if (currentAccountSide?.side === 'ASSET') {
            assetLines.push({ ...reportRow, amount: currentAccountSide.amount })
          }
          if (currentAccountSide?.side === 'LIABILITY') {
            liabilityLines.push({ ...reportRow, amount: currentAccountSide.amount })
          }
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

    const uncoveredYearToDateTotals = sumMovements(plYearToDateMovements, uncoveredSourceAccountIds)
    const yearToDateAmount = profitAndLossMovementAmount(uncoveredYearToDateTotals, candidate.statementType)

    addProfitAndLossLine({
      account: candidate.account,
      statementType: candidate.statementType,
      level1GroupId: candidate.level1GroupId,
      expenseCategory: candidate.expenseCategory,
      line: {
        ...candidate.line,
        amount,
        yearToDateAmount,
        periodDebit: uncoveredTotals.debit,
        periodCredit: uncoveredTotals.credit,
      },
      sourceAccountIds: uncoveredSourceAccountIds,
    })
  }

  for (const candidate of uncoveredCumulativeProfitAndLossCandidates) {
    const uncoveredSourceAccountIds = candidate.sourceAccountIds.filter(
      accountId => !coveredCumulativeProfitAndLossSourceAccountIds.has(accountId),
    )
    if (uncoveredSourceAccountIds.length === 0) continue

    const uncoveredTotals = sumMovements(closingMovements, uncoveredSourceAccountIds)
    const amount = profitAndLossMovementAmount(uncoveredTotals, candidate.statementType)
    addCumulativeProfitAndLossSource({
      amount,
      statementType: candidate.statementType,
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
  const totalRevenueYtd = roundMoney(revenueLines.reduce((sum, row) => sum + (row.yearToDateAmount ?? 0), 0))
  const totalCostOfSalesYtd = roundMoney(costOfSalesLines.reduce((sum, row) => sum + (row.yearToDateAmount ?? 0), 0))
  const grossProfitYtd = roundMoney(totalRevenueYtd - totalCostOfSalesYtd)
  const totalExpensesYtd = roundMoney(expenseCategories.reduce((sum, category) => sum + category.totalYtd, 0))
  const netProfitYtd = roundMoney(grossProfitYtd - totalExpensesYtd)
  addCurrentPeriodProfitToEquity({
    equityLines: structureIndex.bsConfigured ? mappedEquity : equityLines,
    accounts,
    level1AccountIdByReportAccountId,
    profitAmount: cumulativeProfitAndLoss,
  })

  const balanceSheetLayout = structureIndex.bsConfigured
    ? buildBalanceSheetSectionsFromBuckets({
        currentAssets: mappedCurrentAssets,
        nonCurrentAssets: mappedNonCurrentAssets,
        currentLiabilities: mappedCurrentLiabilities,
        nonCurrentLiabilities: mappedNonCurrentLiabilities,
        equity: mappedEquity,
        level1AccountIdByReportAccountId,
      })
    : buildBalanceSheetSections({
        assetLines,
        liabilityLines,
        equityLines,
        level1AccountIdByReportAccountId,
      })
  const totalAssets = balanceSheetLayout.totalAssets
  const totalLiabilities = balanceSheetLayout.totalLiabilities
  const totalEquity = balanceSheetLayout.totalEquity
  const totalLiabilitiesAndEquity = roundMoney(totalLiabilities + totalEquity)
  const balanceSheetEquation = buildAccountingEquationCheck(totalAssets, totalLiabilities, totalEquity)
  const trialBalanceEquation = buildAccountingEquationCheck(totalAssets, totalLiabilities, totalEquity)

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
      totalRevenueYtd,
      totalCostOfSalesYtd,
      grossProfitYtd,
      totalExpensesYtd,
      netProfitYtd,
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
        total: totalEquity,
      },
      assets: balanceSheetLayout.assets,
      liabilities: balanceSheetLayout.liabilities,
      equity: balanceSheetLayout.equity,
      totalAssets,
      totalLiabilities,
      totalEquity,
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
