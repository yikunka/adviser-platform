'use client'

import { useMemo, useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { IncomeStatementReport } from '@/lib/financial/reports'
import type { StatementLineRow } from '@/lib/financial/report-line-types'
import type { ReportDrillDownMode } from '@/lib/financial/report-drill-down'
import {
  buildIncomeStatementDisplayRows,
  formatPctOfRevenue,
  type PlDisplayRow,
} from '@/lib/financial/income-statement-display'
import { formatReportAmount } from '@/lib/financial/utils'

type Props = {
  statement: IncomeStatementReport
  onDrillDown: (row: StatementLineRow, mode: ReportDrillDownMode) => void
}

function money(value: number) {
  return formatReportAmount(value)
}

function SummaryStrip({ statement }: { statement: IncomeStatementReport }) {
  const marginPct = formatPctOfRevenue(statement.grossProfit, statement.totalRevenue)
  const netMarginPct = formatPctOfRevenue(statement.netProfit, statement.totalRevenue)

  const cards = [
    {
      label: '营业收入',
      period: statement.totalRevenue,
      ytd: statement.totalRevenueYtd,
      note: '本期 / 本年累计',
    },
    {
      label: '毛利',
      period: statement.grossProfit,
      ytd: statement.grossProfitYtd,
      note: `毛利率 ${marginPct}`,
    },
    {
      label: '本期利润',
      period: statement.netProfit,
      ytd: statement.netProfitYtd,
      note: `净利率 ${netMarginPct}`,
      highlight: true,
    },
  ] as const

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {cards.map(card => (
        <div
          key={card.label}
          className={`rounded-lg border px-4 py-3 ${
            'highlight' in card && card.highlight
              ? 'border-[#C9A96E66] bg-[#C9A96E14]'
              : 'border-[var(--border-subtle)] bg-[var(--surface-input)]'
          }`}
        >
          <p className="text-xs text-muted-foreground">{card.label}</p>
          <p className="mt-1 font-mono text-lg font-semibold tabular-nums">{money(card.period)}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            本年 {money(card.ytd)}
            <span className="mx-1.5 opacity-40">·</span>
            {card.note}
          </p>
        </div>
      ))}
    </div>
  )
}

function AmountCell({
  amount,
  mode,
  line,
  onDrillDown,
}: {
  amount: number
  mode: ReportDrillDownMode
  line?: StatementLineRow
  onDrillDown: (row: StatementLineRow, mode: ReportDrillDownMode) => void
}) {
  if (!line) {
    return <span className="font-mono tabular-nums">{money(amount)}</span>
  }
  return (
    <button
      type="button"
      className="font-mono tabular-nums hover:underline hover:text-[#C9A96E]"
      title={mode === 'ytd' ? '穿透本年度累计已过账凭证' : '穿透本期已过账凭证'}
      onClick={() => onDrillDown(line, mode)}
    >
      {money(amount)}
    </button>
  )
}

function PctCell({ amount, revenue }: { amount: number; revenue: number }) {
  return (
    <span className="font-mono text-xs tabular-nums text-muted-foreground">
      {formatPctOfRevenue(amount, revenue)}
    </span>
  )
}

