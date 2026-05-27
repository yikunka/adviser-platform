'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { FlaskConical, Pencil, Plus, Search, Trash2, UploadCloud, FileText, CheckCircle, XCircle } from 'lucide-react'
import type { RawMaterialRow } from '@/lib/cosmocoat/raw-materials'

type RawMaterialForm = Omit<RawMaterialRow, 'id' | 'createdAt' | 'updatedAt'>

const emptyForm: RawMaterialForm = {
  category: '',
  attributeCode: '',
  productionCode: '',
  huaxingCode: '',
  name: '',
  primarySupplierCode: '',
  primarySupplierName: '',
  primaryPackageKg: null,
  primaryPricePerKg: null,
  primaryTaxIncluded: '',
  primaryFreightIncluded: '',
  primaryNotes: '',
  secondarySupplierCode: '',
  secondarySupplierName: '',
  secondaryPackageKg: null,
  secondaryPricePerKg: null,
  secondaryTaxIncluded: '',
  secondaryFreightIncluded: '',
  secondaryNotes: '',
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
}

function inputStyle(): React.CSSProperties {
  return {
    background: '#0E0E0A',
    border: '1px solid #2A2418',
    color: 'var(--foreground)',
  }
}

function ynLabel(value: string) {
  if (value === 'Y') return '是'
  if (value === 'N') return '否'
  return '—'
}

function numOrEmpty(value: number | null) {
  return value == null ? '—' : String(value)
}

function Field({ label, children, className = '' }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      <label className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>{label}</label>
      {children}
    </div>
  )
}

function SupplierFields({
  prefix,
  form,
  patch,
}: {
  prefix: 'primary' | 'secondary'
  form: RawMaterialForm
  patch: <K extends keyof RawMaterialForm>(key: K, value: RawMaterialForm[K]) => void
}) {
  const codeKey = `${prefix}SupplierCode` as keyof RawMaterialForm
  const nameKey = `${prefix}SupplierName` as keyof RawMaterialForm
  const pkgKey = `${prefix}PackageKg` as keyof RawMaterialForm
  const priceKey = `${prefix}PricePerKg` as keyof RawMaterialForm
  const taxKey = `${prefix}TaxIncluded` as keyof RawMaterialForm
  const freightKey = `${prefix}FreightIncluded` as keyof RawMaterialForm
  const notesKey = `${prefix}Notes` as keyof RawMaterialForm

  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
      <Field label="供应商编号">
        <input value={String(form[codeKey] ?? '')} onChange={e => patch(codeKey, e.target.value)} className="w-full rounded-lg px-3 py-2.5 text-sm outline-none" style={inputStyle()} />
      </Field>
      <Field label="供应商名称" className="sm:col-span-2">
        <input value={String(form[nameKey] ?? '')} onChange={e => patch(nameKey, e.target.value)} className="w-full rounded-lg px-3 py-2.5 text-sm outline-none" style={inputStyle()} />
      </Field>
      <Field label="包装 (KG)">
        <input type="number" min={0} step="0.01" value={form[pkgKey] ?? ''} onChange={e => patch(pkgKey, e.target.value === '' ? null : Number(e.target.value))} className="w-full rounded-lg px-3 py-2.5 text-sm outline-none" style={inputStyle()} />
      </Field>
      <Field label="价格 (KG)">
        <input type="number" min={0} step="0.0001" value={form[priceKey] ?? ''} onChange={e => patch(priceKey, e.target.value === '' ? null : Number(e.target.value))} className="w-full rounded-lg px-3 py-2.5 text-sm outline-none" style={inputStyle()} />
      </Field>
      <Field label="含税 / 运费">
        <div className="flex gap-2">
          <select value={String(form[taxKey] ?? '')} onChange={e => patch(taxKey, e.target.value as RawMaterialForm[typeof taxKey])} className="flex-1 rounded-lg px-3 py-2.5 text-sm outline-none" style={inputStyle()}>
            <option value="">含税</option>
            <option value="Y">含税：是</option>
            <option value="N">含税：否</option>
          </select>
          <select value={String(form[freightKey] ?? '')} onChange={e => patch(freightKey, e.target.value as RawMaterialForm[typeof freightKey])} className="flex-1 rounded-lg px-3 py-2.5 text-sm outline-none" style={inputStyle()}>
            <option value="">运费</option>
            <option value="Y">运费：是</option>
            <option value="N">运费：否</option>
          </select>
        </div>
      </Field>
      <Field label="备注" className="sm:col-span-2 lg:col-span-3">
        <input value={String(form[notesKey] ?? '')} onChange={e => patch(notesKey, e.target.value)} className="w-full rounded-lg px-3 py-2.5 text-sm outline-none" style={inputStyle()} />
      </Field>
    </div>
  )
}

