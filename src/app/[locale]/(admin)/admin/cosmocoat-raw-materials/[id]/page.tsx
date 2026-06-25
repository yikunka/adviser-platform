'use client'

/* eslint-disable react-hooks/set-state-in-effect */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import { Link } from '@/i18n/navigation'
import { toast } from 'sonner'
import { ArrowLeft, Download, FileText, RefreshCw, Trash2, UploadCloud } from 'lucide-react'
import { CategoryComboField } from '@/components/cosmocoat/category-combo-field'
import type { RawMaterialRow } from '@/lib/cosmocoat/raw-materials'

type FileType = 'tds' | 'msds'
type RawMaterialForm = Omit<RawMaterialRow, 'id' | 'createdAt' | 'updatedAt'>

type SupplierOption = {
  id: string
  code: string
  name: string
  contactPerson: string | null
  contactInfo: string | null
  address: string | null
  shippingAddress: string | null
}

type DownloadUrlResponse = {
  success: boolean
  downloadUrl: string
  fileType: FileType
  fileKey: string
}

const ACCEPT = '.pdf,.doc,.docx,.jpg,.jpeg,.png,.webp'

const card: React.CSSProperties = {
  background: 'var(--card)',
  border: '1px solid var(--border)',
  borderRadius: '0.75rem',
}

function Field({ label, children, className = '' }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      <label className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>{label}</label>
      {children}
    </div>
  )
}

function mergeSupplierOptions(options: SupplierOption[], selected: SupplierOption | null) {
  if (!selected || options.some(option => option.id === selected.id)) return options
  return [selected, ...options]
}

function SupplierPickerField({
  label,
  value,
  options,
  search,
  onSearch,
  onChange,
  inputStyle,
}: {
  label: string
  value: string
  options: SupplierOption[]
  search: string
  onSearch: (value: string) => void
  onChange: (supplier: SupplierOption | null) => void
  inputStyle: React.CSSProperties
}) {
  return (
    <Field label={label} className="sm:col-span-2 lg:col-span-3">
      <div className="grid sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-2">
        <input
          value={search}
          onChange={e => onSearch(e.target.value)}
          placeholder="搜索供应商编号、名称、联系人、电话或地址"
          className="w-full rounded-lg px-3 py-2.5 text-sm outline-none"
          style={inputStyle}
        />
        <select
          value={value}
          onChange={e => {
            const supplier = options.find(option => option.id === e.target.value) ?? null
            onChange(supplier)
          }}
          className="w-full rounded-lg px-3 py-2.5 text-sm outline-none"
          style={inputStyle}
        >
          <option value="">不关联供应商</option>
          {options.map(supplier => (
            <option key={supplier.id} value={supplier.id}>
              {supplier.code} · {supplier.name}
              {supplier.contactPerson ? ` · ${supplier.contactPerson}` : ''}
            </option>
          ))}
        </select>
      </div>
    </Field>
  )
}

