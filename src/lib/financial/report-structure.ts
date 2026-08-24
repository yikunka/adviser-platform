import type { AccountType, FinancialReportSection } from '@prisma/client'
import {
  classifyIncomeStatementExpenseCategory,
  inferProfitAndLossStatementType,
  type IncomeStatementExpenseCategoryKey,
  type ProfitAndLossStatementType,
} from '@/lib/financial/income-statement'
import {
  isCurrentAssetAccount,
  isCurrentLiabilityAccount,
  isNonCurrentAssetAccount,
  isNonCurrentLiabilityAccount,
} from '@/lib/financial/balance-sheet-sections'

export const PL_REPORT_SECTIONS = [
  'PL_REVENUE',
  'PL_COST_OF_SALES',
  'PL_EXPENSE_SALES',
  'PL_EXPENSE_ADMINISTRATIVE',
  'PL_EXPENSE_FINANCE',
] as const satisfies ReadonlyArray<FinancialReportSection>

export const BS_REPORT_SECTIONS = [
  'BS_CURRENT_ASSETS',
  'BS_NON_CURRENT_ASSETS',
  'BS_CURRENT_LIABILITIES',
  'BS_NON_CURRENT_LIABILITIES',
  'BS_EQUITY',
] as const satisfies ReadonlyArray<FinancialReportSection>

export type PlReportSection = (typeof PL_REPORT_SECTIONS)[number]
export type BsReportSection = (typeof BS_REPORT_SECTIONS)[number]

export const REPORT_SECTION_LABELS: Record<FinancialReportSection, string> = {
  PL_REVENUE: '营业收入',
  PL_COST_OF_SALES: '营业成本',
  PL_EXPENSE_SALES: '销售费用',
  PL_EXPENSE_ADMINISTRATIVE: '管理费用',
  PL_EXPENSE_FINANCE: '财务费用',
  BS_CURRENT_ASSETS: '流动资产',
  BS_NON_CURRENT_ASSETS: '非流动资产',
  BS_CURRENT_LIABILITIES: '流动负债',
  BS_NON_CURRENT_LIABILITIES: '非流动负债',
  BS_EQUITY: '所有者权益',
}

export type ReportStructureAccount = {
  id: string
  companyId: string | null
  parentId: string | null
  code: string
  name: string
  type: AccountType
  level: number
}

export type PlClassification = {
  statementType: ProfitAndLossStatementType
  expenseCategory?: IncomeStatementExpenseCategoryKey
}

export type ReportStructureIndex = {
  /** True when the company has at least one P&L section mapping. */
  plConfigured: boolean
  /** True when the company has at least one balance-sheet section mapping. */
  bsConfigured: boolean
  plByAccountId: Map<string, PlClassification>
  bsByAccountId: Map<string, BsReportSection>
}

function isPlSection(section: FinancialReportSection): section is PlReportSection {
  return (PL_REPORT_SECTIONS as ReadonlyArray<string>).includes(section)
}

function isBsSection(section: FinancialReportSection): section is BsReportSection {
  return (BS_REPORT_SECTIONS as ReadonlyArray<string>).includes(section)
}

function plClassificationFromSection(section: PlReportSection): PlClassification {
  switch (section) {
    case 'PL_REVENUE':
      return { statementType: 'REVENUE' }
    case 'PL_COST_OF_SALES':
      return { statementType: 'CGS' }
    case 'PL_EXPENSE_SALES':
      return { statementType: 'EXPENSE', expenseCategory: 'sales' }
    case 'PL_EXPENSE_ADMINISTRATIVE':
      return { statementType: 'EXPENSE', expenseCategory: 'administrative' }
    case 'PL_EXPENSE_FINANCE':
      return { statementType: 'EXPENSE', expenseCategory: 'finance' }
  }
}

