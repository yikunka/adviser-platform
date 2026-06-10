'use client'

/* eslint-disable react-hooks/set-state-in-effect */

import { type ChangeEvent, useCallback, useEffect, useRef, useState } from 'react'
import { Ban, Eye, Pencil, Trash2, Plus, CheckCircle, Upload, CheckSquare, Printer } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { JournalEntryForm, type JournalEntryForForm } from '@/components/admin/financial/JournalEntryForm'
import { JournalViewModal, type JournalEntryDetails } from '@/components/admin/financial/JournalViewModal'
import { FinancialBreadcrumbs } from '@/components/admin/financial/FinancialBreadcrumbs'
import { useFinancialCompany } from '@/components/admin/financial/FinancialCompanyContext'
import { formatJournalLineAccountLevels } from '@/lib/financial/account-hierarchy'

type JournalEntry = JournalEntryDetails &
  JournalEntryForForm & {
    id: string
    voucherNo: string
    date: string
    description: string
    companyId?: string | null
    status: 'DRAFT' | 'POSTED' | 'CANCELLED'
    totalAmount: number
    createdBy: string
    createdAt: string
  }

const STATUS_COLORS: Record<string, string> = {
  DRAFT: '#9CA3AF',
  POSTED: '#10b981',
  CANCELLED: '#ef4444',
}

const STATUS_LABELS: Record<JournalEntry['status'], string> = {
  DRAFT: '待过账',
  POSTED: '已过账',
  CANCELLED: '已取消',
}

type ImportError = {
  row: number
  message: string
}

type ImportResult = {
  imported: number
  rows?: number
  errors?: ImportError[]
  errorCount?: number
}

function money(value: number) {
  return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('zh-HK')
}

function JournalEntryPrintArea({
  entry,
  fallbackCompanyName,
}: {
  entry: JournalEntry | null
  fallbackCompanyName: string
}) {
  if (!entry) return null

  const companyName = entry.company?.nameEn || fallbackCompanyName
  const totalDebit = entry.lines.reduce((sum, line) => sum + line.debit, 0)
  const totalCredit = entry.lines.reduce((sum, line) => sum + line.credit, 0)

  return (
    <div className="journal-print-area" aria-hidden={!entry}>
      <div className="journal-print-voucher">
        <div className="journal-print-info">
          <div>
            <span>凭证号</span>
            <strong>{entry.voucherNo}</strong>
          </div>
          <div>
            <span>状态</span>
            <strong>{STATUS_LABELS[entry.status]}</strong>
          </div>
          <div>
            <span>公司名称</span>
            <strong>{companyName}</strong>
          </div>
          <div>
            <span>日期</span>
            <strong>{formatDate(entry.date)}</strong>
          </div>
          <div>
            <span>摘要</span>
            <strong>{entry.description}</strong>
          </div>
          <div>
            <span>创建人</span>
            <strong>{entry.createdBy || '系统'}</strong>
          </div>
        </div>

        <table className="journal-print-table">
          <thead>
            <tr>
              <th>行</th>
              <th>行摘要</th>
              <th>一级科目</th>
              <th>二级科目</th>
              <th>三级科目</th>
              <th>借贷方向</th>
              <th className="amount">金额</th>
              <th className="amount">借方</th>
              <th className="amount">贷方</th>
            </tr>
          </thead>
          <tbody>
            {entry.lines.map((line, index) => {
              const isDebit = line.debit > 0
              const amount = isDebit ? line.debit : line.credit
              const accountLevels = formatJournalLineAccountLevels(line.account ?? undefined)
              return (
                <tr key={`${entry.id}-${index}`}>
                  <td>{index + 1}</td>
                  <td>{line.description || '-'}</td>
                  <td>{accountLevels.level1}</td>
                  <td>{accountLevels.level2}</td>
                  <td>{accountLevels.level3}</td>
                  <td>{isDebit ? '借方' : '贷方'}</td>
                  <td className="amount">{money(amount)}</td>
                  <td className="amount">{line.debit > 0 ? money(line.debit) : '-'}</td>
                  <td className="amount">{line.credit > 0 ? money(line.credit) : '-'}</td>
                </tr>
              )
            })}
            <tr className="journal-print-total">
              <td colSpan={7}>合计</td>
              <td className="amount">{money(totalDebit)}</td>
              <td className="amount">{money(totalCredit)}</td>
            </tr>
          </tbody>
        </table>

        <div className="journal-print-footer">
          <div>制单：________________</div>
          <div>审核：________________</div>
          <div>打印日期：{formatDate(new Date().toISOString())}</div>
        </div>
      </div>
    </div>
  )
}

