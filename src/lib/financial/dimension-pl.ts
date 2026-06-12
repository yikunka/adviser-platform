import type { AccountType } from '@prisma/client'
import { roundMoney, signedLineAmount } from '@/lib/financial/utils'

/** 损益类科目类型（计入维度损益的科目） */
const PL_TYPES: ReadonlySet<AccountType> = new Set<AccountType>(['REVENUE', 'EXPENSE', 'CGS'])

export function isPlAccountType(type: AccountType) {
  return PL_TYPES.has(type)
}

export type DimensionPlLineInput = {
  dimensionId: string | null
  dimensionCode: string
  dimensionName: string
  accountType: AccountType
  accountCode: string
  debit: number
  credit: number
}

export type DimensionPlRow = {
  dimensionId: string | null
  dimensionCode: string
  dimensionName: string
  revenue: number
  costOfSales: number
  expense: number
  profit: number
}

export type DimensionPlReport = {
  rows: DimensionPlRow[]
  totals: { revenue: number; costOfSales: number; expense: number; profit: number }
}

/**
 * 维度损益表：把已过账凭证行按维度（成本中心/项目）归集，
 * 计算各维度的收入 / 主营成本 / 费用 / 利润。
 * 收入取贷方为正，成本费用取借方为正。未标维度的行归入「未分配」。
 */
export function buildDimensionPlReport(lines: DimensionPlLineInput[]): DimensionPlReport {
  const byDimension = new Map<string, DimensionPlRow>()

  for (const line of lines) {
    if (!isPlAccountType(line.accountType)) continue
    const key = line.dimensionId ?? '__UNASSIGNED__'
    let row = byDimension.get(key)
    if (!row) {
      row = {
        dimensionId: line.dimensionId,
        dimensionCode: line.dimensionId ? line.dimensionCode : '',
        dimensionName: line.dimensionId ? line.dimensionName : '未分配',
        revenue: 0,
        costOfSales: 0,
        expense: 0,
        profit: 0,
      }
      byDimension.set(key, row)
    }
    // 收入：贷-借为正；成本/费用：借-贷为正
    const signed = signedLineAmount({
      accountId: '',
      accountType: line.accountType,
      accountCode: line.accountCode,
      debit: line.debit,
      credit: line.credit,
    })
    if (line.accountType === 'REVENUE') {
      row.revenue = roundMoney(row.revenue + signed)
    } else if (line.accountType === 'CGS') {
      row.costOfSales = roundMoney(row.costOfSales + signed)
    } else {
      row.expense = roundMoney(row.expense + signed)
    }
  }

  const rows = [...byDimension.values()]
  for (const row of rows) {
    row.profit = roundMoney(row.revenue - row.costOfSales - row.expense)
  }
  // 已分配维度按编码排序，未分配置底
  rows.sort((a, b) => {
    if (!a.dimensionId) return 1
    if (!b.dimensionId) return -1
    return a.dimensionCode.localeCompare(b.dimensionCode)
  })

  const totals = rows.reduce(
    (acc, row) => ({
      revenue: roundMoney(acc.revenue + row.revenue),
      costOfSales: roundMoney(acc.costOfSales + row.costOfSales),
      expense: roundMoney(acc.expense + row.expense),
      profit: roundMoney(acc.profit + row.profit),
    }),
    { revenue: 0, costOfSales: 0, expense: 0, profit: 0 },
  )

  return { rows, totals }
}
