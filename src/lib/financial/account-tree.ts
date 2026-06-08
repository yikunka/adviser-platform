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

export function formatAccountOptionLabel(code: string, name: string) {
  return `${code} - ${name}`
}

export type FlatAccountOption<T extends AccountTreeItem = AccountTreeItem> = T & {
  label: string
}

export function flattenAccountHierarchy<T extends AccountTreeItem>(accounts: T[]): FlatAccountOption<T>[] {
  const rows: FlatAccountOption<T>[] = []

  const visit = (items: AccountTreeNode<T>[]) => {
    for (const item of items) {
      const { children: _children, ...account } = item
      rows.push({
        ...(account as unknown as T),
        label: formatAccountOptionLabel(item.code, item.name),
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