function RawMaterialModal({
  item,
  categories,
  attributes,
  onClose,
  onSaved,
}: {
  item: RawMaterialRow | null
  categories: string[]
  attributes: string[]
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState<RawMaterialForm>(item ?? emptyForm)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState<string | null>(null)
  const isEditing = !!item

  function patch<K extends keyof RawMaterialForm>(key: K, value: RawMaterialForm[K]) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  async function uploadFile(type: 'tds' | 'msds', file: File) {
    if (!item?.id) return
    setUploading(type)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('type', type)
      
      const res = await fetch(`/api/admin/cosmocoat/raw-materials/${item.id}/upload`, {
        method: 'POST',
        body: fd,
      })
      
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || `${type.toUpperCase()} 上传失败`)
        return
      }
      
      toast.success(`${type.toUpperCase()} 文件上传成功`)
      // Refresh the list to show updated status
      onSaved()
    } catch {
      toast.error(`${type.toUpperCase()} 上传失败`)
    } finally {
      setUploading(type)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await fetch(
        isEditing ? `/api/admin/cosmocoat/raw-materials/${item.id}` : '/api/admin/cosmocoat/raw-materials',
        {
          method: isEditing ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        },
      )
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? '保存失败')
        return
      }
      toast.success(isEditing ? '原料已更新' : '原料已添加')
      onSaved()
      onClose()
    } catch {
      toast.error('保存失败')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl p-6 space-y-5" style={{ background: '#111111', border: '1px solid #2A2418' }}>
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold" style={{ color: 'var(--foreground)' }}>
            {isEditing ? '编辑原料' : '添加原料'}
          </h2>
          <button type="button" onClick={onClose} className="px-3 py-1 rounded-md text-sm" style={{ color: 'var(--muted-foreground)' }}>关闭</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-3">
            <h3 className="text-sm font-semibold" style={{ color: '#C9A96E' }}>基本信息</h3>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <Field label="分类">
                <input list="category-options" required value={form.category} onChange={e => patch('category', e.target.value)} className="w-full rounded-lg px-3 py-2.5 text-sm outline-none" style={inputStyle()} />
                <datalist id="category-options">{categories.map(c => <option key={c} value={c} />)}</datalist>
              </Field>
              <Field label="属性">
                <input list="attribute-options" required value={form.attributeCode} onChange={e => patch('attributeCode', e.target.value)} className="w-full rounded-lg px-3 py-2.5 text-sm outline-none" style={inputStyle()} />
                <datalist id="attribute-options">{attributes.map(a => <option key={a} value={a} />)}</datalist>
              </Field>
              <Field label="生产号">
                <input required value={form.productionCode} onChange={e => patch('productionCode', e.target.value)} className="w-full rounded-lg px-3 py-2.5 text-sm outline-none" style={inputStyle()} placeholder="AD-0001" />
              </Field>
              <Field label="华兴号">
                <input value={form.huaxingCode} onChange={e => patch('huaxingCode', e.target.value)} className="w-full rounded-lg px-3 py-2.5 text-sm outline-none" style={inputStyle()} />
              </Field>
              <Field label="名称" className="sm:col-span-2">
                <input required value={form.name} onChange={e => patch('name', e.target.value)} className="w-full rounded-lg px-3 py-2.5 text-sm outline-none" style={inputStyle()} />
              </Field>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-semibold" style={{ color: '#C9A96E' }}>主供应商</h3>
            <SupplierFields prefix="primary" form={form} patch={patch} />
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-semibold" style={{ color: '#C9A96E' }}>备用供应商</h3>
            <SupplierFields prefix="secondary" form={form} patch={patch} />
          </div>

          {/* TDS and MSDS file upload */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold" style={{ color: '#C9A96E' }}>技术文档</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* TDS upload */}
              <div style={card} className="p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>TDS (技术数据表)</span>
                  {form.tdsFileKey ? (
                    <CheckCircle size={16} style={{ color: '#4A9F52' }} />
                  ) : (
                    <XCircle size={16} style={{ color: '#7A7060' }} />
                  )}
                </div>
                <p className="text-xs mb-2" style={{ color: '#7A7060' }}>支持 PDF、Word、JPG、PNG，最大 10MB</p>
                <label className="flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm cursor-pointer transition-opacity hover:opacity-85"
                  style={{ background: form.tdsFileKey ? 'rgba(74,159,82,0.12)' : 'rgba(201,169,110,0.12)', color: form.tdsFileKey ? '#4A9F52' : '#C9A96E' }}>
                  <UploadCloud size={14} />
                  {form.tdsFileKey ? '重新上传' : '上传文件'}
                  <input 
                    type="file" 
                    accept=".pdf,.doc,.docx,.jpg,.png,.webp" 
                    disabled={!!uploading}
                    className="hidden" 
                    onChange={async e => {
                      const file = e.target.files?.[0]
                      if (file) {
                        await uploadFile('tds', file)
                        e.target.value = ''
                      }
                    }} 
                  />
                </label>
                {uploading === 'tds' && <p className="text-xs mt-1" style={{ color: '#C9A96E' }}>上传中...</p>}
              </div>

              {/* MSDS upload */}
              <div style={card} className="p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>MSDS (安全数据表)</span>
                  {form.msdsFileKey ? (
                    <CheckCircle size={16} style={{ color: '#4A9F52' }} />
                  ) : (
                    <XCircle size={16} style={{ color: '#7A7060' }} />
                  )}
                </div>
                <p className="text-xs mb-2" style={{ color: '#7A7060' }}>支持 PDF、Word、JPG、PNG，最大 10MB</p>
                <label className="flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm cursor-pointer transition-opacity hover:opacity-85"
                  style={{ background: form.msdsFileKey ? 'rgba(74,159,82,0.12)' : 'rgba(201,169,110,0.12)', color: form.msdsFileKey ? '#4A9F52' : '#C9A96E' }}>
                  <UploadCloud size={14} />
                  {form.msdsFileKey ? '重新上传' : '上传文件'}
                  <input 
                    type="file" 
                    accept=".pdf,.doc,.docx,.jpg,.png,.webp" 
                    disabled={!!uploading}
                    className="hidden" 
                    onChange={async e => {
                      const file = e.target.files?.[0]
                      if (file) {
                        await uploadFile('msds', file)
                        e.target.value = ''
                      }
                    }} 
                  />
                </label>
                {uploading === 'msds' && <p className="text-xs mt-1" style={{ color: '#C9A96E' }}>上传中...</p>}
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-lg text-sm font-medium" style={{ border: '1px solid #2A2418', color: 'var(--muted-foreground)' }}>取消</button>
            <button type="submit" disabled={saving} className="flex-1 py-2.5 rounded-lg text-sm font-medium disabled:opacity-60" style={{ background: '#C9A96E', color: '#0A0805' }}>
              {saving ? '保存中...' : '保存'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function AdminCosmoCoatRawMaterialsPage() {
  const [items, setItems] = useState<RawMaterialRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [categories, setCategories] = useState<string[]>([])
  const [attributes, setAttributes] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [attribute, setAttribute] = useState('')
  const [modalItem, setModalItem] = useState<RawMaterialRow | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)

  const fetchItems = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: '50' })
      if (search.trim()) params.set('q', search.trim())
      if (category) params.set('category', category)
      if (attribute) params.set('attribute', attribute)
      const res = await fetch(`/api/admin/cosmocoat/raw-materials?${params}`)
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? '加载失败')
        return
      }
      setItems(data.items ?? [])
      setTotal(data.total ?? 0)
      setTotalPages(data.totalPages ?? 1)
      setCategories(data.categories ?? [])
      setAttributes(data.attributes ?? [])
    } catch {
      toast.error('加载失败')
    } finally {
      setLoading(false)
    }
  }, [search, category, attribute, page])

  useEffect(() => {
    const t = setTimeout(fetchItems, search ? 300 : 0)
    return () => clearTimeout(t)
  }, [fetchItems, search])

  useEffect(() => {
    setPage(1)
  }, [search, category, attribute])

  function openCreate() {
    setModalItem(null)
    setShowModal(true)
  }

  function openEdit(item: RawMaterialRow) {
    setModalItem(item)
    setShowModal(true)
  }

  async function deleteItem(item: RawMaterialRow) {
    if (!window.confirm(`确定删除 ${item.productionCode} ${item.name}？`)) return
    setDeletingId(item.id)
    try {
      const res = await fetch(`/api/admin/cosmocoat/raw-materials/${item.id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? '删除失败')
        return
      }
      toast.success('已删除')
      fetchItems()
    } catch {
      toast.error('删除失败')
    } finally {
      setDeletingId(null)
    }
  }

  async function importExcel(file: File, mode: 'upsert' | 'replace') {
    if (mode === 'replace' && !window.confirm('将清空现有原料并全量导入，确定继续？')) return
    setImporting(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('mode', mode)
      const res = await fetch('/api/admin/cosmocoat/raw-materials/import', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? '导入失败')
        return
      }
      if (mode === 'replace') {
        toast.success(`已导入 ${data.imported} 条原料`)
      } else {
        toast.success(`新增 ${data.imported} 条，更新 ${data.updated} 条`)
      }
      fetchItems()
    } catch {
      toast.error('导入失败')
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>CosmoCoat 原料管理</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
            管理工厂原料清单、生产号、供应商与价格信息，支持 Excel 导入。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <label className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-opacity hover:opacity-85 cursor-pointer" style={{ background: 'rgba(201,169,110,0.12)', color: '#C9A96E', border: '1px solid rgba(201,169,110,0.25)' }}>
            <UploadCloud size={15} />
            {importing ? '导入中...' : 'Excel 导入'}
            <input type="file" accept=".xlsx,.xls" disabled={importing} className="hidden" onChange={e => {
              const file = e.target.files?.[0]
              if (file) importExcel(file, 'upsert')
              e.target.value = ''
            }} />
          </label>
          <label className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-opacity hover:opacity-85 cursor-pointer" style={{ border: '1px solid #2A2418', color: 'var(--muted-foreground)' }}>
            全量替换
            <input type="file" accept=".xlsx,.xls" disabled={importing} className="hidden" onChange={e => {
              const file = e.target.files?.[0]
              if (file) importExcel(file, 'replace')
              e.target.value = ''
            }} />
          </label>
          <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-opacity hover:opacity-85" style={{ background: '#C9A96E', color: '#0A0805' }}>
            <Plus size={15} />
            添加原料
          </button>
        </div>
      </div>

      <div style={card} className="p-4 flex flex-wrap gap-3">
        <select value={category} onChange={e => setCategory(e.target.value)} className="rounded-lg px-3 py-2 text-sm outline-none" style={inputStyle()}>
          <option value="">全部分类</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={attribute} onChange={e => setAttribute(e.target.value)} className="rounded-lg px-3 py-2 text-sm outline-none" style={inputStyle()}>
          <option value="">全部属性</option>
          {attributes.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <div className="relative flex-1 min-w-[14rem]">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--muted-foreground)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="搜索生产号、名称、供应商..." className="w-full pl-8 pr-3 py-2 rounded-lg text-sm outline-none" style={inputStyle()} />
        </div>
      </div>

      <div style={{ ...card, overflow: 'hidden' }}>
        {loading ? (
          <div className="py-16 text-center text-sm" style={{ color: 'var(--muted-foreground)' }}>加载中...</div>
        ) : items.length === 0 ? (
          <div className="py-16 text-center space-y-3">
            <FlaskConical size={32} className="mx-auto" style={{ color: '#5A5040' }} />
            <p className="text-sm" style={{ color: '#5A5040' }}>暂无原料数据，可上传 Excel 或手动添加。</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th style={th}>生产号</th>
                  <th style={th}>分类</th>
                  <th style={th}>属性</th>
                  <th style={th}>名称</th>
                  <th style={th}>主供应商</th>
                  <th style={th}>包装/KG</th>
                  <th style={th}>价格/KG</th>
                  <th style={th}>TDS</th>
                  <th style={th}>MSDS</th>
                  <th style={{ ...th, textAlign: 'right' }}>操作</th>
                </tr>
              </thead>
              <tbody>
                {items.map(item => (
                  <tr key={item.id} className="cursor-pointer transition-colors hover:bg-[#111108]" onClick={() => openEdit(item)}>
                    <td style={{ ...td, color: 'var(--foreground)', fontWeight: 500 }}>{item.productionCode}</td>
                    <td style={td}>{item.category || '—'}</td>
                    <td style={td}>{item.attributeCode || '—'}</td>
                    <td style={{ ...td, minWidth: '14rem', maxWidth: '20rem' }}>
                      <p className="truncate" title={item.name}>{item.name}</p>
                      {item.huaxingCode && <p className="text-xs truncate" style={{ color: '#7A7060' }}>华兴号：{item.huaxingCode}</p>}
                    </td>
                    <td style={td}>{item.primarySupplierName || '—'}</td>
                    <td style={td}>{numOrEmpty(item.primaryPackageKg)}</td>
                    <td style={td}>{numOrEmpty(item.primaryPricePerKg)}</td>
                    <td style={td} className="text-center">
                      {item.tdsFileKey ? (
                        <span title="已上传 TDS"><CheckCircle size={16} style={{ color: '#4A9F52', margin: '0 auto' }} /></span>
                      ) : (
                        <span title="未上传"><XCircle size={16} style={{ color: '#7A7060', margin: '0 auto' }} /></span>
                      )}
                    </td>
                    <td style={td} className="text-center">
                      {item.msdsFileKey ? (
                        <span title="已上传 MSDS"><CheckCircle size={16} style={{ color: '#4A9F52', margin: '0 auto' }} /></span>
                      ) : (
                        <span title="未上传"><XCircle size={16} style={{ color: '#7A7060', margin: '0 auto' }} /></span>
                      )}
                    </td>
                    <td style={{ ...td, textAlign: 'right' }}>
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={e => { e.stopPropagation(); openEdit(item) }} className="p-1.5 rounded-md" style={{ color: 'var(--muted-foreground)' }}>
                          <Pencil size={14} />
                        </button>
                        <button onClick={e => { e.stopPropagation(); deleteItem(item) }} disabled={deletingId === item.id} className="p-1.5 rounded-md disabled:opacity-40" style={{ color: 'var(--muted-foreground)' }}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {!loading && total > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs" style={{ color: '#5A5040' }}>
          <span>共 {total} 条原料</span>
          <div className="flex items-center gap-2">
            <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1.5 rounded-md disabled:opacity-40" style={{ border: '1px solid #2A2418' }}>上一页</button>
            <span>{page} / {totalPages}</span>
            <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="px-3 py-1.5 rounded-md disabled:opacity-40" style={{ border: '1px solid #2A2418' }}>下一页</button>
          </div>
        </div>
      )}

      {showModal && (
        <RawMaterialModal
          item={modalItem}
          categories={categories}
          attributes={attributes}
          onClose={() => setShowModal(false)}
          onSaved={fetchItems}
        />
      )}
    </div>
  )
}
