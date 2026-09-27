'use client'

/* eslint-disable react-hooks/set-state-in-effect */

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Download, FileBarChart, AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'
import type { FinancialReportsBundle, AccountingEquationCheck, BalanceSheetSection, TrialBalanceRow } from '@/lib/financial/reports'
import type { BalanceSheetLineRow } from '@/lib/financial/balance-sheet-line-hierarchy'
import {
  filterTrialBalanceRowsByLevel,
  TRIAL_BALANCE_LEVEL_OPTIONS,
  type TrialBalanceLevelFilter,
} from '@/lib/financial/trial-balance-level-filter'
import { formatReportAmount } from '@/lib/financial/utils'
import { subscribeFinancialAccountsChanged } from '@/lib/financial/events'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { FinancialBreadcrumbs } from '@/components/admin/financial/FinancialBreadcrumbs'
import { useFinancialCompany } from '@/components/admin/financial/FinancialCompanyContext'
import { ReportDrillDownDialog, type ReportDrillTarget } from '@/components/admin/financial/ReportDrillDownDialog'
import { IncomeStatementView } from '@/components/admin/financial/IncomeStatementView'
import type { ReportDrillDownMode } from '@/lib/financial/report-drill-down'
import { buildIncomeStatementExcelRows } from '@/lib/financial/income-statement-display'

type ReportScope = {
  title: string
  subtitle: string
  exportKey: string
  params: Record<string, string>
  breadcrumbSection: string
}

