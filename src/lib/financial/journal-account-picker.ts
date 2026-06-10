export type JournalAccountPickerAccount = {
  id: string
  code: string
  name: string
  parentId: string | null
  level: number
  sortOrder: number
}

export function getJournalAccountPickerAccounts<T extends JournalAccountPickerAccount>(accounts: T[]) {
  const accountIdsWithDirectChildren = new Set(
    accounts
      .map(account => account.parentId)
      .filter((parentId): parentId is string => Boolean(parentId)),
  )

  return accounts
    .filter(account => (
      account.level === 2
      || account.level === 3
      || (account.level === 1 && !accountIdsWithDirectChildren.has(account.id))
    ))
    .sort((left, right) => left.sortOrder - right.sortOrder || left.code.localeCompare(right.code))
}