function JournalPrintStyles() {
  return (
    <style>{`
      .journal-print-area {
        display: none;
      }

      @media print {
        @page {
          size: A4 portrait;
          margin: 0;
        }

        html,
        body {
          margin: 0 !important;
          padding: 0 !important;
          background: #fff !important;
        }

        .admin-console {
          display: block !important;
          min-height: auto !important;
          background: #fff !important;
        }

        .admin-console > aside,
        .admin-console > .flex-1 > header,
        [data-slot="dialog-portal"],
        [data-slot="dialog-overlay"],
        [data-slot="dialog-content"] {
          display: none !important;
        }

        .admin-console > .flex-1 {
          display: block !important;
          min-width: 0 !important;
        }

        .admin-console main {
          display: block !important;
          padding: 0 !important;
          overflow: visible !important;
          background: #fff !important;
        }

        body * {
          visibility: hidden !important;
        }

        .journal-print-area,
        .journal-print-area * {
          visibility: visible !important;
        }

        .journal-print-area {
          display: block !important;
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          box-sizing: border-box;
          padding: 14mm;
          background: #fff !important;
          color: #111 !important;
          font-family: Arial, "Noto Sans SC", sans-serif;
        }

        .journal-print-voucher {
          color: #111;
          font-size: 11px;
        }

        .journal-print-info {
          display: grid;
          grid-template-columns: 1.35fr 0.65fr;
          gap: 8px 18px;
          margin-bottom: 14px;
          padding-bottom: 12px;
          border-bottom: 1px solid #111;
        }

        .journal-print-info div {
          display: grid;
          grid-template-columns: 58px 1fr;
          gap: 8px;
          min-height: 20px;
        }

        .journal-print-info span {
          color: #555;
        }

        .journal-print-table {
          width: 100%;
          border-collapse: collapse;
          table-layout: fixed;
        }

        .journal-print-table th,
        .journal-print-table td {
          border: 1px solid #111;
          padding: 7px 6px;
          vertical-align: top;
          word-break: break-word;
        }

        .journal-print-table th {
          background: #f1f1f1 !important;
          font-weight: 700;
          text-align: left;
        }

        .journal-print-table th:first-child,
        .journal-print-table td:first-child {
          width: 28px;
          text-align: center;
        }

        .journal-print-table .amount {
          text-align: right;
          white-space: nowrap;
        }

        .journal-print-total td {
          font-weight: 700;
          background: #f7f7f7 !important;
        }

        .journal-print-footer {
          display: flex;
          justify-content: space-between;
          gap: 24px;
          margin-top: 28px;
          font-size: 11px;
        }
      }
    `}</style>
  )
}

