'use client'

/* eslint-disable react-hooks/set-state-in-effect */

import { useCallback, useEffect, useRef, useState } from 'react'
import Papa from 'papaparse'
import { CheckCircle, Link2, Pencil, Plus, RefreshCw, Upload, Wand2, X } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AccountCombobox } from '@/components/admin/financial/AccountCombobox'
import { FinancialBreadcrumbs } from '@/components/admin/financial/FinancialBreadcrumbs'
import { useFinancialCompany } from '@/components/admin/financial/FinancialCompanyContext'
import { inputStyle, money } from '@/components/admin/financial/subledger/config'

type BankAccount = {
  id: string
  name: string
  bankName: string
  accountNumber: string
  currency: string
  glAccountId: string
  glAccount: { id: string; code: string; name: string } | null
  isActive: boolean
  glBalance: number
}

type StatementSummary = {
  id: string
  fileName: string
  periodStart: string | null
  periodEnd: string | null
  importedBy: string | null
  createdAt: string
  lineCount: number
  matchedCount: number
  unmatchedCount: number
}

type Reconciliation = {
  id: string
  statementDate: string
  statementBalance: number
  glBalance: number
  status: 'IN_PROGRESS' | 'COMPLETED'
  completedAt: string | null
}

type ReconWorkspace = {
  reconciliation: { id: string; bankAccount: { name: string }; statementDate: string; status: string }
  summary: {
    statementBalance: number
    glBalance: number
    difference: number
    unmatchedStatementTotal: number
    unmatchedLedgerTotal: number
    unexplainedDifference: number
    isBalanced: boolean
  }
  statementLines: Array<{
    id: string
    date: string
    description: string
    reference: string
    amount: number
    status: 'UNMATCHED' | 'MATCHED' | 'EXCLUDED'
    matchedLedger: { id: string; voucherNo: string; date: string; amount: number } | null
  }>
  unmatchedLedgerRows: Array<{ id: string; date: string; voucherNo: string; description: string; amount: number }>
}

type CsvRow = { date: string; description: string; reference: string; amount: number }

const fieldClassName = 'border-[#2A2418] bg-[#0E0E0A] text-[#FFF7E6] placeholder:text-[#9F927B] focus-visible:border-[#C9A96E] focus-visible:ring-[#C9A96E]/25'
const labelClassName = 'text-[#EADDC3]'
const secondaryButtonClassName = 'border-[#3A3428] bg-[#0E0E0A] text-[#FFF7E6] hover:bg-[#1E1A12] hover:text-[#FFF7E6]'

function parseCsvRows(rows: Record<string, string>[]): { lines: CsvRow[]; errors: string[] } {
  const lines: CsvRow[] = []
  const errors: string[] = []
  rows.forEach((row, index) => {
    const keys = Object.keys(row).reduce<Record<string, string>>((map, key) => {
      map[key.trim().toLowerCase()] = row[key]?.trim() ?? ''
      return map
    }, {})
    const dateRaw = keys['date'] || keys['日期'] || ''
    const description = keys['description'] || keys['摘要'] || keys['narrative'] || ''
    const reference = keys['reference'] || keys['参考号'] || keys['ref'] || ''
    let amount = 0
    if (keys['amount'] || keys['金额']) {
      amount = Number((keys['amount'] || keys['金额']).replace(/[, ]/g, ''))
    } else {
      const credit = Number((keys['credit'] || keys['存入'] || '0').replace(/[, ]/g, '')) || 0
      const debit = Number((keys['debit'] || keys['支出'] || '0').replace(/[, ]/g, '')) || 0
      amount = credit - debit
    }
    const date = dateRaw.replace(/\//g, '-')
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      errors.push(`第 ${index + 2} 行：日期格式无效（${dateRaw || '空'}），需要 YYYY-MM-DD。`)
      return
    }
    if (!Number.isFinite(amount) || amount === 0) {
      errors.push(`第 ${index + 2} 行：金额无效。`)
      return
    }
    lines.push({ date, description, reference, amount })
  })
  return { lines, errors }
}

