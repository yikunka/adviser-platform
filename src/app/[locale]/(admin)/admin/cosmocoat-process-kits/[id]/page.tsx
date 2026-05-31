'use client'

/* eslint-disable react-hooks/set-state-in-effect */

import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Link, useRouter } from '@/i18n/navigation'
import { toast } from 'sonner'
import { ArrowLeft, Plus, Save, Trash2 } from 'lucide-react'
import { DatetimeLocalPicker } from '@/components/ui/date-picker-popover'
import { cn } from '@/lib/utils'

type FactoryProductOption = {
  id: string
  productCode: string
  name: string
}

type KitProduct = {
  id: string
  productId: string
  productName: string
  sortOrder: number
  quantityRatio: string | null
  usageMethod: string
  notes: string | null
}

type KitTest = {
  id: string
  testType: string
  testResult: string
  testDate: string
  testerName: string
  reportLink: string | null
  testNotes: string | null
  passedAt: string | null
}

type KitStatus = 'DRAFT' | 'ACTIVE' | 'ARCHIVED'

type LoadedKit = {
  code: string
  name: string
  description?: string | null
  materials?: string[]
  otherNote?: string | null
  status: KitStatus
  products?: KitProduct[]
  tests?: KitTest[]
}

const MATERIALS = [
  { id: 'ABS', label: 'ABS' },
  { id: 'SAN', label: 'SAN' },
  { id: 'PC', label: 'PC' },
  { id: 'PC_BF', label: 'PC+ 玻纖' },
  { id: 'PP', label: 'PP' },
  { id: 'PETG', label: 'PETG' },
  { id: 'PET', label: 'PET' },
  { id: 'PCTA', label: 'PCTA' },
  { id: 'PS', label: 'PS' },
  { id: 'PE', label: 'PE' },
  { id: 'PMMA', label: 'PMMA' },
  { id: 'NYLON', label: '尼龍' },
  { id: 'ALUMINUM', label: '鋁合金' },
  { id: 'ZINC', label: '鋅合金' },
  { id: 'STAINLESS_302', label: '302' },
  { id: 'STAINLESS_304', label: '304' },
  { id: 'COPPER', label: '銅' },
  { id: 'GLASS', label: '玻璃' },
  { id: 'OTHER', label: '其他 (需註明)' },
]

const card: React.CSSProperties = {
  background: 'var(--card)',
  border: '1px solid var(--border)',
  borderRadius: '0.75rem',
}

const th: React.CSSProperties = {
  textAlign: 'left',
  padding: '0.6rem 0.75rem',
  fontWeight: 500,
  fontSize: '0.8125rem',
  color: 'var(--muted-foreground)',
  background: '#111108',
  borderBottom: '1px solid #2A2418',
  whiteSpace: 'nowrap',
}

