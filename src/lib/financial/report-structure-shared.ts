/** Client-safe report-structure constants (no Prisma / Node imports). */

export const PL_REPORT_SECTIONS = [
  'PL_REVENUE',
  'PL_COST_OF_SALES',
  'PL_EXPENSE_SALES',
  'PL_EXPENSE_ADMINISTRATIVE',
  'PL_EXPENSE_FINANCE',
] as const

export const BS_REPORT_SECTIONS = [
  'BS_CURRENT_ASSETS',
  'BS_NON_CURRENT_ASSETS',
  'BS_CURRENT_LIABILITIES',
  'BS_NON_CURRENT_LIABILITIES',
  'BS_EQUITY',
] as const

export type PlReportSection = (typeof PL_REPORT_SECTIONS)[number]
export type BsReportSection = (typeof BS_REPORT_SECTIONS)[number]
export type ReportStructureSection = PlReportSection | BsReportSection

export const REPORT_SECTION_LABELS: Record<ReportStructureSection, string> = {
  PL_REVENUE: '营业收入',
  PL_COST_OF_SALES: '营业成本',
  PL_EXPENSE_SALES: '销售费用',
  PL_EXPENSE_ADMINISTRATIVE: '管理费用',
  PL_EXPENSE_FINANCE: '财务费用',
  BS_CURRENT_ASSETS: '流动资产',
  BS_NON_CURRENT_ASSETS: '非流动资产',
  BS_CURRENT_LIABILITIES: '流动负债',
  BS_NON_CURRENT_LIABILITIES: '非流动负债',
  BS_EQUITY: '所有者权益',
}
