'use client'

/* eslint-disable react-hooks/set-state-in-effect */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { Link, useRouter } from '@/i18n/navigation'
import { toast } from 'sonner'
import { ArrowLeft, Plus, Save, Search, Trash2 } from 'lucide-react'
import type { CosColorFormulaCategory } from '@prisma/client'
import { ColorFormulaCategoryFields } from '@/components/cosmocoat/ColorFormulaCategoryFields'
import type { ColorFormulaFactoryProductOption } from '@/lib/cosmocoat/color-formula-factory-products'
import type { FullColorFormula } from '@/lib/cosmocoat/color-formulas'
import {
  computeItemAmount,
  computeItemPercentage,
  computeRecipeTotals,
  formatMoney,
  formatPercent,
} from '@/lib/cosmocoat/recipes'

type PickerMaterial = {
  optionType: 'raw_material' | 'product_semifinished'
  id: string
  productionCode: string
  name: string
  attributeCode: string
  category: string
  primaryPackageKg: number | null
  primaryPricePerKg: number | null
  primaryNotes: string
}

type EditableItem = {
  key: string
  itemType: 'raw_material' | 'product_semifinished' | 'manual'
  rawMaterialId: string | null
  productSemifinishedId: string | null
  productionCode: string
  name: string
  attributeCode: string
  quantity: number
  unitPrice: number | null
  amount: number
  notes: string
}

function normalizeItemType(value: string): EditableItem['itemType'] {
  if (value === 'product_semifinished') return 'product_semifinished'
  if (value === 'manual') return 'manual'
  return 'raw_material'
}

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

function toEditableItem(item: FullColorFormula['items'][number]): EditableItem {
  return {
    key: item.id,
    itemType: normalizeItemType(item.itemType),
    rawMaterialId: item.rawMaterialId,
    productSemifinishedId: item.productSemifinishedId,
    productionCode: item.productionCode,
    name: item.name,
    attributeCode: item.attributeCode,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    amount: item.amount ?? computeItemAmount(item.quantity, item.unitPrice),
    notes: item.notes,
  }
}

function toEditableFromPicker(m: PickerMaterial): EditableItem {
  const unitPrice = m.primaryPricePerKg
  const quantity = 0
  return {
    key: crypto.randomUUID(),
    itemType: m.optionType,
    rawMaterialId: m.optionType === 'raw_material' ? m.id : null,
    productSemifinishedId: m.optionType === 'product_semifinished' ? m.id : null,
    productionCode: m.productionCode,
    name: m.name,
    attributeCode: m.attributeCode,
    quantity,
    unitPrice,
    amount: computeItemAmount(quantity, unitPrice),
    notes: '',
  }
}

function toManualItem(): EditableItem {
  return {
    key: crypto.randomUUID(),
    itemType: 'manual',
    rawMaterialId: null,
    productSemifinishedId: null,
    productionCode: '',
    name: '',
    attributeCode: '',
    quantity: 0,
    unitPrice: null,
    amount: 0,
    notes: '',
  }
}

const PICKER_TYPE_OPTIONS = [
  { key: 'AD', label: 'AD' },
  { key: 'SO', label: 'SO' },
  { key: 'Sol', label: 'Sol 半成品' },
  { key: 'DY', label: 'DY' },
  { key: 'CO', label: 'CO' },
  { key: 'CA', label: 'CA' },
  { key: 'CC', label: 'CC' },
] as const

