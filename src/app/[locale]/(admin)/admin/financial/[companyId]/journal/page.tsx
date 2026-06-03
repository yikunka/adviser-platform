'use client'

/* eslint-disable react-hooks/set-state-in-effect */

import { type ChangeEvent, useCallback, useEffect, useRef, useState } from 'react'
import { Ban, Eye, Pencil, Trash2, Plus, CheckCircle, Upload } from 'lucide-react'
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
        onSaved={fetchEntries}
        onContinued={() => setEditingEntry(null)}
      />
      <JournalViewModal open={viewOpen} onOpenChange={setViewOpen} entry={viewingEntry} onPosted={fetchEntries} />
    </div>
  )
}
