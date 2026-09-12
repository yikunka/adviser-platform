'use client'

/* eslint-disable react-hooks/set-state-in-effect */

import { type ChangeEvent, useCallback, useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Download, Edit3, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { Link } from '@/i18n/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

type InvoiceRow = {
  id: string
  invoiceNumber: string
  status: string
  issueDate: string
  dueDate?: string | null
  total: string
  currency: string
  billToName: string
  customerType: 'COMPANY' | 'INDIVIDUAL'
  company?: { id: string; nameEn: string; companyCode?: string | null } | null
  keyPerson?: { id: string; nameEn: string; kycCode?: string | null } | null
}

type HistoricalInvoiceFile = {
  id: string
  title: string
  fileName: string
  fileSize: number
  notes: string
  createdAt: string
  uploadedBy: string
}

const STATUS_COLOR: Record<string, string> = {
  DRAFT: 'bg-[rgba(120,113,108,0.15)] text-[#9A8060]',
  SENT: 'bg-[rgba(59,130,246,0.12)] text-[#3b82f6]',
  PAID: 'bg-[rgba(16,185,129,0.12)] text-[#10b981]',
  CANCELLED: 'bg-[rgba(239,68,68,0.12)] text-[#ef4444]',
}

function fileSizeLabel(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export default function InvoicesPage() {
  const t = useTranslations('admin.invoices')
  const historyFileRef = useRef<HTMLInputElement | null>(null)
  const [invoices, setInvoices] = useState<InvoiceRow[]>([])
  const [historicalFiles, setHistoricalFiles] = useState<HistoricalInvoiceFile[]>([])
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyUploading, setHistoryUploading] = useState(false)
  const [historyUploadOpen, setHistoryUploadOpen] = useState(false)
  const [historyUploadFile, setHistoryUploadFile] = useState<File | null>(null)
  const [historyUploadNotes, setHistoryUploadNotes] = useState('')
  const [editingHistoryFileId, setEditingHistoryFileId] = useState<string | null>(null)
  const [historyNoteDrafts, setHistoryNoteDrafts] = useState<Record<string, string>>({})
  const [historySavingId, setHistorySavingId] = useState<string | null>(null)

  const fetchInvoices = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page) })
      if (search) params.set('q', search)
      if (status) params.set('status', status)
      const res = await fetch(`/api/admin/invoices?${params}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed')
      setInvoices(json.invoices ?? [])
      setTotal(json.total ?? 0)
    } catch {
      toast.error(t('loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [search, status, page, t])

  useEffect(() => {
    fetchInvoices()
  }, [fetchInvoices])

  const fetchHistoricalFiles = useCallback(async () => {
    setHistoryLoading(true)
    try {
      const res = await fetch('/api/admin/invoices/history')
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.toast || json.error || '载入历史发票失败。')
      const files = Array.isArray(json.files) ? json.files : []
      setHistoricalFiles(files)
      setHistoryNoteDrafts(Object.fromEntries(
        files.map((file: HistoricalInvoiceFile) => [file.id, file.notes ?? '']),
      ))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '载入历史发票失败。')
    } finally {
      setHistoryLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchHistoricalFiles()
  }, [fetchHistoricalFiles])

  async function uploadHistoricalInvoice() {
    if (!historyUploadFile) {
      toast.error('请选择历史发票 PDF 文件。')
      return
    }
    setHistoryUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', historyUploadFile)
      formData.append('notes', historyUploadNotes)
      const res = await fetch('/api/admin/invoices/history', {
        method: 'POST',
        body: formData,
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.toast || json.error || '上传历史发票失败。')
      toast.success(json.toast || '历史发票已上传。')
      setHistoryUploadOpen(false)
      setHistoryUploadFile(null)
      setHistoryUploadNotes('')
      await fetchHistoricalFiles()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '上传历史发票失败。')
    } finally {
      setHistoryUploading(false)
      if (historyFileRef.current) historyFileRef.current.value = ''
    }
  }

  function handleHistoryFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    setHistoryUploadFile(file)
  }

  async function saveHistoricalInvoiceNotes(file: HistoricalInvoiceFile) {
    const notes = historyNoteDrafts[file.id] ?? ''
    setHistorySavingId(file.id)
    try {
      const res = await fetch(`/api/admin/invoices/history/${file.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.toast || json.error || '保存备注失败。')
      const updatedFile = json.file as HistoricalInvoiceFile
      setHistoricalFiles(current => current.map(row => row.id === file.id ? updatedFile : row))
      setHistoryNoteDrafts(current => ({ ...current, [file.id]: updatedFile.notes ?? '' }))
      setEditingHistoryFileId(null)
      toast.success(json.toast || '历史发票备注已更新。')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '保存备注失败。')
    } finally {
      setHistorySavingId(null)
    }
  }

  async function downloadHistoricalInvoice(file: HistoricalInvoiceFile) {
    try {
      const res = await fetch(`/api/admin/invoices/history/${file.id}/download`)
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.toast || json.error || '生成下载链接失败。')
      window.location.assign(json.url)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '下载历史发票失败。')
    }
  }

  const pages = Math.max(1, Math.ceil(total / 20))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>
          {t('title')}
        </h1>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => setHistoryUploadOpen(true)}
            disabled={historyUploading}
          >
            <Upload size={15} className="mr-2" />
            {historyUploading ? '上传中...' : '添加历史发票'}
          </Button>
          <Link href="/admin/invoices/new">
            <Button>{t('create')}</Button>
          </Link>
        </div>
      </div>

      <Dialog
        open={historyUploadOpen}
        onOpenChange={open => {
          setHistoryUploadOpen(open)
          if (!open) {
            setHistoryUploadFile(null)
            setHistoryUploadNotes('')
            if (historyFileRef.current) historyFileRef.current.value = ''
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>添加历史发票</DialogTitle>
            <DialogDescription>
              上传 PDF 历史发票文件，可同时填写备注。文件只作为档案保存。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>
                PDF 文件
              </label>
              <input
                ref={historyFileRef}
                type="file"
                accept="application/pdf,.pdf"
                onChange={handleHistoryFileChange}
                disabled={historyUploading}
                className="block w-full rounded-md border border-[var(--border-subtle)] bg-[var(--surface)] px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>
                备注
              </label>
              <Textarea
                value={historyUploadNotes}
                onChange={event => setHistoryUploadNotes(event.target.value)}
                maxLength={1000}
                rows={4}
                placeholder="例如：客户提供的旧账单、付款状态、对应期间等"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              type="button"
              onClick={() => setHistoryUploadOpen(false)}
              disabled={historyUploading}
            >
              取消
            </Button>
            <Button
              type="button"
              onClick={() => void uploadHistoricalInvoice()}
              disabled={historyUploading || !historyUploadFile}
            >
              {historyUploading ? '上传中...' : '上传'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="flex gap-2 flex-wrap">
        <Input
          placeholder={t('search')}
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1) }}
          className="max-w-xs"
        />
        <select
          value={status}
          onChange={e => { setStatus(e.target.value); setPage(1) }}
          className="max-w-xs rounded-md px-3 py-2 text-sm"
          style={{ background: 'var(--surface)', border: '1px solid var(--border-subtle)', color: 'var(--text-cream)' }}
        >
          <option value="">{t('allStatuses')}</option>
          {(['DRAFT', 'SENT', 'PAID', 'CANCELLED'] as const).map(s => (
            <option key={s} value={s}>{t(`statuses.${s}`)}</option>
          ))}
        </select>
      </div>

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead style={{ background: 'var(--surface-panel)', borderBottom: '1px solid var(--border-subtle)' }}>
              <tr>
                <th className="px-4 py-3 text-left font-medium" style={{ color: 'var(--muted-foreground)' }}>{t('invoiceNumber')}</th>
                <th className="px-4 py-3 text-left font-medium" style={{ color: 'var(--muted-foreground)' }}>{t('customer')}</th>
                <th className="px-4 py-3 text-left font-medium" style={{ color: 'var(--muted-foreground)' }}>{t('billTo')}</th>
                <th className="px-4 py-3 text-left font-medium" style={{ color: 'var(--muted-foreground)' }}>{t('issueDate')}</th>
                <th className="px-4 py-3 text-left font-medium" style={{ color: 'var(--muted-foreground)' }}>{t('total')}</th>
                <th className="px-4 py-3 text-left font-medium" style={{ color: 'var(--muted-foreground)' }}>{t('status')}</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">
              {loading ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center" style={{ color: 'var(--muted-foreground)' }}>{t('loading')}</td></tr>
              ) : invoices.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center" style={{ color: 'var(--muted-foreground)' }}>{t('empty')}</td></tr>
              ) : invoices.map(inv => (
                <tr key={inv.id} className="hover:bg-[var(--surface-panel)]/50">
                  <td className="px-4 py-3 font-mono text-xs">{inv.invoiceNumber}</td>
                  <td className="px-4 py-3">
                    <div>{inv.company?.nameEn ?? inv.keyPerson?.nameEn ?? inv.billToName}</div>
                    <div className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                      {inv.customerType === 'COMPANY'
                        ? (inv.company?.companyCode ?? t('companyCustomer'))
                        : (inv.keyPerson?.kycCode ?? t('individualCustomer'))}
                    </div>
                    {inv.customerType === 'INDIVIDUAL' && (
                      <span className="mt-1 inline-flex px-1.5 py-0.5 rounded text-[11px] bg-[rgba(201,169,110,0.12)] text-[#C9A96E]">
                        {t('individualCustomer')}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">{inv.billToName}</td>
                  <td className="px-4 py-3">{new Date(inv.issueDate).toLocaleDateString()}</td>
                  <td className="px-4 py-3">{inv.currency} {Number(inv.total).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLOR[inv.status] ?? ''}`}>
                      {t(`statuses.${inv.status}` as 'statuses.DRAFT')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/admin/invoices/${inv.id}`}>
                      <Button variant="outline" size="sm">{t('view')}</Button>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {pages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>{t('prev')}</Button>
          <span className="text-sm" style={{ color: 'var(--muted-foreground)' }}>{page} / {pages}</span>
          <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage(p => p + 1)}>{t('next')}</Button>
        </div>
      )}

      <Card>
        <CardContent className="p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>历史发票文件</h2>
              <p className="mt-1 text-xs" style={{ color: 'var(--muted-foreground)' }}>
                上传的 PDF 仅作为历史发票档案保存，不影响现有发票编号和状态。
              </p>
            </div>
          </div>
          {historyLoading ? (
            <div className="py-4 text-sm" style={{ color: 'var(--muted-foreground)' }}>载入中...</div>
          ) : historicalFiles.length === 0 ? (
            <div className="py-4 text-sm" style={{ color: 'var(--muted-foreground)' }}>暂无历史发票文件</div>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {historicalFiles.map(file => (
                <div key={file.id} className="rounded-md border border-[var(--border-subtle)] bg-[var(--surface-input)] p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{file.title}</p>
                      <p className="mt-1 truncate text-xs" style={{ color: 'var(--muted-foreground)' }}>
                        {file.fileName} · {fileSizeLabel(file.fileSize)}
                      </p>
                      <p className="mt-1 text-xs" style={{ color: 'var(--muted-foreground)' }}>
                        {new Date(file.createdAt).toLocaleString()} · {file.uploadedBy}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 shrink-0 p-0"
                      title="下载历史发票"
                      onClick={() => void downloadHistoricalInvoice(file)}
                    >
                      <Download size={15} />
                    </Button>
                  </div>
                  <div className="mt-3 border-t border-[var(--border-subtle)] pt-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <p className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>备注</p>
                      {editingHistoryFileId === file.id ? (
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setHistoryNoteDrafts(current => ({ ...current, [file.id]: file.notes ?? '' }))
                              setEditingHistoryFileId(null)
                            }}
                            disabled={historySavingId === file.id}
                          >
                            取消
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => void saveHistoricalInvoiceNotes(file)}
                            disabled={historySavingId === file.id}
                          >
                            {historySavingId === file.id ? '保存中...' : '保存'}
                          </Button>
                        </div>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingHistoryFileId(file.id)}
                        >
                          <Edit3 size={14} className="mr-1" />
                          编辑
                        </Button>
                      )}
                    </div>
                    {editingHistoryFileId === file.id ? (
                      <Textarea
                        value={historyNoteDrafts[file.id] ?? ''}
                        onChange={event => setHistoryNoteDrafts(current => ({ ...current, [file.id]: event.target.value }))}
                        maxLength={1000}
                        rows={3}
                        placeholder="填写此历史发票的备注"
                      />
                    ) : (
                      <p className="whitespace-pre-wrap text-xs leading-5" style={{ color: file.notes ? 'var(--foreground)' : 'var(--muted-foreground)' }}>
                        {file.notes || '暂无备注'}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
