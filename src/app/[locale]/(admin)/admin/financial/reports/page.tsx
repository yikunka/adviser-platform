'use client'

/* eslint-disable react-hooks/set-state-in-effect */

import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { Download, FileBarChart } from 'lucide-react'
import { toast } from 'sonner'
import type { FinancialReportsBundle } from '@/lib/financial/reports'
import { formatCurrency } from '@/lib/financial/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Link } from '@/i18n/navigation'

function currentPeriod() {
  const now = new Date()
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`
}

function money(value: number) {
  return formatCurrency(value)
}

function exportCsv(filename: string, headers: string[], rows: (string | number)[][]) {
  const csv = [headers.join(','), ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = filename
  link.click()
}

export default function AdminFinancialReportsPage() {
  const [period, setPeriod] = useState(currentPeriod)
  const [groupId, setGroupId] = useState('')
  const [companyId, setCompanyId] = useState('')
  const [groups, setGroups] = useState<{ id: string; name: string }[]>([])
  const [companies, setCompanies] = useState<{ id: string; nameEn: string; groupId: string | null; companyCode: string | null }[]>([])
  const [reports, setReports] = useState<FinancialReportsBundle | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetch('/api/admin/financial/scope')
      .then(async r => {
        const json = await r.json()
        if (!r.ok) throw new Error(json.error || 'Failed to load financial scope')
        setGroups((json.groups ?? []).map((g: { id: string; name: string }) => ({ id: g.id, name: g.name })))
        setCompanies((json.companies ?? []).map((c: { id: string; nameEn: string; groupId: string | null; companyCode: string | null }) => ({
          id: c.id,
          nameEn: c.nameEn,
          groupId: c.groupId,
          companyCode: c.companyCode,
        })))
      })
      .catch(error => toast.error(error instanceof Error ? error.message : 'Failed to load financial scope'))
  }, [])

  const companyOptions = groupId
    ? companies.filter(company => company.groupId === groupId)
    : companies

  const fetchReports = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ period })
      if (groupId) params.set('groupId', groupId)
      if (companyId) params.set('companyId', companyId)
      const res = await fetch(`/api/admin/financial/reports?${params}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to generate reports')
      setReports(data.reports)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load financial reports')
      setReports(null)
    } finally {
      setLoading(false)
    }
  }, [period, groupId, companyId])

  useEffect(() => {
    fetchReports()
  }, [fetchReports])

  function exportTrialBalance() {
    if (!reports) return
    exportCsv(
      `trial_balance_${period}.csv`,
      ['Account Code', 'Account Name', 'Type', 'Period Debit', 'Period Credit', 'Closing Debit', 'Closing Credit'],
      reports.trialBalance.rows.map(row => [
        row.code,
        row.name,
        row.type,
        row.periodDebit.toFixed(2),
        row.periodCredit.toFixed(2),
        row.closingDebit.toFixed(2),
        row.closingCredit.toFixed(2),
      ]),
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-xs" style={{ color: '#7A7060' }}>
          <Link href="/admin/dashboard" className="hover:text-[#C9A96E]">Dashboard</Link>
          <span>/</span>
          <Link href="/admin/financial" className="hover:text-[#C9A96E]">Financial Accounting</Link>
          <span>/</span>
          <span style={{ color: 'var(--muted-foreground)' }}>HKFRS Reports</span>
        </div>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>Financial Statements</h1>
            <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
              HKFRS-compliant reports generated from posted general ledger entries.
            </p>
          </div>
          <Badge variant="outline" className="border-[#2A2418] text-[#C9A96E]">
            HKFRS · HKD
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
            <select
              value={groupId}
              onChange={e => { setGroupId(e.target.value); setCompanyId('') }}
              className="rounded-md px-3 py-2 text-sm max-w-[200px]"
              style={{ background: '#0E0E0A', border: '1px solid #2A2418', color: '#F0EAD8' }}
            >
              <option value="">All entity groups</option>
              {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
            <select
              value={companyId}
              onChange={e => setCompanyId(e.target.value)}
              className="rounded-md px-3 py-2 text-sm max-w-[220px]"
              style={{ background: '#0E0E0A', border: '1px solid #2A2418', color: '#F0EAD8' }}
            >
              <option value="">All companies</option>
              {companyOptions.map(c => (
                <option key={c.id} value={c.id}>
                  {c.companyCode ? `${c.companyCode} - ` : ''}{c.nameEn}
                </option>
              ))}
            </select>
            <Button size="sm" onClick={fetchReports} disabled={loading} style={{ background: '#C9A96E', color: '#0A0805' }}>
              <FileBarChart size={15} className="mr-2" />
              {loading ? 'Generating...' : 'Generate Reports'}
            </Button>
            {reports ? (
              <Button variant="outline" size="sm" onClick={exportTrialBalance} style={{ borderColor: '#2A2418' }}>
                <Download size={15} className="mr-2" /> Export Trial Balance
              </Button>
            ) : null}
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="p-8 text-center" style={{ color: 'var(--muted-foreground)' }}>Generating HKFRS reports...</div>
          ) : !reports ? (
            <div className="p-8 text-center" style={{ color: '#5A5040' }}>Select a period and generate reports.</div>
          ) : (
            <Tabs defaultValue="trial-balance">
              <TabsList className="mb-4 flex flex-wrap h-auto gap-1 bg-[#0E0E0A] border border-[#2A2418] p-1">
                <TabsTrigger value="trial-balance">Trial Balance</TabsTrigger>
                <TabsTrigger value="income">Income Statement</TabsTrigger>
                <TabsTrigger value="balance">Balance Sheet</TabsTrigger>
                <TabsTrigger value="cashflow">Cash Flows</TabsTrigger>
              </TabsList>

              <TabsContent value="trial-balance" className="space-y-4">
                <ReportHeader title="Trial Balance" period={period} balanced={reports.trialBalance.balanced} />
                <StatementTable
                  headers={['Code', 'Account', 'Type', 'Period Dr', 'Period Cr', 'Closing Dr', 'Closing Cr']}
                  rows={reports.trialBalance.rows.map(row => [
                    row.code,
                    row.name,
                    row.type,
                    money(row.periodDebit),
                    money(row.periodCredit),
                    money(row.closingDebit),
                    money(row.closingCredit),
                  ])}
                />
                <TotalsFooter
                  left={`Total Debit: ${money(reports.trialBalance.totalDebit)}`}
                  right={`Total Credit: ${money(reports.trialBalance.totalCredit)}`}
                />
              </TabsContent>

              <TabsContent value="income" className="space-y-4">
                <ReportHeader title="Income Statement (Profit or Loss)" period={period} />
                <Section title="Revenue">
                  <StatementTable
                    headers={['Code', 'Account', 'Amount']}
                    rows={reports.incomeStatement.revenue.map(row => [row.code, row.name, money(row.amount)])}
                    emptyLabel="No revenue in this period"
                  />
                  <TotalsFooter left="Total Revenue" right={money(reports.incomeStatement.totalRevenue)} />
                </Section>
                <Section title="Expenses">
                  <StatementTable
                    headers={['Code', 'Account', 'Amount']}
                    rows={reports.incomeStatement.expenses.map(row => [row.code, row.name, money(row.amount)])}
                    emptyLabel="No expenses in this period"
                  />
                  <TotalsFooter left="Total Expenses" right={money(reports.incomeStatement.totalExpenses)} />
                </Section>
                <TotalsFooter
                  left="Profit for the period"
                  right={money(reports.incomeStatement.netProfit)}
                  highlight
                />
              </TabsContent>

              <TabsContent value="balance" className="space-y-4">
                <ReportHeader
                  title="Statement of Financial Position (Balance Sheet)"
                  period={period}
                  balanced={reports.balanceSheet.balanced}
                  subtitle={`As at ${new Date(reports.balanceSheet.asOfDate).toLocaleDateString('en-HK')}`}
                />
                <Section title="Assets">
                  <StatementTable
                    headers={['Code', 'Account', 'Amount']}
                    rows={reports.balanceSheet.assets.map(row => [row.code, row.name, money(row.amount)])}
                    emptyLabel="No asset balances"
                  />
                  <TotalsFooter left="Total Assets" right={money(reports.balanceSheet.totalAssets)} />
                </Section>
                <Section title="Liabilities">
                  <StatementTable
                    headers={['Code', 'Account', 'Amount']}
                    rows={reports.balanceSheet.liabilities.map(row => [row.code, row.name, money(row.amount)])}
                    emptyLabel="No liability balances"
                  />
                  <TotalsFooter left="Total Liabilities" right={money(reports.balanceSheet.totalLiabilities)} />
                </Section>
                <Section title="Equity">
                  <StatementTable
                    headers={['Code', 'Account', 'Amount']}
                    rows={reports.balanceSheet.equity.map(row => [row.code, row.name, money(row.amount)])}
                    emptyLabel="No equity balances"
                  />
                  <TotalsFooter left="Total Equity" right={money(reports.balanceSheet.totalEquity)} />
                </Section>
                <TotalsFooter
                  left="Total Liabilities and Equity"
                  right={money(reports.balanceSheet.totalLiabilitiesAndEquity)}
                  highlight
                />
              </TabsContent>

              <TabsContent value="cashflow" className="space-y-4">
                <ReportHeader title="Statement of Cash Flows (Indirect Method)" period={period} />
                <CashFlowSection title="Operating activities" items={reports.cashFlow.operating} />
                <CashFlowSection title="Investing activities" items={reports.cashFlow.investing} />
                <CashFlowSection title="Financing activities" items={reports.cashFlow.financing} />
                <TotalsFooter left="Net increase / (decrease) in cash" right={money(reports.cashFlow.netCashChange)} highlight />
                <TotalsFooter left="Cash at beginning of period" right={money(reports.cashFlow.openingCash)} />
                <TotalsFooter left="Cash at end of period" right={money(reports.cashFlow.closingCash)} />
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>
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
        <p className="text-sm text-muted-foreground">Period: {period}{subtitle ? ` · ${subtitle}` : ''}</p>
      </div>
      {balanced !== undefined ? (
        <Badge variant="outline" style={{ borderColor: balanced ? '#10b981' : '#ef4444', color: balanced ? '#10b981' : '#ef4444' }}>
          {balanced ? 'Balanced' : 'Out of balance'}
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
  emptyLabel = 'No data',
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
              <TableHead key={header} className={header.includes('Amount') || header.includes('Dr') || header.includes('Cr') ? 'text-right' : undefined}>
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
            <span>{item.label}</span>
            <span className="font-mono">{money(item.amount)}</span>
          </div>
        ))}
      </div>
    </Section>
  )
}