function currentPeriod() {
  const now = new Date()
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`
}

function money(value: number) {
  return formatReportAmount(value)
}

function exportCsv(filename: string, headers: string[], rows: (string | number)[][]) {
  const csv = [headers.join(','), ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = filename
  link.click()
}

function sheetRows(title: string, period: string, rows: (string | number | boolean | null)[][]) {
  return [
    [title],
    ['期间', period],
    [],
    ...rows,
  ]
}

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  ASSET: '流动资产',
  NON_CURRENT_ASSET: '长期资产',
  LIABILITY: '流动负债',
  NON_CURRENT_LIABILITY: '长期负债',
  EQUITY: '权益',
  REVENUE: '收入',
  CGS: '销售成本',
  EXPENSE: '费用',
  CURRENT_ACCOUNT: '往来科目',
}

const CASH_FLOW_LABELS: Record<string, string> = {
  'Profit for the period': '本期利润',
  'Changes in working capital': '营运资金变动',
  'Net cash from operating activities': '经营活动现金流量净额',
  'Purchase / disposal of non-current assets': '购置 / 处置非流动资产',
  'Net cash from investing activities': '投资活动现金流量净额',
  'Changes in borrowings and equity': '借款及权益变动',
  'Net cash from financing activities': '融资活动现金流量净额',
}

function accountTypeLabel(value: string) {
  return ACCOUNT_TYPE_LABELS[value] ?? value
}

function reportLineLabel(value: string) {
  return CASH_FLOW_LABELS[value] ?? (value === 'Profit for the period' ? '本期利润' : value)
}

function reportLineNote(row: { note?: string; noteAmount?: number }) {
  if (!row.note && row.noteAmount === undefined) return ''
  const amountNote = row.noteAmount === undefined ? '' : `期末累计未结转损益：${money(row.noteAmount)}`
  return [row.note, amountNote].filter(Boolean).join(' ')
}

export function FinancialReportsPanel() {
  const company = useFinancialCompany()
  return (
    <FinancialReportsContent
      scope={{
        title: '财务报表',
        subtitle: `${company.nameEn} · 基于已过账凭证分录生成的 HKFRS 报表。`,
        exportKey: company.companyCode ?? company.id,
        params: { companyId: company.id },
        breadcrumbSection: '财务报表',
      }}
    />
  )
}

function FinancialReportsContent({ scope }: { scope: ReportScope }) {
  const [period, setPeriod] = useState(currentPeriod)
  const [reports, setReports] = useState<FinancialReportsBundle | null>(null)
  const [loading, setLoading] = useState(false)
  const [trialBalanceLevel, setTrialBalanceLevel] = useState<TrialBalanceLevelFilter>('all')
  const [expandedTrialBalanceAccounts, setExpandedTrialBalanceAccounts] = useState<Set<string>>(new Set())
  const [expandedBalanceSheetAccounts, setExpandedBalanceSheetAccounts] = useState<Set<string>>(new Set())
  const [drillTarget, setDrillTarget] = useState<ReportDrillTarget | null>(null)

  function openDrillDown(
    row: { accountId: string; code: string; name: string; isComputed?: boolean },
    mode: ReportDrillDownMode = 'period',
  ) {
    if (
      row.isComputed
      || row.accountId === 'computed'
      || row.accountId.startsWith('__')
      || row.code === '——'
    ) {
      toast.message('系统计算行无法穿透到凭证')
      return
    }
    setDrillTarget({
      accountId: row.accountId,
      code: row.code,
      name: row.name,
      mode,
    })
  }

  const filteredTrialBalanceRows = useMemo(
    () => (reports ? filterTrialBalanceRowsByLevel(reports.trialBalance.rows, trialBalanceLevel) : []),
    [reports, trialBalanceLevel],
  )

  const toggleBalanceSheetExpand = useCallback((accountId: string) => {
    setExpandedBalanceSheetAccounts(previous => {
      const next = new Set(previous)
      if (next.has(accountId)) next.delete(accountId)
      else next.add(accountId)
      return next
    })
  }, [])

  const toggleTrialBalanceExpand = useCallback((accountId: string) => {
    setExpandedTrialBalanceAccounts(previous => {
      const next = new Set(previous)
      if (next.has(accountId)) next.delete(accountId)
      else next.add(accountId)
      return next
    })
  }, [])

  const fetchReports = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ period, ...scope.params })
      const res = await fetch(`/api/admin/financial/reports?${params}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '生成财务报表失败')
      setReports(data.reports)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '载入财务报表失败')
      setReports(null)
    } finally {
      setLoading(false)
    }
  }, [period, scope])

  useEffect(() => {
    fetchReports()
  }, [fetchReports])

  useEffect(() => {
    setExpandedTrialBalanceAccounts(new Set())
    setExpandedBalanceSheetAccounts(new Set())
  }, [reports?.generatedAt])

  useEffect(() => {
    const scopedCompanyId = scope.params.companyId
    return subscribeFinancialAccountsChanged(detail => {
      if (scopedCompanyId && detail.companyId !== scopedCompanyId) return
      fetchReports()
    })
  }, [fetchReports, scope.params.companyId])

  function exportTrialBalance() {
    if (!reports) return
    exportCsv(
      `trial_balance_${scope.exportKey}_${period}.csv`,
      ['科目编码', '科目名称', '类型', '本期借方', '本期贷方', '期末借方', '期末贷方'],
      [
        ...filteredTrialBalanceRows.map(row => [
          row.code,
          row.name,
          accountTypeLabel(row.type),
          row.periodDebit.toFixed(2),
          row.periodCredit.toFixed(2),
          row.closingDebit.toFixed(2),
          row.closingCredit.toFixed(2),
        ]),
        [],
        ['借方合计', '', '', '', '', reports.trialBalance.totalDebit.toFixed(2), ''],
        ['贷方合计', '', '', '', '', '', reports.trialBalance.totalCredit.toFixed(2)],
        ['借贷是否平衡', '', '', '', '', reports.trialBalance.balanced ? '是' : '否', ''],
      ],
    )
  }

  async function exportWorkbook() {
    if (!reports) return

    try {
      const XLSX = await import('xlsx')
      const workbook = XLSX.utils.book_new()

      XLSX.utils.book_append_sheet(
        workbook,
        XLSX.utils.aoa_to_sheet(sheetRows('试算平衡表', period, [
          ['科目编码', '科目名称', '类型', '本期借方', '本期贷方', '期末借方', '期末贷方'],
          ...filteredTrialBalanceRows.map(row => [
            row.code,
            row.name,
            accountTypeLabel(row.type),
            row.periodDebit,
            row.periodCredit,
            row.closingDebit,
            row.closingCredit,
          ]),
          [],
          ['借方合计', '', '', '', '', reports.trialBalance.totalDebit, ''],
          ['贷方合计', '', '', '', '', '', reports.trialBalance.totalCredit],
          ['借贷是否平衡', '', '', '', '', reports.trialBalance.balanced ? '是' : '否'],
        ])),
        '试算平衡表',
      )

      XLSX.utils.book_append_sheet(
        workbook,
        XLSX.utils.aoa_to_sheet(sheetRows('损益表', period, buildIncomeStatementExcelRows(reports.incomeStatement))),
        '损益表',
      )

      XLSX.utils.book_append_sheet(
        workbook,
        XLSX.utils.aoa_to_sheet(sheetRows('资产负债表', period, [
          ['截至日期', reports.balanceSheet.asOfDate],
          [],
          ['分类', 'HKFRS 分组', '科目编码', '科目名称', '说明', '金额'],
          ...reports.balanceSheet.assetSections.flatMap(section => [
            ...section.lines.map(row => ['资产', section.label, row.code, row.name, reportLineNote(row), row.amount]),
            [`${section.label}合计`, section.label, '', '', '', section.total],
            [],
          ]),
          ['资产合计', '', '', '', '', reports.balanceSheet.totalAssets],
          [],
          ...reports.balanceSheet.equitySection.lines.map(row => [
            '权益',
            reports.balanceSheet.equitySection.label,
            row.code,
            reportLineLabel(row.name),
            reportLineNote(row),
            row.amount,
          ]),
          [`${reports.balanceSheet.equitySection.label}合计`, reports.balanceSheet.equitySection.label, '', '', '', reports.balanceSheet.equitySection.total],
          ['权益合计', '', '', '', '', reports.balanceSheet.totalEquity],
          [],
          ...reports.balanceSheet.liabilitySections.flatMap(section => [
            ...section.lines.map(row => ['负债', section.label, row.code, row.name, reportLineNote(row), row.amount]),
            [`${section.label}合计`, section.label, '', '', '', section.total],
            [],
          ]),
          ['负债合计', '', '', '', '', reports.balanceSheet.totalLiabilities],
          ['负债和权益合计', '', '', '', '', reports.balanceSheet.totalLiabilitiesAndEquity],
          ['会计恒等式是否平衡', '', '', '', '', reports.balanceSheet.equation.balanced ? '是' : '否'],
          ['恒等式差异（资产 − 负债和权益）', '', '', '', '', reports.balanceSheet.equation.difference],
        ])),
        '资产负债表',
      )

      XLSX.utils.book_append_sheet(
        workbook,
        XLSX.utils.aoa_to_sheet(sheetRows('现金流量表', period, [
          ['编制方法', '间接法'],
          [],
          ['分类', '项目', '金额'],
          ...reports.cashFlow.operating.map(row => ['经营活动', reportLineLabel(row.label), row.amount]),
          ...reports.cashFlow.investing.map(row => ['投资活动', reportLineLabel(row.label), row.amount]),
          ...reports.cashFlow.financing.map(row => ['融资活动', reportLineLabel(row.label), row.amount]),
          [],
          ['汇总', '现金净增加 / 减少', reports.cashFlow.netCashChange],
          ['汇总', '期初现金', reports.cashFlow.openingCash],
          ['汇总', '期末现金', reports.cashFlow.closingCash],
        ])),
        '现金流量表',
      )

      XLSX.writeFile(workbook, `financial_reports_${scope.exportKey}_${period}.xlsx`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '导出财务报表失败。')
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="space-y-2">
        <FinancialBreadcrumbs section={scope.breadcrumbSection} />
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>
              {scope.title}
            </h1>
            <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
              {scope.subtitle}
            </p>
          </div>
          <Badge variant="outline" className="border-[var(--border-subtle)] text-[#C9A96E]">
            HKFRS
          </Badge>
        </div>
      </div>

      <Card className="rounded-lg border-[var(--border-subtle)] bg-card">
        <CardHeader className="pb-4">
          <div className="flex flex-wrap items-center gap-4">
            <Input
              type="month"
              value={period}
              onChange={e => setPeriod(e.target.value)}
              className="financial-report-period-input max-w-[180px]"
              style={{
                background: '#FFFFFF',
                border: '1px solid #C9A96E',
                color: '#0A0805',
                colorScheme: 'light',
              }}
            />
            <Button size="sm" onClick={fetchReports} disabled={loading} style={{ background: '#C9A96E', color: '#0A0805' }}>
              <FileBarChart size={15} className="mr-2" />
              {loading ? '生成中...' : '生成报表'}
            </Button>
            {reports ? (
              <>
                <Button variant="outline" size="sm" onClick={exportWorkbook} style={{ borderColor: 'var(--border-subtle)' }}>
                  <Download size={15} className="mr-2" /> 导出全部报表
                </Button>
                <Button variant="outline" size="sm" onClick={exportTrialBalance} style={{ borderColor: 'var(--border-subtle)' }}>
                  <Download size={15} className="mr-2" /> 导出试算平衡表
                </Button>
              </>
            ) : null}
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="p-8 text-center" style={{ color: 'var(--muted-foreground)' }}>
              正在生成 HKFRS 报表...
            </div>
          ) : !reports ? (
            <div className="p-8 text-center" style={{ color: '#5A5040' }}>
              请选择期间并生成报表。
            </div>
          ) : (
            <Tabs defaultValue="trial-balance">
              <TabsList className="mb-4 flex flex-wrap h-auto gap-1 bg-[var(--surface-input)] border border-[var(--border-subtle)] p-1">
                <TabsTrigger value="trial-balance">试算平衡表</TabsTrigger>
                <TabsTrigger value="income">损益表</TabsTrigger>
                <TabsTrigger value="balance">资产负债表</TabsTrigger>
                <TabsTrigger value="cashflow">现金流量表</TabsTrigger>
              </TabsList>

              <TabsContent value="trial-balance" className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <ReportHeader title="试算平衡表" period={period} balanced={reports.trialBalance.balanced} />
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">科目层级</span>
                    <Select
                      value={trialBalanceLevel}
                      onValueChange={value => setTrialBalanceLevel(value as TrialBalanceLevelFilter)}
                    >
                      <SelectTrigger
                        className="min-w-[140px]"
                        style={{ background: 'var(--surface-input)', border: '1px solid var(--border-subtle)' }}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="border-[var(--border-subtle)] bg-card">
                        {TRIAL_BALANCE_LEVEL_OPTIONS.map(option => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <TrialBalanceTable
                  rows={filteredTrialBalanceRows}
                  expandedAccountIds={expandedTrialBalanceAccounts}
                  onToggleExpand={toggleTrialBalanceExpand}
                  onDrillDown={row => openDrillDown(row, 'period')}
                />
                <TotalsFooter
                  left={`借方合计：${money(reports.trialBalance.totalDebit)}`}
                  right={`贷方合计：${money(reports.trialBalance.totalCredit)}`}
                />
                <p className="text-xs" style={{ color: '#7A7060' }}>
                  ＊ 点击有下级科目的行可展开或收起明细；点击科目名称可穿透查看本期已过账凭证；「科目层级」可限制可展开范围；借贷合计始终只基于一级科目计算。
                  仅显示有余额或本期发生额的科目。零余额科目在过账分录后自动出现。
                  带「一级汇总」标注的行为一级科目汇总（含下级明细合计），计入借贷合计。
                </p>
                {!reports.trialBalance.balanced ? (
                  <BalanceWarning
                    title="试算平衡表借贷不平衡"
                    message={`期末借方合计与贷方合计存在 ${money(Math.abs(reports.trialBalance.totalDebit - reports.trialBalance.totalCredit))} 的差异，请检查日记账分录。`}
                  />
                ) : null}
              </TabsContent>

              <TabsContent value="income" className="space-y-4">
                <ReportHeader title="损益表" period={period} />
                <IncomeStatementView
                  statement={reports.incomeStatement}
                  onDrillDown={openDrillDown}
                />
              </TabsContent>

              <TabsContent value="balance" className="space-y-4">
                <ReportHeader
                  title="资产负债表"
                  period={period}
                  balanced={reports.balanceSheet.equation.balanced}
                  subtitle={`截至 ${new Date(reports.balanceSheet.asOfDate).toLocaleDateString('zh-HK')}`}
                />
                <AccountingEquationAlert equation={reports.balanceSheet.equation} />
                <p className="text-xs text-muted-foreground">
                  默认仅展示一级科目汇总；点击有下级明细的一级科目可展开查看二、三、四级明细；点击科目名称可穿透到已过账凭证。
                </p>
                <Section title="资产">
                  {reports.balanceSheet.assetSections.map(section => (
                    <BalanceSheetSectionBlock
                      key={section.label}
                      section={section}
                      expandedAccountIds={expandedBalanceSheetAccounts}
                      onToggleExpand={toggleBalanceSheetExpand}
                      onDrillDown={row => openDrillDown(row, 'period')}
                    />
                  ))}
                  <TotalsFooter left="资产合计" right={money(reports.balanceSheet.totalAssets)} highlight />
                </Section>
                <Section title="负债及所有者权益">
                  <BalanceSheetSectionBlock
                    section={reports.balanceSheet.equitySection}
                    expandedAccountIds={expandedBalanceSheetAccounts}
                    onToggleExpand={toggleBalanceSheetExpand}
                    onDrillDown={row => openDrillDown(row, 'period')}
                  />
                  {reports.balanceSheet.liabilitySections.map(section => (
                    <BalanceSheetSectionBlock
                      key={section.label}
                      section={section}
                      expandedAccountIds={expandedBalanceSheetAccounts}
                      onToggleExpand={toggleBalanceSheetExpand}
                      onDrillDown={row => openDrillDown(row, 'period')}
                    />
                  ))}
                  <TotalsFooter left="负债合计" right={money(reports.balanceSheet.totalLiabilities)} />
                  <TotalsFooter left="权益合计" right={money(reports.balanceSheet.totalEquity)} />
                  <TotalsFooter
                    left="负债和权益合计"
                    right={money(reports.balanceSheet.totalLiabilitiesAndEquity)}
                    highlight
                  />
                </Section>
              </TabsContent>

              <TabsContent value="cashflow" className="space-y-4">
                <ReportHeader title="现金流量表（间接法）" period={period} />
                <CashFlowSection title="经营活动" items={reports.cashFlow.operating} />
                <CashFlowSection title="投资活动" items={reports.cashFlow.investing} />
                <CashFlowSection title="融资活动" items={reports.cashFlow.financing} />
                <TotalsFooter left="现金净增加 / 减少" right={money(reports.cashFlow.netCashChange)} highlight />
                <TotalsFooter left="期初现金" right={money(reports.cashFlow.openingCash)} />
                <TotalsFooter left="期末现金" right={money(reports.cashFlow.closingCash)} />
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>

      <ReportDrillDownDialog
        open={!!drillTarget}
        onOpenChange={open => {
          if (!open) setDrillTarget(null)
        }}
        period={period}
        scopeParams={scope.params}
        target={drillTarget}
      />
    </div>
  )
}

function BalanceSheetSectionBlock({
  section,
  expandedAccountIds,
  onToggleExpand,
  onDrillDown,
}: {
  section: BalanceSheetSection
  expandedAccountIds: Set<string>
  onToggleExpand: (accountId: string) => void
  onDrillDown: (row: { accountId: string; code: string; name: string }) => void
}) {
  return (
    <div className="space-y-2">
      <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{section.label}</h4>
      <ExpandableBalanceSheetTable
        lines={section.lines}
        expandedAccountIds={expandedAccountIds}
        onToggleExpand={onToggleExpand}
        onDrillDown={onDrillDown}
        emptyLabel={`暂无${section.label}余额`}
      />
      {section.lines.length > 0 ? (
        <TotalsFooter left={`${section.label}合计`} right={money(section.total)} />
      ) : null}
    </div>
  )
}

function ExpandableBalanceSheetTable({
  lines,
  expandedAccountIds,
  onToggleExpand,
  onDrillDown,
  emptyLabel,
}: {
  lines: BalanceSheetLineRow[]
  expandedAccountIds: Set<string>
  onToggleExpand: (accountId: string) => void
  onDrillDown: (row: { accountId: string; code: string; name: string }) => void
  emptyLabel: string
}) {
  if (lines.length === 0) {
    return <p className="text-sm text-muted-foreground py-2">{emptyLabel}</p>
  }

  const rows: { line: BalanceSheetLineRow; depth: number }[] = []

  for (const line of lines) {
    rows.push({ line, depth: 0 })
    if (line.children?.length && expandedAccountIds.has(line.accountId)) {
      for (const child of line.children) {
        rows.push({ line: child, depth: child.level - 1 })
      }
    }
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-[var(--border-subtle)]">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>编码</TableHead>
            <TableHead>科目</TableHead>
            <TableHead className="text-right">金额</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map(({ line, depth }) => {
            const hasChildren = (line.children?.length ?? 0) > 0
            const expanded = expandedAccountIds.has(line.accountId)
            const indent = depth > 0 ? `${depth * 1.25}rem` : undefined
            const canDrill = Boolean(line.code && line.code !== '——')

            return (
              <TableRow key={`${line.accountId}-${depth}`}>
                <TableCell className="font-mono">{line.code}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-1" style={{ paddingLeft: indent }}>
                    {hasChildren ? (
                      <button
                        type="button"
                        onClick={() => onToggleExpand(line.accountId)}
                        className="inline-flex shrink-0 rounded p-0.5 text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                        aria-label={expanded ? '收起明细' : '展开明细'}
                      >
                        {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </button>
                    ) : (
                      <span className="inline-block w-[22px] shrink-0" />
                    )}
                    <span className="flex min-w-0 flex-col">
                      {canDrill ? (
                        <button
                          type="button"
                          className="text-left hover:underline hover:text-[#C9A96E]"
                          onClick={() => onDrillDown({ accountId: line.accountId, code: line.code, name: line.name })}
                        >
                          {reportLineLabel(line.name)}
                        </button>
                      ) : (
                        <span>{reportLineLabel(line.name)}</span>
                      )}
                      {line.note ? (
                        <span className="mt-1 text-xs leading-relaxed text-muted-foreground">{line.note}</span>
                      ) : null}
                      {line.noteAmount !== undefined ? (
                        <span className="mt-0.5 text-xs leading-relaxed text-[#C9A96E]">
                          期末累计未结转损益：
                          <span className="font-mono">{money(line.noteAmount)}</span>
                        </span>
                      ) : null}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-right font-mono">{money(line.amount)}</TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}

function AccountingEquationAlert({ equation }: { equation: AccountingEquationCheck }) {
  return (
    <div className="space-y-3">
      <div className="grid gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-input)] p-4 text-sm sm:grid-cols-3">
        <div className="flex justify-between sm:block">
          <span className="text-muted-foreground">资产合计</span>
          <span className="font-mono">{money(equation.totalAssets)}</span>
        </div>
        <div className="flex justify-between sm:block">
          <span className="text-muted-foreground">负债合计</span>
          <span className="font-mono">{money(equation.totalLiabilities)}</span>
        </div>
        <div className="flex justify-between sm:block">
          <span className="text-muted-foreground">权益合计（含本期利润）</span>
          <span className="font-mono">{money(equation.totalEquity)}</span>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-input)] px-4 py-3 text-sm">
        <span className="text-muted-foreground">会计恒等式：资产 = 负债 + 所有者权益</span>
        <Badge
          variant="outline"
          style={{
            borderColor: equation.balanced ? '#10b981' : '#ef4444',
            color: equation.balanced ? '#10b981' : '#ef4444',
          }}
        >
          {equation.balanced ? '恒等式成立' : '恒等式不成立'}
        </Badge>
      </div>
      {!equation.balanced ? (
        <BalanceWarning
          title="会计恒等式不平衡"
          message={`资产与「负债 + 所有者权益」相差 ${money(Math.abs(equation.difference))}（${equation.difference > 0 ? '资产偏多' : '负债和权益偏多'}）。请检查科目余额与日记账分录。`}
        />
      ) : null}
    </div>
  )
}

function BalanceWarning({ title, message }: { title: string; message: string }) {
  return (
    <div className="flex gap-3 rounded-lg border border-[#ef444466] bg-[#ef444414] px-4 py-3 text-sm">
      <AlertTriangle size={18} className="mt-0.5 shrink-0 text-[#ef4444]" />
      <div>
        <p className="font-medium text-[#ef4444]">{title}</p>
        <p className="mt-1 text-muted-foreground">{message}</p>
      </div>
    </div>
  )
}

function ReportHeader({
  title,
  period,
  balanced,
  subtitle,
}: {
  title: string
  period: string
  balanced?: boolean
  subtitle?: string
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div>
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">
          期间：{period}
          {subtitle ? ` · ${subtitle}` : ''}
        </p>
      </div>
      {balanced !== undefined ? (
        <Badge
          variant="outline"
          style={{ borderColor: balanced ? '#10b981' : '#ef4444', color: balanced ? '#10b981' : '#ef4444' }}
        >
          {balanced ? '已平衡' : '不平衡'}
        </Badge>
      ) : null}
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium text-[#C9A96E]">{title}</h3>
      {children}
    </div>
  )
}

function TotalsFooter({ left, right, highlight }: { left: string; right: string; highlight?: boolean }) {
  return (
    <div
      className={`flex justify-between rounded-lg border px-4 py-3 text-sm ${highlight ? 'border-[#C9A96E66] bg-[#C9A96E14] font-semibold' : 'border-[var(--border-subtle)] bg-[var(--surface-input)]'}`}
    >
      <span>{left}</span>
      <span className="font-mono">{right}</span>
    </div>
  )
}

function CashFlowSection({ title, items }: { title: string; items: { label: string; amount: number }[] }) {
  return (
    <Section title={title}>
      <div className="space-y-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-input)] p-4">
        {items.map(item => (
          <div key={item.label} className="flex justify-between text-sm">
            <span>{reportLineLabel(item.label)}</span>
            <span className="font-mono">{money(item.amount)}</span>
          </div>
        ))}
      </div>
    </Section>
  )
}

function TrialBalanceTable({
  rows,
  expandedAccountIds,
  onToggleExpand,
  onDrillDown,
}: {
  rows: TrialBalanceRow[]
  expandedAccountIds: Set<string>
  onToggleExpand: (accountId: string) => void
  onDrillDown: (row: TrialBalanceRow) => void
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground py-2">本期间暂无科目余额</p>
  }

  const headers = ['编码', '科目', '类型', '本期借方', '本期贷方', '期末借方', '期末贷方']
  const accountRows = rows.filter(row => !row.isComputed)
  const rowById = new Map(accountRows.map(row => [row.accountId, row]))
  const childrenByParentId = new Map<string, TrialBalanceRow[]>()
  for (const row of accountRows) {
    if (!row.parentId || !rowById.has(row.parentId)) continue
    const siblings = childrenByParentId.get(row.parentId) ?? []
    siblings.push(row)
    childrenByParentId.set(row.parentId, siblings)
  }
  for (const siblings of childrenByParentId.values()) {
    siblings.sort((left, right) => left.sortOrder - right.sortOrder || left.code.localeCompare(right.code))
  }

  const visibleRows: Array<{ row: TrialBalanceRow; depth: number }> = []
  const rootRows = accountRows.filter(row => !row.parentId || !rowById.has(row.parentId))

  function addVisibleRow(row: TrialBalanceRow, depth: number) {
    visibleRows.push({ row, depth })
    if (!expandedAccountIds.has(row.accountId)) return
    for (const child of childrenByParentId.get(row.accountId) ?? []) {
      addVisibleRow(child, depth + 1)
    }
  }

  for (const row of rootRows) addVisibleRow(row, 0)

  function rowStyle(row: TrialBalanceRow) {
    if (row.isSummary) {
      return { background: 'rgba(42,36,24,0.04)', fontWeight: 600 as const }
    }
    return undefined
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-[var(--border-subtle)]">
      <Table>
        <TableHeader>
          <TableRow>
            {headers.map(header => (
              <TableHead
                key={header}
                className={
                  header.includes('借方') || header.includes('贷方') ? 'text-right' : undefined
                }
              >
                {header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {visibleRows.map(({ row, depth }) => {
            const hasChildren = (childrenByParentId.get(row.accountId)?.length ?? 0) > 0
            const expanded = expandedAccountIds.has(row.accountId)
            const indent = depth > 0 ? `${depth * 1.25}rem` : undefined
            return (
            <TableRow
              key={`${row.accountId}-${row.isSummary ? 'summary' : row.isComputed ? 'computed' : 'detail'}`}
              style={rowStyle(row)}
            >
              <TableCell className="font-mono">{row.code}</TableCell>
              <TableCell>
                <div className="flex items-center gap-1" style={{ paddingLeft: indent }}>
                  {hasChildren ? (
                    <button
                      type="button"
                      onClick={() => onToggleExpand(row.accountId)}
                      className="inline-flex shrink-0 rounded p-0.5 text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                      aria-label={expanded ? '收起明细' : '展开明细'}
                    >
                      {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </button>
                  ) : (
                    <span className="inline-block w-[22px] shrink-0" />
                  )}
                  <button
                    type="button"
                    className="text-left hover:underline hover:text-[#C9A96E]"
                    title="穿透本期已过账凭证"
                    onClick={() => onDrillDown(row)}
                  >
                    {row.name}
                  </button>
                </div>
                {row.isSummary && (
                  <span
                    className="ml-2 rounded px-1 py-0.5 text-[10px] font-normal"
                    style={{ background: 'rgba(42,36,24,0.08)', color: 'var(--border-subtle)' }}
                  >
                    一级汇总
                  </span>
                )}
              </TableCell>
              <TableCell>{accountTypeLabel(row.type)}</TableCell>
              <TableCell className="text-right font-mono">{money(row.periodDebit)}</TableCell>
              <TableCell className="text-right font-mono">{money(row.periodCredit)}</TableCell>
              <TableCell className="text-right font-mono">{money(row.closingDebit)}</TableCell>
              <TableCell className="text-right font-mono">{money(row.closingCredit)}</TableCell>
            </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
