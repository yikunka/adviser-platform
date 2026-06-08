import type { AccountType } from '@prisma/client'
import type { StatementLineRow } from '@/lib/financial/report-line-types'
import { roundMoney } from '@/lib/financial/utils'

export type BalanceSheetSection = {
  label: string
  lines: StatementLineRow[]
  total: number
}

function isCashAccount(account: { code: string; name: string }) {
  return /^(1001|1002|1010|1020)/.test(account.code) || /cash|bank|現金|銀行/i.test(account.name)
}

function isCurrentAccountReceivable(account: { code: string; type: AccountType }) {
  return account.type === 'CURRENT_ACCOUNT' && /^1/.test(account.code)
}

/** HKFRS current assets: cash, receivables, inventory (typically 10xx–12xx). */
export function isCurrentAssetAccount(account: { code: string; type: AccountType; name: string }) {
  if (isCurrentAccountReceivable(account)) return true
  if (account.type !== 'ASSET') return false
  if (isCashAccount(account)) return true
  return /^1(0|1|2)\d/.test(account.code)
}

/** HKFRS non-current assets: property, plant and equipment and other long-term assets. */
export function isNonCurrentAssetAccount(account: { code: string; type: AccountType; name: string }) {
  return account.type === 'ASSET' && !isCurrentAssetAccount(account)
}

/**
 * HKFRS non-current liabilities: long-term borrowings and other obligations
 * not expected to be settled within 12 months (typically 25xx–29xx).
 *
 * Note: 22xx codes (应付账款, 应交税费, 应付职工薪酬 etc.) are SHORT-TERM
 * trade payables and accruals — they are CURRENT liabilities under both
 * Chinese GAAP and HKFRS, so they are intentionally excluded from this range.
 */
export function isNonCurrentLiabilityAccount(account: { code: string; type: AccountType }) {
  if (account.type !== 'LIABILITY') return false
  return /^2[5-9]/.test(account.code)
}

/** HKFRS current liabilities: trade payables, accruals, tax payable and other short-term obligations. */
export function isCurrentLiabilityAccount(account: { code: string; type: AccountType }) {
  if (account.type === 'CURRENT_ACCOUNT' && /^2/.test(account.code)) return true
  return account.type === 'LIABILITY' && /^2/.test(account.code) && !isNonCurrentLiabilityAccount(account)
}

function sectionTotal(lines: StatementLineRow[]) {
  return roundMoney(lines.reduce((sum, row) => sum + row.amount, 0))
}

function sortLines(lines: StatementLineRow[]) {
  return [...lines].sort((a, b) => a.code.localeCompare(b.code))
}

export function buildBalanceSheetSections(input: {
  assetLines: StatementLineRow[]
  liabilityLines: StatementLineRow[]
  equityLines: StatementLineRow[]
}) {
  const currentAssets = sortLines(input.assetLines.filter(row => isCurrentAssetAccount(row)))
  const nonCurrentAssets = sortLines(input.assetLines.filter(row => isNonCurrentAssetAccount(row)))
  const currentLiabilities = sortLines(input.liabilityLines.filter(row => isCurrentLiabilityAccount(row)))
  const nonCurrentLiabilities = sortLines(input.liabilityLines.filter(row => isNonCurrentLiabilityAccount(row)))
  const equity = sortLines(input.equityLines)

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