function buildChildrenByParent(accounts: ReportStructureAccount[]) {
  const childrenByParent = new Map<string, string[]>()
  for (const account of accounts) {
    if (!account.parentId) continue
    const list = childrenByParent.get(account.parentId) ?? []
    list.push(account.id)
    childrenByParent.set(account.parentId, list)
  }
  return childrenByParent
}

/** Expand mapped parents so all descendants inherit the same report section. */
function expandMappedAccountIds(
  mappedIds: Iterable<string>,
  childrenByParent: Map<string, string[]>,
): Set<string> {
  const result = new Set<string>()
  const stack = [...mappedIds]
  while (stack.length > 0) {
    const id = stack.pop()!
    if (result.has(id)) continue
    result.add(id)
    for (const childId of childrenByParent.get(id) ?? []) stack.push(childId)
  }
  return result
}

/**
 * Load per-company report structure and expand parent→descendant mappings.
 * When a statement has no mappings, that half of the index stays empty and
 * `*Configured` is false so callers fall back to heuristics.
 */
export async function loadReportStructureIndex(
  companyIds: string[] | undefined,
  accounts: ReportStructureAccount[],
): Promise<ReportStructureIndex> {
  const empty: ReportStructureIndex = {
    plConfigured: false,
    bsConfigured: false,
    plByAccountId: new Map(),
    bsByAccountId: new Map(),
  }
  if (!companyIds?.length) return empty

  const { prisma } = await import('@/lib/db/prisma')
  const mappings = await prisma.financialReportSectionMapping.findMany({
    where: { companyId: { in: companyIds } },
    select: { companyId: true, section: true, accountId: true },
  })
  if (mappings.length === 0) return empty

  const accountsByCompany = new Map<string, ReportStructureAccount[]>()
  for (const account of accounts) {
    if (!account.companyId) continue
    const list = accountsByCompany.get(account.companyId) ?? []
    list.push(account)
    accountsByCompany.set(account.companyId, list)
  }

  const plByAccountId = new Map<string, PlClassification>()
  const bsByAccountId = new Map<string, BsReportSection>()
  let plConfigured = false
  let bsConfigured = false

  for (const companyId of companyIds) {
    const companyAccounts = accountsByCompany.get(companyId) ?? []
    const childrenByParent = buildChildrenByParent(companyAccounts)
    const companyMappings = mappings.filter(row => row.companyId === companyId)

    const plMapped = companyMappings.filter(row => isPlSection(row.section))
    const bsMapped = companyMappings.filter(row => isBsSection(row.section))
    if (plMapped.length > 0) plConfigured = true
    if (bsMapped.length > 0) bsConfigured = true

    for (const section of PL_REPORT_SECTIONS) {
      const roots = plMapped.filter(row => row.section === section).map(row => row.accountId)
      if (roots.length === 0) continue
      const classification = plClassificationFromSection(section)
      for (const accountId of expandMappedAccountIds(roots, childrenByParent)) {
        // First explicit section wins if an account is mapped to multiple sections.
        if (!plByAccountId.has(accountId)) plByAccountId.set(accountId, classification)
      }
    }

    for (const section of BS_REPORT_SECTIONS) {
      const roots = bsMapped.filter(row => row.section === section).map(row => row.accountId)
      if (roots.length === 0) continue
      for (const accountId of expandMappedAccountIds(roots, childrenByParent)) {
        if (!bsByAccountId.has(accountId)) bsByAccountId.set(accountId, section)
      }
    }
  }

  return { plConfigured, bsConfigured, plByAccountId, bsByAccountId }
}

export function resolvePlClassificationForAccount(
  index: ReportStructureIndex,
  account: { accountId: string; sourceAccountIds: string[]; code: string; name: string; type: AccountType },
  topLevelAccount?: { code: string; name: string } | null,
): PlClassification | null {
  if (index.plConfigured) {
    for (const id of [account.accountId, ...account.sourceAccountIds]) {
      const mapped = index.plByAccountId.get(id)
      if (mapped) return mapped
    }
    return null
  }

  const statementType = inferProfitAndLossStatementType(account)
  if (!statementType) return null
  if (statementType !== 'EXPENSE') return { statementType }
  return {
    statementType,
    expenseCategory: classifyIncomeStatementExpenseCategory({
      account,
      topLevelAccount,
    }),
  }
}

