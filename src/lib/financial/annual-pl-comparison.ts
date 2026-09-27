import { roundMoney } from '@/lib/financial/utils'

export const ANNUAL_PL_METRIC_KEYS = [
  'totalRevenue',
  'totalCostOfSales',
  'grossProfit',
  'totalExpenses',
  'netProfit',
] as const

export type AnnualPlMetricKey = (typeof ANNUAL_PL_METRIC_KEYS)[number]

export const ANNUAL_PL_METRIC_LABELS: Record<AnnualPlMetricKey, string> = {
  totalRevenue: '营业收入',
  totalCostOfSales: '营业成本',
  grossProfit: '毛利',
  totalExpenses: '营业费用',
  netProfit: '本期利润',
}

export type AnnualPlMonthSummary = {
  period: string
  totalRevenue: number
  totalCostOfSales: number
  grossProfit: number
  totalExpenses: number
  netProfit: number
}

export type AnnualPlComparisonRow = {
  key: AnnualPlMetricKey
  label: string
  /** Jan–Dec period amounts; always length 12. */
  months: number[]
  yearTotal: number
}

export type AnnualPlComparisonReport = {
  year: number
  currency: 'HKD'
  standard: 'HKFRS'
  /** `YYYY-MM` labels for columns 1–12. */
  periods: string[]
  rows: AnnualPlComparisonRow[]
  generatedAt: string
}

export function yearMonths(year: number): string[] {
  return Array.from({ length: 12 }, (_, index) => `${year}-${String(index + 1).padStart(2, '0')}`)
}

export function sumAnnualPlMonths(months: number[]): number {
  return roundMoney(months.reduce((sum, value) => sum + value, 0))
}

export function buildAnnualPlComparisonRows(monthSummaries: AnnualPlMonthSummary[]): AnnualPlComparisonRow[] {
  return ANNUAL_PL_METRIC_KEYS.map(key => {
    const months = monthSummaries.map(summary => roundMoney(summary[key]))
    return {
      key,
      label: ANNUAL_PL_METRIC_LABELS[key],
      months,
      yearTotal: sumAnnualPlMonths(months),
    }
  })
}

export function buildAnnualPlComparisonExcelRows(report: AnnualPlComparisonReport): (string | number)[][] {
  const header = ['项目', ...report.periods.map(period => `${Number(period.slice(5, 7))}月`), '全年合计']
  return [
    header,
    ...report.rows.map(row => [row.label, ...row.months, row.yearTotal]),
  ]
}

export async function buildAnnualPlComparison(
  year: number,
  options?: { companyId?: string },
): Promise<AnnualPlComparisonReport> {
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    throw new Error('Year must be an integer between 2000 and 2100.')
  }

  const { buildFinancialReports } = await import('@/lib/financial/reports')
  const periods = yearMonths(year)
  const monthSummaries: AnnualPlMonthSummary[] = []

  for (const period of periods) {
    const reports = await buildFinancialReports(period, options)
    const pl = reports.incomeStatement
    monthSummaries.push({
      period,
      totalRevenue: pl.totalRevenue,
      totalCostOfSales: pl.totalCostOfSales,
      grossProfit: pl.grossProfit,
      totalExpenses: pl.totalExpenses,
      netProfit: pl.netProfit,
    })
  }

  return {
    year,
    currency: 'HKD',
    standard: 'HKFRS',
    periods,
    rows: buildAnnualPlComparisonRows(monthSummaries),
    generatedAt: new Date().toISOString(),
  }
}
