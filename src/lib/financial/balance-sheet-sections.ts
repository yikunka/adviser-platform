import type { AccountType } from '@prisma/client'
import type { BalanceSheetLineRow } from '@/lib/financial/balance-sheet-line-hierarchy'
import { attachBalanceSheetChildren } from '@/lib/financial/balance-sheet-line-hierarchy'
import type { StatementLineRow } from '@/lib/financial/report-line-types'
import { roundMoney } from '@/lib/financial/utils'

export type { BalanceSheetLineRow } from '@/lib/financial/balance-sheet-line-hierarchy'

export type BalanceSheetSection = {
  label: string
  lines: BalanceSheetLineRow[]
  total: number
}

/** HKFRS current assets: accounts explicitly typed as current assets plus receivable-style current accounts. */
export function isCurrentAssetAccount(account: { code: string; type: AccountType; name: string }) {
  if (account.type === 'NON_CURRENT_ASSET') return false
  if (account.type === 'CURRENT_ACCOUNT') return true
  return account.type === 'ASSET'
}

/** HKFRS non-current assets: accounts explicitly typed as non-current assets. */
export function isNonCurrentAssetAccount(account: { code: string; type: AccountType; name: string }) {
  return account.type === 'NON_CURRENT_ASSET'
}

/**
 * HKFRS non-current liabilities: accounts explicitly typed as non-current liabilities.
 */
export function isNonCurrentLiabilityAccount(account: { code: string; type: AccountType }) {
  return account.type === 'NON_CURRENT_LIABILITY'
}

/** HKFRS current liabilities: trade payables, accruals, tax payable and other short-term obligations. */
export function isCurrentLiabilityAccount(account: { code: string; type: AccountType }) {
  if (account.type === 'NON_CURRENT_LIABILITY') return false
  if (account.type === 'CURRENT_ACCOUNT') return true
  return account.type === 'LIABILITY'
}

function sectionTotal(lines: BalanceSheetLineRow[]) {
  return roundMoney(lines.reduce((sum, row) => sum + row.amount, 0))
}

function sortLines(lines: BalanceSheetLineRow[]) {
  return [...lines].sort((a, b) => a.code.localeCompare(b.code))
}

function buildSectionLines(
  lines: StatementLineRow[],
  classify: (row: StatementLineRow) => boolean,
  level1AccountIdByReportAccountId?: Map<string, string>,
) {
  const topLevel = lines.filter(classify).filter(row => row.level === 1)
  if (level1AccountIdByReportAccountId) {
    return attachBalanceSheetChildren(topLevel, lines, level1AccountIdByReportAccountId)
  }
  return sortLines(topLevel.map(line => ({ ...line })))
}

export function buildBalanceSheetSections(input: {
  assetLines: StatementLineRow[]
  liabilityLines: StatementLineRow[]
  equityLines: StatementLineRow[]
  level1AccountIdByReportAccountId?: Map<string, string>
}) {
  const currentAssets = buildSectionLines(input.assetLines, isCurrentAssetAccount, input.level1AccountIdByReportAccountId)
  const nonCurrentAssets = buildSectionLines(input.assetLines, isNonCurrentAssetAccount, input.level1AccountIdByReportAccountId)
  const currentLiabilities = buildSectionLines(input.liabilityLines, isCurrentLiabilityAccount, input.level1AccountIdByReportAccountId)
  const nonCurrentLiabilities = buildSectionLines(input.liabilityLines, isNonCurrentLiabilityAccount, input.level1AccountIdByReportAccountId)
  const equity = buildSectionLines(input.equityLines, () => true, input.level1AccountIdByReportAccountId)

  return assembleBalanceSheetSections({
    currentAssets,
    nonCurrentAssets,
    currentLiabilities,
    nonCurrentLiabilities,
    equity,
  })
}

/** Build BS sections from already-classified line buckets (custom report structure). */
export function buildBalanceSheetSectionsFromBuckets(input: {
  currentAssets: StatementLineRow[]
  nonCurrentAssets: StatementLineRow[]
  currentLiabilities: StatementLineRow[]
  nonCurrentLiabilities: StatementLineRow[]
  equity: StatementLineRow[]
  level1AccountIdByReportAccountId?: Map<string, string>
}) {
  const toSection = (lines: StatementLineRow[]) => {
    const topLevel = lines.filter(row => row.level === 1)
    if (input.level1AccountIdByReportAccountId) {
      return attachBalanceSheetChildren(topLevel, lines, input.level1AccountIdByReportAccountId)
    }
    return sortLines(topLevel.map(line => ({ ...line })))
  }

  return assembleBalanceSheetSections({
    currentAssets: toSection(input.currentAssets),
    nonCurrentAssets: toSection(input.nonCurrentAssets),
    currentLiabilities: toSection(input.currentLiabilities),
    nonCurrentLiabilities: toSection(input.nonCurrentLiabilities),
    equity: toSection(input.equity),
  })
}

function assembleBalanceSheetSections(input: {
  currentAssets: BalanceSheetLineRow[]
  nonCurrentAssets: BalanceSheetLineRow[]
  currentLiabilities: BalanceSheetLineRow[]
  nonCurrentLiabilities: BalanceSheetLineRow[]
  equity: BalanceSheetLineRow[]
}) {
  const assetSections: BalanceSheetSection[] = [
    { label: '非流动资产', lines: input.nonCurrentAssets, total: sectionTotal(input.nonCurrentAssets) },
    { label: '流动资产', lines: input.currentAssets, total: sectionTotal(input.currentAssets) },
  ]

  const liabilitySections: BalanceSheetSection[] = [
    { label: '非流动负债', lines: input.nonCurrentLiabilities, total: sectionTotal(input.nonCurrentLiabilities) },
    { label: '流动负债', lines: input.currentLiabilities, total: sectionTotal(input.currentLiabilities) },
  ]

  const equitySection: BalanceSheetSection = {
    label: '所有者权益',
    lines: input.equity,
    total: sectionTotal(input.equity),
  }

  return {
    assetSections,
    liabilitySections,
    equitySection,
    assets: [...input.nonCurrentAssets, ...input.currentAssets],
    liabilities: [...input.nonCurrentLiabilities, ...input.currentLiabilities],
    equity: input.equity,
    totalAssets: roundMoney(sectionTotal(input.nonCurrentAssets) + sectionTotal(input.currentAssets)),
    totalLiabilities: roundMoney(sectionTotal(input.nonCurrentLiabilities) + sectionTotal(input.currentLiabilities)),
    totalEquity: equitySection.total,
  }
}