const td: React.CSSProperties = {
  padding: '0.6rem 0.75rem',
  fontSize: '0.8125rem',
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

const dateTimePickerStyle: React.CSSProperties = {
  background: '#0E0E0A',
  border: '1px solid #2A2418',
  color: 'var(--foreground)',
  borderRadius: '0.5rem',
  fontSize: '0.875rem',
}

function toDatetimeLocal(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function fromDatetimeLocal(value: string): string | null {
  if (!value.trim()) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

const TEST_TYPES = [
  'PERFORMANCE',
  'DURABILITY',
  'ADHESION',
  'COLOR_STABILITY',
  'BOND_STRENGTH',
  'OTHER',
] as const

const TEST_RESULTS = ['PENDING', 'PASSED', 'FAILED'] as const

function ResultBadge({ result, label }: { result: string; label: string }) {
  const colors: Record<string, { bg: string; text: string }> = {
    PENDING: { bg: 'rgba(148, 163, 184, 0.15)', text: '#94a3b8' },
    PASSED: { bg: 'rgba(16, 185, 129, 0.15)', text: '#10b981' },
    FAILED: { bg: 'rgba(239, 68, 68, 0.15)', text: '#ef4444' },
  }
  const c = colors[result] ?? colors.PENDING
  return (
    <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: c.bg, color: c.text }}>
      {label}
    </span>
  )
}

export default function AdminCosmoCoatProcessKitDetailPage() {
  const t = useTranslations('admin.processKits')
  const params = useParams()
  const router = useRouter()
  const kitId = params.id as string
  const isNew = kitId === 'new'

  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [products, setProducts] = useState<FactoryProductOption[]>([])

  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [selectedMaterials, setSelectedMaterials] = useState<string[]>([])
  const [otherNote, setOtherNote] = useState('')
  const [status, setStatus] = useState<KitStatus>('DRAFT')
  const [kitProducts, setKitProducts] = useState<KitProduct[]>([])
  const [tests, setTests] = useState<KitTest[]>([])

  const [showProductForm, setShowProductForm] = useState(false)
  const [addingProduct, setAddingProduct] = useState(false)
  const [productForm, setProductForm] = useState({
    productId: '',
    quantityRatio: '',
    usageMethod: '',
    notes: '',
  })

  const [showTestForm, setShowTestForm] = useState(false)
  const [addingTest, setAddingTest] = useState(false)
  const [testForm, setTestForm] = useState({
    testType: 'PERFORMANCE' as typeof TEST_TYPES[number],
    testResult: 'PENDING' as typeof TEST_RESULTS[number],
    testDate: toDatetimeLocal(new Date().toISOString()),
    testerName: '',
    reportLink: '',
    testNotes: '',
  })

  const hasOther = selectedMaterials.includes('OTHER')

  function toggleMaterial(materialId: string) {
    setSelectedMaterials(prev => {
      if (prev.includes(materialId)) {
        if (materialId === 'OTHER') setOtherNote('')
        return prev.filter(id => id !== materialId)
      }
      return [...prev, materialId]
    })
  }

  const loadProducts = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/cosmocoat/factory-products?limit=500')
      const data = await res.json()
      if (!res.ok) return
      setProducts((data.items ?? []).map((p: FactoryProductOption) => ({
        id: p.id,
        productCode: p.productCode,
        name: p.name,
      })))
    } catch {
      // non-blocking
    }
  }, [])

  const loadKit = useCallback(async () => {
    if (isNew) return
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/cosmocoat/process-kits/${kitId}`)
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? t('loadFailed'))
        return
      }
      const kit = data.kit as LoadedKit
      setCode(kit.code)
      setName(kit.name)
      setDescription(kit.description ?? '')
      const loadedMaterials: string[] = kit.materials ?? []
      const loadedOtherNote: string = kit.otherNote ?? ''
      setSelectedMaterials(
        loadedOtherNote ? [...loadedMaterials, 'OTHER'] : loadedMaterials,
      )
      setOtherNote(loadedOtherNote)
      setStatus(kit.status)
      setKitProducts(kit.products ?? [])
      setTests(kit.tests ?? [])
    } catch {
      toast.error(t('loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [isNew, kitId, t])

  useEffect(() => {
    loadProducts()
    if (isNew) setLoading(false)
  }, [loadProducts, isNew])

  useEffect(() => {
    if (!isNew) loadKit()
  }, [isNew, loadKit])

  async function saveKit() {
    if (!name.trim()) {
      toast.error(t('nameRequired'))
      return
    }

    if (selectedMaterials.length === 0) {
      toast.error(t('materialRequired'))
      return
    }

    if (hasOther && !otherNote.trim()) {
      toast.error(t('otherNoteRequired'))
      return
    }

    setSaving(true)
    const kitData = {
      name: name.trim(),
      description: description.trim() || null,
      materials: selectedMaterials.filter(id => id !== 'OTHER'),
      otherNote: hasOther && otherNote.trim() ? otherNote.trim() : null,
      ...(!isNew ? { status } : {}),
    }
    const payload = isNew
      ? { code: code.trim() || undefined, ...kitData }
      : kitData

    try {
      const res = await fetch(
        isNew ? '/api/admin/cosmocoat/process-kits' : `/api/admin/cosmocoat/process-kits/${kitId}`,
        {
          method: isNew ? 'POST' : 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
      )
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? t('saveFailed'))
        return
      }
      toast.success(isNew ? t('created') : t('saved'))
      if (isNew && data.kit?.id) {
        router.replace(`/admin/cosmocoat-process-kits/${data.kit.id}`)
      } else {
        loadKit()
      }
    } catch {
      toast.error(t('saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  async function addProduct() {
    if (!productForm.productId || !productForm.usageMethod.trim()) {
      toast.error(t('productFormRequired'))
      return
    }
    setAddingProduct(true)
    try {
      const res = await fetch(`/api/admin/cosmocoat/process-kits/${kitId}/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: productForm.productId,
          quantityRatio: productForm.quantityRatio,
          usageMethod: productForm.usageMethod.trim(),
          notes: productForm.notes,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? t('addProductFailed'))
        return
      }
      toast.success(t('productAdded'))
      setKitProducts(data.kit?.products ?? [])
      setProductForm({ productId: '', quantityRatio: '', usageMethod: '', notes: '' })
      setShowProductForm(false)
    } catch {
      toast.error(t('addProductFailed'))
    } finally {
      setAddingProduct(false)
    }
  }

  async function removeProduct(productId: string) {
    if (!window.confirm(t('removeProductConfirm'))) return
    try {
      const res = await fetch(`/api/admin/cosmocoat/process-kits/${kitId}/products`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: productId }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? t('removeProductFailed'))
        return
      }
      toast.success(t('productRemoved'))
      setKitProducts(data.kit?.products ?? [])
    } catch {
      toast.error(t('removeProductFailed'))
    }
  }

  async function addTest() {
    if (!testForm.testerName.trim()) {
      toast.error(t('testerRequired'))
      return
    }
    const testDate = fromDatetimeLocal(testForm.testDate)
    if (!testDate) {
      toast.error(t('testDateRequired'))
      return
    }

    setAddingTest(true)
    try {
      const res = await fetch(`/api/admin/cosmocoat/process-kits/${kitId}/tests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          testType: testForm.testType,
          testResult: testForm.testResult,
          testDate,
          testerName: testForm.testerName.trim(),
          reportLink: testForm.reportLink,
          testNotes: testForm.testNotes,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? t('addTestFailed'))
        return
      }
      toast.success(t('testAdded'))
      setTests(data.kit?.tests ?? [])
      setTestForm({
        testType: 'PERFORMANCE',
        testResult: 'PENDING',
        testDate: toDatetimeLocal(new Date().toISOString()),
        testerName: '',
        reportLink: '',
        testNotes: '',
      })
      setShowTestForm(false)
    } catch {
      toast.error(t('addTestFailed'))
    } finally {
      setAddingTest(false)
    }
  }

  if (loading) {
    return <div className="p-6 text-sm" style={{ color: 'var(--muted-foreground)' }}>{t('loading')}</div>
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/admin/cosmocoat-process-kits" className="p-2 rounded-lg" style={{ border: '1px solid #2A2418', color: 'var(--muted-foreground)' }}>
            <ArrowLeft size={16} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>
              {isNew ? t('createTitle') : t('detailTitle')}
            </h1>
            <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
              {isNew ? t('createSubtitle') : `${code} · ${name}`}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={saveKit}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
          style={{ background: '#C9A96E', color: '#0A0805' }}
        >
          <Save size={14} /> {saving ? t('saving') : (isNew ? t('create') : t('save'))}
        </button>
      </div>

      <div style={card} className="p-4 space-y-4">
        <h3 className="text-sm font-semibold" style={{ color: '#C9A96E' }}>{t('basicInfo')}</h3>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>{t('code')}</label>
            <input
              value={code}
              onChange={e => setCode(e.target.value)}
              readOnly={!isNew}
              placeholder={isNew ? t('codePlaceholder') : undefined}
              className={`w-full rounded-lg px-3 py-2.5 text-sm outline-none ${!isNew ? 'opacity-70' : ''}`}
              style={inputStyle()}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <label className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>{t('name')}</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full rounded-lg px-3 py-2.5 text-sm outline-none"
              style={inputStyle()}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>{t('status')}</label>
            <select
              value={status}
              onChange={e => setStatus(e.target.value as KitStatus)}
              className="w-full rounded-lg px-3 py-2.5 text-sm outline-none"
              style={inputStyle()}
            >
              <option value="DRAFT">{t('statuses.DRAFT')}</option>
              <option value="ACTIVE">{t('statuses.ACTIVE')}</option>
              <option value="ARCHIVED">{t('statuses.ARCHIVED')}</option>
            </select>
          </div>
          <div className="space-y-1.5 sm:col-span-2 lg:col-span-3">
            <label className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>{t('description')}</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={3}
              className="w-full rounded-lg px-3 py-2 text-sm outline-none resize-y"
              style={inputStyle()}
              placeholder={t('descriptionPlaceholder')}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-3">
            <label className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>{t('materials')}</label>
            <p className="text-xs mb-2" style={{ color: 'var(--muted-foreground)' }}>{t('selectMaterialsHint')}</p>
            <div className="flex flex-wrap gap-2">
              {MATERIALS.map(material => (
                <button
                  key={material.id}
                  type="button"
                  onClick={() => toggleMaterial(material.id)}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs transition-all border',
                    selectedMaterials.includes(material.id)
                      ? 'bg-[#C9A96E] border-[#C9A96E] text-[#0A0805]'
                      : 'bg-[#0E0E0A] border-[#2A2418] text-[var(--muted-foreground)] hover:border-[#4A4030]',
                  )}
                >
                  {material.label}
                </button>
              ))}
            </div>
            {hasOther && (
              <div className="space-y-1.5 pt-2">
                <label className="text-xs font-medium text-[var(--muted-foreground)]">
                  {t('otherNoteLabel')}
                  <span className="text-red-500 ml-0.5">*</span>
                </label>
                <input
                  type="text"
                  value={otherNote}
                  onChange={e => setOtherNote(e.target.value)}
                  placeholder={t('otherNotePlaceholder')}
                  className="w-full rounded-lg px-3 py-2.5 text-sm outline-none"
                  style={inputStyle()}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {!isNew && (
        <>
          <div style={{ ...card, overflow: 'hidden' }}>
            <div className="px-4 py-3 border-b flex flex-wrap items-center justify-between gap-2" style={{ borderColor: '#2A2418' }}>
              <h3 className="text-sm font-semibold" style={{ color: '#C9A96E' }}>{t('productsSection')}</h3>
              <button
                type="button"
                onClick={() => setShowProductForm(v => !v)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
                style={{ background: '#1A1A12', border: '1px solid #2A2418', color: 'var(--foreground)' }}
              >
                <Plus size={13} /> {t('addProduct')}
              </button>
            </div>

            {showProductForm && (
              <div className="p-4 border-b space-y-3" style={{ borderColor: '#2A2418', background: '#0E0E0A' }}>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5 sm:col-span-2">
                    <label className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>{t('selectProduct')}</label>
                    <select
                      value={productForm.productId}
                      onChange={e => setProductForm(f => ({ ...f, productId: e.target.value }))}
                      className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                      style={inputStyle()}
                    >
                      <option value="">{t('selectProductPlaceholder')}</option>
                      {products.map(p => (
                        <option key={p.id} value={p.id}>{p.productCode} · {p.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>{t('quantityRatio')}</label>
                    <input
                      value={productForm.quantityRatio}
                      onChange={e => setProductForm(f => ({ ...f, quantityRatio: e.target.value }))}
                      placeholder={t('quantityRatioPlaceholder')}
                      className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                      style={inputStyle()}
                    />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <label className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>{t('usageMethod')}</label>
                    <textarea
                      value={productForm.usageMethod}
                      onChange={e => setProductForm(f => ({ ...f, usageMethod: e.target.value }))}
                      rows={2}
                      className="w-full rounded-lg px-3 py-2 text-sm outline-none resize-y"
                      style={inputStyle()}
                    />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <label className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>{t('notes')}</label>
                    <input
                      value={productForm.notes}
                      onChange={e => setProductForm(f => ({ ...f, notes: e.target.value }))}
                      className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                      style={inputStyle()}
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={addProduct}
                    disabled={addingProduct}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-50"
                    style={{ background: '#C9A96E', color: '#0A0805' }}
                  >
                    {addingProduct ? t('saving') : t('confirmAdd')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowProductForm(false)}
                    className="px-3 py-1.5 rounded-lg text-xs"
                    style={{ border: '1px solid #2A2418', color: 'var(--muted-foreground)' }}
                  >
                    {t('cancel')}
                  </button>
                </div>
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    <th style={th}>#</th>
                    <th style={th}>{t('productName')}</th>
                    <th style={th}>{t('quantityRatio')}</th>
                    <th style={th}>{t('usageMethod')}</th>
                    <th style={th}>{t('notes')}</th>
                    <th style={{ ...th, textAlign: 'right' }}>{t('actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {kitProducts.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ ...td, textAlign: 'center', padding: '2rem' }}>{t('noProducts')}</td>
                    </tr>
                  ) : kitProducts.map((p, index) => (
                    <tr key={p.id}>
                      <td style={td}>{index + 1}</td>
                      <td style={{ ...td, color: 'var(--foreground)' }}>{p.productName}</td>
                      <td style={td}>{p.quantityRatio || '—'}</td>
                      <td style={td}>{p.usageMethod}</td>
                      <td style={td}>{p.notes || '—'}</td>
                      <td style={{ ...td, textAlign: 'right' }}>
                        <button
                          type="button"
                          onClick={() => removeProduct(p.id)}
                          className="p-1.5 rounded-md"
                          style={{ color: '#ef4444' }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div style={{ ...card, overflow: 'hidden' }}>
            <div className="px-4 py-3 border-b flex flex-wrap items-center justify-between gap-2" style={{ borderColor: '#2A2418' }}>
              <h3 className="text-sm font-semibold" style={{ color: '#C9A96E' }}>{t('testsSection')}</h3>
              <button
                type="button"
                onClick={() => setShowTestForm(v => !v)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
                style={{ background: '#1A1A12', border: '1px solid #2A2418', color: 'var(--foreground)' }}
              >
                <Plus size={13} /> {t('addTest')}
              </button>
            </div>

            {showTestForm && (
              <div className="p-4 border-b space-y-3" style={{ borderColor: '#2A2418', background: '#0E0E0A' }}>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>{t('testType')}</label>
                    <select
                      value={testForm.testType}
                      onChange={e => setTestForm(f => ({ ...f, testType: e.target.value as typeof TEST_TYPES[number] }))}
                      className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                      style={inputStyle()}
                    >
                      {TEST_TYPES.map(type => (
                        <option key={type} value={type}>{t(`testTypes.${type}`)}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>{t('testResult')}</label>
                    <select
                      value={testForm.testResult}
                      onChange={e => setTestForm(f => ({ ...f, testResult: e.target.value as typeof TEST_RESULTS[number] }))}
                      className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                      style={inputStyle()}
                    >
                      {TEST_RESULTS.map(r => (
                        <option key={r} value={r}>{t(`testResults.${r}`)}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>{t('testDate')}</label>
                    <DatetimeLocalPicker
                      value={testForm.testDate}
                      onChange={v => setTestForm(f => ({ ...f, testDate: v }))}
                      datePlaceholder={t('selectDate')}
                      dateTriggerStyle={{ ...dateTimePickerStyle, width: '100%', padding: '0.5rem 0.75rem' }}
                      timeInputStyle={dateTimePickerStyle}
                      timeInputClassName="outline-none"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>{t('testerName')}</label>
                    <input
                      value={testForm.testerName}
                      onChange={e => setTestForm(f => ({ ...f, testerName: e.target.value }))}
                      className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                      style={inputStyle()}
                    />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <label className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>{t('reportLink')}</label>
                    <input
                      value={testForm.reportLink}
                      onChange={e => setTestForm(f => ({ ...f, reportLink: e.target.value }))}
                      placeholder="https://"
                      className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                      style={inputStyle()}
                    />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2 lg:col-span-3">
                    <label className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>{t('testNotes')}</label>
                    <textarea
                      value={testForm.testNotes}
                      onChange={e => setTestForm(f => ({ ...f, testNotes: e.target.value }))}
                      rows={2}
                      className="w-full rounded-lg px-3 py-2 text-sm outline-none resize-y"
                      style={inputStyle()}
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={addTest}
                    disabled={addingTest}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-50"
                    style={{ background: '#C9A96E', color: '#0A0805' }}
                  >
                    {addingTest ? t('saving') : t('confirmAdd')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowTestForm(false)}
                    className="px-3 py-1.5 rounded-lg text-xs"
                    style={{ border: '1px solid #2A2418', color: 'var(--muted-foreground)' }}
                  >
                    {t('cancel')}
                  </button>
                </div>
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    <th style={th}>{t('testType')}</th>
                    <th style={th}>{t('testResult')}</th>
                    <th style={th}>{t('testDate')}</th>
                    <th style={th}>{t('testerName')}</th>
                    <th style={th}>{t('reportLink')}</th>
                    <th style={th}>{t('testNotes')}</th>
                  </tr>
                </thead>
                <tbody>
                  {tests.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ ...td, textAlign: 'center', padding: '2rem' }}>{t('noTests')}</td>
                    </tr>
                  ) : tests.map(test => (
                    <tr key={test.id}>
                      <td style={td}>{t(`testTypes.${test.testType}`)}</td>
                      <td style={td}>
                        <ResultBadge result={test.testResult} label={t(`testResults.${test.testResult}`)} />
                      </td>
                      <td style={td}>{new Date(test.testDate).toLocaleString()}</td>
                      <td style={td}>{test.testerName}</td>
                      <td style={td}>
                        {test.reportLink
                          ? <a href={test.reportLink} target="_blank" rel="noreferrer" className="underline" style={{ color: '#C9A96E' }}>{t('viewReport')}</a>
                          : '—'}
                      </td>
                      <td style={td}>{test.testNotes || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {isNew && (
        <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>{t('saveFirstHint')}</p>
      )}
    </div>
  )
}
