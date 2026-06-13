'use client'

/* eslint-disable react-hooks/set-state-in-effect */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import { Link, useRouter } from '@/i18n/navigation'
import { toast } from 'sonner'
import { ArrowLeft, Download, FileText, Save, Trash2, Upload } from 'lucide-react'
import type { CosCustomerRow } from '@/lib/cosmocoat/customers'

type PlatformUser = {
  id: string
  email: string
  nameEn: string
  isActive: boolean
}

type FormState = {
  code: string
  name: string
  userId: string
  phone: string
  address: string
  productionEquipmentParams: string
}

type BusinessLicenseFile = {
  id: string
  fileName: string
  storageKey: string
  mimeType: string
  fileSize: number
  notes: string | null
  createdAt: string
  uploadedBy: { nameEn: string | null; email: string } | null
}

function fileUrl(storageKey: string) {
  return `/api/files?key=${encodeURIComponent(storageKey)}`
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function BusinessLicensesSection({
  customerId,
  files,
  onRefresh,
}: {
  customerId: string
  files: BusinessLicenseFile[]
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
      if (notes.trim()) fd.append('notes', notes.trim())
      const res = await fetch(`/api/admin/cosmocoat/customers/${customerId}/business-licenses`, {
        method: 'POST',
        body: fd,
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error ?? '上传失败')
      toast.success('营业执照已上传')
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
    if (!window.confirm('确定删除此营业执照文件？')) return
    setDeletingId(fileId)
    try {
      const res = await fetch(
        `/api/admin/cosmocoat/customers/${customerId}/business-licenses/${fileId}`,
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
          <h2 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>营业执照</h2>
          <p className="text-xs mt-1" style={{ color: 'var(--muted-foreground)' }}>
            上传、查看、下载与删除客户营业执照文件
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
            placeholder="版本、有效期等"
            className="w-full rounded-lg px-3 py-2 text-sm outline-none"
            style={inputStyle()}
          />
        </Field>
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
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
            {uploading ? '上传中...' : '上传营业执照'}
          </button>
          <span className="text-[11px]" style={{ color: '#756A58' }}>PDF、JPG、PNG、WEBP，最大 10 MB</span>
        </div>
      </div>

      {files.length === 0 ? (
        <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>暂无营业执照文件</p>
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

function Field({ label, hint, children, className = '' }: { label: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      <label className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>{label}</label>
      {hint && <p className="text-[11px]" style={{ color: '#756A58' }}>{hint}</p>}
      {children}
    </div>
  )
}

export default function AdminCosmoCoatCustomerDetailPage() {
  const params = useParams()
  const router = useRouter()
  const customerId = params.id as string
  const isNew = customerId === 'new'

  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [platformUsers, setPlatformUsers] = useState<PlatformUser[]>([])
  const [customer, setCustomer] = useState<CosCustomerRow | null>(null)
  const [businessLicenses, setBusinessLicenses] = useState<BusinessLicenseFile[]>([])
  const [form, setForm] = useState<FormState>({
    code: '',
    name: '',
    userId: '',
    phone: '',
    address: '',
    productionEquipmentParams: '',
  })

  const fetchPlatformUsers = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/users?platform=COSMICOAT')
      const data = await res.json()
      if (!res.ok) return
      setPlatformUsers(data.users ?? [])
    } catch {
      // optional field — silent fail
    }
  }, [])

  const fetchBusinessLicenses = useCallback(async () => {
    if (isNew) return
    try {
      const res = await fetch(`/api/admin/cosmocoat/customers/${customerId}/business-licenses`)
      const data = await res.json()
      if (!res.ok) return
      setBusinessLicenses(data.files ?? [])
    } catch {
      setBusinessLicenses([])
    }
  }, [customerId, isNew])

  const fetchCustomer = useCallback(async () => {
    if (isNew) return
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/cosmocoat/customers/${customerId}`)
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? '加载客户详情失败')
        return
      }
      const row = data.customer as CosCustomerRow
      setCustomer(row)
      setForm({
        code: row.code,
        name: row.name,
        userId: row.userId ?? '',
        phone: row.phone ?? '',
        address: row.address ?? '',
        productionEquipmentParams: row.productionEquipmentParams ?? '',
      })
      await fetchBusinessLicenses()
    } catch {
      toast.error('加载客户详情失败')
    } finally {
      setLoading(false)
    }
  }, [customerId, fetchBusinessLicenses, isNew])

  useEffect(() => {
    fetchPlatformUsers()
  }, [fetchPlatformUsers])

  useEffect(() => {
    fetchCustomer()
  }, [fetchCustomer])

  function patch<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) {
      toast.error('请填写客户名称')
      return
    }

    setSaving(true)
    try {
      const payload = {
        code: form.code.trim() || undefined,
        name: form.name.trim(),
        userId: form.userId || null,
        phone: form.phone.trim() || null,
        address: form.address.trim() || null,
        productionEquipmentParams: form.productionEquipmentParams.trim() || null,
      }

      const res = await fetch(
        isNew ? '/api/admin/cosmocoat/customers' : `/api/admin/cosmocoat/customers/${customerId}`,
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

      toast.success(isNew ? '客户已创建' : '客户资料已更新')
      if (isNew) {
        router.push(`/admin/cosmocoat-customers/${data.customer.id}`)
      } else {
        setCustomer(data.customer)
        setForm({
          code: data.customer.code,
          name: data.customer.name,
          userId: data.customer.userId ?? '',
          phone: data.customer.phone ?? '',
          address: data.customer.address ?? '',
          productionEquipmentParams: data.customer.productionEquipmentParams ?? '',
        })
      }
    } catch {
      toast.error('保存失败')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (isNew || !window.confirm(`确定删除客户「${form.name}」？此操作不可撤销。`)) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/admin/cosmocoat/customers/${customerId}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? '删除失败')
        return
      }
      toast.success('客户已删除')
      router.push('/admin/cosmocoat-customers')
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
    <div className="p-6 max-w-3xl">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              href="/admin/cosmocoat-customers"
              className="inline-flex items-center gap-1.5 text-sm"
              style={{ color: 'var(--muted-foreground)' }}
            >
              <ArrowLeft size={16} />
              返回列表
            </Link>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>
              {isNew ? '新建客户' : `客户详情 · ${customer?.code ?? form.code}`}
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/admin/cosmocoat-customers"
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
              {saving ? '保存中...' : isNew ? '创建客户' : '保存更改'}
            </button>
            {!isNew && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm disabled:opacity-50"
                style={{ border: '1px solid #5A3030', color: '#E57373' }}
              >
                <Trash2 size={14} />
                {deleting ? '删除中...' : '删除客户'}
              </button>
            )}
          </div>
        </div>
        <div className="p-5 space-y-4" style={card}>
          <h2 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>基本信息</h2>

          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="客户编码" hint={isNew ? '留空则自动生成（如 KH0001）' : undefined}>
              <input
                value={form.code}
                onChange={e => patch('code', e.target.value)}
                maxLength={32}
                placeholder={isNew ? '自动生成' : undefined}
                className="w-full rounded-lg px-3 py-2.5 text-sm outline-none"
                style={inputStyle()}
              />
            </Field>
            <Field label="客户名称 *">
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

          <Field
            label="客户账号（可选）"
            hint="可关联「客户账号管理」中维护的 CosmoCoat 平台登录账号"
          >
            <select
              value={form.userId}
              onChange={e => patch('userId', e.target.value)}
              className="w-full rounded-lg px-3 py-2.5 text-sm outline-none"
              style={inputStyle()}
            >
              <option value="">不关联平台账号</option>
              {platformUsers.map(user => (
                <option key={user.id} value={user.id}>
                  {user.email} · {user.nameEn}{user.isActive ? '' : '（已停用）'}
                </option>
              ))}
            </select>
          </Field>

          <Field label="客户电话">
            <input
              value={form.phone}
              onChange={e => patch('phone', e.target.value)}
              maxLength={50}
              className="w-full rounded-lg px-3 py-2.5 text-sm outline-none"
              style={inputStyle()}
            />
          </Field>

          <Field label="客户地址">
            <textarea
              value={form.address}
              onChange={e => patch('address', e.target.value)}
              maxLength={500}
              rows={3}
              className="w-full rounded-lg px-3 py-2.5 text-sm outline-none resize-y"
              style={inputStyle()}
            />
          </Field>

          <Field
            label="生产设备参数"
            hint="记录客户的生产设备参数信息，便于管理生产设备数据"
          >
            <textarea
              value={form.productionEquipmentParams}
              onChange={e => patch('productionEquipmentParams', e.target.value)}
              maxLength={5000}
              rows={5}
              placeholder="例如：喷涂设备型号、喷枪口径、烘烤温度与时间等"
              className="w-full rounded-lg px-3 py-2.5 text-sm outline-none resize-y"
              style={inputStyle()}
            />
          </Field>
        </div>

        {!isNew && customer && (
          <BusinessLicensesSection
            customerId={customer.id}
            files={businessLicenses}
            onRefresh={fetchBusinessLicenses}
          />
        )}

        {isNew && (
          <div className="p-5 text-xs rounded-lg" style={{ ...card, color: '#C9A96E', background: 'rgba(201,169,110,0.08)' }}>
            请先保存客户资料，再上传营业执照文件。
          </div>
        )}

        {!isNew && customer && (
          <div className="p-5 space-y-2 text-xs" style={card}>
            <div style={{ color: 'var(--muted-foreground)' }}>
              创建时间：{new Date(customer.createdAt).toLocaleString('zh-HK')}
            </div>
            <div style={{ color: 'var(--muted-foreground)' }}>
              最后更新：{new Date(customer.updatedAt).toLocaleString('zh-HK')}
            </div>
          </div>
        )}
      </form>
    </div>
  )
}
