import type { AccountType } from '@prisma/client'

export type TrialBalanceDisplayRow = {
  accountId: string
  code: string
  name: string
  type: AccountType
  level: number
  sortOrder: number
  periodDebit: number
  periodCredit: number
  closingDebit: number
  closingCredit: number
  isComputed?: boolean
  isSummary?: boolean
}

type HierarchyAccount = {
  id: string
  parentId: string | null
  level: number
  sortOrder: number
  code: string
}

type ReportAccountRef = {
  accountId: string
  code: string
}

export function buildLevel1GroupingMaps(
  rawAccounts: HierarchyAccount[],
  reportAccounts: ReportAccountRef[],
) {
  const byId = new Map(rawAccounts.map(account => [account.id, account]))
  const level1IdByAccountId = new Map<string, string>()

  function resolveLevel1Id(id: string): string {
    const cached = level1IdByAccountId.get(id)
    if (cached) return cached

    const account = byId.get(id)
    if (!account || account.level === 1) {
      level1IdByAccountId.set(id, id)
      return id
    }

    const ancestor = resolveLevel1Id(account.parentId!)
    level1IdByAccountId.set(id, ancestor)
    return ancestor
  }

  for (const account of rawAccounts) {
    resolveLevel1Id(account.id)
  }

  const level1IdByCode = new Map<string, string>()
  const level1SortOrderById = new Map<string, number>()
  for (const account of rawAccounts) {
    const level1Id = level1IdByAccountId.get(account.id)!
    if (!level1IdByCode.has(account.code)) {
      level1IdByCode.set(account.code, level1Id)
    }
    const level1 = byId.get(level1Id)
    if (level1) {
      level1SortOrderById.set(level1Id, level1.sortOrder)
    }
  }

  const level1AccountIdByReportAccountId = new Map<string, string>()
  for (const account of reportAccounts) {
    if (byId.has(account.accountId)) {
      level1AccountIdByReportAccountId.set(
        account.accountId,
        level1IdByAccountId.get(account.accountId)!,
      )
      continue
    }
    level1AccountIdByReportAccountId.set(
      account.accountId,
      level1IdByCode.get(account.code) ?? account.accountId,
    )
  }

  return { level1AccountIdByReportAccountId, level1SortOrderById, level1IdByAccountId, byId }
}

export function assembleTrialBalanceRows(input: {
  detailRows: TrialBalanceDisplayRow[]
  summaryRowsByLevel1Id: Map<string, TrialBalanceDisplayRow>
  level1AccountIdByReportAccountId: Map<string, string>
  level1SortOrderById: Map<string, number>
}): TrialBalanceDisplayRow[] {
  const detailRows = input.detailRows.filter(row => !row.isComputed)
  const computedRows = input.detailRows.filter(row => row.isComputed)

  const groups = new Map<string, { summary?: TrialBalanceDisplayRow; details: TrialBalanceDisplayRow[] }>()

  for (const row of detailRows) {
    const level1Id = input.level1AccountIdByReportAccountId.get(row.accountId) ?? row.accountId
    const group = groups.get(level1Id) ?? { details: [] }
    group.details.push(row)
    groups.set(level1Id, group)
  }

  for (const [level1Id, summary] of input.summaryRowsByLevel1Id) {
    const group = groups.get(level1Id) ?? { details: [] }
    group.summary = summary
    groups.set(level1Id, group)
  }

  const sortedGroupIds = [...groups.keys()].sort((left, right) => {
    const sortLeft = input.level1SortOrderById.get(left) ?? Number.MAX_SAFE_INTEGER
    const sortRight = input.level1SortOrderById.get(right) ?? Number.MAX_SAFE_INTEGER
    return sortLeft - sortRight || left.localeCompare(right)
  })

  const result: TrialBalanceDisplayRow[] = []
  for (const groupId of sortedGroupIds) {
    const group = groups.get(groupId)!
    if (group.summary) {
      result.push(group.summary)
    }
    group.details.sort(
      (left, right) => left.sortOrder - right.sortOrder
        || left.code.localeCompare(right.code)
        || left.level - right.level,
    )
    result.push(...group.details)
  }

  return [...result, ...computedRows]
}
