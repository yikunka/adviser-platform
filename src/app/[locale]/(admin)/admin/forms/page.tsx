'use client'

/* eslint-disable react-hooks/set-state-in-effect */

import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react'
import { Download, Edit3, FileSpreadsheet, Plus, Save, Search, Trash2, Upload, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { useAdminPermission } from '@/components/admin/AdminPermissionContext'

type AdviserForm = {
  id: string
  formName: string
  notes: string | null
  fileName: string
  storageKey: string
  mimeType: string
  fileSize: number
  createdAt: string
  updatedAt: string
  uploadedBy?: { nameEn: string | null; email: string | null } | null
}

type FormDraft = {
  formName: string
  notes: string
}

const emptyDraft: FormDraft = { formName: '', notes: '' }

const card: React.CSSProperties = {
  background: 'var(--card)',
  border: '1px solid var(--border)',
  borderRadius: '0.75rem',
}

const inputClass = 'w-full rounded-lg px-3 py-2.5 text-sm outline-none'

function inputStyle(): React.CSSProperties {
  return {
    background: '#0F0D08',
    border: '1px solid var(--border-subtle)',
    color: 'var(--foreground)',
  }
}

function fileSizeLabel(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function fileUrl(storageKey: string, fileName: string) {
  const params = new URLSearchParams({ key: storageKey, filename: fileName, download: '1' })
  return `/api/files?${params.toString()}`
}

export default function FormsPage() {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const canCreate = useAdminPermission('forms.create')
  const canEdit = useAdminPermission('forms.edit')
  const canDelete = useAdminPermission('forms.delete')
  const [forms, setForms] = useState<AdviserForm[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [draft, setDraft] = useState<FormDraft>(emptyDraft)
  const [file, setFile] = useState<File | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState<FormDraft>(emptyDraft)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const fetchForms = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search.trim()) params.set('q', search.trim())
      const res = await fetch(`/api/admin/forms${params.size ? `?${params}` : ''}`)
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || '载入表格失败。')
      setForms(Array.isArray(json.forms) ? json.forms : [])
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '载入表格失败。')
    } finally {
      setLoading(false)
    }
  }, [search])

  useEffect(() => {
    fetchForms()
  }, [fetchForms])

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    setFile(event.target.files?.[0] ?? null)
  }

  async function uploadForm() {
    if (!draft.formName.trim()) {
      toast.error('请填写表格名称。')
      return
    }
    if (!file) {
      toast.error('请选择表格文件。')
      return
    }
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('formName', draft.formName.trim())
      formData.append('notes', draft.notes)
      formData.append('file', file)
      const res = await fetch('/api/admin/forms', { method: 'POST', body: formData })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || '上传表格失败。')
      toast.success(json.toast || '表格已上传。')
      setUploadOpen(false)
      setDraft(emptyDraft)
      setFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      await fetchForms()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '上传表格失败。')
    } finally {
      setUploading(false)
    }
  }

  async function saveForm(form: AdviserForm) {
    setSavingId(form.id)
    try {
      const res = await fetch(`/api/admin/forms/${form.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editDraft),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || '保存表格失败。')
      setForms(current => current.map(row => row.id === form.id ? json.form : row))
      setEditingId(null)
      toast.success(json.toast || '表格已更新。')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '保存表格失败。')
    } finally {
      setSavingId(null)
    }
  }

  async function deleteForm(form: AdviserForm) {
    if (!window.confirm(`删除表格「${form.formName}」？文件也会一并删除。`)) return
    setDeletingId(form.id)
    try {
      const res = await fetch(`/api/admin/forms/${form.id}`, { method: 'DELETE' })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || '删除表格失败。')
      setForms(current => current.filter(row => row.id !== form.id))
      toast.success(json.toast || '表格已删除。')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '删除表格失败。')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>表格下载</h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--muted-foreground)' }}>
            上传并下载顾问平台共用表格，不关联客户公司。
          </p>
        </div>
        {canCreate && (
          <Button onClick={() => setUploadOpen(true)}>
            <Plus size={16} className="mr-2" /> 上传表格
          </Button>
        )}
      </div>

      {uploadOpen && (
        <div className="space-y-4 p-4" style={card}>
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>上传表格</h2>
            <button type="button" onClick={() => setUploadOpen(false)} aria-label="关闭">
              <X size={16} style={{ color: 'var(--muted-foreground)' }} />
            </button>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <input
              value={draft.formName}
              onChange={event => setDraft(prev => ({ ...prev, formName: event.target.value }))}
              placeholder="表格名称"
              className={inputClass}
              style={inputStyle()}
            />
            <label className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2.5 text-sm" style={inputStyle()}>
              <Upload size={16} style={{ color: '#C9A96E' }} />
              <span className="truncate" style={{ color: file ? 'var(--foreground)' : 'var(--muted-foreground)' }}>
                {file ? file.name : '选择 PDF、Word 或 Excel（最大 15 MB）'}
              </span>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.doc,.docx,.xls,.xlsx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                className="hidden"
                onChange={onFileChange}
              />
            </label>
          </div>
          <textarea
            value={draft.notes}
            onChange={event => setDraft(prev => ({ ...prev, notes: event.target.value }))}
            placeholder="备注（可选）"
            className={`${inputClass} min-h-20 resize-y`}
            style={inputStyle()}
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setUploadOpen(false)}>取消</Button>
            <Button type="button" onClick={uploadForm} disabled={uploading}>
              {uploading ? '上传中…' : '上传'}
            </Button>
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 rounded-lg px-3 py-2" style={card}>
        <Search size={16} style={{ color: 'var(--muted-foreground)' }} />
        <input
          value={search}
          onChange={event => setSearch(event.target.value)}
          placeholder="搜索表格名称、文件名或备注..."
          className="flex-1 bg-transparent text-sm outline-none"
          style={{ color: 'var(--foreground)' }}
        />
      </div>

      <div className="overflow-hidden rounded-lg" style={card}>
        <table className="w-full text-left text-sm">
          <thead style={{ background: 'var(--surface-modal)', color: 'var(--muted-foreground)' }}>
            <tr>
              <th className="px-4 py-3 font-medium">表格名称</th>
              <th className="px-4 py-3 font-medium">文件</th>
              <th className="px-4 py-3 font-medium">备注</th>
              <th className="px-4 py-3 text-right font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center" style={{ color: 'var(--muted-foreground)' }}>载入中…</td>
              </tr>
            ) : forms.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center" style={{ color: 'var(--muted-foreground)' }}>还没有表格。</td>
              </tr>
            ) : forms.map(form => {
              const editing = editingId === form.id
              return (
                <tr key={form.id} style={{ borderTop: '1px solid #1E1C15' }}>
                  <td className="px-4 py-3 align-top">
                    {editing ? (
                      <input
                        value={editDraft.formName}
                        onChange={event => setEditDraft(prev => ({ ...prev, formName: event.target.value }))}
                        className={inputClass}
                        style={inputStyle()}
                      />
                    ) : (
                      <div>
                        <div className="font-medium" style={{ color: 'var(--foreground)' }}>{form.formName}</div>
                        <div className="mt-1 text-xs" style={{ color: 'var(--muted-foreground)' }}>
                          {form.uploadedBy?.nameEn || form.uploadedBy?.email || '—'}
                        </div>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 align-top">
                    <div className="flex items-start gap-2">
                      <FileSpreadsheet size={16} className="mt-0.5 shrink-0" style={{ color: '#C9A96E' }} />
                      <div className="min-w-0">
                        <p className="truncate" style={{ color: 'var(--foreground)' }}>{form.fileName}</p>
                        <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{fileSizeLabel(form.fileSize)}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 align-top">
                    {editing ? (
                      <textarea
                        value={editDraft.notes}
                        onChange={event => setEditDraft(prev => ({ ...prev, notes: event.target.value }))}
                        className={`${inputClass} min-h-20 resize-y`}
                        style={inputStyle()}
                      />
                    ) : (
                      <p className="max-w-md whitespace-pre-wrap" style={{ color: 'var(--muted-foreground)' }}>
                        {form.notes || '—'}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 align-top">
                    <div className="flex justify-end gap-2">
                      <a href={fileUrl(form.storageKey, form.fileName)} download={form.fileName}>
                        <Button type="button" variant="outline" size="sm">
                          <Download size={14} className="mr-1" /> 下载
                        </Button>
                      </a>
                      {editing ? (
                        <>
                          <Button type="button" size="sm" onClick={() => saveForm(form)} disabled={savingId === form.id}>
                            <Save size={14} className="mr-1" /> {savingId === form.id ? '保存中' : '保存'}
                          </Button>
                          <Button type="button" variant="outline" size="sm" onClick={() => setEditingId(null)}>
                            <X size={14} />
                          </Button>
                        </>
                      ) : (
                        <>
                          {canEdit && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setEditingId(form.id)
                                setEditDraft({ formName: form.formName, notes: form.notes ?? '' })
                              }}
                            >
                              <Edit3 size={14} className="mr-1" /> 编辑
                            </Button>
                          )}
                          {canDelete && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => deleteForm(form)}
                              disabled={deletingId === form.id}
                            >
                              <Trash2 size={14} className="mr-1" /> {deletingId === form.id ? '删除中' : '删除'}
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