export default function AdminFinancialBankingPage() {
  const company = useFinancialCompany()
  const readOnly = company.financialReadOnly ?? false
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const [accounts, setAccounts] = useState<BankAccount[]>([])
  const [selectedAccountId, setSelectedAccountId] = useState('')
  const [statements, setStatements] = useState<StatementSummary[]>([])
  const [reconciliations, setReconciliations] = useState<Reconciliation[]>([])
  const [workspace, setWorkspace] = useState<ReconWorkspace | null>(null)
  const [loading, setLoading] = useState(true)

  // 账户表单
  const [accountFormOpen, setAccountFormOpen] = useState(false)
  const [editingAccount, setEditingAccount] = useState<BankAccount | null>(null)
  const [accountForm, setAccountForm] = useState({ name: '', bankName: '', accountNumber: '', glAccountId: '' })
  const [saving, setSaving] = useState(false)

  // CSV 导入
  const [csvLines, setCsvLines] = useState<CsvRow[]>([])
  const [csvErrors, setCsvErrors] = useState<string[]>([])
  const [csvFileName, setCsvFileName] = useState('')
  const [importing, setImporting] = useState(false)

  // 新建对账
  const [reconFormOpen, setReconFormOpen] = useState(false)
  const [reconDate, setReconDate] = useState(new Date().toISOString().slice(0, 10))
  const [reconBalance, setReconBalance] = useState('')

  // 手动匹配选择
  const [matchingLineId, setMatchingLineId] = useState<string | null>(null)

  const fetchAccounts = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/financial/bank-accounts?companyId=${company.id}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '载入银行账户失败')
      setAccounts(data.bankAccounts ?? [])
      if (!selectedAccountId && data.bankAccounts?.length) {
        setSelectedAccountId(data.bankAccounts[0].id)
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '载入银行账户失败')
    } finally {
      setLoading(false)
    }
  }, [company.id, selectedAccountId])

  const fetchAccountDetail = useCallback(async () => {
    if (!selectedAccountId) return
    try {
      const [statementsRes, reconsRes] = await Promise.all([
        fetch(`/api/admin/financial/bank-statements?bankAccountId=${selectedAccountId}`),
        fetch(`/api/admin/financial/bank-reconciliations?bankAccountId=${selectedAccountId}`),
      ])
      const [statementsData, reconsData] = await Promise.all([statementsRes.json(), reconsRes.json()])
      if (statementsRes.ok) setStatements(statementsData.statements ?? [])
      if (reconsRes.ok) {
        setReconciliations(reconsData.reconciliations ?? [])
        const inProgress = (reconsData.reconciliations ?? []).find(
          (recon: Reconciliation) => recon.status === 'IN_PROGRESS',
        )
        if (inProgress) {
          const workspaceRes = await fetch(`/api/admin/financial/bank-reconciliations/${inProgress.id}`)
          const workspaceData = await workspaceRes.json()
          if (workspaceRes.ok) setWorkspace(workspaceData)
        } else {
          setWorkspace(null)
        }
      }
    } catch {
      /* non-blocking */
    }
  }, [selectedAccountId])

  useEffect(() => {
    void fetchAccounts()
  }, [fetchAccounts])

  useEffect(() => {
    void fetchAccountDetail()
  }, [fetchAccountDetail])

  async function saveAccount() {
    if (!accountForm.name.trim() || !accountForm.glAccountId) {
      toast.error('账户名称和关联总账科目必填。')
      return
    }
    setSaving(true)
    try {
      const payload = editingAccount
        ? { name: accountForm.name, bankName: accountForm.bankName, accountNumber: accountForm.accountNumber, glAccountId: accountForm.glAccountId }
        : { companyId: company.id, ...accountForm }
      const res = await fetch(
        editingAccount ? `/api/admin/financial/bank-accounts/${editingAccount.id}` : '/api/admin/financial/bank-accounts',
        {
          method: editingAccount ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
      )
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.toast || data.error || '保存失败。')
      toast.success(data.toast || '已保存。')
      setAccountFormOpen(false)
      await fetchAccounts()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '保存失败。')
    } finally {
      setSaving(false)
    }
  }

  function handleCsvFile(file: File) {
    setCsvFileName(file.name)
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: results => {
        const { lines, errors } = parseCsvRows(results.data)
        setCsvLines(lines)
        setCsvErrors(errors)
        if (lines.length === 0) toast.error('未解析到有效流水行，请检查 CSV 列名（Date/Description/Reference/Amount 或 Credit+Debit）。')
      },
      error: () => toast.error('CSV 解析失败。'),
    })
  }

  async function importCsv() {
    if (!selectedAccountId || csvLines.length === 0) return
    setImporting(true)
    try {
      const res = await fetch('/api/admin/financial/bank-statements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bankAccountId: selectedAccountId, fileName: csvFileName, lines: csvLines }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.toast || data.error || '导入失败。')
      toast.success(data.toast || '导入成功。')
      setCsvLines([])
      setCsvErrors([])
      setCsvFileName('')
      if (fileInputRef.current) fileInputRef.current.value = ''
      await fetchAccountDetail()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '导入失败。')
    } finally {
      setImporting(false)
    }
  }

  async function createRecon() {
    if (!selectedAccountId || !reconBalance) {
      toast.error('请填写对账单余额。')
      return
    }
    try {
      const res = await fetch('/api/admin/financial/bank-reconciliations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bankAccountId: selectedAccountId,
          statementDate: reconDate,
          statementBalance: Number(reconBalance),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.toast || data.error || '创建对账失败。')
      toast.success(data.toast || '对账已创建。')
      setReconFormOpen(false)
      setReconBalance('')
      await fetchAccountDetail()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '创建对账失败。')
    }
  }

  async function reconAction(url: string, method: string, body?: unknown) {
    try {
      const res = await fetch(url, {
        method,
        ...(body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.toast || data.error || '操作失败。')
      toast.success(data.toast || '操作成功。')
      setMatchingLineId(null)
      await fetchAccountDetail()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '操作失败。')
    }
  }

  const selectedAccount = accounts.find(account => account.id === selectedAccountId) ?? null

  return (
    <div className="p-6 space-y-6">
      <div className="space-y-2">
        <FinancialBreadcrumbs section="银行与现金" />
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>银行与现金</h1>
            <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
              {company.nameEn} · 银行账户、流水导入与银行对账。
            </p>
          </div>
          {!readOnly ? (
            <Button
              size="sm"
              onClick={() => {
                setEditingAccount(null)
                setAccountForm({ name: '', bankName: '', accountNumber: '', glAccountId: '' })
                setAccountFormOpen(true)
              }}
              style={{ background: '#C9A96E', color: '#0A0805' }}
            >
              <Plus size={15} className="mr-2" /> 新增银行账户
            </Button>
          ) : null}
        </div>
      </div>

      {readOnly ? (
        <div className="rounded-lg border border-[#C9A96E55] bg-[#C9A96E14] px-4 py-3 text-sm" style={{ color: '#EADDC3' }}>
          Staff 账号在银行与现金模块仅可查看对账和流水结果，不能新增账户、导入流水或执行对账操作。
        </div>
      ) : null}

      {/* 账户卡片 */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="text-sm" style={{ color: 'var(--muted-foreground)' }}>载入中...</div>
        ) : accounts.length === 0 ? (
          <div className="text-sm" style={{ color: '#5A5040' }}>暂无银行账户，请先创建并关联总账科目（如 1002 银行存款）。</div>
        ) : (
          accounts.map(account => (
            <Card
              key={account.id}
              className={`rounded-lg bg-card cursor-pointer transition-colors ${
                account.id === selectedAccountId ? 'border-[#C9A96E]' : 'border-[#2A2418] hover:border-[#C9A96E66]'
              }`}
              onClick={() => setSelectedAccountId(account.id)}
            >
              <CardContent className="pt-4 space-y-1">
                <div className="flex items-center justify-between">
                  <p className="font-semibold" style={{ color: 'var(--foreground)' }}>{account.name}</p>
                  {!readOnly ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      onClick={event => {
                        event.stopPropagation()
                        setEditingAccount(account)
                        setAccountForm({
                          name: account.name,
                          bankName: account.bankName,
                          accountNumber: account.accountNumber,
                          glAccountId: account.glAccountId,
                        })
                        setAccountFormOpen(true)
                      }}
                    >
                      <Pencil size={13} className="text-muted-foreground" />
                    </Button>
                  ) : null}
                </div>
                <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                  {[account.bankName, account.accountNumber].filter(Boolean).join(' · ') || '—'}
                </p>
                <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                  总账科目：{account.glAccount ? `${account.glAccount.code} ${account.glAccount.name}` : '-'}
                </p>
                <p className="text-xl font-bold mt-1" style={{ color: '#C9A96E' }}>
                  {money(account.glBalance)} <span className="text-xs font-normal">{account.currency}</span>
                </p>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {selectedAccount ? (
        <Tabs defaultValue="reconciliation">
          <TabsList>
            <TabsTrigger value="reconciliation">银行对账</TabsTrigger>
            <TabsTrigger value="import">流水导入</TabsTrigger>
            <TabsTrigger value="statements">已导入对账单</TabsTrigger>
          </TabsList>

          {/* ── 对账 ── */}
          <TabsContent value="reconciliation">
            <Card className="rounded-lg border-[#2A2418] bg-card">
              <CardHeader className="pb-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                    {selectedAccount.name} · 进行中的对账会自动载入；完成后可开启下一期。
                  </p>
                  {!workspace ? !readOnly ? (
                    <Button size="sm" onClick={() => setReconFormOpen(true)} style={{ background: '#C9A96E', color: '#0A0805' }}>
                      <Plus size={15} className="mr-2" /> 开始新对账
                    </Button>
                  ) : null : (
                    <div className="flex gap-2">
                      {!readOnly ? (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            style={{ borderColor: '#2A2418' }}
                            onClick={() =>
                              void reconAction(
                                `/api/admin/financial/bank-reconciliations/${workspace.reconciliation.id}/auto-match`,
                                'POST',
                              )
                            }
                          >
                            <Wand2 size={14} className="mr-1" /> 自动匹配
                          </Button>
                          <Button
                            size="sm"
                            disabled={!workspace.summary.isBalanced}
                            title={workspace.summary.isBalanced ? '' : '调节后差额为零才能完成对账'}
                            onClick={() =>
                              void reconAction(`/api/admin/financial/bank-reconciliations/${workspace.reconciliation.id}`, 'PUT')
                            }
                            style={{ background: '#10b981', color: '#fff' }}
                          >
                            <CheckCircle size={14} className="mr-1" /> 完成对账
                          </Button>
                        </>
                      ) : null}
                    </div>
                  )}
                </div>
                {workspace ? (
                  <div className="mt-3 grid sm:grid-cols-5 gap-3 text-sm">
                    {[
                      ['对账单余额', workspace.summary.statementBalance, undefined],
                      ['总账余额', workspace.summary.glBalance, undefined],
                      ['差额', workspace.summary.difference, undefined],
                      ['未匹配流水', workspace.summary.unmatchedStatementTotal, '#f59e0b'],
                      ['调节后差额', workspace.summary.unexplainedDifference, workspace.summary.isBalanced ? '#10b981' : '#ef4444'],
                    ].map(([label, value, color]) => (
                      <div key={label as string} className="rounded-md border px-3 py-2" style={{ borderColor: '#2A2418' }}>
                        <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{label as string}</p>
                        <p className="font-semibold" style={{ color: (color as string) ?? 'var(--foreground)' }}>
                          {money(value as number)}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : null}
              </CardHeader>
              <CardContent>
                {!workspace ? (
                  reconciliations.length === 0 ? (
                    <div className="p-8 text-center" style={{ color: '#5A5040' }}>暂无对账记录</div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>截止日期</TableHead>
                          <TableHead className="text-right">对账单余额</TableHead>
                          <TableHead className="text-right">总账余额</TableHead>
                          <TableHead>状态</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {reconciliations.map(recon => (
                          <TableRow key={recon.id}>
                            <TableCell>{recon.statementDate}</TableCell>
                            <TableCell className="text-right">{money(recon.statementBalance)}</TableCell>
                            <TableCell className="text-right">{money(recon.glBalance)}</TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                style={
                                  recon.status === 'COMPLETED'
                                    ? { borderColor: '#10b981', color: '#10b981' }
                                    : { borderColor: '#f59e0b', color: '#f59e0b' }
                                }
                              >
                                {recon.status === 'COMPLETED' ? '已完成' : '进行中'}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )
                ) : (
                  <div className="grid lg:grid-cols-2 gap-4">
                    {/* 银行流水 */}
                    <div>
                      <p className="text-sm font-medium mb-2" style={{ color: 'var(--foreground)' }}>
                        银行流水（截止 {workspace.reconciliation.statementDate}）
                      </p>
                      <div className="space-y-1.5 max-h-[480px] overflow-y-auto pr-1">
                        {workspace.statementLines.length === 0 ? (
                          <div className="p-6 text-center text-sm" style={{ color: '#5A5040' }}>
                            暂无流水，请先在「流水导入」中导入 CSV。
                          </div>
                        ) : (
                          workspace.statementLines.map(line => (
                            <div
                              key={line.id}
                              className="rounded-md border px-3 py-2 text-sm"
                              style={{
                                borderColor:
                                  matchingLineId === line.id
                                    ? '#C9A96E'
                                    : line.status === 'MATCHED'
                                      ? '#10b98155'
                                      : line.status === 'EXCLUDED'
                                        ? '#9CA3AF55'
                                        : '#2A2418',
                                opacity: line.status === 'EXCLUDED' ? 0.6 : 1,
                              }}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="min-w-0">
                                  <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{line.date}</span>
                                  <span className="ml-2 truncate">{line.description || line.reference || '-'}</span>
                                </div>
                                <span className="font-medium shrink-0" style={{ color: line.amount >= 0 ? '#10b981' : '#ef4444' }}>
                                  {money(line.amount)}
                                </span>
                              </div>
                              <div className="mt-1 flex items-center justify-between gap-2">
                                <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                                  {line.status === 'MATCHED' && line.matchedLedger
                                    ? `已匹配 ${line.matchedLedger.voucherNo}`
                                    : line.status === 'EXCLUDED'
                                      ? '已排除'
                                      : '未匹配'}
                                </span>
                                <span className="flex gap-1">
                                  {!readOnly && line.status === 'UNMATCHED' ? (
                                    <>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 px-2 text-xs hover:text-[#C9A96E]"
                                        onClick={() => setMatchingLineId(matchingLineId === line.id ? null : line.id)}
                                      >
                                        <Link2 size={12} className="mr-1" />
                                        {matchingLineId === line.id ? '取消选择' : '手动匹配'}
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 px-2 text-xs"
                                        onClick={() =>
                                          void reconAction(`/api/admin/financial/bank-statement-lines/${line.id}`, 'PATCH', {
                                            action: 'EXCLUDE',
                                          })
                                        }
                                      >
                                        <X size={12} className="mr-1" /> 排除
                                      </Button>
                                    </>
                                  ) : !readOnly ? (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 px-2 text-xs"
                                        onClick={() =>
                                          void reconAction(`/api/admin/financial/bank-statement-lines/${line.id}`, 'PATCH', {
                                            action: line.status === 'MATCHED' ? 'UNMATCH' : 'INCLUDE',
                                          })
                                        }
                                      >
                                        <RefreshCw size={12} className="mr-1" />
                                        {line.status === 'MATCHED' ? '取消匹配' : '恢复'}
                                      </Button>
                                    ) : (
                                      <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>只读</span>
                                    )}
                                </span>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    {/* 未匹配总账行 */}
                    <div>
                      <p className="text-sm font-medium mb-2" style={{ color: 'var(--foreground)' }}>
                        未匹配总账记录（未达账项）
                        {matchingLineId ? (
                          <span className="ml-2 text-xs" style={{ color: '#C9A96E' }}>点击下方记录与所选流水匹配</span>
                        ) : null}
                      </p>
                      <div className="space-y-1.5 max-h-[480px] overflow-y-auto pr-1">
                        {workspace.unmatchedLedgerRows.length === 0 ? (
                          <div className="p-6 text-center text-sm" style={{ color: '#5A5040' }}>无未达账项</div>
                        ) : (
                          workspace.unmatchedLedgerRows.map(row => (
                            <button
                              key={row.id}
                              type="button"
                              disabled={!matchingLineId || readOnly}
                              onClick={() =>
                                matchingLineId && !readOnly
                                  ? void reconAction(`/api/admin/financial/bank-statement-lines/${matchingLineId}`, 'PATCH', {
                                      action: 'MATCH',
                                      ledgerId: row.id,
                                      reconciliationId: workspace.reconciliation.id,
                                    })
                                  : undefined
                              }
                              className="w-full rounded-md border px-3 py-2 text-left text-sm transition-colors disabled:cursor-default"
                              style={{ borderColor: matchingLineId ? '#C9A96E66' : '#2A2418' }}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="min-w-0">
                                  <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{row.date}</span>
                                  <span className="ml-2 font-mono text-xs">{row.voucherNo}</span>
                                  <span className="ml-2 truncate text-xs">{row.description}</span>
                                </div>
                                <span className="font-medium shrink-0" style={{ color: row.amount >= 0 ? '#10b981' : '#ef4444' }}>
                                  {money(row.amount)}
                                </span>
                              </div>
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── 流水导入 ── */}
          <TabsContent value="import">
            <Card className="rounded-lg border-[#2A2418] bg-card">
              <CardHeader className="pb-4">
                {!readOnly ? (
                  <div className="flex flex-wrap items-center gap-3">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv"
                      className="hidden"
                      onChange={event => {
                        const file = event.target.files?.[0]
                        if (file) handleCsvFile(file)
                      }}
                    />
                    <Button size="sm" variant="outline" style={{ borderColor: '#2A2418' }} onClick={() => fileInputRef.current?.click()}>
                      <Upload size={15} className="mr-2" /> 选择 CSV 文件
                    </Button>
                    {csvFileName ? <span className="text-sm" style={{ color: 'var(--muted-foreground)' }}>{csvFileName}</span> : null}
                    {csvLines.length > 0 ? (
                      <Button size="sm" onClick={() => void importCsv()} disabled={importing} style={{ background: '#C9A96E', color: '#0A0805' }}>
                        {importing ? '导入中...' : `导入 ${csvLines.length} 行到「${selectedAccount.name}」`}
                      </Button>
                    ) : null}
                  </div>
                ) : (
                  <div className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                    Staff 账号不可导入银行流水。
                  </div>
                )}
                <p className="mt-2 text-xs" style={{ color: 'var(--muted-foreground)' }}>
                  支持列名：Date/日期、Description/摘要、Reference/参考号、Amount/金额（正=流入，负=流出），或 Credit/存入 + Debit/支出 两列。
                </p>
                {csvErrors.length > 0 ? (
                  <div className="mt-2 rounded-md border px-3 py-2 text-xs space-y-0.5" style={{ borderColor: '#ef4444', color: '#fecaca' }}>
                    {csvErrors.slice(0, 6).map((error, index) => (
                      <p key={index}>{error}</p>
                    ))}
                    {csvErrors.length > 6 ? <p>… 共 {csvErrors.length} 个问题行（已跳过）</p> : null}
                  </div>
                ) : null}
              </CardHeader>
              <CardContent>
                {csvLines.length === 0 ? (
                  <div className="p-8 text-center" style={{ color: '#5A5040' }}>选择 CSV 后在此预览</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>日期</TableHead>
                        <TableHead>摘要</TableHead>
                        <TableHead>参考号</TableHead>
                        <TableHead className="text-right">金额</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {csvLines.slice(0, 50).map((line, index) => (
                        <TableRow key={index}>
                          <TableCell>{line.date}</TableCell>
                          <TableCell className="max-w-[280px] truncate">{line.description}</TableCell>
                          <TableCell className="font-mono text-xs">{line.reference}</TableCell>
                          <TableCell className="text-right" style={{ color: line.amount >= 0 ? '#10b981' : '#ef4444' }}>
                            {money(line.amount)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── 已导入对账单 ── */}
          <TabsContent value="statements">
            <Card className="rounded-lg border-[#2A2418] bg-card">
              <CardContent className="pt-4">
                {statements.length === 0 ? (
                  <div className="p-8 text-center" style={{ color: '#5A5040' }}>暂无导入记录</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>文件</TableHead>
                        <TableHead>期间</TableHead>
                        <TableHead className="text-right">行数</TableHead>
                        <TableHead className="text-right">已匹配</TableHead>
                        <TableHead className="text-right">未匹配</TableHead>
                        <TableHead>导入人</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {statements.map(statement => (
                        <TableRow key={statement.id}>
                          <TableCell className="max-w-[220px] truncate">{statement.fileName || '-'}</TableCell>
                          <TableCell>
                            {statement.periodStart} ~ {statement.periodEnd}
                          </TableCell>
                          <TableCell className="text-right">{statement.lineCount}</TableCell>
                          <TableCell className="text-right" style={{ color: '#10b981' }}>{statement.matchedCount}</TableCell>
                          <TableCell className="text-right" style={{ color: statement.unmatchedCount > 0 ? '#f59e0b' : undefined }}>
                            {statement.unmatchedCount}
                          </TableCell>
                          <TableCell>{statement.importedBy ?? '-'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      ) : null}

      {/* 账户表单 */}
      <Dialog open={accountFormOpen} onOpenChange={setAccountFormOpen}>
        <DialogContent className="financial-modal max-w-lg border-[#2A2418] bg-[#11110E] text-[#FFF7E6] shadow-2xl ring-[#3A3428]">
          <DialogHeader>
            <DialogTitle className="text-[#FFF7E6]">{editingAccount ? `编辑 ${editingAccount.name}` : '新增银行账户'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className={labelClassName}>账户名称 *（如「汇丰 HKD 户口」）</Label>
              <Input value={accountForm.name} onChange={e => setAccountForm(f => ({ ...f, name: e.target.value }))} className={fieldClassName} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className={labelClassName}>银行名称</Label>
                <Input value={accountForm.bankName} onChange={e => setAccountForm(f => ({ ...f, bankName: e.target.value }))} className={fieldClassName} />
              </div>
              <div className="space-y-1.5">
                <Label className={labelClassName}>账号</Label>
                <Input
                  value={accountForm.accountNumber}
                  onChange={e => setAccountForm(f => ({ ...f, accountNumber: e.target.value }))}
                  className={fieldClassName}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className={labelClassName}>关联总账科目 *（银行存款类科目）</Label>
              <AccountCombobox
                value={accountForm.glAccountId}
                companyId={company.id}
                onChange={glAccountId => setAccountForm(f => ({ ...f, glAccountId }))}
                inputClassName={fieldClassName}
                placeholder="搜索银行存款、现金或科目编码..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className={secondaryButtonClassName} onClick={() => setAccountFormOpen(false)}>
              取消
            </Button>
            <Button onClick={() => void saveAccount()} disabled={saving} style={{ background: '#C9A96E', color: '#0A0805' }}>
              {saving ? '保存中...' : '保存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 新建对账 */}
      <Dialog open={reconFormOpen} onOpenChange={setReconFormOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>开始新对账</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>对账截止日期 *</Label>
              <Input type="date" value={reconDate} onChange={e => setReconDate(e.target.value)} style={inputStyle} />
            </div>
            <div className="space-y-1.5">
              <Label>银行对账单余额 *</Label>
              <Input type="number" step="0.01" value={reconBalance} onChange={e => setReconBalance(e.target.value)} style={inputStyle} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" style={{ borderColor: '#2A2418' }} onClick={() => setReconFormOpen(false)}>
              取消
            </Button>
            <Button onClick={() => void createRecon()} style={{ background: '#C9A96E', color: '#0A0805' }}>
              创建
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
