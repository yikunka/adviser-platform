'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { Link, useRouter } from '@/i18n/navigation'
import { toast } from 'sonner'
import { ArrowLeft, Save } from 'lucide-react'
import {
  buildProductionOrderItems,
  formatPercent,
  formatWeight,
} from '@/lib/cosmocoat/recipes'
import { DatetimeLocalPicker } from '@/components/ui/date-picker-popover'

type FactoryProductOption = {
  id: string
  productCode: string
  name: string
  unit: string
  productionRequirements: string
  qualityCheckRequirements: string
  packagingRequirements: string
  currentRecipe: { id: string; code: string; name: string } | null
}

type RecipeItem = {
  sortOrder: number
  quantity: number
  percentage: number | null
  notes: string
  rawMaterial: { id: string; productionCode: string; name: string }
}

type EditableItem = {
  key: string
  id?: string
  rawMaterialId: string
  sortOrder: number
  productionCode: string
  materialName: string
  percentage: number
  requiredWeight: number
  actualWeight: number | null
  notes: string
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

export default function AdminCosmoCoatProductionOrderEditorPage() {
  const params = useParams()
  const router = useRouter()
  const orderId = params.id as string
  const isNew = orderId === 'new'

  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [products, setProducts] = useState<FactoryProductOption[]>([])
  const [recipeItems, setRecipeItems] = useState<RecipeItem[]>([])

  const [code, setCode] = useState('')
  const [factoryProductId, setFactoryProductId] = useState('')
  const [recipeCode, setRecipeCode] = useState('')
  const [recipeName, setRecipeName] = useState('')
  const [productName, setProductName] = useState('')
  const [productUnit, setProductUnit] = useState('kg')
  const [totalWeight, setTotalWeight] = useState(100)
  const [batchNo, setBatchNo] = useState('')
  const [startedAt, setStartedAt] = useState('')
  const [finishedAt, setFinishedAt] = useState('')
  const [productionNotes, setProductionNotes] = useState('')
  const [qualityNotes, setQualityNotes] = useState('')
  const [packagingNotes, setPackagingNotes] = useState('')
  const [status, setStatus] = useState<'draft' | 'completed'>('draft')
  const [items, setItems] = useState<EditableItem[]>([])

  const selectedProduct = useMemo(
    () => products.find(p => p.id === factoryProductId) ?? null,
    [products, factoryProductId],
  )

  const requiredTotal = useMemo(
    () => items.reduce((sum, item) => sum + item.requiredWeight, 0),
    [items],
  )

  const loadProducts = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/cosmocoat/factory-products?limit=200')
      const data = await res.json()
      if (!res.ok) return
      setProducts((data.items ?? []).map((p: FactoryProductOption) => ({
        id: p.id,
        productCode: p.productCode,
        name: p.name,
        unit: p.unit,
        productionRequirements: p.productionRequirements,
        qualityCheckRequirements: p.qualityCheckRequirements,
        packagingRequirements: p.packagingRequirements,
        currentRecipe: p.currentRecipe,
      })))
    } catch {
      // non-blocking
    }
  }, [])

  const loadRecipeItems = useCallback(async (recipeId: string) => {
    try {
      const res = await fetch(`/api/admin/cosmocoat/recipes/${recipeId}`)
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? '加载配方失败')
        setRecipeItems([])
        return
      }
      const recipe = data.recipe
      setRecipeCode(recipe.code)
      setRecipeName(recipe.name)
      setRecipeItems(recipe.items.map((item: {
        sortOrder: number
        quantity: number
        percentage: number | null
        notes: string
        rawMaterial: { id: string; productionCode: string; name: string }
      }) => ({
        sortOrder: item.sortOrder,
        quantity: item.quantity,
        percentage: item.percentage,
        notes: item.notes,
        rawMaterial: item.rawMaterial,
      })))
    } catch {
      toast.error('加载配方失败')
      setRecipeItems([])
    }
  }, [])

  const loadOrder = useCallback(async () => {
    if (isNew) return
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/cosmocoat/production-orders/${orderId}`)
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? '加载生产单失败')
        return
      }
      const order = data.order
      setCode(order.code)
      setFactoryProductId(order.factoryProductId)
      setProductName(order.factoryProduct.name)
      setProductUnit(order.factoryProduct.unit)
      setRecipeCode(order.recipe.code)
      setRecipeName(order.recipe.name)
      setTotalWeight(order.totalWeight)
      setBatchNo(order.batchNo)
      setStartedAt(toDatetimeLocal(order.startedAt))
      setFinishedAt(toDatetimeLocal(order.finishedAt))
      setProductionNotes(order.productionNotes || order.productionRequirements)
      setQualityNotes(order.qualityNotes || order.qualityCheckRequirements)
      setPackagingNotes(order.packagingNotes || order.packagingRequirements)
      setStatus(order.status === 'completed' ? 'completed' : 'draft')
      setItems(order.items.map((item: {
        id: string
        sortOrder: number
        productionCode: string
        materialName: string
        percentage: number
        requiredWeight: number
        actualWeight: number | null
        notes: string
        rawMaterial: { id: string }
      }) => ({
        key: item.id,
        id: item.id,
        rawMaterialId: item.rawMaterial.id,
        sortOrder: item.sortOrder,
        productionCode: item.productionCode,
        materialName: item.materialName,
        percentage: item.percentage,
        requiredWeight: item.requiredWeight,
        actualWeight: item.actualWeight,
        notes: item.notes,
      })))
    } catch {
      toast.error('加载生产单失败')
    } finally {
      setLoading(false)
    }
  }, [orderId, isNew])

  useEffect(() => {
    loadProducts().finally(() => {
      if (isNew) setLoading(false)
    })
  }, [loadProducts, isNew])

  useEffect(() => {
    if (!isNew) loadOrder()
  }, [isNew, loadOrder])

  useEffect(() => {
    if (!isNew || !factoryProductId) return
    const product = products.find(p => p.id === factoryProductId)
    if (!product) return
    setProductName(product.name)
    setProductUnit(product.unit)
    setProductionNotes(product.productionRequirements)
    setQualityNotes(product.qualityCheckRequirements)
    setPackagingNotes(product.packagingRequirements)
    if (!product.currentRecipe) {
      setRecipeCode('')
      setRecipeName('')
      setRecipeItems([])
      toast.error('该产品未设置当前配方')
      return
    }
    loadRecipeItems(product.currentRecipe.id)
  }, [factoryProductId, products, isNew, loadRecipeItems])

  useEffect(() => {
    if (isNew) {
      setBatchNo(code)
    }
  }, [code, isNew])

  useEffect(() => {
    if (!isNew || recipeItems.length === 0 || totalWeight <= 0) {
      if (isNew && recipeItems.length === 0) setItems([])
      return
    }
    setItems(prev => {
      const actualByMaterial = new Map(prev.map(item => [item.rawMaterialId, item.actualWeight]))
      return buildProductionOrderItems(recipeItems, totalWeight).map(item => ({
        key: item.rawMaterialId,
        rawMaterialId: item.rawMaterialId,
        sortOrder: item.sortOrder,
        productionCode: item.productionCode,
        materialName: item.materialName,
        percentage: item.percentage,
        requiredWeight: item.requiredWeight,
        actualWeight: actualByMaterial.get(item.rawMaterialId) ?? null,
        notes: item.notes,
      }))
    })
  }, [isNew, recipeItems, totalWeight])

  useEffect(() => {
    if (isNew) return
    setItems(prev => prev.map(item => ({
      ...item,
      requiredWeight: totalWeight > 0 ? (totalWeight * item.percentage) / 100 : 0,
    })))
  }, [isNew, totalWeight])

  function patchActualWeight(key: string, actualWeight: number | null) {
    setItems(prev => prev.map(item => (
      item.key === key ? { ...item, actualWeight } : item
    )))
  }

  async function saveOrder() {
    if (isNew && !factoryProductId) {
      toast.error('请选择产品')
      return
    }
    if (totalWeight <= 0) {
      toast.error('请填写有效的生产重量')
      return
    }
    if (isNew && items.length === 0) {
      toast.error('当前配方无原料明细，无法创建生产单')
      return
    }

    setSaving(true)
    const itemPayload = items.map(item => ({
      rawMaterialId: item.rawMaterialId,
      actualWeight: item.actualWeight,
      notes: item.notes,
    }))
    const payload = isNew
      ? {
          code: code.trim() || undefined,
          factoryProductId,
          totalWeight,
          batchNo,
          startedAt: fromDatetimeLocal(startedAt),
          finishedAt: fromDatetimeLocal(finishedAt),
          productionNotes,
          qualityNotes,
          packagingNotes,
          status,
          items: itemPayload,
        }
      : {
          totalWeight,
          batchNo,
          startedAt: fromDatetimeLocal(startedAt),
          finishedAt: fromDatetimeLocal(finishedAt),
          productionNotes,
          qualityNotes,
          packagingNotes,
          productionRequirements: selectedProduct?.productionRequirements || '',
          qualityCheckRequirements: selectedProduct?.qualityCheckRequirements || '',
          packagingRequirements: selectedProduct?.packagingRequirements || '',
          status,
          items: items.map(item => ({
            id: item.id,
            actualWeight: item.actualWeight,
            notes: item.notes,
          })),
        }

    try {
      const res = await fetch(
        isNew ? '/api/admin/cosmocoat/production-orders' : `/api/admin/cosmocoat/production-orders/${orderId}`,
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
      toast.success(isNew ? '生产单已创建' : '生产单已保存')
      if (isNew && data.order?.id) {
        router.replace(`/admin/cosmocoat-production-orders/${data.order.id}`)
      } else {
        loadOrder()
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
          <Link href="/admin/cosmocoat-production-orders" className="p-2 rounded-lg" style={{ border: '1px solid #2A2418', color: 'var(--muted-foreground)' }}>
            <ArrowLeft size={16} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>
              {isNew ? '新建生产单' : '生产单详情'}
            </h1>
            <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
              {isNew ? '选择产品并填写生产总量与实投数量，保存后生效' : `${code} · ${productName}`}
            </p>
          </div>
        </div>
        <button type="button" onClick={saveOrder} disabled={saving} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50" style={{ background: '#C9A96E', color: '#0A0805' }}>
          <Save size={14} /> {saving ? '保存中...' : (isNew ? '创建' : '保存')}
        </button>
      </div>

      <div style={card} className="p-4 space-y-4">
        <h3 className="text-sm font-semibold" style={{ color: '#C9A96E' }}>基本信息</h3>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {isNew ? (
            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>选择产品</label>
              <select value={factoryProductId} onChange={e => setFactoryProductId(e.target.value)} className="w-full rounded-lg px-3 py-2.5 text-sm outline-none" style={inputStyle()}>
                <option value="">请选择工厂产品</option>
                {products.map(product => (
                  <option key={product.id} value={product.id}>
                    {product.productCode} · {product.name}
                    {!product.currentRecipe ? '（无当前配方）' : ''}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="space-y-1.5">
              <label className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>生产单号</label>
              <input value={code} readOnly className="w-full rounded-lg px-3 py-2.5 text-sm outline-none opacity-70" style={inputStyle()} />
            </div>
          )}
          {!isNew && (
            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>产品名称</label>
              <input value={productName} readOnly className="w-full rounded-lg px-3 py-2.5 text-sm outline-none opacity-70" style={inputStyle()} />
            </div>
          )}
          <div className="space-y-1.5">
            <label className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>配方编号</label>
            <input value={recipeCode} readOnly className="w-full rounded-lg px-3 py-2.5 text-sm outline-none opacity-70" style={inputStyle()} placeholder="选择产品后自动带出" />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <label className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>配方名称</label>
            <input value={recipeName} readOnly className="w-full rounded-lg px-3 py-2.5 text-sm outline-none opacity-70" style={inputStyle()} />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>生产重量 ({productUnit})</label>
            <input type="number" min={0.001} step="0.001" value={totalWeight} onChange={e => setTotalWeight(Number(e.target.value) || 0)} className="w-full rounded-lg px-3 py-2.5 text-sm outline-none" style={inputStyle()} />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>生产批次</label>
            <input value={batchNo} onChange={e => setBatchNo(e.target.value)} className="w-full rounded-lg px-3 py-2.5 text-sm outline-none" style={inputStyle()} />
          </div>
          <div className="space-y-1.5 sm:col-span-2 lg:col-span-1">
            <label className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>开始时间</label>
            <DatetimeLocalPicker
              value={startedAt}
              onChange={setStartedAt}
              datePlaceholder="选择日期"
              dateTriggerStyle={{ ...dateTimePickerStyle, width: '100%', padding: '0.625rem 0.75rem' }}
              timeInputStyle={dateTimePickerStyle}
              timeInputClassName="outline-none"
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2 lg:col-span-1">
            <label className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>完成时间</label>
            <DatetimeLocalPicker
              value={finishedAt}
              onChange={setFinishedAt}
              datePlaceholder="选择日期"
              dateTriggerStyle={{ ...dateTimePickerStyle, width: '100%', padding: '0.625rem 0.75rem' }}
              timeInputStyle={dateTimePickerStyle}
              timeInputClassName="outline-none"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>状态</label>
            <select value={status} onChange={e => setStatus(e.target.value as 'draft' | 'completed')} className="w-full rounded-lg px-3 py-2.5 text-sm outline-none" style={inputStyle()}>
              <option value="draft">草稿</option>
              <option value="completed">已完成</option>
            </select>
          </div>
          {isNew && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>生产单号（可选）</label>
              <input value={code} onChange={e => setCode(e.target.value)} placeholder="留空则自动生成" className="w-full rounded-lg px-3 py-2.5 text-sm outline-none" style={inputStyle()} />
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-4 text-sm">
          <span style={{ color: 'var(--muted-foreground)' }}>参考投料合计：<strong style={{ color: '#C9A96E' }}>{formatWeight(requiredTotal)} {productUnit}</strong></span>
          {selectedProduct && !selectedProduct.currentRecipe && (
            <span style={{ color: '#ef4444' }}>该产品未设置当前配方，请先在工厂产品中配置</span>
          )}
        </div>
      </div>

      <div style={{ ...card, overflow: 'hidden' }}>
        <div className="px-4 py-3 border-b" style={{ borderColor: '#2A2418' }}>
          <h3 className="text-sm font-semibold" style={{ color: '#C9A96E' }}>原料投料明细</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th style={th}>序号</th>
                <th style={th}>原材料编号</th>
                <th style={th}>比例</th>
                <th style={th}>参考投料 ({productUnit})</th>
                <th style={th}>本次实投 ({productUnit})</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ ...td, textAlign: 'center', padding: '2rem' }}>
                    {isNew ? '请选择有当前配方的产品' : '暂无原料明细'}
                  </td>
                </tr>
              ) : items.map((item, index) => (
                <tr key={item.key}>
                  <td style={td}>{index + 1}</td>
                  <td style={td}>{item.productionCode}</td>
                  <td style={td}>{formatPercent(item.percentage)}</td>
                  <td style={td}>{formatWeight(item.requiredWeight)}</td>
                  <td style={td}>
                    <input
                      type="number"
                      min={0}
                      step="0.001"
                      value={item.actualWeight ?? ''}
                      onChange={e => patchActualWeight(item.key, e.target.value === '' ? null : Number(e.target.value))}
                      className="w-28 rounded px-2 py-1 text-sm outline-none"
                      style={inputStyle()}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div style={card} className="p-4 space-y-2">
          <label className="text-xs font-medium" style={{ color: '#C9A96E' }}>生产要求</label>
          <textarea value={productionNotes} onChange={e => setProductionNotes(e.target.value)} rows={4} className="w-full rounded-lg px-3 py-2 text-sm outline-none resize-y" style={inputStyle()} placeholder="如：控制好粘度、调粘度..." />
        </div>
        <div style={card} className="p-4 space-y-2">
          <label className="text-xs font-medium" style={{ color: '#C9A96E' }}>质检要求</label>
          <textarea value={qualityNotes} onChange={e => setQualityNotes(e.target.value)} rows={4} className="w-full rounded-lg px-3 py-2 text-sm outline-none resize-y" style={inputStyle()} placeholder="如：粘度 9.7-9.8、密度..." />
        </div>
        <div style={card} className="p-4 space-y-2">
          <label className="text-xs font-medium" style={{ color: '#C9A96E' }}>包装要求</label>
          <textarea value={packagingNotes} onChange={e => setPackagingNotes(e.target.value)} rows={4} className="w-full rounded-lg px-3 py-2 text-sm outline-none resize-y" style={inputStyle()} placeholder="如：18KG" />
        </div>
      </div>
    </div>
  )
}
