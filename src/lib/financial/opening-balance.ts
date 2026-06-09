/** Parent accounts derive opening balances from children; only leaf accounts are editable. */
export function canEditOpeningBalance(_level: number, hasChildren: boolean) {
  return !hasChildren
}

export function canEditEnteredBalances(level: number, hasChildren: boolean) {
  return canEditOpeningBalance(level, hasChildren)
}

export function openingBalanceEditBlockedMessage(level: number, hasChildren: boolean) {
  if (hasChildren) {
    return level === 1
      ? '一级科目的期初余额和本年累计发生数由下级科目自动汇总，无需单独录入。'
      : '上级科目的期初余额和本年累计发生数由下级科目自动汇总，无需单独录入。'
  }
  return ''
}
