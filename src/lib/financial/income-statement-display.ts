import type { IncomeStatementReport } from '@/lib/financial/reports'
import type { StatementLineRow } from '@/lib/financial/report-line-types'
import { roundMoney } from '@/lib/financial/utils'

export type PlRowKind = 'section' | 'detail' | 'subtotal' | 'milestone' | 'expense-group'

export type PlDisplayRow =
  | { kind: 'section'; key: string; label: string }
  | {
      kind: 'detail'
      key: string
      line: StatementLineRow
      indent: number
    }
  | {
      kind: 'subtotal'
      key: string
      label: string
      period: number
      ytd: number
    }
  | {
      kind: 'milestone'
      key: string
      label: string
      period: number
      ytd: number
      variant: 'gross' | 'net'
    }
  | {
      kind: 'expense-group'
      key: string
      label: string
      period: number
      ytd: number
      lines: StatementLineRow[]
    }

export function pctOfRevenue(amount: number, revenue: number): number | null {
  if (revenue === 0) return null
  return roundMoney((amount / revenue) * 100)
}

export function formatPctOfRevenue(amount: number, revenue: number): string {
  const pct = pctOfRevenue(amount, revenue)
  if (pct === null) return '—'
  return `${pct.toFixed(1)}%`
}

/** Build a single continuous P&L layout (expense groups are expandable in the UI). */
export function buildIncomeStatementDisplayRows(
  statement: IncomeStatementReport,
): PlDisplayRow[] {
  const rows: PlDisplayRow[] = []

  rows.push({ kind: 'section', key: 'sec-revenue', label: '营业收入' })
  for (const line of statement.revenue) {
    rows.push({ kind: 'detail', key: `rev-${line.accountId}`, line, indent: 1 })
  }
  rows.push({
    kind: 'subtotal',
    key: 'total-revenue',
    label: '收入合计',
    period: statement.totalRevenue,
    ytd: statement.totalRevenueYtd,
  })

  rows.push({ kind: 'section', key: 'sec-cogs', label: '减：营业成本' })
  for (const line of statement.costOfSales) {
    rows.push({ kind: 'detail', key: `cogs-${line.accountId}`, line, indent: 1 })
  }
  rows.push({
    kind: 'subtotal',
    key: 'total-cogs',
    label: '营业成本合计',
    period: statement.totalCostOfSales,
    ytd: statement.totalCostOfSalesYtd,
  })

  rows.push({
    kind: 'milestone',
    key: 'gross-profit',
    label: '毛利',
    period: statement.grossProfit,
    ytd: statement.grossProfitYtd,
    variant: 'gross',
  })

  rows.push({ kind: 'section', key: 'sec-opex', label: '减：营业费用' })
  for (const category of statement.expenseCategories) {
    rows.push({
      kind: 'expense-group',
      key: `exp-${category.key}`,
      label: category.label,
      period: category.total,
      ytd: category.totalYtd,
      lines: category.lines,
    })
  }
  rows.push({
    kind: 'subtotal',
    key: 'total-expenses',
    label: '营业费用合计',
    period: statement.totalExpenses,
    ytd: statement.totalExpensesYtd,
  })

  rows.push({
    kind: 'milestone',
    key: 'net-profit',
    label: '本期利润',
    period: statement.netProfit,
    ytd: statement.netProfitYtd,
    variant: 'net',
  })

  return rows
}

export function buildIncomeStatementExcelRows(
  statement: IncomeStatementReport,
): (string | number)[][] {
  const revenue = statement.totalRevenue
  const rows: (string | number)[][] = [
    ['项目', '编码', '本期金额', '占收入%', '本年度总金额', '本年占收入%'],
  ]

  const pushSection = (label: string) => {
    rows.push([label, '', '', '', '', ''])
  }
  const pushDetail = (line: StatementLineRow, prefix = '') => {
    rows.push([
      `${prefix}${line.name}`,
      line.code,
      line.amount,
      formatPctOfRevenue(line.amount, revenue),
      line.yearToDateAmount ?? 0,
      formatPctOfRevenue(line.yearToDateAmount ?? 0, statement.totalRevenueYtd),
    ])
  }
  const pushTotal = (label: string, period: number, ytd: number) => {
    rows.push([
      label,
      '',
      period,
      formatPctOfRevenue(period, revenue),
      ytd,
      formatPctOfRevenue(ytd, statement.totalRevenueYtd),
    ])
  }

  pushSection('营业收入')
  for (const line of statement.revenue) pushDetail(line, '  ')
  pushTotal('收入合计', statement.totalRevenue, statement.totalRevenueYtd)

  pushSection('减：营业成本')
  for (const line of statement.costOfSales) pushDetail(line, '  ')
  pushTotal('营业成本合计', statement.totalCostOfSales, statement.totalCostOfSalesYtd)
  pushTotal('毛利', statement.grossProfit, statement.grossProfitYtd)

  pushSection('减：营业费用')
  for (const category of statement.expenseCategories) {
    pushTotal(`  ${category.label}合计`, category.total, category.totalYtd)
    for (const line of category.lines) pushDetail(line, '    ')
  }
  pushTotal('营业费用合计', statement.totalExpenses, statement.totalExpensesYtd)
  pushTotal('本期利润', statement.netProfit, statement.netProfitYtd)

  return rows
}
