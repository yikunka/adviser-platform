export type AccountHierarchyNode = {
  id: string
  code: string
  name: string
  level: number
  parentId: string | null
}

export type AccountLevelRef = {
  level: number
  code: string
  name: string
}

export function buildAccountByIdMap<T extends AccountHierarchyNode>(accounts: T[]) {
  return new Map(accounts.map(account => [account.id, account]))
}

export function buildAccountLevelChain(
  account: AccountHierarchyNode,
  accountById: Map<string, AccountHierarchyNode>,
): AccountLevelRef[] {
  const chain: AccountLevelRef[] = []
  let current: AccountHierarchyNode | null = account

  while (current) {
    chain.unshift({ level: current.level, code: current.code, name: current.name })
    current = current.parentId ? accountById.get(current.parentId) ?? null : null
  }

  return chain
}

export function formatAccountLevelCell(chain: AccountLevelRef[] | undefined, level: number) {
  const item = chain?.find(entry => entry.level === level)
  if (!item) return '-'
  return `${item.code} ${item.name}`
}

export function formatJournalLineAccountLevels(account?: {
  code: string
  name: string
  level?: number
  levelChain?: AccountLevelRef[]
}) {
  if (account?.levelChain?.length) {
    return {
      level1: formatAccountLevelCell(account.levelChain, 1),
      level2: formatAccountLevelCell(account.levelChain, 2),
      level3: formatAccountLevelCell(account.levelChain, 3),
    }
  }

  if (!account) {
    return { level1: '-', level2: '-', level3: '-' }
  }

  const leaf = `${account.code} ${account.name}`
  const level = account.level ?? 1
  return {
    level1: level === 1 ? leaf : '-',
    level2: level === 2 ? leaf : '-',
    level3: level >= 3 ? leaf : '-',
  }
}
