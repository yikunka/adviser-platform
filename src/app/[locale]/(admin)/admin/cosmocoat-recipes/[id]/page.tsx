'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { Link, useRouter } from '@/i18n/navigation'
import { toast } from 'sonner'
import { ArrowLeft, FlaskConical, RefreshCw, Save, Search, Trash2 } from 'lucide-react'
import type { FullRecipe } from '@/lib/cosmocoat/recipe-serializer'
import {
  MATERIAL_ATTRIBUTE_GROUPS,
  computeItemAmount,
  computeItemPercentage,
  computeRecipeTotals,
  formatMoney,
  formatPercent,
} from '@/lib/cosmocoat/recipes'

type PickerMaterial = {
  id: string
  productionCode: string
  name: string
  attributeCode: string
  category: string
  primaryPackageKg: number | null
  primaryPricePerKg: number | null
  primaryNotes: string
}

type PickerSemifinished = {
  id: string
  code: string
  name: string
  description: string
  category: string
  stock: number
  unit: string
  unitPrice: number | null
  sourceProductionOrder: { id: string; code: string; batchNo: string } | null
}

type PickerMode = 'raw_material' | 'semi_finished'

type RecipeCategoryOption = {
  id: string
  code: string
  name: string
}

function mapRecipeCategoryOption(c: { id: string; code: string; name: string }): RecipeCategoryOption {
  return { id: c.id, code: c.code, name: c.name }
}

