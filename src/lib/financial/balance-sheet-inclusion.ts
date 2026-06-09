/** Whether a chart-of-accounts row should appear on the balance sheet report. */
export function shouldIncludeAccountInBalanceSheet(_level: number): boolean {
  return true
}

/** Whether a row is shown as a top-level balance sheet line (level-1 summary). */
export function isBalanceSheetSummaryRow(level: number): boolean {
  return level === 1
}
