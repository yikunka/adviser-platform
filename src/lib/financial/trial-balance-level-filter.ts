import type { TrialBalanceRow } from '@/lib/financial/reports'

export type TrialBalanceLevelFilter = '1' | '2' | 'all'

export const TRIAL_BALANCE_LEVEL_OPTIONS: { value: TrialBalanceLevelFilter; label: string }[] = [
  { value: '1', label: '仅一级科目' },
  { value: '2', label: '前两级科目' },
  { value: 'all', label: '全量明细' },
]

/** Filter trial-balance rows by maximum account level to display. Totals are unchanged. */
export function filterTrialBalanceRowsByLevel(
  rows: TrialBalanceRow[],
  maxLevel: TrialBalanceLevelFilter,
): TrialBalanceRow[] {
  if (maxLevel === 'all') return rows

  const levelCap = maxLevel === '1' ? 1 : 2

  return rows.filter(row => {
    if (row.isComputed) return true
    if (row.isSummary) return levelCap >= 1
    return row.level <= levelCap
  })
}
