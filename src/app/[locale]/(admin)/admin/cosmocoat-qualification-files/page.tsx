'use client'

/* eslint-disable react-hooks/set-state-in-effect */

import { type ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Download, Eye, FileText, Pencil, Plus, Search, ShieldCheck, Trash2, Upload } from 'lucide-react'

type QualificationFileRow = {
  id: string
  title: string
  documentType: string
  fileName: string
  storageKey: string
  mimeType: string
  fileSize: number
  notes: string | null
  createdAt: string
  updatedAt: string
  uploadedBy: { nameEn: string | null; email: string } | null
}

type FormState = {
  title: string
  documentType: string
  notes: string
}

const card: React.CSSProperties = {
  background: 'var(--card)',
  border: '1px solid var(--border)',
  borderRadius: '0.75rem',
}

const th: React.CSSProperties = {
  textAlign: 'left',
  padding: '0.75rem 1rem',
  fontWeight: 500,
  fontSize: '0.8125rem',
  color: 'var(--muted-foreground)',
  background: '#111108',
  borderBottom: '1px solid #2A2418',
  whiteSpace: 'nowrap',
}

const td: React.CSSProperties = {
  padding: '0.75rem 1rem',
  fontSize: '0.875rem',
  color: 'var(--muted-foreground)',
  borderBottom: '1px solid #1E1C15',
  verticalAlign: 'top',
}

function inputStyle(): React.CSSProperties {
  return {
    background: '#0E0E0A',
    border: '1px solid #2A2418',
    color: 'var(--foreground)',
  }
}

function fileUrl(storageKey: string, fileName?: string, download = false) {
  const params = new URLSearchParams({ key: storageKey })
  if (fileName) params.set('filename', fileName)
  if (download) params.set('download', '1')
  return `/api/files?${params.toString()}`
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function isImageFile(file: Pick<QualificationFileRow, 'mimeType' | 'fileName'>) {
  return file.mimeType.startsWith('image/') || /\.(jpe?g|png|webp)$/i.test(file.fileName)
}

function isPdfFile(file: Pick<QualificationFileRow, 'mimeType' | 'fileName'>) {
  return file.mimeType === 'application/pdf' || /\.pdf$/i.test(file.fileName)
}

function defaultFormState(): FormState {
  return { title: '', documentType: '', notes: '' }
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>{label}</label>
      {hint ? <p className="text-[11px]" style={{ color: '#756A58' }}>{hint}</p> : null}
      {children}
    </div>
  )
}

