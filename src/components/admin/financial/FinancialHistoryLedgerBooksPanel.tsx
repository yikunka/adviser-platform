'use client'

/* eslint-disable react-hooks/set-state-in-effect */

import { type ChangeEvent, useCallback, useEffect, useRef, useState } from 'react'
import { Download, FileSpreadsheet, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { FinancialBreadcrumbs } from '@/components/admin/financial/FinancialBreadcrumbs'
import { useFinancialCompany } from '@/components/admin/financial/FinancialCompanyContext'

type SheetPreview = {
  name: string
  rowCount: number
  columnCount: number
  headers: string[]
  previewRows: string[][]
}

type HistoryBook = {
  id: string
  title: string
  fileName: string
  fileSize: number
  sheets: SheetPreview[]
  notes: string
  createdAt: string
  uploadedBy: string
}

function fileSizeLabel(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export function FinancialHistoryLedgerBooksPanel() {
  const company = useFinancialCompany()
  const readOnly = company.financialReadOnly ?? false
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [books, setBooks] = useState<HistoryBook[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [title, setTitle] = useState('')
  const [notes, setNotes] = useState('')

  const fetchBooks = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/financial/history-ledger-books?companyId=${company.id}`)
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.toast || data.error || '载入历史账套失败。')
      setBooks(Array.isArray(data.books) ? data.books : [])
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '载入历史账套失败。')
    } finally {
      setLoading(false)
    }
  }, [company.id])

  useEffect(() => {
    fetchBooks()
  }, [fetchBooks])

  async function uploadBook(file: File) {
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('companyId', company.id)
      formData.append('file', file)
      formData.append('title', title)
      formData.append('notes', notes)

      const res = await fetch('/api/admin/financial/history-ledger-books', {
        method: 'POST',
        body: formData,
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.toast || data.error || '上传历史账套失败。')
      toast.success(data.toast || '历史账套已上传。')
      setTitle('')
      setNotes('')
      await fetchBooks()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '上传历史账套失败。')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    void uploadBook(file)
  }

  async function downloadBook(book: HistoryBook) {
    try {
      const res = await fetch(`/api/admin/financial/history-ledger-books/${book.id}/download`)
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.toast || data.error || '生成下载链接失败。')
      window.location.assign(data.url)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '下载历史账套失败。')
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="space-y-2">
        <FinancialBreadcrumbs section="历史账套" />
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>
              历史账套
            </h1>
            <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
              {company.nameEn} · Excel 历史账套档案仅用于查看和下载，不导入当前会计期间。
            </p>
          </div>
        </div>
      </div>

      {!readOnly ? (
        <Card className="rounded-lg border-[var(--border-subtle)] bg-card">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2 text-sm font-medium text-[#C9A96E]">
              <Upload size={16} />
              上传历史账套 Excel
            </div>
          </CardHeader>
          <CardContent className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_auto]">
            <Input
              value={title}
              onChange={event => setTitle(event.target.value)}
              placeholder="档案标题（可选）"
              style={{ background: 'var(--surface-input)', border: '1px solid var(--border-subtle)' }}
            />
            <Textarea
              value={notes}
              onChange={event => setNotes(event.target.value)}
              placeholder="备注（可选）"
              className="min-h-[40px]"
              style={{ background: 'var(--surface-input)', border: '1px solid var(--border-subtle)' }}
            />
            <div className="flex items-start">
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={handleFileChange}
                disabled={uploading}
              />
              <Button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                style={{ background: '#C9A96E', color: '#0A0805' }}
              >
                <FileSpreadsheet size={15} className="mr-2" />
                {uploading ? '上传中...' : '选择 Excel'}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-lg border border-[#C9A96E55] bg-[#C9A96E14] px-4 py-3 text-sm" style={{ color: 'var(--text-label)' }}>
          Staff 账号可查看和下载历史账套，不能上传新的历史账套档案。
        </div>
      )}

      <Card className="rounded-lg border-[var(--border-subtle)] bg-card">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2 text-sm font-medium text-[#C9A96E]">
            <FileSpreadsheet size={16} />
            已上传档案
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">载入中...</div>
          ) : books.length === 0 ? (
            <div className="p-8 text-center" style={{ color: '#5A5040' }}>
              暂无历史账套档案
            </div>
          ) : (
            <div className="space-y-4">
              {books.map(book => (
                <div key={book.id} className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-input)] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold">{book.title}</h3>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {book.fileName} · {fileSizeLabel(book.fileSize)} · {new Date(book.createdAt).toLocaleString('zh-HK')} · {book.uploadedBy}
                      </p>
                      {book.notes ? <p className="mt-2 text-sm text-muted-foreground">{book.notes}</p> : null}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void downloadBook(book)}
                      style={{ borderColor: 'var(--border-subtle)' }}
                    >
                      <Download size={15} className="mr-2" />
                      下载原文件
                    </Button>
                  </div>
                  <div className="mt-4 overflow-x-auto rounded-md border border-[var(--border-subtle)]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>工作表</TableHead>
                          <TableHead className="text-right">行数</TableHead>
                          <TableHead className="text-right">列数</TableHead>
                          <TableHead>表头预览</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {book.sheets.map(sheet => (
                          <TableRow key={`${book.id}-${sheet.name}`}>
                            <TableCell>{sheet.name}</TableCell>
                            <TableCell className="text-right font-mono">{sheet.rowCount}</TableCell>
                            <TableCell className="text-right font-mono">{sheet.columnCount}</TableCell>
                            <TableCell className="max-w-[460px] truncate text-muted-foreground">
                              {sheet.headers.filter(Boolean).join(' / ') || '-'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
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
