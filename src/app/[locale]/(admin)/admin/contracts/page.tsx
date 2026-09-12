'use client'

/* eslint-disable react-hooks/set-state-in-effect */

import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react'
import { Download, Edit3, FileText, Plus, Save, Search, Trash2, Upload, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { useAdminPermission } from '@/components/admin/AdminPermissionContext'

type AdviserContract = {
  id: string
  contractName: string
  startDate: string
  endDate: string
  notes: string | null
  fileName: string
  storageKey: string
  mimeType: string
  fileSize: number
  createdAt: string
  updatedAt: string
  uploadedBy?: { nameEn: string | null; email: string | null } | null
}

type ContractDraft = {
  contractName: string
  startDate: string
  endDate: string
  notes: string
}

const emptyDraft: ContractDraft = {
  contractName: '',
  startDate: '',
  endDate: '',
  notes: '',
}

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

function dateInputValue(value: string) {
  return value ? value.slice(0, 10) : ''
}

function fileSizeLabel(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function fileUrl(storageKey: string, fileName: string, download = false) {
  const params = new URLSearchParams({ key: storageKey, filename: fileName })
  if (download) params.set('download', '1')
  return `/api/files?${params.toString()}`
}

function contractToDraft(contract: AdviserContract): ContractDraft {
  return {
    contractName: contract.contractName,
    startDate: dateInputValue(contract.startDate),
    endDate: dateInputValue(contract.endDate),
    notes: contract.notes ?? '',
  }
}

export default function ContractsPage() {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const canCreate = useAdminPermission('contracts.create')
  const canEdit = useAdminPermission('contracts.edit')
  const canDelete = useAdminPermission('contracts.delete')
  const [contracts, setContracts] = useState<AdviserContract[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [draft, setDraft] = useState<ContractDraft>(emptyDraft)
  const [file, setFile] = useState<File | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState<ContractDraft>(emptyDraft)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const fetchContracts = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search.trim()) params.set('q', search.trim())
      const res = await fetch(`/api/admin/contracts${params.size ? `?${params}` : ''}`)
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || '载入合同失败。')
      setContracts(Array.isArray(json.contracts) ? json.contracts : [])
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '载入合同失败。')
    } finally {
      setLoading(false)
    }
  }, [search])

  useEffect(() => {
    fetchContracts()
  }, [fetchContracts])

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    setFile(event.target.files?.[0] ?? null)
  }

  async function uploadContract() {
    if (!file) {
      toast.error('请选择合同文件。')
      return
    }
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('contractName', draft.contractName)
      formData.append('startDate', draft.startDate)
      formData.append('endDate', draft.endDate)
      formData.append('notes', draft.notes)
      formData.append('file', file)
      const res = await fetch('/api/admin/contracts', { method: 'POST', body: formData })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || '上传合同失败。')
      toast.success(json.toast || '合同已上传。')
      setUploadOpen(false)
      setDraft(emptyDraft)
      setFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      await fetchContracts()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '上传合同失败。')
    } finally {
      setUploading(false)
    }
  }

  async function saveContract(contract: AdviserContract) {
    setSavingId(contract.id)
    try {
      const res = await fetch(`/api/admin/contracts/${contract.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editDraft),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || '保存合同失败。')
      setContracts(current => current.map(row => row.id === contract.id ? json.contract : row))
      setEditingId(null)
      toast.success(json.toast || '合同已更新。')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '保存合同失败。')
    } finally {
      setSavingId(null)
    }
  }

  async function deleteContract(contract: AdviserContract) {
    if (!window.confirm(`删除合同「${contract.contractName}」？文件也会一并删除。`)) return
    setDeletingId(contract.id)
    try {
      const res = await fetch(`/api/admin/contracts/${contract.id}`, { method: 'DELETE' })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || '删除合同失败。')
      setContracts(current => current.filter(row => row.id !== contract.id))
      toast.success(json.toast || '合同已删除。')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '删除合同失败。')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>合同管理</h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--muted-foreground)' }}>
            独立管理 Adviser 平台合同文件、合同期限和备注，不关联客户公司。
          </p>
        </div>
        {canCreate && (
          <Button onClick={() => setUploadOpen(true)}>
            <Plus size={16} className="mr-2" /> 新增合同
          </Button>
        )}
      </div>

      <div className="flex items-center gap-2 rounded-lg px-3 py-2" style={card}>
        <Search size={16} style={{ color: 'var(--muted-foreground)' }} />
        <input
          value={search}
          onChange={event => setSearch(event.target.value)}
          placeholder="搜索合同名称、文件名或备注..."
          className="flex-1 bg-transparent text-sm outline-none"
          style={{ color: 'var(--foreground)' }}
        />
      </div>

      <div className="overflow-hidden rounded-lg" style={card}>
        <table className="w-full text-left text-sm">
          <thead style={{ background: 'var(--surface-modal)', color: 'var(--muted-foreground)' }}>
            <tr>
              <th className="px-4 py-3 font-medium">合同名称</th>
              <th className="px-4 py-3 font-medium">合同日期</th>
              <th className="px-4 py-3 font-medium">文件</th>
              <th className="px-4 py-3 font-medium">备注</th>
              <th className="px-4 py-3 text-right font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {contracts.map(contract => {
              const editing = editingId === contract.id
              return (
                <tr key={contract.id} style={{ borderTop: '1px solid #1E1C15' }}>
                  <td className="px-4 py-3 align-top">
                    {editing ? (
                      <input
                        value={editDraft.contractName}
                        onChange={event => setEditDraft(prev => ({ ...prev, contractName: event.target.value }))}
                        className={inputClass}
                        style={inputStyle()}
                      />
                    ) : (
                      <div className="font-medium" style={{ color: 'var(--foreground)' }}>{contract.contractName}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 align-top" style={{ color: 'var(--muted-foreground)' }}>
                    {editing ? (
                      <div className="grid gap-2">
                        <input
                          type="date"
                          value={editDraft.startDate}
                          onChange={event => setEditDraft(prev => ({ ...prev, startDate: event.target.value }))}
                          className={inputClass}
                          style={inputStyle()}
                        />
                        <input
                          type="date"
                          value={editDraft.endDate}
                          onChange={event => setEditDraft(prev => ({ ...prev, endDate: event.target.value }))}
                          className={inputClass}
                          style={inputStyle()}
                        />
                      </div>
                    ) : (
                      <span>{dateInputValue(contract.startDate)} 至 {dateInputValue(contract.endDate)}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 align-top">
                    <div className="flex items-start gap-2">
                      <FileText size={16} className="mt-0.5 shrink-0" style={{ color: '#C9A96E' }} />
                      <div className="min-w-0">
                        <p className="truncate" style={{ color: 'var(--foreground)' }}>{contract.fileName}</p>
                        <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{fileSizeLabel(contract.fileSize)}</p>
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
                        {contract.notes || '—'}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 align-top">
                    <div className="flex justify-end gap-2">
                      <a href={fileUrl(contract.storageKey, contract.fileName, true)} download={contract.fileName}>
                        <Button type="button" variant="outline" size="sm">
                          <Download size={14} className="mr-1" /> 下载
                        </Button>
                      </a>
                      {editing ? (
                        <>
                          <Button type="button" size="sm" onClick={() => saveContract(contract)} disabled={savingId === contract.id}>
                            <Save size={14} className="mr-1" /> {savingId === contract.id ? '保存中' : '保存'}
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
                              onClick={() => { setEditingId(contract.id); setEditDraft(contractToDraft(contract)) }}
                            >
                              <Edit3 size={14} className="mr-1" /> 编辑
                            </Button>
                          )}
                          {canDelete && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => deleteContract(contract)}
                              disabled={deletingId === contract.id}
                            >
                              <Trash2 size={14} className="mr-1" /> {deletingId === contract.id ? '删除中' : '删除'}
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
            {!loading && contracts.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-sm" style={{ color: 'var(--muted-foreground)' }}>
                  暂无合同记录。
                </td>
              </tr>
            )}
            {loading && (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-sm" style={{ color: 'var(--muted-foreground)' }}>
                  载入中...
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {uploadOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: 'rgba(0,0,0,0.55)' }}>
          <div className="w-full max-w-xl rounded-lg p-5 shadow-xl" style={{ ...card, background: '#0A0805' }}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>新增合同</h2>
                <p className="mt-1 text-xs" style={{ color: 'var(--muted-foreground)' }}>
                  上传合同文件并填写合同期限，可后续编辑合同名称、日期和备注。
                </p>
              </div>
              <button type="button" onClick={() => setUploadOpen(false)} className="rounded-md p-1.5" style={{ color: 'var(--muted-foreground)' }}>
                <X size={16} />
              </button>
            </div>
            <div className="mt-5 grid gap-4">
              <label className="space-y-1.5">
                <span className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>合同名称</span>
                <input value={draft.contractName} onChange={event => setDraft(prev => ({ ...prev, contractName: event.target.value }))} className={inputClass} style={inputStyle()} />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-1.5">
                  <span className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>合同开始日期</span>
                  <input type="date" value={draft.startDate} onChange={event => setDraft(prev => ({ ...prev, startDate: event.target.value }))} className={inputClass} style={inputStyle()} />
                </label>
                <label className="space-y-1.5">
                  <span className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>合同结束日期</span>
                  <input type="date" value={draft.endDate} onChange={event => setDraft(prev => ({ ...prev, endDate: event.target.value }))} className={inputClass} style={inputStyle()} />
                </label>
              </div>
              <label className="space-y-1.5">
                <span className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>合同文件</span>
                <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp" onChange={onFileChange} className={inputClass} style={inputStyle()} />
                <span className="block text-xs" style={{ color: 'var(--muted-foreground)' }}>支持 PDF、Word、JPG、PNG、WEBP，最大 10MB。</span>
              </label>
              <label className="space-y-1.5">
                <span className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>备注</span>
                <textarea value={draft.notes} onChange={event => setDraft(prev => ({ ...prev, notes: event.target.value }))} className={`${inputClass} min-h-24 resize-y`} style={inputStyle()} />
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setUploadOpen(false)}>取消</Button>
              <Button onClick={uploadContract} disabled={uploading}>
                <Upload size={15} className="mr-2" /> {uploading ? '上传中...' : '上传合同'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