export default function AdminCosmoCoatQualificationFilesPage() {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const editFileInputRef = useRef<HTMLInputElement | null>(null)
  const [items, setItems] = useState<QualificationFileRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [previewItem, setPreviewItem] = useState<QualificationFileRow | null>(null)
  const [form, setForm] = useState<FormState>(defaultFormState())
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [editingItem, setEditingItem] = useState<QualificationFileRow | null>(null)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const selectedFileLabel = useMemo(() => selectedFile ? `${selectedFile.name} · ${formatFileSize(selectedFile.size)}` : '', [selectedFile])

  const fetchItems = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' })
      if (search.trim()) params.set('q', search.trim())
      const res = await fetch(`/api/admin/cosmocoat/qualification-files?${params}`)
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? '加载文件列表失败')
      setItems(Array.isArray(data.items) ? data.items : [])
      setTotal(data.total ?? 0)
      setTotalPages(data.totalPages ?? 1)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '加载文件列表失败')
    } finally {
      setLoading(false)
    }
  }, [page, search])

  useEffect(() => {
    const timer = setTimeout(fetchItems, search ? 300 : 0)
    return () => clearTimeout(timer)
  }, [fetchItems, search])

  useEffect(() => {
    setPage(1)
  }, [search])

  function resetModalState() {
    setForm(defaultFormState())
    setSelectedFile(null)
    setEditingItem(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
    if (editFileInputRef.current) editFileInputRef.current.value = ''
  }

  function openCreateModal() {
    resetModalState()
    setModalOpen(true)
  }

  function openEditModal(item: QualificationFileRow) {
    setForm({
      title: item.title,
      documentType: item.documentType,
      notes: item.notes ?? '',
    })
    setSelectedFile(null)
    setEditingItem(item)
    if (fileInputRef.current) fileInputRef.current.value = ''
    if (editFileInputRef.current) editFileInputRef.current.value = ''
    setModalOpen(true)
  }

  function closeModal() {
    if (saving) return
    setModalOpen(false)
    resetModalState()
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null
    setSelectedFile(file)
  }

  async function saveItem() {
    if (!form.title.trim()) {
      toast.error('请输入文件标题')
      return
    }
    if (!form.documentType.trim()) {
      toast.error('请输入资质类型')
      return
    }
    if (!editingItem && !selectedFile) {
      toast.error('请先选择要上传的文件')
      return
    }

    setSaving(true)
    try {
      const body = new FormData()
      body.append('title', form.title.trim())
      body.append('documentType', form.documentType.trim())
      if (form.notes.trim()) body.append('notes', form.notes.trim())
      if (selectedFile) body.append('file', selectedFile)

      const res = await fetch(
        editingItem
          ? `/api/admin/cosmocoat/qualification-files/${editingItem.id}`
          : '/api/admin/cosmocoat/qualification-files',
        {
          method: editingItem ? 'PATCH' : 'POST',
          body,
        },
      )
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? '保存失败')

      toast.success(editingItem ? '资质文件已更新' : '资质文件已上传')
      closeModal()
      await fetchItems()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  async function deleteItem(item: QualificationFileRow) {
    if (!window.confirm(`确定删除资质文件「${item.title}」？`)) return
    setDeletingId(item.id)
    try {
      const res = await fetch(`/api/admin/cosmocoat/qualification-files/${item.id}`, { method: 'DELETE' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? '删除失败')
      toast.success('资质文件已删除')
      if (previewItem?.id === item.id) setPreviewItem(null)
      await fetchItems()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '删除失败')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>资质文件管理</h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--muted-foreground)' }}>
            共 {total} 份公司官方资质文件，支持上传、在线预览、下载、编辑与删除
          </p>
        </div>
        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium"
          style={{ background: '#C9A96E', color: '#0A0805' }}
        >
          <Plus size={16} />
          上传资质文件
        </button>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative w-full max-w-md">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--muted-foreground)' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="搜索标题、资质类型、原文件名..."
            className="w-full rounded-lg pl-9 pr-3 py-2.5 text-sm outline-none"
            style={inputStyle()}
          />
        </div>
      </div>

      <div style={card}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                {['标题', '资质类型', '原文件名', '备注', '更新时间', '上传人', '操作'].map(label => (
                  <th key={label} style={th}>{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center" style={{ color: 'var(--muted-foreground)' }}>加载中...</td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <ShieldCheck size={28} style={{ color: '#C9A96E', opacity: 0.45 }} />
                      <span style={{ color: 'var(--muted-foreground)' }}>
                        {search ? '没有匹配的资质文件' : '暂无资质文件，点击「上传资质文件」开始'}
                      </span>
                    </div>
                  </td>
                </tr>
              ) : items.map(item => (
                <tr key={item.id} className="hover:bg-[#1A1A12]/50">
                  <td style={{ ...td, color: 'var(--foreground)' }}>
                    <div className="font-medium">{item.title}</div>
                    <div className="mt-1 text-xs">{formatFileSize(item.fileSize)}</div>
                  </td>
                  <td style={td}>{item.documentType}</td>
                  <td style={td}>
                    <div className="max-w-[220px] truncate">{item.fileName}</div>
                  </td>
                  <td style={td}>
                    <div className="max-w-[260px] whitespace-pre-wrap break-words">{item.notes || '—'}</div>
                  </td>
                  <td style={td}>{new Date(item.updatedAt).toLocaleString('zh-HK')}</td>
                  <td style={td}>{item.uploadedBy?.nameEn ?? item.uploadedBy?.email ?? '—'}</td>
                  <td style={td}>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setPreviewItem(item)}
                        className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs"
                        style={{ border: '1px solid #2A2418', color: '#C9A96E' }}
                      >
                        <Eye size={12} />
                        查看
                      </button>
                      <a
                        href={fileUrl(item.storageKey, item.fileName, true)}
                        download={item.fileName}
                        className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs"
                        style={{ border: '1px solid #2A2418', color: '#C9A96E' }}
                      >
                        <Download size={12} />
                        下载
                      </a>
                      <button
                        type="button"
                        onClick={() => openEditModal(item)}
                        className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs"
                        style={{ border: '1px solid #2A2418', color: 'var(--foreground)' }}
                      >
                        <Pencil size={12} />
                        编辑
                      </button>
                      <button
                        type="button"
                        disabled={deletingId === item.id}
                        onClick={() => void deleteItem(item)}
                        className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs disabled:opacity-50"
                        style={{ border: '1px solid #5A3030', color: '#E57373' }}
                      >
                        <Trash2 size={12} />
                        {deletingId === item.id ? '删除中' : '删除'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {totalPages > 1 ? (
        <div className="flex items-center justify-center gap-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage(prev => Math.max(1, prev - 1))}
            className="rounded border px-3 py-1.5 text-sm disabled:opacity-50"
            style={{ borderColor: '#2A2418', color: 'var(--foreground)' }}
          >
            上一页
          </button>
          <span className="text-sm" style={{ color: 'var(--muted-foreground)' }}>{page} / {totalPages}</span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage(prev => Math.min(totalPages, prev + 1))}
            className="rounded border px-3 py-1.5 text-sm disabled:opacity-50"
            style={{ borderColor: '#2A2418', color: 'var(--foreground)' }}
          >
            下一页
          </button>
        </div>
      ) : null}

      {modalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-2xl rounded-xl border bg-[#0A0A08]" style={{ borderColor: '#2A2418' }}>
            <div className="flex items-center justify-between gap-3 border-b px-5 py-4" style={{ borderColor: '#2A2418' }}>
              <div>
                <h2 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>
                  {editingItem ? '编辑资质文件' : '上传资质文件'}
                </h2>
                <p className="mt-1 text-xs" style={{ color: 'var(--muted-foreground)' }}>
                  支持 PDF、JPG、PNG、WEBP，单文件最大 10 MB
                </p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="rounded px-2 py-1 text-xs"
                style={{ border: '1px solid #2A2418', color: 'var(--foreground)' }}
              >
                关闭
              </button>
            </div>
            <div className="space-y-4 px-5 py-5">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="文件标题">
                  <input
                    value={form.title}
                    onChange={e => setForm(prev => ({ ...prev, title: e.target.value }))}
                    maxLength={120}
                    className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                    style={inputStyle()}
                    placeholder="例如：营业执照（2026）"
                  />
                </Field>
                <Field label="资质类型">
                  <input
                    value={form.documentType}
                    onChange={e => setForm(prev => ({ ...prev, documentType: e.target.value }))}
                    maxLength={80}
                    className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                    style={inputStyle()}
                    placeholder="例如：营业执照、ISO 9001"
                  />
                </Field>
              </div>

              <Field label="备注" hint="可填写证书版本、生效时间、适用范围等说明">
                <textarea
                  value={form.notes}
                  onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))}
                  rows={3}
                  maxLength={500}
                  className="w-full resize-y rounded-lg px-3 py-2 text-sm outline-none"
                  style={inputStyle()}
                  placeholder="选填"
                />
              </Field>

              <Field
                label={editingItem ? '替换文件（可选）' : '上传文件'}
                hint={editingItem ? `当前文件：${editingItem.fileName}` : '新增时必须选择文件'}
              >
                <div className="space-y-2">
                  <input
                    ref={editingItem ? editFileInputRef : fileInputRef}
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                  <button
                    type="button"
                    onClick={() => (editingItem ? editFileInputRef.current : fileInputRef.current)?.click()}
                    className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs"
                    style={{ border: '1px solid #2A2418', color: 'var(--foreground)' }}
                  >
                    <Upload size={13} />
                    {editingItem ? '选择替换文件' : '选择上传文件'}
                  </button>
                  {selectedFileLabel ? (
                    <div className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{selectedFileLabel}</div>
                  ) : null}
                </div>
              </Field>
            </div>
            <div className="flex items-center justify-end gap-2 border-t px-5 py-4" style={{ borderColor: '#2A2418' }}>
              <button
                type="button"
                onClick={closeModal}
                disabled={saving}
                className="rounded px-3 py-1.5 text-sm disabled:opacity-50"
                style={{ border: '1px solid #2A2418', color: 'var(--foreground)' }}
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => void saveItem()}
                disabled={saving}
                className="rounded px-3 py-1.5 text-sm font-medium disabled:opacity-50"
                style={{ background: '#C9A96E', color: '#0A0805' }}
              >
                {saving ? '保存中...' : editingItem ? '保存修改' : '上传文件'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {previewItem ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true">
          <div className="flex h-[88vh] w-full max-w-5xl flex-col rounded-xl border bg-[#0A0A08]" style={{ borderColor: '#2A2418' }}>
            <div className="flex items-center justify-between gap-3 border-b px-4 py-3" style={{ borderColor: '#2A2418' }}>
              <div className="min-w-0">
                <h3 className="truncate text-sm font-semibold" style={{ color: 'var(--foreground)' }}>{previewItem.title}</h3>
                <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                  {previewItem.documentType} · {previewItem.fileName} · {formatFileSize(previewItem.fileSize)}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <a
                  href={fileUrl(previewItem.storageKey, previewItem.fileName, true)}
                  download={previewItem.fileName}
                  className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs"
                  style={{ border: '1px solid #2A2418', color: '#C9A96E' }}
                >
                  <Download size={12} />
                  下载
                </a>
                <button
                  type="button"
                  onClick={() => setPreviewItem(null)}
                  className="rounded px-2 py-1 text-xs"
                  style={{ border: '1px solid #2A2418', color: 'var(--foreground)' }}
                >
                  关闭
                </button>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-auto p-4">
              {isImageFile(previewItem) ? (
                // eslint-disable-next-line @next/next/no-img-element -- uploaded qualification files are arbitrary external assets.
                <img
                  src={fileUrl(previewItem.storageKey, previewItem.fileName)}
                  alt={previewItem.title}
                  className="mx-auto max-h-full max-w-full rounded-lg object-contain"
                />
              ) : isPdfFile(previewItem) ? (
                <iframe
                  title={previewItem.title}
                  src={fileUrl(previewItem.storageKey, previewItem.fileName)}
                  className="h-full min-h-[70vh] w-full rounded-lg bg-white"
                />
              ) : (
                <div className="flex h-full min-h-[60vh] flex-col items-center justify-center gap-3 text-center text-sm" style={{ color: 'var(--muted-foreground)' }}>
                  <FileText size={28} style={{ color: '#C9A96E' }} />
                  <p>该文件格式暂不支持在线预览，请直接下载查看。</p>
                  <a
                    href={fileUrl(previewItem.storageKey, previewItem.fileName, true)}
                    download={previewItem.fileName}
                    className="inline-flex items-center gap-1 rounded px-3 py-1.5 text-xs"
                    style={{ border: '1px solid #2A2418', color: '#C9A96E' }}
                  >
                    <Download size={12} />
                    下载文件
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