export function resolveBsSectionForAccount(
  index: ReportStructureIndex,
  account: {
    accountId: string
    sourceAccountIds: string[]
    code: string
    name: string
    type: AccountType
  },
): BsReportSection | null {
  if (index.bsConfigured) {
    for (const id of [account.accountId, ...account.sourceAccountIds]) {
      const mapped = index.bsByAccountId.get(id)
      if (mapped) return mapped
    }
    return null
  }

  if (account.type === 'EQUITY') return 'BS_EQUITY'
  if (isNonCurrentAssetAccount(account)) return 'BS_NON_CURRENT_ASSETS'
  if (isCurrentAssetAccount(account)) return 'BS_CURRENT_ASSETS'
  if (isNonCurrentLiabilityAccount(account)) return 'BS_NON_CURRENT_LIABILITIES'
  if (isCurrentLiabilityAccount(account)) return 'BS_CURRENT_LIABILITIES'
  return null
}

/** Suggest section mappings from current heuristics (for "初始化建议" on the settings page). */
export function suggestReportSectionMappings(accounts: ReportStructureAccount[]): Array<{
  section: FinancialReportSection
  accountId: string
}> {
  const byId = new Map(accounts.map(a => [a.id, a]))
  const suggestions: Array<{ section: FinancialReportSection; accountId: string }> = []
  const usedPl = new Set<string>()
  const usedBs = new Set<string>()

  for (const account of accounts) {
    const statementType = inferProfitAndLossStatementType(account)
    if (statementType) {
      let section: PlReportSection
      if (statementType === 'REVENUE') section = 'PL_REVENUE'
      else if (statementType === 'CGS') section = 'PL_COST_OF_SALES'
      else {
        const parent = account.parentId ? byId.get(account.parentId) : null
        const topLevel = parent?.level === 1
          ? parent
          : account.level === 1
            ? account
            : null
        const category = classifyIncomeStatementExpenseCategory({
          account,
          topLevelAccount: topLevel,
        })
        section = category === 'sales'
          ? 'PL_EXPENSE_SALES'
          : category === 'finance'
            ? 'PL_EXPENSE_FINANCE'
            : 'PL_EXPENSE_ADMINISTRATIVE'
      }
      // Prefer mapping level-1 parents so descendants inherit.
      const mapTarget = account.level === 1
        ? account
        : (() => {
            let cur: ReportStructureAccount | undefined = account
            while (cur?.parentId) {
              const parent = byId.get(cur.parentId)
              if (!parent) break
              if (parent.level === 1) return parent
              cur = parent
            }
            return account
          })()
      if (!usedPl.has(`${section}:${mapTarget.id}`)) {
        usedPl.add(`${section}:${mapTarget.id}`)
        suggestions.push({ section, accountId: mapTarget.id })
      }
    }

    let bsSection: BsReportSection | null = null
    if (account.type === 'EQUITY') bsSection = 'BS_EQUITY'
    else if (isNonCurrentAssetAccount(account)) bsSection = 'BS_NON_CURRENT_ASSETS'
    else if (account.type === 'ASSET') bsSection = 'BS_CURRENT_ASSETS'
    else if (isNonCurrentLiabilityAccount(account)) bsSection = 'BS_NON_CURRENT_LIABILITIES'
    else if (account.type === 'LIABILITY') bsSection = 'BS_CURRENT_LIABILITIES'
    // Skip CURRENT_ACCOUNT for seed — side depends on balance.

    if (bsSection && account.level === 1) {
      const key = `${bsSection}:${account.id}`
      if (!usedBs.has(key)) {
        usedBs.add(key)
        suggestions.push({ section: bsSection, accountId: account.id })
      }
    }
  }

  return suggestions
}
