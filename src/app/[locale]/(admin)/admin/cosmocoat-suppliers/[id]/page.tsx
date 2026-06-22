'use client'

/* eslint-disable react-hooks/set-state-in-effect */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import { Link, useRouter } from '@/i18n/navigation'
import { toast } from 'sonner'
import { ArrowLeft, Download, FileText, Save, Trash2, Upload } from 'lucide-react'
import type { CosSupplierRow } from '@/lib/cosmocoat/suppliers'

type FormState = {
  code: string
  name: string
  contactPerson: string
  contactInfo: string
  address: string
  shippingAddress: string
}

type SupplierFile = {
  id: string
  kind: SupplierFileKind
  fileName: string
  storageKey: string
  mimeType: string
  fileSize: number
  notes: string | null
  createdAt: string
  uploadedBy: { nameEn: string | null; email: string } | null
}

type SupplierFileKind = 'GENERAL' | 'BUSINESS_LICENSE' | 'QUALITY_GUARANTEE'

const SUPPLIER_FILE_SECTIONS: Array<{
  kind: SupplierFileKind
  title: string
  description: string
  uploadLabel: string
  emptyLabel: string
  notesPlaceholder: string
}> = [
  {
    kind: 'BUSINESS_LICENSE',
    title: '营业执照',
    description: '上传、查看、下载与删除供应商营业执照',
    uploadLabel: '上传营业执照',
    emptyLabel: '暂无营业执照文件',
    notesPlaceholder: '版本、有效期等',
  },
  {
    kind: 'QUALITY_GUARANTEE',
    title: '质量保証函',
    description: '上传、查看、下载与删除供应商质量保証函',
    uploadLabel: '上传质量保証函',
    emptyLabel: '暂无质量保証函文件',
    notesPlaceholder: '版本、适用产品等',
  },
  {
    kind: 'GENERAL',
    title: '供应商文件',
    description: '上传、查看、下载与删除供应商资料文件',
    uploadLabel: '上传文件',
    emptyLabel: '暂无供应商文件',
    notesPlaceholder: '合同、证照、报价单等',
  },
]

const EMPTY_SUPPLIER_FILES: Record<SupplierFileKind, SupplierFile[]> = {
  GENERAL: [],
  BUSINESS_LICENSE: [],
  QUALITY_GUARANTEE: [],
}

const card: React.CSSProperties = {
  background: 'var(--card)',
  border: '1px solid var(--border)',
  borderRadius: '0.75rem',
}

function inputStyle(): React.CSSProperties {
  return {
    background: '#0E0E0A',
    border: '1px solid #2A2418',
    color: 'var(--foreground)',
  }
}

