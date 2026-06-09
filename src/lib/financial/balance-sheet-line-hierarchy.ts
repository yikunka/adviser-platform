import type { StatementLineRow } from '@/lib/financial/report-line-types'

export type BalanceSheetLineRow = StatementLineRow & {
  children?: BalanceSheetLineRow[]
}

function sortBalanceSheetLines(lines: BalanceSheetLineRow[]) {
  return [...lines].sort((left, right) => left.code.localeCompare(right.code) || left.level - right.level)
}

/** Attach descendant detail rows under each level-1 summary row for expandable display. */
export function attachBalanceSheetChildren(
  topLevelLines: StatementLineRow[],
  allLines: StatementLineRow[],
  level1AccountIdByReportAccountId: Map<string, string>,
): BalanceSheetLineRow[] {
  return sortBalanceSheetLines(topLevelLines.map(line => ({ ...line }))).map(line => {
    const children = sortBalanceSheetLines(
      allLines
        .filter(
          child =>
            child.level > 1
            && (level1AccountIdByReportAccountId.get(child.accountId) ?? child.accountId) === line.accountId,
        )
        .map(child => ({ ...child })),
    )

    return children.length > 0 ? { ...line, children } : line
  })
}
