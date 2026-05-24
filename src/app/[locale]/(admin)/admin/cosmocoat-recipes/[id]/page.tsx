'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { Link, useRouter } from '@/i18n/navigation'
import { toast } from 'sonner'
import { ArrowLeft, RefreshCw, Save, Search, Trash2 } from 'lucide-react'
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

type EditableItem = {
  key: string
  rawMaterialId: string
  productionCode: string
  name: string
  packageKg: number | null
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

function toEditableItem(material: PickerMaterial, quantity = 0, notes = ''): EditableItem {
  const unitPrice = material.primaryPricePerKg
  const qty = quantity
  return {
    key: material.id,
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

export default function AdminCosmoCoatRecipeEditorPage() {
  const params = useParams()
  const router = useRouter()
  const recipeId = params.id as string
  const isNew = recipeId === 'new'

  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [categories, setCategories] = useState<Array<{ id: string; code: string; name: string }>>([])
  const [pickerMaterials, setPickerMaterials] = useState<PickerMaterial[]>([])
  const [pickerLoading, setPickerLoading] = useState(false)
  const [attributeFilter, setAttributeFilter] = useState('RS')
  const [pickerSearch, setPickerSearch] = useState('')
  const [selectedPickerId, setSelectedPickerId] = useState<string | null>(null)

  const [categoryId, setCategoryId] = useState('')
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [batchQuantity, setBatchQuantity] = useState(100)
  const [notes, setNotes] = useState('')
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
      const list = (data.categories ?? []).map((c: { id: string; code: string; name: string }) => ({
        id: c.id,
        code: c.code,
        name: c.name,
      }))
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
      setCategories((categoryData.categories ?? []).map((c: { id: string; code: string; name: string }) => ({
        id: c.id,
        code: c.code,
        name: c.name,
      })))
      setCategoryId(recipe.categoryId)
      setCode(recipe.code)
      setName(recipe.name)
      setBatchQuantity(recipe.batchQuantity)
      setNotes(recipe.notes)
      setItems(recipe.items.map(item => ({
        key: item.id,
        rawMaterialId: item.rawMaterial.id,
        productionCode: item.rawMaterial.productionCode,
        name: item.rawMaterial.name,
        packageKg: item.rawMaterial.packageKg,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        amount: item.amount ?? computeItemAmount(item.quantity, item.unitPrice),
        notes: item.notes,
      })))
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

  useEffect(() => {
    if (isNew) {
      loadCategories().finally(() => setLoading(false))
    } else {
      loadRecipe()
    }
  }, [isNew, loadCategories, loadRecipe])

  useEffect(() => {
    const t = setTimeout(loadPickerMaterials, pickerSearch.trim() ? 300 : 0)
    return () => clearTimeout(t)
  }, [loadPickerMaterials, pickerSearch, attributeFilter])

  function patchItem(key: string, patch: Partial<EditableItem>) {
    setItems(prev => prev.map(item => {
      if (item.key !== key) return item
      const next = { ...item, ...patch }
      next.amount = computeItemAmount(next.quantity, next.unitPrice)
      return next
    }))
  }

  function addSelectedMaterial() {
    const material = pickerMaterials.find(m => m.id === selectedPickerId)
    if (!material) {
      toast.error('请先选择原料')
      return
    }
    if (items.some(item => item.rawMaterialId === material.id)) {
      toast.error('该原料已在配方中')
      return
    }
    setItems(prev => [...prev, { ...toEditableItem(material), key: crypto.randomUUID() }])
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
    if (!code.trim() || !name.trim()) {
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
      items: items.map((item, index) => ({
        rawMaterialId: item.rawMaterialId,
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
      toast.success('已从原料表更新价格')
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
              <RefreshCw size={14} /> {refreshing ? '更新中...' : '更新原料价格'}
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
            <input value={code} onChange={e => setCode(e.target.value)} className="w-full rounded-lg px-3 py-2.5 text-sm outline-none" style={inputStyle()} />
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
                  <td colSpan={10} style={{ ...td, textAlign: 'center', padding: '2rem' }}>请从下方待选原料中添加</td>
                </tr>
              ) : itemsWithPercentage.map((item, index) => (
                <tr key={item.key}>
                  <td style={td}>{index + 1}</td>
                  <td style={td}>{item.productionCode}</td>
                  <td style={td}>{item.name}</td>
                  <td style={td}>{item.packageKg ?? '—'}</td>
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
          <h3 className="text-sm font-semibold" style={{ color: '#C9A96E' }}>待选原料</h3>
          {pickerSearch.trim() && (
            <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>正在全部分类中搜索</span>
          )}
        </div>
        <div className="grid lg:grid-cols-[12rem_1fr] min-h-[14rem]">
          <div
            className="border-r overflow-y-auto max-h-72 lg:max-h-80"
            style={{ borderColor: '#2A2418', opacity: pickerSearch.trim() ? 0.45 : 1 }}
          >
            {MATERIAL_ATTRIBUTE_GROUPS.map(group => (
              <button
                key={group.code}
                type="button"
                onClick={() => {
                  setPickerSearch('')
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
            ))}
          </div>
          <div className="p-3 space-y-3">
            <div className="flex flex-wrap gap-2 items-center">
              <div className="relative flex-1 min-w-[12rem]">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--muted-foreground)' }} />
                <input
                  value={pickerSearch}
                  onChange={e => setPickerSearch(e.target.value)}
                  placeholder="搜索全部原料（编号、名称、供应商）..."
                  className="w-full pl-8 pr-3 py-2 rounded-lg text-sm outline-none"
                  style={inputStyle()}
                />
              </div>
              <button type="button" onClick={addSelectedMaterial} className="px-4 py-2 rounded-lg text-sm font-medium" style={{ background: 'rgba(201,169,110,0.15)', color: '#C9A96E', border: '1px solid rgba(201,169,110,0.25)' }}>
                添加选中
              </button>
            </div>
            <div className="overflow-x-auto max-h-56 overflow-y-auto">
              {pickerLoading ? (
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
                      const alreadyAdded = items.some(item => item.rawMaterialId === material.id)
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
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
