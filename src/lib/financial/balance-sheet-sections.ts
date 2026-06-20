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

  const assetSections: BalanceSheetSection[] = [
    { label: '非流动资产', lines: nonCurrentAssets, total: sectionTotal(nonCurrentAssets) },
    { label: '流动资产', lines: currentAssets, total: sectionTotal(currentAssets) },
  ]

  const liabilitySections: BalanceSheetSection[] = [
    { label: '非流动负债', lines: nonCurrentLiabilities, total: sectionTotal(nonCurrentLiabilities) },
    { label: '流动负债', lines: currentLiabilities, total: sectionTotal(currentLiabilities) },
  ]

  const equitySection: BalanceSheetSection = {
    label: '所有者权益',
    lines: equity,
    total: sectionTotal(equity),
  }

  return {
    assetSections,
    liabilitySections,
    equitySection,
    assets: [...nonCurrentAssets, ...currentAssets],
    liabilities: [...nonCurrentLiabilities, ...currentLiabilities],
    equity,
    totalAssets: roundMoney(sectionTotal(nonCurrentAssets) + sectionTotal(currentAssets)),
    totalLiabilities: roundMoney(sectionTotal(nonCurrentLiabilities) + sectionTotal(currentLiabilities)),
    totalEquity: equitySection.total,
  }
}
