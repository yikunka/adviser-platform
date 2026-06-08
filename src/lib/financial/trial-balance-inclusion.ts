export type TrialBalanceMovementTotals = {
  debit: number
  credit: number
}

export type TrialBalanceYearToDateTotals = {
  debit: number
  credit: number
  balance: number
}

/** Whether a chart-of-accounts row should appear on the trial balance report. */
export function shouldIncludeAccountInTrialBalance(input: {
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
