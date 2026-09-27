import { buildFinancialReports } from '@/lib/financial/reports'
import {
  buildAnnualPlComparisonRows,
  yearMonths,
  type AnnualPlComparisonReport,
  type AnnualPlMonthSummary,
} from '@/lib/financial/annual-pl-comparison'

/** Server-only: builds year × month P&L summaries via the full report engine. */
export async function buildAnnualPlComparison(
  year: number,
  options?: { companyId?: string },
): Promise<AnnualPlComparisonReport> {
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    throw new Error('Year must be an integer between 2000 and 2100.')
  }

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
