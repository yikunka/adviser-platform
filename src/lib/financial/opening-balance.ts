/** Level-1 and parent accounts derive opening balances from children; only leaf level-2+ accounts are editable. */
export function canEditOpeningBalance(level: number, hasChildren: boolean) {
  return level >= 2 && !hasChildren
}

export function canEditEnteredBalances(level: number, hasChildren: boolean) {
  return canEditOpeningBalance(level, hasChildren)
}

export function openingBalanceEditBlockedMessage(level: number, hasChildren: boolean) {
  if (level === 1) {
    return '一级科目的期初余额和本年累计发生数由下级科目自动汇总，无需单独录入。'
  }
  if (hasChildren) {
    return '上级科目的期初余额和本年累计发生数由下级科目自动汇总，无需单独录入。'
  }
  return ''
}
