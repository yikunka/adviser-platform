/** Whether a chart-of-accounts row should appear on the balance sheet report. */
export function shouldIncludeAccountInBalanceSheet(level: number): boolean {
  return level === 1
}
