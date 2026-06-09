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

export function FinancialReportsPanel() {
  const company = useFinancialCompany()
  return (
    <FinancialReportsContent
      scope={{
        title: '财务报表',
        subtitle: `${company.nameEn} · 基于已过账总账生成的 HKFRS 报表。`,
        exportKey: company.companyCode ?? company.id,
        params: { companyId: company.id },
        breadcrumbSection: '财务报表',
      }}
    />
  )
}

export function FinancialReportGroupReportsPanel({
  group,
}: {
  group: { id: string; name: string; companies: { company: { nameEn: string; companyCode: string | null } }[] }
}) {
  const companyLabel = group.companies
    .map(member => member.company.companyCode ? `${member.company.companyCode} ${member.company.nameEn}` : member.company.nameEn)
    .join(', ')

  return (
    <FinancialReportsContent
      scope={{
        title: '合并财务报表',
        subtitle: `${group.name} · ${companyLabel || '暂无公司'} · 仅用于报表合并。`,
        exportKey: group.name.replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '') || group.id,
        params: { reportGroupId: group.id },
        breadcrumbSection: '合并报表',
      }}
    />
  )
}

function FinancialReportsContent({ scope }: { scope: ReportScope }) {
  const [period, setPeriod] = useState(currentPeriod)
  const [reports, setReports] = useState<FinancialReportsBundle | null>(null)
  const [loading, setLoading] = useState(false)
  const [trialBalanceLevel, setTrialBalanceLevel] = useState<TrialBalanceLevelFilter>('all')
  const [expandedBalanceSheetAccounts, setExpandedBalanceSheetAccounts] = useState<Set<string>>(new Set())

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
        XLSX.utils.aoa_to_sheet(sheetRows('损益表', period, [
          ['分类', '科目编码', '科目名称', '金额'],
          ...reports.incomeStatement.revenue.map(row => ['收入', row.code, row.name, row.amount]),
          ['收入合计', '', '', reports.incomeStatement.totalRevenue],
          [],
          ...reports.incomeStatement.expenses.map(row => ['费用', row.code, row.name, row.amount]),
          ['费用合计', '', '', reports.incomeStatement.totalExpenses],
          ['本期利润', '', '', reports.incomeStatement.netProfit],
        ])),
        '损益表',
      )

      XLSX.utils.book_append_sheet(
        workbook,
        XLSX.utils.aoa_to_sheet(sheetRows('资产负债表', period, [
          ['截至日期', reports.balanceSheet.asOfDate],
          [],
          ['分类', 'HKFRS 分组', '科目编码', '科目名称', '金额'],
          ...reports.balanceSheet.assetSections.flatMap(section => [
            ...section.lines.map(row => ['资产', section.label, row.code, row.name, row.amount]),
            [`${section.label}合计`, section.label, '', '', section.total],
            [],
          ]),
          ['资产合计', '', '', '', reports.balanceSheet.totalAssets],
          [],
          ...reports.balanceSheet.equitySection.lines.map(row => [
            '权益',
            reports.balanceSheet.equitySection.label,
            row.code,
            reportLineLabel(row.name),
            row.amount,
          ]),
          [`${reports.balanceSheet.equitySection.label}合计`, reports.balanceSheet.equitySection.label, '', '', reports.balanceSheet.equitySection.total],
          ['权益合计', '', '', '', reports.balanceSheet.totalEquity],
          [],
          ...reports.balanceSheet.liabilitySections.flatMap(section => [
            ...section.lines.map(row => ['负债', section.label, row.code, row.name, row.amount]),
            [`${section.label}合计`, section.label, '', '', section.total],
            [],
          ]),
          ['负债合计', '', '', '', reports.balanceSheet.totalLiabilities],
          ['负债和权益合计', '', '', '', reports.balanceSheet.totalLiabilitiesAndEquity],
          ['会计恒等式是否平衡', '', '', '', reports.balanceSheet.equation.balanced ? '是' : '否'],
          ['恒等式差异（资产 − 负债和权益）', '', '', '', reports.balanceSheet.equation.difference],
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
          <Badge variant="outline" className="border-[#2A2418] text-[#C9A96E]">
            HKFRS
          </Badge>
        </div>
      </div>

      <Card className="rounded-lg border-[#2A2418] bg-card">
        <CardHeader className="pb-4">
          <div className="flex flex-wrap items-center gap-4">
            <Input
              type="month"
              value={period}
              onChange={e => setPeriod(e.target.value)}
              className="max-w-[180px]"
              style={{ background: '#0E0E0A', border: '1px solid #2A2418' }}
            />
            <Button size="sm" onClick={fetchReports} disabled={loading} style={{ background: '#C9A96E', color: '#0A0805' }}>
              <FileBarChart size={15} className="mr-2" />
              {loading ? '生成中...' : '生成报表'}
            </Button>
            {reports ? (
              <>
                <Button variant="outline" size="sm" onClick={exportWorkbook} style={{ borderColor: '#2A2418' }}>
                  <Download size={15} className="mr-2" /> 导出全部报表
                </Button>
                <Button variant="outline" size="sm" onClick={exportTrialBalance} style={{ borderColor: '#2A2418' }}>
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
              <TabsList className="mb-4 flex flex-wrap h-auto gap-1 bg-[#0E0E0A] border border-[#2A2418] p-1">
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
                        style={{ background: '#0E0E0A', border: '1px solid #2A2418' }}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="border-[#2A2418] bg-card">
                        {TRIAL_BALANCE_LEVEL_OPTIONS.map(option => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <TrialBalanceTable rows={filteredTrialBalanceRows} />
                <TotalsFooter
                  left={`借方合计：${money(reports.trialBalance.totalDebit)}`}
                  right={`贷方合计：${money(reports.trialBalance.totalCredit)}`}
                />
                <p className="text-xs" style={{ color: '#7A7060' }}>
                  ＊ 可通过「科目层级」筛选仅一级、前两级或全量明细展示范围；借贷合计始终基于全部明细科目计算。
                  仅显示有余额或本期发生额的科目。零余额科目在过账分录后自动出现。
                  带「一级汇总」标注的行为一级科目汇总（含下级明细合计），不计入借贷合计。
                  带「期末计算」标注的行为汇总估算，不计入借贷合计。
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
                <Section title="收入">
                  <StatementTable
                    headers={['编码', '科目', '金额']}
                    rows={reports.incomeStatement.revenue.map(row => [row.code, row.name, money(row.amount)])}
                    emptyLabel="本期间暂无收入"
                  />
                  <TotalsFooter left="收入合计" right={money(reports.incomeStatement.totalRevenue)} />
                </Section>
                <Section title="费用">
                  <StatementTable
                    headers={['编码', '科目', '金额']}
                    rows={reports.incomeStatement.expenses.map(row => [row.code, row.name, money(row.amount)])}
                    emptyLabel="本期间暂无费用"
                  />
                  <TotalsFooter left="费用合计" right={money(reports.incomeStatement.totalExpenses)} />
                </Section>
                <TotalsFooter
                  left="本期利润"
                  right={money(reports.incomeStatement.netProfit)}
                  highlight
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
                  默认仅展示一级科目汇总；点击有下级明细的一级科目可展开查看二、三、四级明细。
                </p>
                <Section title="资产">
                  {reports.balanceSheet.assetSections.map(section => (
                    <BalanceSheetSectionBlock
                      key={section.label}
                      section={section}
                      expandedAccountIds={expandedBalanceSheetAccounts}
                      onToggleExpand={toggleBalanceSheetExpand}
                    />
                  ))}
                  <TotalsFooter left="资产合计" right={money(reports.balanceSheet.totalAssets)} highlight />
                </Section>
                <Section title="负债及所有者权益">
                  <BalanceSheetSectionBlock
                    section={reports.balanceSheet.equitySection}
                    expandedAccountIds={expandedBalanceSheetAccounts}
                    onToggleExpand={toggleBalanceSheetExpand}
                  />
                  {reports.balanceSheet.liabilitySections.map(section => (
                    <BalanceSheetSectionBlock
                      key={section.label}
                      section={section}
                      expandedAccountIds={expandedBalanceSheetAccounts}
                      onToggleExpand={toggleBalanceSheetExpand}
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
    </div>
  )
}

function BalanceSheetSectionBlock({
  section,
  expandedAccountIds,
  onToggleExpand,
}: {
  section: BalanceSheetSection
  expandedAccountIds: Set<string>
  onToggleExpand: (accountId: string) => void
}) {
  return (
    <div className="space-y-2">
      <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{section.label}</h4>
      <ExpandableBalanceSheetTable
        lines={section.lines}
        expandedAccountIds={expandedAccountIds}
        onToggleExpand={onToggleExpand}
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
  emptyLabel,
}: {
  lines: BalanceSheetLineRow[]
  expandedAccountIds: Set<string>
  onToggleExpand: (accountId: string) => void
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
    <div className="overflow-x-auto rounded-lg border border-[#2A2418]">
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
                    <span>{reportLineLabel(line.name)}</span>
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
      <div className="grid gap-2 rounded-lg border border-[#2A2418] bg-[#0E0E0A] p-4 text-sm sm:grid-cols-3">
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
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#2A2418] bg-[#0E0E0A] px-4 py-3 text-sm">
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

function StatementTable({
  headers,
  rows,
  emptyLabel = '暂无数据',
}: {
  headers: string[]
  rows: string[][]
  emptyLabel?: string
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground py-2">{emptyLabel}</p>
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-[#2A2418]">
      <Table>
        <TableHeader>
          <TableRow>
            {headers.map(header => (
              <TableHead
                key={header}
                className={
                  header.includes('金额') || header.includes('借方') || header.includes('贷方') ? 'text-right' : undefined
                }
              >
                {header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, index) => (
            <TableRow key={index}>
              {row.map((cell, cellIndex) => (
                <TableCell
                  key={cellIndex}
                  className={cellIndex >= 2 ? 'text-right font-mono' : cellIndex === 0 ? 'font-mono' : undefined}
                >
                  {cell}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function TotalsFooter({ left, right, highlight }: { left: string; right: string; highlight?: boolean }) {
  return (
    <div
      className={`flex justify-between rounded-lg border px-4 py-3 text-sm ${highlight ? 'border-[#C9A96E66] bg-[#C9A96E14] font-semibold' : 'border-[#2A2418] bg-[#0E0E0A]'}`}
    >
      <span>{left}</span>
      <span className="font-mono">{right}</span>
    </div>
  )
}

function CashFlowSection({ title, items }: { title: string; items: { label: string; amount: number }[] }) {
  return (
    <Section title={title}>
      <div className="space-y-2 rounded-lg border border-[#2A2418] bg-[#0E0E0A] p-4">
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

/** Trial-balance table that handles computed rows (isComputed=true) with distinct styling. */
function TrialBalanceTable({ rows }: { rows: TrialBalanceRow[] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground py-2">本期间暂无科目余额</p>
  }

  const headers = ['编码', '科目', '类型', '本期借方', '本期贷方', '期末借方', '期末贷方']

  function rowStyle(row: TrialBalanceRow) {
    if (row.isComputed) {
      return { background: 'rgba(201,169,110,0.06)', fontStyle: 'italic' as const }
    }
    if (row.isSummary) {
      return { background: 'rgba(42,36,24,0.04)', fontWeight: 600 as const }
    }
    return undefined
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-[#2A2418]">
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
          {rows.map((row, index) => (
            <TableRow
              key={index}
              style={rowStyle(row)}
            >
              <TableCell className="font-mono">{row.code}</TableCell>
              <TableCell>
                <span>{row.name}</span>
                {row.isSummary && (
                  <span
                    className="ml-2 rounded px-1 py-0.5 text-[10px] font-normal"
                    style={{ background: 'rgba(42,36,24,0.08)', color: '#2A2418' }}
                  >
                    一级汇总
                  </span>
                )}
                {row.isComputed && (
                  <span
                    className="ml-2 rounded px-1 py-0.5 text-[10px] font-normal not-italic"
                    style={{ background: 'rgba(201,169,110,0.2)', color: '#C9A96E' }}
                  >
                    期末计算
                  </span>
                )}
              </TableCell>
              <TableCell>{accountTypeLabel(row.type)}</TableCell>
              <TableCell className="text-right font-mono">{money(row.periodDebit)}</TableCell>
              <TableCell className="text-right font-mono">{money(row.periodCredit)}</TableCell>
              <TableCell className="text-right font-mono">{money(row.closingDebit)}</TableCell>
              <TableCell className="text-right font-mono">{money(row.closingCredit)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