export default function CosmocoatColorFormulaDetailPage() {
  const params = useParams()
  const router = useRouter()
  const formulaId = params.id as string
  const isNew = formulaId === 'new'

  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [category, setCategory] = useState<CosColorFormulaCategory>('PU')
  const [factoryProductId, setFactoryProductId] = useState<string | null>(null)
  const [factoryProducts, setFactoryProducts] = useState<ColorFormulaFactoryProductOption[]>([])
  const [lastAutoCode, setLastAutoCode] = useState('')
  const [colorCode, setColorCode] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [targetColor, setTargetColor] = useState('')
  const [batchQuantity, setBatchQuantity] = useState(100)
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState<EditableItem[]>([])
  const [pickerQuery, setPickerQuery] = useState('')
  const [pickerMaterials, setPickerMaterials] = useState<PickerMaterial[]>([])
  const [selectedPickerKey, setSelectedPickerKey] = useState('')
  const [pickerTypes, setPickerTypes] = useState<string[]>(PICKER_TYPE_OPTIONS.map(option => option.key))

  const loadFormula = useCallback(async () => {
    if (isNew) return
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/cosmocoat/color-formulas/${formulaId}`)
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? '加载失败')
        return
      }
      const formula = data.formula as FullColorFormula
      setCode(formula.code)
      setName(formula.name)
      setCategory(formula.category)
      setFactoryProductId(formula.factoryProductId)
      setColorCode(formula.colorCode)
      setCustomerName(formula.customerName)
      setTargetColor(formula.targetColor)
      setBatchQuantity(formula.batchQuantity)
      setNotes(formula.notes)
      setItems(formula.items.map(toEditableItem))
    } catch {
      toast.error('加载失败')
    } finally {
      setLoading(false)
    }
  }, [formulaId, isNew])

  useEffect(() => {
    loadFormula()
  }, [loadFormula])

  const handleProductsLoaded = useCallback((products: ColorFormulaFactoryProductOption[]) => {
    setFactoryProducts(products)
  }, [])

  const selectedFactoryProduct = useMemo(
    () => factoryProducts.find(product => product.id === factoryProductId),
    [factoryProducts, factoryProductId],
  )

  useEffect(() => {
    if (!isNew) return
    if (!selectedFactoryProduct?.productCode) {
      if (code && code === lastAutoCode) setCode('')
      if (lastAutoCode) setLastAutoCode('')
      return
    }
    if (code && code !== lastAutoCode) return

    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(
          `/api/admin/cosmocoat/color-formulas/by-product/${encodeURIComponent(selectedFactoryProduct.productCode)}`,
        )
        const data = await res.json()
        if (!res.ok || cancelled) return

        const prefix = `${selectedFactoryProduct.productCode}-`
        const maxNumber = (data.formulas ?? []).reduce((max: number, formula: { code?: string }) => {
          if (!formula.code?.startsWith(prefix)) return max
          const suffix = formula.code.slice(prefix.length)
          if (!/^\d{4}$/.test(suffix)) return max
          return Math.max(max, Number(suffix))
        }, 0)
        const nextCode = `${prefix}${String(maxNumber + 1).padStart(4, '0')}`
        setCode(nextCode)
        setLastAutoCode(nextCode)
        if (!name.trim()) setName(`${selectedFactoryProduct.name} 调色配方`)
      } catch {
        /* keep manual entry available */
      }
    })()

    return () => {
      cancelled = true
    }
  }, [code, isNew, lastAutoCode, name, selectedFactoryProduct])

  useEffect(() => {
    const q = pickerQuery.trim()
    const t = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ limit: '40' })
        if (q) params.set('q', q)
        pickerTypes.forEach(type => params.append('type', type))
        const res = await fetch(`/api/admin/cosmocoat/color-formulas/material-options?${params}`)
        const data = await res.json()
        if (res.ok) setPickerMaterials(data.items ?? [])
      } catch {
        /* ignore */
      }
    }, q ? 250 : 0)
    return () => clearTimeout(t)
  }, [pickerQuery, pickerTypes])

  const totals = useMemo(() => {
    const withAmount = items.map(item => ({
      quantity: item.quantity,
      amount: computeItemAmount(item.quantity, item.unitPrice),
    }))
    return computeRecipeTotals(withAmount, batchQuantity)
  }, [items, batchQuantity])

  const totalQuantity = totals.totalQuantity

  function updateItem(key: string, patch: Partial<EditableItem>) {
    setItems(prev =>
      prev.map(item => {
        if (item.key !== key) return item
        const next = { ...item, ...patch }
        next.amount = computeItemAmount(next.quantity, next.unitPrice)
        return next
      }),
    )
  }

  function addMaterial() {
    const material = pickerMaterials.find(m => `${m.optionType}:${m.id}` === selectedPickerKey)
    if (!material) {
      toast.error('请先选择原料')
      return
    }
    if (
      material.optionType === 'raw_material' &&
      items.some(i => i.rawMaterialId === material.id)
    ) {
      toast.error('该原料已在配方中')
      return
    }
    if (
      material.optionType === 'product_semifinished' &&
      items.some(i => i.productSemifinishedId === material.id)
    ) {
      toast.error('该半成品已在配方中')
      return
    }
    setItems(prev => [...prev, toEditableFromPicker(material)])
    setSelectedPickerKey('')
    toast.success(material.optionType === 'product_semifinished' ? '已添加半成品' : '已添加原料')
  }

  function addManualRow() {
    setItems(prev => [...prev, toManualItem()])
    toast.success('已添加空白行')
  }

  function togglePickerType(type: string) {
    setPickerTypes(prev =>
      prev.includes(type)
        ? prev.filter(item => item !== type)
        : [...prev, type],
    )
  }

  function removeItem(key: string) {
    setItems(prev => prev.filter(i => i.key !== key))
  }

  async function saveFormula() {
    if (!name.trim()) {
      toast.error('请填写配方名称')
      return
    }

    setSaving(true)
    const payload = {
      code: code.trim() || undefined,
      name: name.trim(),
      category,
      factoryProductId,
      colorCode,
      customerName,
      targetColor,
      batchQuantity,
      notes,
      items: items.map((item, index) => ({
        rawMaterialId: item.rawMaterialId,
        productSemifinishedId: item.productSemifinishedId,
        productionCode: item.productionCode,
        name: item.name,
        attributeCode: item.attributeCode,
        sortOrder: index + 1,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        notes: item.notes,
      })),
    }

    try {
      const res = await fetch(
        isNew ? '/api/admin/cosmocoat/color-formulas' : `/api/admin/cosmocoat/color-formulas/${formulaId}`,
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
      toast.success(isNew ? '调色配方已创建' : '已保存')
      if (isNew && data.formula?.id) {
        router.replace(`/admin/cosmocoat-color-formulas/${data.formula.id}`)
      } else {
        loadFormula()
      }
    } catch {
      toast.error('保存失败')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="p-6 text-sm" style={{ color: 'var(--muted-foreground)' }}>加载中...</div>
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/admin/cosmocoat-color-formulas" className="p-2 rounded-lg" style={{ border: '1px solid #2A2418', color: 'var(--muted-foreground)' }}>
            <ArrowLeft size={16} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>
              {isNew ? '新建调色配方' : '调色配方详情'}
            </h1>
            <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
              {isNew ? '填写基本信息并添加原料' : `${code} · ${name}`}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={saveFormula}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
          style={{ background: '#C9A96E', color: '#0A0805' }}
        >
          <Save size={14} /> {saving ? '保存中...' : (isNew ? '创建' : '保存')}
        </button>
      </div>

      <div style={card} className="p-4 space-y-4">
        <h3 className="text-sm font-semibold" style={{ color: '#C9A96E' }}>基本信息</h3>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <ColorFormulaCategoryFields
            className="sm:col-span-2 lg:col-span-2"
            category={category}
            factoryProductId={factoryProductId}
            onCategoryChange={setCategory}
            onFactoryProductChange={setFactoryProductId}
            onProductsLoaded={handleProductsLoaded}
            inputStyle={inputStyle()}
          />
          <div className="space-y-1.5">
            <label className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>配方编号</label>
            <input value={code} onChange={e => setCode(e.target.value)} placeholder="留空自动生成" className="w-full rounded-lg px-3 py-2.5 text-sm outline-none" style={inputStyle()} />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>配方名称</label>
            <input required value={name} onChange={e => setName(e.target.value)} className="w-full rounded-lg px-3 py-2.5 text-sm outline-none" style={inputStyle()} />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>基准批量 (kg)</label>
            <input type="number" min={0.001} step={0.001} value={batchQuantity} onChange={e => setBatchQuantity(Number(e.target.value) || 100)} className="w-full rounded-lg px-3 py-2.5 text-sm outline-none" style={inputStyle()} />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>色号</label>
            <input value={colorCode} onChange={e => setColorCode(e.target.value)} className="w-full rounded-lg px-3 py-2.5 text-sm outline-none" style={inputStyle()} />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>目标色</label>
            <input value={targetColor} onChange={e => setTargetColor(e.target.value)} className="w-full rounded-lg px-3 py-2.5 text-sm outline-none" style={inputStyle()} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <label className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>客户</label>
            <input value={customerName} onChange={e => setCustomerName(e.target.value)} className="w-full rounded-lg px-3 py-2.5 text-sm outline-none" style={inputStyle()} />
          </div>
          <div className="space-y-1.5 sm:col-span-2 lg:col-span-4">
            <label className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>备注</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className="w-full rounded-lg px-3 py-2.5 text-sm outline-none resize-y" style={inputStyle()} />
          </div>
        </div>
      </div>

      <div style={card} className="p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-semibold" style={{ color: '#C9A96E' }}>原料明细</h3>
          <div className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
            合计 {formatMoney(totals.totalAmount)} · 成本单价 {formatMoney(totals.unitCost)} / {batchQuantity} kg
          </div>
        </div>

        <div className="flex flex-wrap gap-2 items-end">
          <div className="relative flex-1 min-w-[12rem]">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--muted-foreground)' }} />
            <input
              value={pickerQuery}
              onChange={e => setPickerQuery(e.target.value)}
              placeholder="搜索原料..."
              className="w-full pl-8 pr-3 py-2 rounded-lg text-sm outline-none"
              style={inputStyle()}
            />
          </div>
          <select value={selectedPickerKey} onChange={e => setSelectedPickerKey(e.target.value)} className="rounded-lg px-3 py-2 text-sm outline-none min-w-[14rem]" style={inputStyle()}>
            <option value="">选择原料</option>
            {pickerMaterials.map(m => (
              <option key={`${m.optionType}:${m.id}`} value={`${m.optionType}:${m.id}`}>
                {m.attributeCode} · {m.productionCode} · {m.name}
              </option>
            ))}
          </select>
          <button type="button" onClick={addMaterial} className="px-4 py-2 rounded-lg text-sm font-medium" style={{ background: '#C9A96E', color: '#0A0805' }}>
            添加
          </button>
          <button type="button" onClick={addManualRow} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium" style={{ border: '1px solid #2A2418', color: 'var(--foreground)' }}>
            <Plus size={14} /> 空白行
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>类型筛选</span>
          {PICKER_TYPE_OPTIONS.map(option => (
            <label key={option.key} className="inline-flex items-center gap-1.5 rounded px-2 py-1 text-xs" style={{ border: '1px solid #2A2418', color: 'var(--muted-foreground)' }}>
              <input
                type="checkbox"
                checked={pickerTypes.includes(option.key)}
                onChange={() => togglePickerType(option.key)}
              />
              {option.label}
            </label>
          ))}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th style={th}>生产编号</th>
                <th style={th}>名称</th>
                <th style={th}>属性</th>
                <th style={th}>数量</th>
                <th style={th}>单价</th>
                <th style={th}>金额</th>
                <th style={th}>占比</th>
                <th style={th}>备注</th>
                <th style={{ ...th, width: 48 }} />
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ ...td, textAlign: 'center', padding: '2rem' }}>暂无原料，请搜索并添加</td>
                </tr>
              ) : (
                items.map(item => (
                  <tr key={item.key}>
                    <td style={{ ...td, color: 'var(--foreground)' }}>
                      {item.itemType === 'manual' ? (
                        <input
                          value={item.productionCode}
                          onChange={e => updateItem(item.key, { productionCode: e.target.value })}
                          className="w-28 rounded px-2 py-1 text-sm outline-none"
                          style={inputStyle()}
                        />
                      ) : (
                        item.productionCode
                      )}
                    </td>
                    <td style={td}>
                      {item.itemType === 'manual' ? (
                        <input
                          value={item.name}
                          onChange={e => updateItem(item.key, { name: e.target.value })}
                          className="w-full min-w-[10rem] rounded px-2 py-1 text-sm outline-none"
                          style={inputStyle()}
                        />
                      ) : (
                        item.name
                      )}
                    </td>
                    <td style={td}>
                      {item.itemType === 'manual' ? (
                        <input
                          value={item.attributeCode}
                          onChange={e => updateItem(item.key, { attributeCode: e.target.value })}
                          className="w-24 rounded px-2 py-1 text-sm outline-none"
                          style={inputStyle()}
                        />
                      ) : (
                        item.attributeCode
                      )}
                    </td>
                    <td style={td}>
                      <input
                        type="number"
                        min={0}
                        step={0.001}
                        value={item.quantity}
                        onChange={e => updateItem(item.key, { quantity: Number(e.target.value) || 0 })}
                        className="w-24 rounded px-2 py-1 text-sm outline-none"
                        style={inputStyle()}
                      />
                    </td>
                    <td style={td}>
                      <input
                        type="number"
                        min={0}
                        step={0.0001}
                        value={item.unitPrice ?? ''}
                        onChange={e => updateItem(item.key, { unitPrice: e.target.value === '' ? null : Number(e.target.value) })}
                        className="w-24 rounded px-2 py-1 text-sm outline-none"
                        style={inputStyle()}
                      />
                    </td>
                    <td style={td}>{formatMoney(item.amount)}</td>
                    <td style={td}>{formatPercent(computeItemPercentage(item.quantity, totalQuantity))}</td>
                    <td style={td}>
                      <input
                        value={item.notes}
                        onChange={e => updateItem(item.key, { notes: e.target.value })}
                        className="w-full min-w-[8rem] rounded px-2 py-1 text-sm outline-none"
                        style={inputStyle()}
                      />
                    </td>
                    <td style={td}>
                      <button type="button" onClick={() => removeItem(item.key)} className="p-1.5 rounded" style={{ color: '#ef4444' }}>
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
