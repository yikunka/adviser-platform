export type TrialBalanceMovementTotals = {
  debit: number
  credit: number
}

export type TrialBalanceYearToDateTotals = {
  debit: number
  credit: number
  balance: number
}

/** Level-1 accounts with sub-accounts are grouping headers; show detail rows instead. */
export function isLevel1AccountWithChildren(level: number, hasChildren: boolean): boolean {
  return level === 1 && hasChildren
}

/** Whether a chart-of-accounts row should appear on the trial balance report. */
export function shouldIncludeAccountInTrialBalance(input: {
  level: number
  hasChildren: boolean
  periodTotals: TrialBalanceMovementTotals
  openingTotals: TrialBalanceMovementTotals
  closingBalance: number
  yearToDateTotals?: TrialBalanceYearToDateTotals | null
}): boolean {
  if (isLevel1AccountWithChildren(input.level, input.hasChildren)) {
    return false
  }

  return (
    input.periodTotals.debit > 0
    || input.periodTotals.credit > 0
    || input.openingTotals.debit > 0
    || input.openingTotals.credit > 0
    || input.closingBalance !== 0
    || (input.yearToDateTotals?.debit ?? 0) > 0
    || (input.yearToDateTotals?.credit ?? 0) > 0
  )
}