function TechDocCard({
  title,
  fileKey,
  busy,
  onUpload,
  onDownload,
  onDelete,
}: {
  title: string
  fileKey: string | null
  busy: boolean
  onUpload: (file: File) => void
  onDownload: () => void
  onDelete: () => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const hasFile = Boolean(fileKey)

  return (
    <div className="rounded-xl p-4 border" style={{ background: 'rgba(201,169,110,0.03)', borderColor: '#2A2418' }}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <FileText size={20} style={{ color: '#C9A96E', flexShrink: 0 }} />
          <span className="text-sm font-semibold truncate" style={{ color: 'var(--foreground)' }}>{title}</span>
        </div>
        <span
          className="text-[11px] px-2 py-0.5 rounded-full shrink-0"
          style={{
            background: hasFile ? 'rgba(74,159,82,0.12)' : 'rgba(122,112,96,0.12)',
            color: hasFile ? '#4A9F52' : '#7A7060',
          }}
        >
          {hasFile ? '已上传' : '未上传'}
        </span>
      </div>

      <p className="text-xs mb-3" style={{ color: 'var(--muted-foreground)' }}>
        支持 PDF、Word、JPG、PNG、WEBP，最大 10MB
      </p>

      <div className="flex flex-wrap gap-2">
        {hasFile && (
          <>
            <button
              type="button"
              onClick={onDownload}
              disabled={busy}
              className="flex-1 min-w-[7rem] flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium disabled:opacity-50 transition-opacity hover:opacity-90"
              style={{ background: '#4A9F52', color: '#fff' }}
            >
              <Download size={15} />
              下载
            </button>
            <button
              type="button"
              onClick={onDelete}
              disabled={busy}
              className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium disabled:opacity-50 transition-opacity hover:opacity-90"
              style={{ border: '1px solid #5A3030', color: '#E57373' }}
            >
              <Trash2 size={15} />
              删除
            </button>
          </>
        )}
        <label
          className={`flex-1 min-w-[7rem] flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-opacity hover:opacity-90 ${busy ? 'opacity-50 pointer-events-none' : 'cursor-pointer'}`}
          style={{ background: 'rgba(201,169,110,0.12)', color: '#C9A96E', border: '1px dashed rgba(201,169,110,0.35)' }}
        >
          <UploadCloud size={15} />
          {hasFile ? '重新上传' : '上传文件'}
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            disabled={busy}
            className="hidden"
            onChange={e => {
              const file = e.target.files?.[0]
              if (file) onUpload(file)
              e.target.value = ''
            }}
          />
        </label>
      </div>

      {busy && (
        <p className="text-xs mt-2" style={{ color: '#C9A96E' }}>处理中...</p>
      )}
    </div>
  )
}

export default function AdminCosmoCoatRawMaterialDetailPage() {
  const params = useParams()
  const materialId = params.id as string

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [fileBusy, setFileBusy] = useState<FileType | null>(null)
  const [item, setItem] = useState<RawMaterialRow | null>(null)
  const [categories, setCategories] = useState<string[]>([])
  const [primarySuppliers, setPrimarySuppliers] = useState<SupplierOption[]>([])
  const [secondarySuppliers, setSecondarySuppliers] = useState<SupplierOption[]>([])
  const [primarySupplierSearch, setPrimarySupplierSearch] = useState('')
  const [secondarySupplierSearch, setSecondarySupplierSearch] = useState('')
  const [form, setForm] = useState<RawMaterialForm>({
    category: '',
    attributeCode: '',
    productionCode: '',
    huaxingCode: '',
    name: '',
    primarySupplierId: null,
    primarySupplierCode: '',
    primarySupplierName: '',
    primarySupplierContactPerson: '',
    primarySupplierContactInfo: '',
    primarySupplierAddress: '',
    primaryPackageKg: null,
    primaryPricePerKg: null,
    primaryTaxIncluded: '',
    primaryFreightIncluded: '',
    primaryNotes: '',
    secondarySupplierId: null,
    secondarySupplierCode: '',
    secondarySupplierName: '',
    secondarySupplierContactPerson: '',
    secondarySupplierContactInfo: '',
    secondarySupplierAddress: '',
    secondaryPackageKg: null,
    secondaryPricePerKg: null,
    secondaryTaxIncluded: '',
    secondaryFreightIncluded: '',
    secondaryNotes: '',
    tdsFileKey: null,
    msdsFileKey: null,
  })

  const inputStyle: React.CSSProperties = {
    background: '#0E0E0A',
    border: '1px solid #2A2418',
    color: 'var(--foreground)',
  }

  const applyItem = useCallback((row: RawMaterialRow) => {
    setItem(row)
    setForm({
      category: row.category,
      attributeCode: row.attributeCode,
      productionCode: row.productionCode,
      huaxingCode: row.huaxingCode,
      name: row.name,
      primarySupplierId: row.primarySupplierId,
      primarySupplierCode: row.primarySupplierCode,
      primarySupplierName: row.primarySupplierName,
      primarySupplierContactPerson: row.primarySupplierContactPerson,
      primarySupplierContactInfo: row.primarySupplierContactInfo,
      primarySupplierAddress: row.primarySupplierAddress,
      primaryPackageKg: row.primaryPackageKg,
      primaryPricePerKg: row.primaryPricePerKg,
      primaryTaxIncluded: row.primaryTaxIncluded,
      primaryFreightIncluded: row.primaryFreightIncluded,
      primaryNotes: row.primaryNotes,
      secondarySupplierId: row.secondarySupplierId,
      secondarySupplierCode: row.secondarySupplierCode,
      secondarySupplierName: row.secondarySupplierName,
      secondarySupplierContactPerson: row.secondarySupplierContactPerson,
      secondarySupplierContactInfo: row.secondarySupplierContactInfo,
      secondarySupplierAddress: row.secondarySupplierAddress,
      secondaryPackageKg: row.secondaryPackageKg,
      secondaryPricePerKg: row.secondaryPricePerKg,
      secondaryTaxIncluded: row.secondaryTaxIncluded,
      secondaryFreightIncluded: row.secondaryFreightIncluded,
      secondaryNotes: row.secondaryNotes,
      tdsFileKey: row.tdsFileKey,
      msdsFileKey: row.msdsFileKey,
    })
  }, [])

  const fetchItem = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/cosmocoat/raw-materials/${materialId}`)
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? '加载失败')
        return
      }
      applyItem(data.item)
    } catch {
      toast.error('加载失败')
    } finally {
      setLoading(false)
    }
  }, [applyItem, materialId])

  useEffect(() => {
    fetchItem()
  }, [fetchItem])

  useEffect(() => {
    let cancelled = false
    fetch('/api/admin/cosmocoat/raw-materials?limit=1')
      .then(res => res.json())
      .then(data => {
        if (!cancelled) setCategories(data.categories ?? [])
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  const fetchSupplierOptions = useCallback(async (target: 'primary' | 'secondary', q: string) => {
    try {
      const params = new URLSearchParams({ limit: '50' })
      if (q.trim()) params.set('q', q.trim())
      const res = await fetch(`/api/admin/cosmocoat/raw-materials/picker/suppliers?${params}`)
      const data = await res.json()
      if (!res.ok) return
      const suppliers = (data.suppliers ?? []) as SupplierOption[]
      if (target === 'primary') {
        const selected = form.primarySupplierId
          ? {
              id: form.primarySupplierId,
              code: form.primarySupplierCode,
              name: form.primarySupplierName,
              contactPerson: form.primarySupplierContactPerson || null,
              contactInfo: form.primarySupplierContactInfo || null,
              address: form.primarySupplierAddress || null,
              shippingAddress: null,
            }
          : null
        setPrimarySuppliers(mergeSupplierOptions(suppliers, selected))
      } else {
        const selected = form.secondarySupplierId
          ? {
              id: form.secondarySupplierId,
              code: form.secondarySupplierCode,
              name: form.secondarySupplierName,
              contactPerson: form.secondarySupplierContactPerson || null,
              contactInfo: form.secondarySupplierContactInfo || null,
              address: form.secondarySupplierAddress || null,
              shippingAddress: null,
            }
          : null
        setSecondarySuppliers(mergeSupplierOptions(suppliers, selected))
      }
    } catch {
      // Supplier selection is progressive enhancement; form fields remain editable on failure.
    }
  }, [
    form.primarySupplierAddress,
    form.primarySupplierCode,
    form.primarySupplierContactInfo,
    form.primarySupplierContactPerson,
    form.primarySupplierId,
    form.primarySupplierName,
    form.secondarySupplierAddress,
    form.secondarySupplierCode,
    form.secondarySupplierContactInfo,
    form.secondarySupplierContactPerson,
    form.secondarySupplierId,
    form.secondarySupplierName,
  ])

  useEffect(() => {
    const timer = setTimeout(() => fetchSupplierOptions('primary', primarySupplierSearch), primarySupplierSearch ? 300 : 0)
    return () => clearTimeout(timer)
  }, [fetchSupplierOptions, primarySupplierSearch])

  useEffect(() => {
    const timer = setTimeout(() => fetchSupplierOptions('secondary', secondarySupplierSearch), secondarySupplierSearch ? 300 : 0)
    return () => clearTimeout(timer)
  }, [fetchSupplierOptions, secondarySupplierSearch])

  function patch<K extends keyof typeof form>(key: K, value: typeof form[K]) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  function applySupplier(prefix: 'primary' | 'secondary', supplier: SupplierOption | null) {
    const patchValues = supplier
      ? {
          [`${prefix}SupplierId`]: supplier.id,
          [`${prefix}SupplierCode`]: supplier.code,
          [`${prefix}SupplierName`]: supplier.name,
          [`${prefix}SupplierContactPerson`]: supplier.contactPerson ?? '',
          [`${prefix}SupplierContactInfo`]: supplier.contactInfo ?? '',
          [`${prefix}SupplierAddress`]: supplier.address ?? '',
        }
      : {
          [`${prefix}SupplierId`]: null,
        }

    setForm(prev => ({ ...prev, ...patchValues }))
  }

  async function uploadFile(type: FileType, file: File) {
    setFileBusy(type)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('type', type)

      const res = await fetch(`/api/admin/cosmocoat/raw-materials/${materialId}/upload`, {
        method: 'POST',
        body: fd,
      })

      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || `${type.toUpperCase()} 上传失败`)
        return
      }

      toast.success(`${type.toUpperCase()} 文件已上传`)
      await fetchItem()
    } catch {
      toast.error(`${type.toUpperCase()} 上传失败`)
    } finally {
      setFileBusy(null)
    }
  }

  async function handleDownload(fileType: FileType) {
    const fileKey = fileType === 'tds' ? form.tdsFileKey : form.msdsFileKey
    if (!fileKey) {
      toast.error(`${fileType.toUpperCase()} 文件不存在`)
      return
    }

    setFileBusy(fileType)
    try {
      const res = await fetch(`/api/admin/cosmocoat/raw-materials/${materialId}/download?type=${fileType}`)
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        toast.error((errorData as { error?: string }).error || '下载失败')
        return
      }

      const data: DownloadUrlResponse = await res.json()
      window.open(data.downloadUrl, '_blank', 'noopener,noreferrer')
    } catch {
      toast.error('下载失败，请重试')
    } finally {
      setFileBusy(null)
    }
  }

  async function handleDelete(fileType: FileType) {
    const label = fileType.toUpperCase()
    if (!window.confirm(`确定删除 ${label} 文件？此操作不可恢复。`)) return

    setFileBusy(fileType)
    try {
      const res = await fetch(`/api/admin/cosmocoat/raw-materials/${materialId}/files?type=${fileType}`, {
        method: 'DELETE',
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || `${label} 删除失败`)
        return
      }

      toast.success(`${label} 文件已删除`)
      await fetchItem()
    } catch {
      toast.error(`${label} 删除失败`)
    } finally {
      setFileBusy(null)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/cosmocoat/raw-materials/${materialId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? '保存失败')
        return
      }
      toast.success('原料已更新')
      applyItem(data.item)
    } catch {
      toast.error('保存失败')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="p-6 text-sm" style={{ color: 'var(--muted-foreground)' }}>加载中...</div>
  }

  if (!item) {
    return (
      <div className="p-6 space-y-4">
        <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>找不到该原料，可能已被删除或 ID 不存在</p>
        <Link href="/admin/cosmocoat-raw-materials" className="text-sm" style={{ color: '#C9A96E' }}>返回列表</Link>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/admin/cosmocoat-raw-materials" className="p-2 rounded-lg" style={{ border: '1px solid #2A2418', color: 'var(--muted-foreground)' }}>
            <ArrowLeft size={16} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>原料详情</h1>
            <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
              {item.productionCode} · {item.name}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={fetchItem}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-opacity hover:opacity-85"
          style={{ border: '1px solid #2A2418', color: 'var(--muted-foreground)' }}
        >
          <RefreshCw size={14} /> 刷新
        </button>
      </div>

      <div style={card} className="overflow-hidden">
        <div className="px-4 py-3 border-b" style={{ borderColor: '#2A2418' }}>
          <h3 className="text-sm font-semibold" style={{ color: '#C9A96E' }}>技术文档</h3>
        </div>
        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <TechDocCard
            title="TDS (技术数据表)"
            fileKey={form.tdsFileKey ?? null}
            busy={fileBusy === 'tds'}
            onUpload={file => uploadFile('tds', file)}
            onDownload={() => handleDownload('tds')}
            onDelete={() => handleDelete('tds')}
          />
          <TechDocCard
            title="MSDS (安全数据表)"
            fileKey={form.msdsFileKey ?? null}
            busy={fileBusy === 'msds'}
            onUpload={file => uploadFile('msds', file)}
            onDownload={() => handleDownload('msds')}
            onDelete={() => handleDelete('msds')}
          />
        </div>
      </div>

      <div style={card} className="overflow-hidden">
        <div className="px-4 py-3 border-b" style={{ borderColor: '#2A2418' }}>
          <h3 className="text-sm font-semibold" style={{ color: '#C9A96E' }}>基本信息</h3>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Field label="分类">
              <CategoryComboField
                required
                value={form.category}
                onChange={v => patch('category', v)}
                categories={categories}
                placeholder="输入或选择分类"
              />
            </Field>
            <Field label="属性代码">
              <input required value={form.attributeCode} onChange={e => patch('attributeCode', e.target.value)} className="w-full rounded-lg px-3 py-2.5 text-sm outline-none" style={inputStyle} />
            </Field>
            <Field label="生产号">
              <input required value={form.productionCode} onChange={e => patch('productionCode', e.target.value)} className="w-full rounded-lg px-3 py-2.5 text-sm outline-none" style={inputStyle} />
            </Field>
            <Field label="CAS">
              <input value={form.huaxingCode} onChange={e => patch('huaxingCode', e.target.value)} className="w-full rounded-lg px-3 py-2.5 text-sm outline-none" style={inputStyle} />
            </Field>
            <Field label="名称" className="sm:col-span-2">
              <input required value={form.name} onChange={e => patch('name', e.target.value)} className="w-full rounded-lg px-3 py-2.5 text-sm outline-none" style={inputStyle} />
            </Field>
          </div>
        </form>
      </div>

      <div style={card} className="overflow-hidden">
        <div className="px-4 py-3 border-b" style={{ borderColor: '#2A2418' }}>
          <h3 className="text-sm font-semibold" style={{ color: '#C9A96E' }}>主供应商信息</h3>
        </div>
        <div className="p-4">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <SupplierPickerField
              label="关联供应商"
              value={form.primarySupplierId ?? ''}
              options={primarySuppliers}
              search={primarySupplierSearch}
              onSearch={setPrimarySupplierSearch}
              onChange={supplier => applySupplier('primary', supplier)}
              inputStyle={inputStyle}
            />
            <Field label="供应商编号">
              <input value={form.primarySupplierCode} onChange={e => patch('primarySupplierCode', e.target.value)} className="w-full rounded-lg px-3 py-2.5 text-sm outline-none" style={inputStyle} />
            </Field>
            <Field label="供应商名称" className="sm:col-span-2">
              <input value={form.primarySupplierName} onChange={e => patch('primarySupplierName', e.target.value)} className="w-full rounded-lg px-3 py-2.5 text-sm outline-none" style={inputStyle} />
            </Field>
            <Field label="联系人">
              <input value={form.primarySupplierContactPerson} onChange={e => patch('primarySupplierContactPerson', e.target.value)} className="w-full rounded-lg px-3 py-2.5 text-sm outline-none" style={inputStyle} />
            </Field>
            <Field label="联系方式">
              <input value={form.primarySupplierContactInfo} onChange={e => patch('primarySupplierContactInfo', e.target.value)} className="w-full rounded-lg px-3 py-2.5 text-sm outline-none" style={inputStyle} />
            </Field>
            <Field label="地址">
              <input value={form.primarySupplierAddress} onChange={e => patch('primarySupplierAddress', e.target.value)} className="w-full rounded-lg px-3 py-2.5 text-sm outline-none" style={inputStyle} />
            </Field>
            <Field label="包装 (KG)">
              <input type="number" min={0} step="0.01" value={form.primaryPackageKg ?? ''} onChange={e => patch('primaryPackageKg', e.target.value === '' ? null : Number(e.target.value))} className="w-full rounded-lg px-3 py-2.5 text-sm outline-none" style={inputStyle} />
            </Field>
            <Field label="价格 (KG)">
              <input type="number" min={0} step="0.0001" value={form.primaryPricePerKg ?? ''} onChange={e => patch('primaryPricePerKg', e.target.value === '' ? null : Number(e.target.value))} className="w-full rounded-lg px-3 py-2.5 text-sm outline-none" style={inputStyle} />
            </Field>
            <Field label="含税 / 运费">
              <div className="flex gap-2">
                <select value={form.primaryTaxIncluded} onChange={e => patch('primaryTaxIncluded', e.target.value)} className="flex-1 rounded-lg px-3 py-2.5 text-sm outline-none" style={inputStyle}>
                  <option value="">--</option>
                  <option value="Y">含税：是</option>
                  <option value="N">含税：否</option>
                </select>
                <select value={form.primaryFreightIncluded} onChange={e => patch('primaryFreightIncluded', e.target.value)} className="flex-1 rounded-lg px-3 py-2.5 text-sm outline-none" style={inputStyle}>
                  <option value="">--</option>
                  <option value="Y">运费：是</option>
                  <option value="N">运费：否</option>
                </select>
              </div>
            </Field>
            <Field label="备注" className="sm:col-span-2 lg:col-span-3">
              <input value={form.primaryNotes} onChange={e => patch('primaryNotes', e.target.value)} className="w-full rounded-lg px-3 py-2.5 text-sm outline-none" style={inputStyle} />
            </Field>
          </div>
        </div>
      </div>

      <div style={card} className="overflow-hidden">
        <div className="px-4 py-3 border-b" style={{ borderColor: '#2A2418' }}>
          <h3 className="text-sm font-semibold" style={{ color: '#C9A96E' }}>备用供应商信息</h3>
        </div>
        <div className="p-4">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <SupplierPickerField
              label="关联供应商"
              value={form.secondarySupplierId ?? ''}
              options={secondarySuppliers}
              search={secondarySupplierSearch}
              onSearch={setSecondarySupplierSearch}
              onChange={supplier => applySupplier('secondary', supplier)}
              inputStyle={inputStyle}
            />
            <Field label="供应商编号">
              <input value={form.secondarySupplierCode} onChange={e => patch('secondarySupplierCode', e.target.value)} className="w-full rounded-lg px-3 py-2.5 text-sm outline-none" style={inputStyle} />
            </Field>
            <Field label="供应商名称" className="sm:col-span-2">
              <input value={form.secondarySupplierName} onChange={e => patch('secondarySupplierName', e.target.value)} className="w-full rounded-lg px-3 py-2.5 text-sm outline-none" style={inputStyle} />
            </Field>
            <Field label="联系人">
              <input value={form.secondarySupplierContactPerson} onChange={e => patch('secondarySupplierContactPerson', e.target.value)} className="w-full rounded-lg px-3 py-2.5 text-sm outline-none" style={inputStyle} />
            </Field>
            <Field label="联系方式">
              <input value={form.secondarySupplierContactInfo} onChange={e => patch('secondarySupplierContactInfo', e.target.value)} className="w-full rounded-lg px-3 py-2.5 text-sm outline-none" style={inputStyle} />
            </Field>
            <Field label="地址">
              <input value={form.secondarySupplierAddress} onChange={e => patch('secondarySupplierAddress', e.target.value)} className="w-full rounded-lg px-3 py-2.5 text-sm outline-none" style={inputStyle} />
            </Field>
            <Field label="包装 (KG)">
              <input type="number" min={0} step="0.01" value={form.secondaryPackageKg ?? ''} onChange={e => patch('secondaryPackageKg', e.target.value === '' ? null : Number(e.target.value))} className="w-full rounded-lg px-3 py-2.5 text-sm outline-none" style={inputStyle} />
            </Field>
            <Field label="价格 (KG)">
              <input type="number" min={0} step="0.0001" value={form.secondaryPricePerKg ?? ''} onChange={e => patch('secondaryPricePerKg', e.target.value === '' ? null : Number(e.target.value))} className="w-full rounded-lg px-3 py-2.5 text-sm outline-none" style={inputStyle} />
            </Field>
            <Field label="含税 / 运费">
              <div className="flex gap-2">
                <select value={form.secondaryTaxIncluded} onChange={e => patch('secondaryTaxIncluded', e.target.value)} className="flex-1 rounded-lg px-3 py-2.5 text-sm outline-none" style={inputStyle}>
                  <option value="">--</option>
                  <option value="Y">含税：是</option>
                  <option value="N">含税：否</option>
                </select>
                <select value={form.secondaryFreightIncluded} onChange={e => patch('secondaryFreightIncluded', e.target.value)} className="flex-1 rounded-lg px-3 py-2.5 text-sm outline-none" style={inputStyle}>
                  <option value="">--</option>
                  <option value="Y">运费：是</option>
                  <option value="N">运费：否</option>
                </select>
              </div>
            </Field>
            <Field label="备注" className="sm:col-span-2 lg:col-span-3">
              <input value={form.secondaryNotes} onChange={e => patch('secondaryNotes', e.target.value)} className="w-full rounded-lg px-3 py-2.5 text-sm outline-none" style={inputStyle} />
            </Field>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 pt-2">
        <Link href="/admin/cosmocoat-raw-materials" className="flex-1 py-2.5 rounded-lg text-sm font-medium text-center transition-opacity hover:opacity-85" style={{ border: '1px solid #2A2418', color: 'var(--muted-foreground)' }}>
          返回列表
        </Link>
        <button type="button" onClick={handleSubmit} disabled={saving} className="flex-1 py-2.5 rounded-lg text-sm font-medium disabled:opacity-60 transition-opacity hover:opacity-85" style={{ background: '#C9A96E', color: '#0A0805' }}>
          {saving ? '保存中...' : '保存更改'}
        </button>
      </div>
    </div>
  )
}
