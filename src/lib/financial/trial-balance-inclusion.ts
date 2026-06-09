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

function hasTrialBalanceActivity(input: {
  periodTotals: TrialBalanceMovementTotals
  openingTotals: TrialBalanceMovementTotals
  closingBalance: number
  yearToDateTotals?: TrialBalanceYearToDateTotals | null
}): boolean {
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

  return hasTrialBalanceActivity(input)
}

/** Whether a level-1 grouping row with sub-accounts should appear as a summary line. */
export function shouldShowLevel1SummaryInTrialBalance(input: {
  level: number
  hasChildren: boolean
  periodTotals: TrialBalanceMovementTotals
  openingTotals: TrialBalanceMovementTotals
  closingBalance: number
  yearToDateTotals?: TrialBalanceYearToDateTotals | null
}): boolean {
  return isLevel1AccountWithChildren(input.level, input.hasChildren)
    && hasTrialBalanceActivity(input)
}