export function IncomeStatementView({ statement, onDrillDown }: Props) {
  const [expandedExpenseKeys, setExpandedExpenseKeys] = useState<Set<string>>(() => new Set())
  const displayRows = useMemo(() => buildIncomeStatementDisplayRows(statement), [statement])
  const revenuePeriod = statement.totalRevenue
  const revenueYtd = statement.totalRevenueYtd

  function toggleExpense(key: string) {
    setExpandedExpenseKeys(previous => {
      const next = new Set(previous)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  return (
    <div className="space-y-4">
      <SummaryStrip statement={statement} />

      <div className="overflow-x-auto rounded-lg border border-[var(--border-subtle)]">
        <Table className="table-fixed w-full">
          <colgroup>
            <col />
            <col className="w-[5.5rem]" />
            <col className="w-[8.5rem]" />
            <col className="w-[4.5rem]" />
            <col className="w-[8.5rem]" />
            <col className="w-[4.5rem]" />
          </colgroup>
          <TableHeader>
            <TableRow>
              <TableHead>项目</TableHead>
              <TableHead>编码</TableHead>
              <TableHead className="text-right">本期金额</TableHead>
              <TableHead className="text-right">占收入%</TableHead>
              <TableHead className="text-right">本年度总金额</TableHead>
              <TableHead className="text-right">本年%</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayRows.map(row => {
              if (row.kind === 'section') {
                return (
                  <TableRow key={row.key} className="bg-[var(--surface-input)]">
                    <TableCell colSpan={6} className="py-2 text-sm font-medium text-[#C9A96E]">
                      {row.label}
                    </TableCell>
                  </TableRow>
                )
              }

              if (row.kind === 'detail') {
                const ytd = row.line.yearToDateAmount ?? 0
                return (
                  <TableRow key={row.key}>
                    <TableCell style={{ paddingLeft: `${0.75 + row.indent * 1.1}rem` }}>
                      <button
                        type="button"
                        className="text-left hover:underline hover:text-[#C9A96E]"
                        onClick={() => onDrillDown(row.line, 'period')}
                      >
                        {row.line.name}
                      </button>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{row.line.code}</TableCell>
                    <TableCell className="text-right">
                      <AmountCell amount={row.line.amount} mode="period" line={row.line} onDrillDown={onDrillDown} />
                    </TableCell>
                    <TableCell className="text-right">
                      <PctCell amount={row.line.amount} revenue={revenuePeriod} />
                    </TableCell>
                    <TableCell className="text-right">
                      <AmountCell amount={ytd} mode="ytd" line={row.line} onDrillDown={onDrillDown} />
                    </TableCell>
                    <TableCell className="text-right">
                      <PctCell amount={ytd} revenue={revenueYtd} />
                    </TableCell>
                  </TableRow>
                )
              }

              if (row.kind === 'expense-group') {
                const expanded = expandedExpenseKeys.has(row.key)
                const hasLines = row.lines.length > 0
                return (
                  <ExpenseGroupRows
                    key={row.key}
                    row={row}
                    expanded={expanded}
                    hasLines={hasLines}
                    revenuePeriod={revenuePeriod}
                    revenueYtd={revenueYtd}
                    onToggle={() => toggleExpense(row.key)}
                    onDrillDown={onDrillDown}
                  />
                )
              }

              if (row.kind === 'subtotal') {
                return (
                  <TableRow key={row.key} className="bg-[var(--surface-input)] font-semibold">
                    <TableCell colSpan={2}>{row.label}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums">{money(row.period)}</TableCell>
                    <TableCell className="text-right">
                      <PctCell amount={row.period} revenue={revenuePeriod} />
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums">{money(row.ytd)}</TableCell>
                    <TableCell className="text-right">
                      <PctCell amount={row.ytd} revenue={revenueYtd} />
                    </TableCell>
                  </TableRow>
                )
              }

              // milestone
              const milestoneClass =
                row.variant === 'net'
                  ? 'border-[#C9A96E66] bg-[#C9A96E14] font-semibold'
                  : 'bg-[rgba(201,169,110,0.08)] font-semibold'
              return (
                <TableRow key={row.key} className={milestoneClass}>
                  <TableCell colSpan={2} className="text-[#C9A96E]">
                    {row.label}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums">{money(row.period)}</TableCell>
                  <TableCell className="text-right">
                    <PctCell amount={row.period} revenue={revenuePeriod} />
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums">{money(row.ytd)}</TableCell>
                  <TableCell className="text-right">
                    <PctCell amount={row.ytd} revenue={revenueYtd} />
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      <p className="text-xs text-muted-foreground">
        ＊ 营业费用默认只显示各类合计，点击左侧箭头展开科目明细；点击科目或金额可穿透到已过账凭证。占收入%以本期 / 本年营业收入为分母。
      </p>
    </div>
  )
}

function ExpenseGroupRows({
  row,
  expanded,
  hasLines,
  revenuePeriod,
  revenueYtd,
  onToggle,
  onDrillDown,
}: {
  row: Extract<PlDisplayRow, { kind: 'expense-group' }>
  expanded: boolean
  hasLines: boolean
  revenuePeriod: number
  revenueYtd: number
  onToggle: () => void
  onDrillDown: (line: StatementLineRow, mode: ReportDrillDownMode) => void
}) {
  return (
    <>
      <TableRow className="bg-[var(--surface-input)]/60">
        <TableCell>
          <div className="flex items-center gap-1 pl-3">
            {hasLines ? (
              <button
                type="button"
                onClick={onToggle}
                className="inline-flex shrink-0 rounded p-0.5 text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                aria-label={expanded ? '收起明细' : '展开明细'}
              >
                {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </button>
            ) : (
              <span className="inline-block w-[22px] shrink-0" />
            )}
            <span className="font-medium">{row.label}合计</span>
          </div>
        </TableCell>
        <TableCell />
        <TableCell className="text-right font-mono font-medium tabular-nums">{money(row.period)}</TableCell>
        <TableCell className="text-right">
          <PctCell amount={row.period} revenue={revenuePeriod} />
        </TableCell>
        <TableCell className="text-right font-mono font-medium tabular-nums">{money(row.ytd)}</TableCell>
        <TableCell className="text-right">
          <PctCell amount={row.ytd} revenue={revenueYtd} />
        </TableCell>
      </TableRow>
      {expanded
        ? row.lines.map(line => {
            const ytd = line.yearToDateAmount ?? 0
            return (
              <TableRow key={`${row.key}-${line.accountId}`}>
                <TableCell style={{ paddingLeft: '2.5rem' }}>
                  <button
                    type="button"
                    className="text-left hover:underline hover:text-[#C9A96E]"
                    onClick={() => onDrillDown(line, 'period')}
                  >
                    {line.name}
                  </button>
                </TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">{line.code}</TableCell>
                <TableCell className="text-right">
                  <AmountCell amount={line.amount} mode="period" line={line} onDrillDown={onDrillDown} />
                </TableCell>
                <TableCell className="text-right">
                  <PctCell amount={line.amount} revenue={revenuePeriod} />
                </TableCell>
                <TableCell className="text-right">
                  <AmountCell amount={ytd} mode="ytd" line={line} onDrillDown={onDrillDown} />
                </TableCell>
                <TableCell className="text-right">
                  <PctCell amount={ytd} revenue={revenueYtd} />
                </TableCell>
              </TableRow>
            )
          })
        : null}
    </>
  )
}