type EditableItem = {
  key: string
  itemType: 'raw_material' | 'recipe' | 'product_semifinished'
  rawMaterialId?: string
  recipeId?: string
  productSemifinishedId?: string
  productionCode: string
  name: string
  packageKg: number | null
  stock?: number | null
  unit?: string
  sourceOrderCode?: string | null
  quantity: number
  unitPrice: number | null
  amount: number
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

function toEditableItemFromMaterial(material: PickerMaterial, quantity = 0, notes = ''): EditableItem {
  const unitPrice = material.primaryPricePerKg
  const qty = quantity
  return {
    key: material.id,
    itemType: 'raw_material',
    rawMaterialId: material.id,
    productionCode: material.productionCode,
    name: material.name,
    packageKg: material.primaryPackageKg,
    quantity: qty,
    unitPrice,
    amount: computeItemAmount(qty, unitPrice),
    notes,
  }
}

function toEditableItemFromSemifinished(
  semifinished: PickerSemifinished,
  quantity = 0,
  notes = '',
): EditableItem {
  const unitPrice = semifinished.unitPrice
  const qty = quantity
  return {
    key: semifinished.id,
    itemType: 'product_semifinished',
    productSemifinishedId: semifinished.id,
    productionCode: semifinished.code,
    name: semifinished.name,
    packageKg: null,
    stock: semifinished.stock,
    unit: semifinished.unit,
    sourceOrderCode: semifinished.sourceProductionOrder?.code ?? null,
    quantity: qty,
    unitPrice,
    amount: computeItemAmount(qty, unitPrice),
    notes,
  }
}

export default function AdminCosmoCoatRecipeEditorPage() {
  const params = useParams()
  const router = useRouter()
  const recipeId = params.id as string
  const isNew = recipeId === 'new'

  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [categories, setCategories] = useState<RecipeCategoryOption[]>([])
  const [pickerMode, setPickerMode] = useState<PickerMode>('raw_material')
  const [pickerMaterials, setPickerMaterials] = useState<PickerMaterial[]>([])
  const [pickerSemifinished, setPickerSemifinished] = useState<PickerSemifinished[]>([])
  const [semifinishedCategories, setSemifinishedCategories] = useState<string[]>([])
  const [pickerLoading, setPickerLoading] = useState(false)
  const [attributeFilter, setAttributeFilter] = useState('RS')
  const [semifinishedCategoryFilter, setSemifinishedCategoryFilter] = useState('Sol.')
  const [pickerSearch, setPickerSearch] = useState('')
  const [selectedPickerId, setSelectedPickerId] = useState<string | null>(null)

  const pickerSemifinishedCategories = useMemo(() => {
    const merged = new Set([...semifinishedCategories, semifinishedCategoryFilter].filter(Boolean))
    return Array.from(merged).sort()
  }, [semifinishedCategories, semifinishedCategoryFilter])

  const [categoryId, setCategoryId] = useState('')
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [batchQuantity, setBatchQuantity] = useState(100)
  const [notes, setNotes] = useState('')
  const [stirringRequirements, setStirringRequirements] = useState('')
  const [packagingRequirements, setPackagingRequirements] = useState('')
  const [productionNotes, setProductionNotes] = useState('')
  const [items, setItems] = useState<EditableItem[]>([])

  const totals = useMemo(
    () => computeRecipeTotals(
      items.map(item => ({ quantity: item.quantity, amount: item.amount })),
      batchQuantity,
    ),
    [items, batchQuantity],
  )

  const itemsWithPercentage = useMemo(() => {
    const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0)
    return items.map(item => ({
      ...item,
      percentage: computeItemPercentage(item.quantity, totalQuantity),
    }))
  }, [items])

  const loadCategories = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/cosmocoat/recipe-categories')
      const data = await res.json()
      if (!res.ok) return
      const list: RecipeCategoryOption[] = (data.categories ?? []).map(mapRecipeCategoryOption)
      setCategories(list)
      if (isNew && list.length > 0) {
        setCategoryId(prev => prev || list[0].id)
      }
    } catch {
      // non-blocking
    }
  }, [isNew])

  const loadRecipe = useCallback(async () => {
    if (isNew) return
    setLoading(true)
    try {
      const [recipeRes, categoryRes] = await Promise.all([
        fetch(`/api/admin/cosmocoat/recipes/${recipeId}`),
        fetch('/api/admin/cosmocoat/recipe-categories'),
      ])
      const recipeData = await recipeRes.json()
      const categoryData = await categoryRes.json()
      if (!recipeRes.ok) {
        toast.error(recipeData.error ?? '加载配方失败')
        return
      }
      const recipe = recipeData.recipe as FullRecipe
      const cats: RecipeCategoryOption[] = (categoryData.categories ?? []).map(mapRecipeCategoryOption)
      setCategories(cats)
      setCategoryId(recipe.categoryId)
      setCode(recipe.code)
      setName(recipe.name)
      setBatchQuantity(recipe.batchQuantity)
      setNotes(recipe.notes)
      setStirringRequirements(recipe.stirringRequirements)
      setPackagingRequirements(recipe.packagingRequirements)
      setProductionNotes(recipe.productionNotes)
      setItems(recipe.items.map(item => {
        if (item.itemType === 'product_semifinished' && item.productSemifinished) {
          const sf = item.productSemifinished
          return {
            key: item.id,
            itemType: 'product_semifinished' as const,
            productSemifinishedId: sf.id,
            productionCode: sf.code,
            name: sf.name,
            packageKg: null,
            stock: sf.stock,
            unit: sf.unit,
            sourceOrderCode: sf.sourceProductionOrder?.code ?? null,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            amount: item.amount ?? computeItemAmount(item.quantity, item.unitPrice),
            notes: item.notes,
          }
        }
        if (item.itemType === 'recipe' && item.recipe) {
          return {
            key: item.id,
            itemType: 'recipe' as const,
            recipeId: item.recipe.id,
            productionCode: item.recipe.code,
            name: item.recipe.name,
            packageKg: item.recipe.batchQuantity,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            amount: item.amount ?? computeItemAmount(item.quantity, item.unitPrice),
            notes: item.notes,
          }
        }
        const material = item.rawMaterial!
        return {
          key: item.id,
          itemType: 'raw_material' as const,
          rawMaterialId: material.id,
          productionCode: material.productionCode,
          name: material.name,
          packageKg: material.packageKg,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          amount: item.amount ?? computeItemAmount(item.quantity, item.unitPrice),
          notes: item.notes,
        }
      }))
    } catch {
      toast.error('加载配方失败')
    } finally {
      setLoading(false)
    }
  }, [recipeId, isNew])

  const loadPickerMaterials = useCallback(async () => {
    setPickerLoading(true)
    try {
      const q = pickerSearch.trim()
      const params = new URLSearchParams({ limit: '200' })
      if (q) {
        params.set('q', q)
      } else {
        params.set('attribute', attributeFilter)
      }
      const res = await fetch(`/api/admin/cosmocoat/raw-materials?${params}`)
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? '加载原料失败')
        return
      }
      setPickerMaterials((data.items ?? []).map((item: PickerMaterial & {
        primaryPackageKg?: number | null
        primaryPricePerKg?: number | null
        primaryNotes?: string
      }) => ({
        id: item.id,
        productionCode: item.productionCode,
        name: item.name,
        attributeCode: item.attributeCode,
        category: item.category,
        primaryPackageKg: item.primaryPackageKg ?? null,
        primaryPricePerKg: item.primaryPricePerKg ?? null,
        primaryNotes: item.primaryNotes ?? '',
      })))
    } catch {
      toast.error('加载原料失败')
    } finally {
      setPickerLoading(false)
    }
  }, [attributeFilter, pickerSearch])

  const loadPickerSemifinished = useCallback(async () => {
    setPickerLoading(true)
    try {
      const params = new URLSearchParams({ limit: '200' })
      const q = pickerSearch.trim()
      if (q) {
        params.set('q', q)
      } else if (semifinishedCategoryFilter) {
        params.set('category', semifinishedCategoryFilter)
      }
      const res = await fetch(`/api/admin/cosmocoat/product-semifinished?${params}`)
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? '加载 Sol. 半成品失败')
        return
      }
      setPickerSemifinished(data.items ?? [])
      const cats: string[] = data.categories ?? []
      if (cats.length > 0) {
        setSemifinishedCategories(cats)
      }
    } catch {
      toast.error('加载 Sol. 半成品失败')
    } finally {
      setPickerLoading(false)
    }
  }, [pickerSearch, semifinishedCategoryFilter])

  useEffect(() => {
    if (isNew) {
      loadCategories().finally(() => setLoading(false))
    } else {
      loadRecipe()
    }
  }, [isNew, loadCategories, loadRecipe])

  useEffect(() => {
    if (pickerMode !== 'raw_material') return
    const t = setTimeout(loadPickerMaterials, pickerSearch.trim() ? 300 : 0)
    return () => clearTimeout(t)
  }, [loadPickerMaterials, pickerSearch, attributeFilter, pickerMode])

  useEffect(() => {
    if (pickerMode !== 'semi_finished') return
    const t = setTimeout(loadPickerSemifinished, pickerSearch.trim() ? 300 : 0)
    return () => clearTimeout(t)
  }, [loadPickerSemifinished, pickerSearch, pickerMode, semifinishedCategoryFilter])

  function switchPickerMode(mode: PickerMode) {
    setPickerMode(mode)
    setSelectedPickerId(null)
    setPickerSearch('')
  }

  function patchItem(key: string, patch: Partial<EditableItem>) {
    setItems(prev => prev.map(item => {
      if (item.key !== key) return item
      const next = { ...item, ...patch }
      next.amount = computeItemAmount(next.quantity, next.unitPrice)
      return next
    }))
  }

  function addSelectedPickerItem() {
    if (pickerMode === 'semi_finished') {
      const semifinished = pickerSemifinished.find(s => s.id === selectedPickerId)
      if (!semifinished) {
        toast.error('请先选择 Sol. 半成品')
        return
      }
      if (items.some(item => item.itemType === 'product_semifinished' && item.productSemifinishedId === semifinished.id)) {
        toast.error('该半成品已在配方中')
        return
      }
      setItems(prev => [...prev, { ...toEditableItemFromSemifinished(semifinished), key: crypto.randomUUID() }])
      toast.success('已添加 Sol. 半成品')
      return
    }

    const material = pickerMaterials.find(m => m.id === selectedPickerId)
    if (!material) {
      toast.error('请先选择原料')
      return
    }
    if (items.some(item => item.itemType === 'raw_material' && item.rawMaterialId === material.id)) {
      toast.error('该原料已在配方中')
      return
    }
    setItems(prev => [...prev, { ...toEditableItemFromMaterial(material), key: crypto.randomUUID() }])
    toast.success('已添加原料')
  }

  function removeItem(key: string) {
    setItems(prev => prev.filter(item => item.key !== key))
  }

  async function saveRecipe() {
    if (!categoryId) {
      toast.error('请选择目录')
      return
    }
    if ((!isNew && !code.trim()) || !name.trim()) {
      toast.error('请填写配方编号和名称')
      return
    }

    setSaving(true)
    const payload = {
      categoryId,
      code: code.trim(),
      name: name.trim(),
      batchQuantity,
      notes,
      stirringRequirements,
      packagingRequirements,
      productionNotes,
      items: items.map((item, index) => ({
        ...(item.itemType === 'recipe'
          ? { recipeId: item.recipeId }
          : item.itemType === 'product_semifinished'
            ? { productSemifinishedId: item.productSemifinishedId }
            : { rawMaterialId: item.rawMaterialId }),
        sortOrder: index + 1,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        notes: item.notes,
      })),
    }

    try {
      const res = await fetch(
        isNew ? '/api/admin/cosmocoat/recipes' : `/api/admin/cosmocoat/recipes/${recipeId}`,
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
      toast.success(isNew ? '配方已创建' : '配方已保存')
      if (isNew && data.recipe?.id) {
        router.replace(`/admin/cosmocoat-recipes/${data.recipe.id}`)
      } else {
        loadRecipe()
      }
    } catch {
      toast.error('保存失败')
    } finally {
      setSaving(false)
    }
  }

  async function refreshPrices() {
    if (isNew) return
    setRefreshing(true)
    try {
      const res = await fetch(`/api/admin/cosmocoat/recipes/${recipeId}/refresh-prices`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? '更新价格失败')
        return
      }
      toast.success('已从原料表和 Sol. 半成品更新价格')
      loadRecipe()
    } catch {
      toast.error('更新价格失败')
    } finally {
      setRefreshing(false)
    }
  }

  if (loading) {
    return <div className="p-6 text-sm" style={{ color: 'var(--muted-foreground)' }}>加载中...</div>
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/admin/cosmocoat-recipes" className="p-2 rounded-lg" style={{ border: '1px solid #2A2418', color: 'var(--muted-foreground)' }}>
            <ArrowLeft size={16} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>
              {isNew ? '新建配方' : '配方详情'}
            </h1>
            <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
              {isNew ? '填写基本信息并添加原料，保存后生效' : `${code} · ${name}`}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {!isNew && (
            <button type="button" onClick={refreshPrices} disabled={refreshing} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm disabled:opacity-50" style={{ border: '1px solid #2A2418', color: 'var(--muted-foreground)' }}>
              <RefreshCw size={14} /> {refreshing ? '更新中...' : '更新价格'}
            </button>
          )}
          <button type="button" onClick={saveRecipe} disabled={saving} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50" style={{ background: '#C9A96E', color: '#0A0805' }}>
            <Save size={14} /> {saving ? '保存中...' : (isNew ? '创建' : '保存')}
          </button>
        </div>
      </div>

      <div style={card} className="p-4 space-y-4">
        <h3 className="text-sm font-semibold" style={{ color: '#C9A96E' }}>基本信息</h3>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>目录</label>
            <select value={categoryId} onChange={e => setCategoryId(e.target.value)} className="w-full rounded-lg px-3 py-2.5 text-sm outline-none" style={inputStyle()}>
              {categories.map(category => (
                <option key={category.id} value={category.id}>{category.code} {category.name}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>配方编号</label>
            <input value={code} onChange={e => setCode(e.target.value)} placeholder="系统自动生成，无需手动填写" className="w-full rounded-lg px-3 py-2.5 text-sm outline-none" style={inputStyle()} />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>配方名称</label>
            <input value={name} onChange={e => setName(e.target.value)} className="w-full rounded-lg px-3 py-2.5 text-sm outline-none" style={inputStyle()} />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>每生产产品数量</label>
            <input type="number" min={0.001} step="0.001" value={batchQuantity} onChange={e => setBatchQuantity(Number(e.target.value) || 100)} className="w-full rounded-lg px-3 py-2.5 text-sm outline-none" style={inputStyle()} />
          </div>
        </div>
        <div className="flex flex-wrap gap-4 text-sm">
          <span style={{ color: 'var(--muted-foreground)' }}>产品成本单价：<strong style={{ color: '#C9A96E' }}>{formatMoney(totals.unitCost)}</strong></span>
          <span style={{ color: 'var(--muted-foreground)' }}>材料数量合计：{formatMoney(totals.totalQuantity, 3)}</span>
          <span style={{ color: 'var(--muted-foreground)' }}>材料金额合计：{formatMoney(totals.totalAmount, 3)} 元</span>
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <label className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>备注</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className="w-full rounded-lg px-3 py-2.5 text-sm outline-none resize-y" style={inputStyle()} />
        </div>
      </div>

      <div style={card} className="p-4 space-y-4">
        <h3 className="text-sm font-semibold" style={{ color: '#C9A96E' }}>生产工艺</h3>
        <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
          创建生产单时将按当前配方自动带出以下要求（质检标准请写在生产注意事项中）
        </p>
        <div className="grid sm:grid-cols-1 lg:grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>生产要求</label>
            <textarea
              value={stirringRequirements}
              onChange={e => setStirringRequirements(e.target.value)}
              rows={4}
              className="w-full rounded-lg px-3 py-2.5 text-sm outline-none resize-y"
              style={inputStyle()}
              placeholder="1500 转 / 30 分钟"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>包装要求</label>
            <textarea
              value={packagingRequirements}
              onChange={e => setPackagingRequirements(e.target.value)}
              rows={4}
              className="w-full rounded-lg px-3 py-2.5 text-sm outline-none resize-y"
              style={inputStyle()}
              placeholder="3.4.2 包装方式：200 目滤网"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>生产注意事项</label>
            <textarea
              value={productionNotes}
              onChange={e => setProductionNotes(e.target.value)}
              rows={4}
              className="w-full rounded-lg px-3 py-2.5 text-sm outline-none resize-y"
              style={inputStyle()}
              placeholder="3.4.3 生产注意事项：先加 A 料再慢慢加入 B 料；质检：粘度 9.7-9.8..."
            />
          </div>
        </div>
      </div>

      <div style={{ ...card, overflow: 'hidden' }}>
        <div className="px-4 py-3 border-b" style={{ borderColor: '#2A2418' }}>
          <h3 className="text-sm font-semibold" style={{ color: '#C9A96E' }}>配方物料</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th style={th}>序号</th>
                <th style={th}>编号</th>
                <th style={th}>名称</th>
                <th style={th}>规格</th>
                <th style={th}>数量</th>
                <th style={th}>占比</th>
                <th style={th}>单价(元)</th>
                <th style={th}>金额(元)</th>
                <th style={th}>备注</th>
                <th style={{ ...th, textAlign: 'right' }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {itemsWithPercentage.length === 0 ? (
                <tr>
                  <td colSpan={10} style={{ ...td, textAlign: 'center', padding: '2rem' }}>请从下方选择原材料或半成品</td>
                </tr>
              ) : itemsWithPercentage.map((item, index) => (
                <tr key={item.key}>
                  <td style={td}>{index + 1}</td>
                  <td style={td}>
                    <span className="inline-flex items-center gap-1">
                      {item.productionCode}
                      {item.itemType === 'product_semifinished' && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] px-1 py-0.5 rounded" style={{ background: 'rgba(201,169,110,0.15)', color: '#C9A96E' }}>
                          <FlaskConical size={10} /> Sol.
                        </span>
                      )}
                      {item.itemType === 'recipe' && (
                        <span className="text-[10px] px-1 py-0.5 rounded" style={{ background: 'rgba(201,169,110,0.15)', color: '#C9A96E' }}>配方</span>
                      )}
                    </span>
                  </td>
                  <td style={td}>
                    {item.name}
                    {item.sourceOrderCode && (
                      <span className="block text-[10px] mt-0.5" style={{ color: '#5A5040' }}>来源: {item.sourceOrderCode}</span>
                    )}
                  </td>
                  <td style={td}>
                    {item.itemType === 'product_semifinished'
                      ? `库存 ${item.stock ?? '—'} ${item.unit ?? 'kg'}`
                      : `${item.packageKg ?? '—'}${item.itemType === 'recipe' ? ' kg/批' : ''}`}
                  </td>
                  <td style={td}>
                    <input
                      type="number"
                      min={0}
                      step="0.001"
                      value={item.quantity}
                      onChange={e => patchItem(item.key, { quantity: Number(e.target.value) || 0 })}
                      className="w-24 rounded px-2 py-1 text-sm outline-none"
                      style={inputStyle()}
                    />
                  </td>
                  <td style={td}>{formatPercent(item.percentage)}</td>
                  <td style={td}>
                    <input
                      type="number"
                      min={0}
                      step="0.0001"
                      value={item.unitPrice ?? ''}
                      onChange={e => patchItem(item.key, { unitPrice: e.target.value === '' ? null : Number(e.target.value) })}
                      className="w-24 rounded px-2 py-1 text-sm outline-none"
                      style={inputStyle()}
                    />
                  </td>
                  <td style={td}>{formatMoney(item.amount, 3)}</td>
                  <td style={td}>
                    <input
                      value={item.notes}
                      onChange={e => patchItem(item.key, { notes: e.target.value })}
                      className="w-full min-w-[8rem] rounded px-2 py-1 text-sm outline-none"
                      style={inputStyle()}
                    />
                  </td>
                  <td style={{ ...td, textAlign: 'right' }}>
                    <button type="button" onClick={() => removeItem(item.key)} className="p-1.5 rounded-md" style={{ color: '#ef4444' }}>
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div style={card} className="overflow-hidden">
        <div className="px-4 py-3 border-b flex flex-wrap items-center justify-between gap-2" style={{ borderColor: '#2A2418' }}>
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-semibold" style={{ color: '#C9A96E' }}>待选物料</h3>
            <div className="flex rounded-lg overflow-hidden text-xs" style={{ border: '1px solid #2A2418' }}>
              <button
                type="button"
                onClick={() => switchPickerMode('raw_material')}
                className="px-3 py-1.5 transition-colors"
                style={{
                  background: pickerMode === 'raw_material' ? 'rgba(201,169,110,0.15)' : 'transparent',
                  color: pickerMode === 'raw_material' ? '#C9A96E' : 'var(--muted-foreground)',
                }}
              >
                原材料
              </button>
              <button
                type="button"
                onClick={() => switchPickerMode('semi_finished')}
                className="px-3 py-1.5 transition-colors"
                style={{
                  background: pickerMode === 'semi_finished' ? 'rgba(201,169,110,0.15)' : 'transparent',
                  color: pickerMode === 'semi_finished' ? '#C9A96E' : 'var(--muted-foreground)',
                }}
              >
                半成品
              </button>
            </div>
          </div>
          {pickerSearch.trim() && (
            <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
              {pickerMode === 'raw_material' ? '正在全部分类中搜索原料' : '正在全部 Sol. 半成品中搜索'}
            </span>
          )}
        </div>
        <div className="grid lg:grid-cols-[12rem_1fr] min-h-[14rem]">
          <div
            className="border-r overflow-y-auto max-h-72 lg:max-h-80"
            style={{ borderColor: '#2A2418', opacity: pickerSearch.trim() ? 0.45 : 1 }}
          >
            {pickerMode === 'raw_material' ? (
              MATERIAL_ATTRIBUTE_GROUPS.map(group => (
                <button
                  key={group.code}
                  type="button"
                  onClick={() => {
                    setPickerSearch('')
                    setSelectedPickerId(null)
                    setAttributeFilter(group.code)
                  }}
                  className="w-full text-left px-3 py-2 text-xs transition-colors"
                  style={{
                    background: !pickerSearch.trim() && attributeFilter === group.code ? 'rgba(201,169,110,0.12)' : 'transparent',
                    color: !pickerSearch.trim() && attributeFilter === group.code ? '#C9A96E' : 'var(--muted-foreground)',
                  }}
                >
                  {group.label}
                </button>
              ))
            ) : pickerSemifinishedCategories.length === 0 ? (
              <p className="px-3 py-4 text-xs" style={{ color: '#5A5040' }}>暂无 Sol. 半成品分类</p>
            ) : (
              pickerSemifinishedCategories.map(category => (
                <button
                  key={category}
                  type="button"
                  onClick={() => {
                    setPickerSearch('')
                    setSelectedPickerId(null)
                    setSemifinishedCategoryFilter(category)
                  }}
                  className="w-full text-left px-3 py-2 text-xs transition-colors"
                  style={{
                    background: !pickerSearch.trim() && semifinishedCategoryFilter === category ? 'rgba(201,169,110,0.12)' : 'transparent',
                    color: !pickerSearch.trim() && semifinishedCategoryFilter === category ? '#C9A96E' : 'var(--muted-foreground)',
                  }}
                >
                  {category}
                </button>
              ))
            )}
          </div>
          <div className="p-3 space-y-3">
            <div className="flex flex-wrap gap-2 items-center">
              <div className="relative flex-1 min-w-[12rem]">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--muted-foreground)' }} />
                <input
                  value={pickerSearch}
                  onChange={e => {
                    setPickerSearch(e.target.value)
                    setSelectedPickerId(null)
                  }}
                  placeholder={
                    pickerMode === 'raw_material'
                      ? '搜索全部原料（编号、名称、供应商）...'
                      : '搜索 Sol. 半成品（编号、名称）...'
                  }
                  className="w-full pl-8 pr-3 py-2 rounded-lg text-sm outline-none"
                  style={inputStyle()}
                />
              </div>
              <button
                type="button"
                onClick={addSelectedPickerItem}
                className="px-4 py-2 rounded-lg text-sm font-medium"
                style={{ background: 'rgba(201,169,110,0.15)', color: '#C9A96E', border: '1px solid rgba(201,169,110,0.25)' }}
              >
                添加选中
              </button>
            </div>
            <div className="overflow-x-auto max-h-56 overflow-y-auto">
              {pickerMode === 'raw_material' ? (
                pickerLoading ? (
                  <p className="text-sm py-8 text-center" style={{ color: 'var(--muted-foreground)' }}>加载原料...</p>
                ) : pickerMaterials.length === 0 ? (
                  <p className="text-sm py-8 text-center" style={{ color: '#5A5040' }}>
                    {pickerSearch.trim() ? '未找到匹配原料' : '该分类下暂无原料'}
                  </p>
                ) : (
                  <table className="w-full">
                    <thead>
                      <tr>
                        <th style={th}>编号</th>
                        <th style={th}>名称</th>
                        <th style={th}>属性</th>
                        <th style={th}>规格</th>
                        <th style={th}>单价</th>
                        <th style={th}>备注</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pickerMaterials.map(material => {
                        const alreadyAdded = items.some(
                          item => item.itemType === 'raw_material' && item.rawMaterialId === material.id,
                        )
                        return (
                          <tr
                            key={material.id}
                            onClick={() => !alreadyAdded && setSelectedPickerId(material.id)}
                            className={alreadyAdded ? 'opacity-40' : 'cursor-pointer'}
                            style={{
                              background: selectedPickerId === material.id && !alreadyAdded
                                ? 'rgba(201,169,110,0.08)'
                                : 'transparent',
                            }}
                          >
                            <td style={td}>{material.productionCode}</td>
                            <td style={td}>{material.name}</td>
                            <td style={td}>{material.attributeCode}</td>
                            <td style={td}>{material.primaryPackageKg ?? '—'}</td>
                            <td style={td}>{formatMoney(material.primaryPricePerKg)}</td>
                            <td style={td}>{material.primaryNotes || '—'}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                )
              ) : pickerLoading ? (
                <p className="text-sm py-8 text-center" style={{ color: 'var(--muted-foreground)' }}>加载 Sol. 半成品...</p>
              ) : pickerSemifinished.length === 0 ? (
                <p className="text-sm py-8 text-center" style={{ color: '#5A5040' }}>
                  {pickerSearch.trim() ? '未找到匹配 Sol. 半成品' : '该分类下暂无 Sol. 半成品'}
                </p>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr>
                      <th style={th}>编号</th>
                      <th style={th}>名称</th>
                      <th style={th}>分类</th>
                      <th style={th}>库存</th>
                      <th style={th}>单价</th>
                      <th style={th}>来源订单</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pickerSemifinished.map(semifinished => {
                      const alreadyAdded = items.some(
                        item => item.itemType === 'product_semifinished' && item.productSemifinishedId === semifinished.id,
                      )
                      return (
                        <tr
                          key={semifinished.id}
                          onClick={() => !alreadyAdded && setSelectedPickerId(semifinished.id)}
                          className={alreadyAdded ? 'opacity-40' : 'cursor-pointer'}
                          style={{
                            background: selectedPickerId === semifinished.id && !alreadyAdded
                              ? 'rgba(201,169,110,0.08)'
                              : 'transparent',
                          }}
                        >
                          <td style={td}>{semifinished.code}</td>
                          <td style={td}>{semifinished.name}</td>
                          <td style={td}>{semifinished.category}</td>
                          <td style={td}>{formatMoney(semifinished.stock, 3)} {semifinished.unit}</td>
                          <td style={td}>{formatMoney(semifinished.unitPrice)}</td>
                          <td style={td}>{semifinished.sourceProductionOrder?.code ?? '—'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
