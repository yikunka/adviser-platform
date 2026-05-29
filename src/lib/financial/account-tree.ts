export type AccountTreeItem = {
  id: string
  code: string
  name: string
  parentId: string | null
  level: number
  sortOrder: number
  children?: AccountTreeItem[]
}

type AccountTreeNode<T extends AccountTreeItem> = T & {
  children: AccountTreeNode<T>[]
}

export function getAccountHierarchy<T extends AccountTreeItem>(accounts: T[]) {
  const byId = new Map<string, AccountTreeNode<T>>()
  const roots: AccountTreeNode<T>[] = []

  for (const account of accounts) {
    byId.set(account.id, { ...account, children: [] } as AccountTreeNode<T>)
  }

  for (const account of byId.values()) {
    const parent = account.parentId ? byId.get(account.parentId) : null
    if (parent) {
      parent.children.push(account)
    } else {
      roots.push(account)
    }
  }

  const sortAccounts = (items: AccountTreeNode<T>[]) => {
    items.sort((a, b) => a.sortOrder - b.sortOrder || a.code.localeCompare(b.code))
    items.forEach(item => sortAccounts(item.children))
  }

  sortAccounts(roots)
  return roots
}

export function getChildrenForParent<T extends AccountTreeItem>(
  accounts: T[],
  parentId: string | null,
) {
  return accounts
    .filter(account => account.parentId === parentId)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.code.localeCompare(b.code))
}

export function flattenAccountHierarchy<T extends AccountTreeItem>(accounts: T[]) {
  const rows: (T & { label: string })[] = []

  const visit = (items: AccountTreeNode<T>[]) => {
    for (const item of items) {
      rows.push({
        ...item,
        label: `${'  '.repeat(Math.max(0, item.level - 1))}${item.code} - ${item.name}`,
      })
      if (item.children.length) visit(item.children)
    }
  }

  visit(getAccountHierarchy(accounts))
  return rows
}

export function isDescendantAccount<T extends AccountTreeItem>(
  accounts: T[],
  accountId: string,
  candidateParentId: string,
) {
  let current = accounts.find(account => account.id === candidateParentId) ?? null
  while (current) {
    if (current.id === accountId) return true
    current = current.parentId ? accounts.find(account => account.id === current?.parentId) ?? null : null
  }
  return false
}