export default function AdminFinancialJournalPage() {
  const company = useFinancialCompany()
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [entries, setEntries] = useState<JournalEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [search, setSearch] = useState('')
  const [filterPeriod, setFilterPeriod] = useState('')
  const [filterStatus, setFilterStatus] = useState('ALL')
  const [page, setPage] = useState(1)
  const [formOpen, setFormOpen] = useState(false)
  const [viewOpen, setViewOpen] = useState(false)
  const [editingEntry, setEditingEntry] = useState<JournalEntry | null>(null)
  const [viewingEntry, setViewingEntry] = useState<JournalEntry | null>(null)
  const [printEntry, setPrintEntry] = useState<JournalEntry | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [batchPosting, setBatchPosting] = useState(false)
  const pageSize = 10

  const fetchEntries = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ companyId: company.id })
      if (filterPeriod) params.append('period', filterPeriod)
      if (filterStatus !== 'ALL') params.append('status', filterStatus)
      const res = await fetch(`/api/admin/financial/journal-entries?${params}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '载入日记账失败')
      setEntries(data.entries || [])
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '载入日记账失败')
    } finally {
      setLoading(false)
    }
  }, [company.id, filterPeriod, filterStatus])

  useEffect(() => {
    fetchEntries()
  }, [fetchEntries])

  useEffect(() => {
    setSelectedIds(new Set())
    setPage(1)
  }, [filterPeriod, filterStatus, search, company.id])

  useEffect(() => {
    if (!printEntry) return
    const timer = window.setTimeout(() => window.print(), 100)
    return () => window.clearTimeout(timer)
  }, [printEntry])

  useEffect(() => {
    function clearPrintedEntry() {
      setPrintEntry(null)
    }

    window.addEventListener('afterprint', clearPrintedEntry)
    return () => window.removeEventListener('afterprint', clearPrintedEntry)
  }, [])

  function printJournalEntry(entry: JournalEntry) {
    setPrintEntry(null)
    window.setTimeout(() => setPrintEntry(entry), 0)
  }

  async function handleFormSaved(entry?: JournalEntryForForm, options?: { print?: boolean }) {
    await fetchEntries()
    if (options?.print && entry) {
      printJournalEntry(entry as JournalEntry)
    }
  }

  function openCreateForm() {
    setEditingEntry(null)
    setFormOpen(true)
  }

  function openEditForm(entry: JournalEntry) {
    setEditingEntry(entry)
    setFormOpen(true)
  }

  function openViewModal(entry: JournalEntry) {
    setViewingEntry(entry)
    setViewOpen(true)
  }

  async function postEntry(entry: JournalEntry) {
    if (!confirm(`确定审核并过账日记账 ${entry.voucherNo}？过账后会生成总账记录，不能撤销。`))
      return

    try {
      const res = await fetch(`/api/admin/financial/journal-entries/${entry.id}/post`, { method: 'PUT' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.toast || data.error || '日记账过账失败。')
      toast.success(data.toast || '日记账已过账。')
      await fetchEntries()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '日记账过账失败。')
    }
  }

  async function batchPostEntries() {
    const draftIds = [...selectedIds].filter(id => {
      const entry = entries.find(row => row.id === id)
      return entry?.status === 'DRAFT'
    })
    if (draftIds.length === 0) {
      toast.error('请至少选择一条待过账日记账。')
      return
    }
    if (
      !confirm(
        `确定批量过账 ${draftIds.length} 条日记账？过账后会生成总账记录，不能撤销。`,
      )
    )
      return

    setBatchPosting(true)
    try {
      const res = await fetch('/api/admin/financial/journal-entries/batch-post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: draftIds }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.toast || data.error || '批量过账失败。')
      if (data.errors?.length) {
        toast.warning(data.toast || `已成功过账 ${data.posted?.length ?? 0} 条，部分失败。`)
      } else {
        toast.success(data.toast || `已成功过账 ${data.posted?.length ?? draftIds.length} 条日记账。`)
      }
      setSelectedIds(new Set())
      await fetchEntries()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '批量过账失败。')
    } finally {
      setBatchPosting(false)
    }
  }

  function toggleSelectEntry(id: string) {
    setSelectedIds(current => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function cancelEntry(entry: JournalEntry) {
    if (!confirm(`确定取消日记账 ${entry.voucherNo}？`)) return

    try {
      const res = await fetch(`/api/admin/financial/journal-entries/${entry.id}`, { method: 'DELETE' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.toast || data.error || '取消日记账失败。')
      toast.success(data.toast || '日记账已取消。')
      await fetchEntries()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '取消日记账失败。')
    }
  }

  async function hardDeleteEntry(entry: JournalEntry) {
    if (!confirm(`确定彻底删除日记账 ${entry.voucherNo}？此操作会永久删除记录和分录，不能恢复。`)) return

    try {
      const res = await fetch(`/api/admin/financial/journal-entries/${entry.id}/hard-delete`, { method: 'DELETE' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.toast || data.error || '彻底删除日记账失败。')
      toast.success(data.toast || '日记账已彻底删除。')
      await fetchEntries()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '彻底删除日记账失败。')
    }
  }

  async function importExcel(file: File) {
    setImporting(true)
    setImportResult(null)
    try {
      const formData = new FormData()
      formData.append('companyId', company.id)
      formData.append('file', file)

      const res = await fetch('/api/admin/financial/journal-entries/import', {
        method: 'POST',
        body: formData,
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setImportResult({
          imported: 0,
          errors: Array.isArray(data.errors) ? data.errors : [{ row: 0, message: data.toast || data.error || '导入失败。' }],
          errorCount: Number(data.errorCount ?? data.errors?.length ?? 1),
        })
        throw new Error(data.toast || data.error || '导入失败。')
      }

      setImportResult({ imported: data.imported ?? 0, rows: data.rows ?? 0 })
      toast.success(data.toast || `已导入 ${data.imported ?? 0} 条待过账日记账。`)
      await fetchEntries()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '导入日记账失败。')
    } finally {
      setImporting(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  function handleImportFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    void importExcel(file)
  }

  const filtered = entries.filter(
    e =>
      (e.voucherNo.toLowerCase().includes(search.toLowerCase()) ||
        e.description.toLowerCase().includes(search.toLowerCase())) &&
      (filterStatus === 'ALL' || e.status === filterStatus) &&
      (!filterPeriod || e.date.startsWith(filterPeriod)),
  )

  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize)
  const totalPages = Math.ceil(filtered.length / pageSize)
  const draftOnPage = paginated.filter(entry => entry.status === 'DRAFT')
  const allDraftOnPageSelected =
    draftOnPage.length > 0 && draftOnPage.every(entry => selectedIds.has(entry.id))
  const selectedDraftCount = [...selectedIds].filter(id => {
    const entry = entries.find(row => row.id === id)
    return entry?.status === 'DRAFT'
  }).length

  function toggleSelectAllDraftOnPage() {
    setSelectedIds(current => {
      const next = new Set(current)
      if (allDraftOnPageSelected) {
        draftOnPage.forEach(entry => next.delete(entry.id))
      } else {
        draftOnPage.forEach(entry => next.add(entry.id))
      }
      return next
    })
  }

  return (
    <div className="p-6 space-y-6">
      <div className="space-y-2">
        <FinancialBreadcrumbs section="日记账" />
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>
              日记账
            </h1>
            <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
              {company.nameEn} · 创建和管理会计凭证。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={handleImportFile}
              disabled={importing}
            />
            <Button
              size="sm"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
              style={{ borderColor: '#2A2418' }}
            >
              <Upload size={15} className="mr-2" /> {importing ? '导入中...' : '导入 Excel'}
            </Button>
            {selectedDraftCount > 0 ? (
              <Button
                size="sm"
                onClick={() => void batchPostEntries()}
                disabled={batchPosting}
                style={{ background: '#10b981', color: '#fff' }}
              >
                <CheckSquare size={15} className="mr-2" />
                {batchPosting ? '过账中...' : `批量过账 (${selectedDraftCount})`}
              </Button>
            ) : null}
            <Button size="sm" onClick={openCreateForm} style={{ background: '#C9A96E', color: '#0A0805' }}>
              <Plus size={15} className="mr-2" /> 新增日记账
            </Button>
          </div>
        </div>
      </div>

      <Card className="rounded-lg border-[#2A2418] bg-card">
        <CardHeader className="pb-4">
          <div className="flex flex-wrap items-center gap-4">
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="搜索凭证号或摘要..."
              className="max-w-xs"
              style={{ background: '#0E0E0A', border: '1px solid #2A2418' }}
            />
            <Input
              type="month"
              value={filterPeriod}
              onChange={e => setFilterPeriod(e.target.value)}
              className="max-w-[160px]"
              style={{ background: '#0E0E0A', border: '1px solid #2A2418' }}
            />
            <Select value={filterStatus} onValueChange={value => setFilterStatus(value ?? 'ALL')}>
              <SelectTrigger className="w-[140px]" style={{ background: '#0E0E0A', border: '1px solid #2A2418' }}>
                <SelectValue placeholder="全部状态" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">全部状态</SelectItem>
                <SelectItem value="DRAFT">待过账</SelectItem>
                <SelectItem value="POSTED">已过账</SelectItem>
                <SelectItem value="CANCELLED">已取消</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="mt-3 text-xs" style={{ color: 'var(--muted-foreground)' }}>
            Excel 导入支持三种格式：逐行分录（Voucher No、Date、Description、Account Code、Debit、Credit）；
            按科目名称（Date、Account、Particular、Debit、Credit，Account 无法匹配时整条导入记录失败）；
            借贷配对行（Date、Description、Debit Account Code、Credit Account Code、Amount）。导入后保存为待过账。
          </div>
          {importResult ? (
            <div
              className="mt-3 rounded-md border px-3 py-2 text-xs"
              style={{
                borderColor: importResult.errors?.length ? '#ef4444' : '#2A2418',
                color: importResult.errors?.length ? '#fecaca' : '#C9A96E',
                background: importResult.errors?.length ? 'rgba(239,68,68,0.08)' : 'rgba(201,169,110,0.08)',
              }}
            >
              {importResult.errors?.length ? (
                <div className="space-y-1">
                  <p className="font-medium">导入失败，共 {importResult.errorCount ?? importResult.errors.length} 个错误。</p>
                  {importResult.errors.slice(0, 8).map((error, index) => (
                    <p key={`${error.row}-${index}`}>
                      第 {error.row || '-'} 行：{error.message}
                    </p>
                  ))}
                </div>
              ) : (
                <p>已从 {importResult.rows ?? 0} 行 Excel 数据导入 {importResult.imported} 条待过账日记账。</p>
              )}
            </div>
          ) : null}
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="p-8 text-center" style={{ color: 'var(--muted-foreground)' }}>
              载入中...
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center" style={{ color: '#5A5040' }}>
              暂无日记账
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40px]">
                      <input
                        type="checkbox"
                        checked={allDraftOnPageSelected}
                        onChange={toggleSelectAllDraftOnPage}
                        disabled={draftOnPage.length === 0}
                        aria-label="全选本页待过账"
                        className="cursor-pointer"
                      />
                    </TableHead>
                    <TableHead>凭证号</TableHead>
                    <TableHead>日期</TableHead>
                    <TableHead>摘要</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead className="text-right">金额合计</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginated.map(entry => (
                    <TableRow key={entry.id}>
                      <TableCell>
                        {entry.status === 'DRAFT' ? (
                          <input
                            type="checkbox"
                            checked={selectedIds.has(entry.id)}
                            onChange={() => toggleSelectEntry(entry.id)}
                            aria-label={`选择 ${entry.voucherNo}`}
                            className="cursor-pointer"
                          />
                        ) : null}
                      </TableCell>
                      <TableCell className="font-mono">{entry.voucherNo}</TableCell>
                      <TableCell>{new Date(entry.date).toLocaleDateString('zh-HK')}</TableCell>
                      <TableCell className="max-w-[240px] truncate">{entry.description}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          style={{ borderColor: STATUS_COLORS[entry.status], color: STATUS_COLORS[entry.status] }}
                        >
                          {entry.status === 'DRAFT' ? '待过账' : entry.status === 'POSTED' ? '已过账' : '已取消'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">{entry.totalAmount.toLocaleString()}</TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => openViewModal(entry)}>
                          <Eye size={15} className="text-muted-foreground" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          title="打印凭证"
                          onClick={() => printJournalEntry(entry)}
                        >
                          <Printer size={15} className="text-muted-foreground" />
                        </Button>
                        {entry.status === 'DRAFT' ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 hover:text-emerald-500"
                            title="审核并过账"
                            onClick={() => postEntry(entry)}
                          >
                            <CheckCircle size={15} />
                          </Button>
                        ) : null}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => openEditForm(entry)}
                          disabled={entry.status !== 'DRAFT'}
                        >
                          <Pencil size={15} className="text-muted-foreground" />
                        </Button>
                        {entry.status === 'CANCELLED' ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 hover:text-red-500"
                            title="彻底删除"
                            onClick={() => hardDeleteEntry(entry)}
                          >
                            <Trash2 size={15} />
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 hover:text-red-500"
                            title="取消日记账"
                            onClick={() => cancelEntry(entry)}
                          >
                            <Ban size={15} />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <div className="flex items-center justify-between mt-4 px-2">
                <div className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                  显示第 {(page - 1) * pageSize + 1} 至 {Math.min(page * pageSize, filtered.length)} 项，共{' '}
                  {filtered.length} 条日记账
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    style={{ borderColor: '#2A2418' }}
                  >
                    上一页
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    style={{ borderColor: '#2A2418' }}
                  >
                    下一页
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <JournalEntryForm
        open={formOpen}
        onOpenChange={setFormOpen}
        entry={editingEntry}
        fixedCompanyId={company.id}
        onSaved={handleFormSaved}
        onContinued={() => setEditingEntry(null)}
      />
      <JournalViewModal
        open={viewOpen}
        onOpenChange={setViewOpen}
        entry={viewingEntry}
        onPosted={fetchEntries}
        onPrint={entry => printJournalEntry(entry as JournalEntry)}
      />
      <JournalEntryPrintArea entry={printEntry} fallbackCompanyName={company.nameEn} />
      <JournalPrintStyles />
    </div>
  )
}