function fileUrl(storageKey: string) {
  return `/api/files?key=${encodeURIComponent(storageKey)}`
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function Field({ label, hint, children, className = '' }: { label: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      <label className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>{label}</label>
      {hint && <p className="text-[11px]" style={{ color: '#756A58' }}>{hint}</p>}
      {children}
    </div>
  )
}

function SupplierFilesSection({
  supplierId,
  kind,
  title,
  description,
  uploadLabel,
  emptyLabel,
  notesPlaceholder,
  files,
  onRefresh,
}: {
  supplierId: string
  kind: SupplierFileKind
  title: string
  description: string
  uploadLabel: string
  emptyLabel: string
  notesPlaceholder: string
  files: SupplierFile[]
  onRefresh: () => void
}) {
  const [uploading, setUploading] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [notes, setNotes] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleUpload(fileList: FileList | null) {
    const file = fileList?.[0]
    if (!file) return
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('kind', kind)
      if (notes.trim()) fd.append('notes', notes.trim())
      const res = await fetch(`/api/admin/cosmocoat/suppliers/${supplierId}/files`, {
        method: 'POST',
        body: fd,
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error ?? '上传失败')
      toast.success(`${title}已上传`)
      setNotes('')
      if (fileRef.current) fileRef.current.value = ''
      onRefresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '上传失败')
    } finally {
      setUploading(false)
    }
  }

  async function handleDelete(fileId: string) {
    if (!window.confirm(`确定删除此${title}文件？`)) return
    setDeletingId(fileId)
    try {
      const res = await fetch(
        `/api/admin/cosmocoat/suppliers/${supplierId}/files/${fileId}`,
        { method: 'DELETE' },
      )
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error ?? '删除失败')
      toast.success('文件已删除')
      onRefresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '删除失败')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="p-5 space-y-4" style={card}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>{title}</h2>
          <p className="text-xs mt-1" style={{ color: 'var(--muted-foreground)' }}>
            {description}
          </p>
        </div>
        <FileText size={16} style={{ color: '#C9A96E' }} />
      </div>

      <div className="space-y-2 rounded-md p-4" style={{ background: '#0A0A0A', border: '1px solid #2A2418' }}>
        <Field label="备注（可选）">
          <input
            value={notes}
            onChange={e => setNotes(e.target.value)}
            maxLength={500}
            placeholder={notesPlaceholder}
            className="w-full rounded-lg px-3 py-2 text-sm outline-none"
            style={inputStyle()}
          />
        </Field>
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={e => handleUpload(e.target.files)}
          />
          <button
            type="button"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs disabled:opacity-50"
            style={{ border: '1px solid #2A2418', color: 'var(--foreground)' }}
          >
            <Upload size={13} />
            {uploading ? '上传中...' : uploadLabel}
          </button>
          <span className="text-[11px]" style={{ color: '#756A58' }}>PDF、Word、JPG、PNG、WEBP，最大 10 MB</span>
        </div>
      </div>

      {files.length === 0 ? (
        <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{emptyLabel}</p>
      ) : (
        <div className="space-y-2">
          {files.map(file => (
            <div
              key={file.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md px-3 py-2"
              style={{ background: '#111108', border: '1px solid #1E1C15' }}
            >
              <div className="min-w-0">
                <div className="text-sm truncate" style={{ color: 'var(--foreground)' }}>{file.fileName}</div>
                <div className="text-[11px] mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                  {formatFileSize(file.fileSize)}
                  {file.notes ? ` · ${file.notes}` : ''}
                  {file.uploadedBy?.nameEn || file.uploadedBy?.email
                    ? ` · ${file.uploadedBy.nameEn ?? file.uploadedBy.email}`
                    : ''}
                  · {new Date(file.createdAt).toLocaleDateString('zh-HK')}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={fileUrl(file.storageKey)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs"
                  style={{ border: '1px solid #2A2418', color: 'var(--foreground)' }}
                >
                  <FileText size={12} /> 查看
                </a>
                <a
                  href={fileUrl(file.storageKey)}
                  download={file.fileName}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs"
                  style={{ border: '1px solid #2A2418', color: '#C9A96E' }}
                >
                  <Download size={12} /> 下载
                </a>
                <button
                  type="button"
                  disabled={deletingId === file.id}
                  onClick={() => handleDelete(file.id)}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs disabled:opacity-50"
                  style={{ border: '1px solid #5A3030', color: '#E57373' }}
                >
                  <Trash2 size={12} />
                  {deletingId === file.id ? '删除中' : '删除'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function AdminCosmoCoatSupplierDetailPage() {
  const params = useParams()
  const router = useRouter()
  const supplierId = params.id as string
  const isNew = supplierId === 'new'

  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [supplier, setSupplier] = useState<CosSupplierRow | null>(null)
  const [files, setFiles] = useState<Record<SupplierFileKind, SupplierFile[]>>(EMPTY_SUPPLIER_FILES)
  const [form, setForm] = useState<FormState>({
    code: '',
    name: '',
    contactPerson: '',
    contactInfo: '',
    address: '',
    shippingAddress: '',
  })

  const fetchFiles = useCallback(async (kind: SupplierFileKind) => {
    if (isNew) return
    try {
      const res = await fetch(`/api/admin/cosmocoat/suppliers/${supplierId}/files?kind=${kind}`)
      const data = await res.json()
      if (!res.ok) return
      setFiles(prev => ({ ...prev, [kind]: data.files ?? [] }))
    } catch {
      setFiles(prev => ({ ...prev, [kind]: [] }))
    }
  }, [supplierId, isNew])

  const fetchAllFiles = useCallback(async () => {
    await Promise.all(SUPPLIER_FILE_SECTIONS.map(section => fetchFiles(section.kind)))
  }, [fetchFiles])

  const fetchSupplier = useCallback(async () => {
    if (isNew) return
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/cosmocoat/suppliers/${supplierId}`)
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? '加载供应商详情失败')
        return
      }
      const row = data.supplier as CosSupplierRow
      setSupplier(row)
      setForm({
        code: row.code,
        name: row.name,
        contactPerson: row.contactPerson ?? '',
        contactInfo: row.contactInfo ?? '',
        address: row.address ?? '',
        shippingAddress: row.shippingAddress ?? '',
      })
      await fetchAllFiles()
    } catch {
      toast.error('加载供应商详情失败')
    } finally {
      setLoading(false)
    }
  }, [supplierId, fetchAllFiles, isNew])

  useEffect(() => {
    fetchSupplier()
  }, [fetchSupplier])

  function patch<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) {
      toast.error('请填写供应商名称')
      return
    }

    setSaving(true)
    try {
      const payload = {
        code: form.code.trim() || undefined,
        name: form.name.trim(),
        contactPerson: form.contactPerson.trim() || null,
        contactInfo: form.contactInfo.trim() || null,
        address: form.address.trim() || null,
        shippingAddress: form.shippingAddress.trim() || null,
      }

      const res = await fetch(
        isNew ? '/api/admin/cosmocoat/suppliers' : `/api/admin/cosmocoat/suppliers/${supplierId}`,
        {
          method: isNew ? 'POST' : 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
      )
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? '保存失败')
        return
      }

      toast.success(isNew ? '供应商已创建' : '供应商资料已更新')
      if (isNew) {
        router.push(`/admin/cosmocoat-suppliers/${data.supplier.id}`)
      } else {
        setSupplier(data.supplier)
        setForm({
          code: data.supplier.code,
          name: data.supplier.name,
          contactPerson: data.supplier.contactPerson ?? '',
          contactInfo: data.supplier.contactInfo ?? '',
          address: data.supplier.address ?? '',
          shippingAddress: data.supplier.shippingAddress ?? '',
        })
      }
    } catch {
      toast.error('保存失败')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (isNew || !window.confirm(`确定删除供应商「${form.name}」？此操作不可撤销。`)) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/admin/cosmocoat/suppliers/${supplierId}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? '删除失败')
        return
      }
      toast.success('供应商已删除')
      router.push('/admin/cosmocoat-suppliers')
    } catch {
      toast.error('删除失败')
    } finally {
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <p style={{ color: 'var(--muted-foreground)' }}>加载中...</p>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/cosmocoat-suppliers"
            className="inline-flex items-center gap-1.5 text-sm"
            style={{ color: 'var(--muted-foreground)' }}
          >
            <ArrowLeft size={16} />
            返回列表
          </Link>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>
            {isNew ? '新建供应商' : `供应商详情 · ${supplier?.code ?? form.code}`}
          </h1>
        </div>
        {!isNew && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm disabled:opacity-50"
            style={{ border: '1px solid #5A3030', color: '#E57373' }}
          >
            <Trash2 size={14} />
            {deleting ? '删除中...' : '删除供应商'}
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="p-5 space-y-4" style={card}>
          <h2 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>基本信息</h2>

          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="供应商编码" hint={isNew ? '留空则自动生成（如 SC0001）' : undefined}>
              <input
                value={form.code}
                onChange={e => patch('code', e.target.value)}
                maxLength={32}
                placeholder={isNew ? '自动生成' : undefined}
                className="w-full rounded-lg px-3 py-2.5 text-sm outline-none"
                style={inputStyle()}
              />
            </Field>
            <Field label="供应商名称 *">
              <input
                value={form.name}
                onChange={e => patch('name', e.target.value)}
                required
                maxLength={200}
                className="w-full rounded-lg px-3 py-2.5 text-sm outline-none"
                style={inputStyle()}
              />
            </Field>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="联系方式">
              <textarea
                value={form.contactInfo}
                onChange={e => patch('contactInfo', e.target.value)}
                maxLength={500}
                rows={3}
                placeholder="电话、邮箱等"
                className="w-full rounded-lg px-3 py-2.5 text-sm outline-none resize-y"
                style={inputStyle()}
              />
            </Field>
            <Field label="联系人">
              <input
                value={form.contactPerson}
                onChange={e => patch('contactPerson', e.target.value)}
                maxLength={200}
                placeholder="负责对接人员"
                className="w-full rounded-lg px-3 py-2.5 text-sm outline-none"
                style={inputStyle()}
              />
            </Field>
          </div>

          <Field label="地址">
            <textarea
              value={form.address}
              onChange={e => patch('address', e.target.value)}
              maxLength={500}
              rows={3}
              className="w-full rounded-lg px-3 py-2.5 text-sm outline-none resize-y"
              style={inputStyle()}
            />
          </Field>

          <Field label="发货地址">
            <textarea
              value={form.shippingAddress}
              onChange={e => patch('shippingAddress', e.target.value)}
              maxLength={500}
              rows={3}
              className="w-full rounded-lg px-3 py-2.5 text-sm outline-none resize-y"
              style={inputStyle()}
            />
          </Field>
        </div>

        {!isNew && supplier && (
          <div className="space-y-4">
            {SUPPLIER_FILE_SECTIONS.map(section => (
              <SupplierFilesSection
                key={section.kind}
                supplierId={supplier.id}
                {...section}
                files={files[section.kind]}
                onRefresh={() => fetchFiles(section.kind)}
              />
            ))}
          </div>
        )}

        {isNew && (
          <div className="p-5 text-xs rounded-lg" style={{ ...card, color: '#C9A96E', background: 'rgba(201,169,110,0.08)' }}>
            请先保存供应商资料，再上传文件。
          </div>
        )}

        {!isNew && supplier && (
          <div className="p-5 space-y-2 text-xs" style={card}>
            <div style={{ color: 'var(--muted-foreground)' }}>
              创建时间：{new Date(supplier.createdAt).toLocaleString('zh-HK')}
            </div>
            <div style={{ color: 'var(--muted-foreground)' }}>
              最后更新：{new Date(supplier.updatedAt).toLocaleString('zh-HK')}
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Link
            href="/admin/cosmocoat-suppliers"
            className="px-4 py-2 rounded-lg text-sm"
            style={{ border: '1px solid #2A2418', color: 'var(--foreground)' }}
          >
            取消
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
            style={{ background: '#C9A96E', color: '#0A0805' }}
          >
            <Save size={14} />
            {saving ? '保存中...' : isNew ? '创建供应商' : '保存更改'}
          </button>
        </div>
      </form>
    </div>
  )
}
