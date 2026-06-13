'use client'

/* eslint-disable react-hooks/set-state-in-effect */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from '@/i18n/navigation'
import { toast } from 'sonner'
import {
  ExternalLink,
  Package,
  Pencil,
  Plus,
  Search,
  Star,
  Trash2,
  X,
} from 'lucide-react'
import { formatMoney } from '@/lib/cosmocoat/recipes'
import {
  flattenCategoryTree,
  type CategoryTreeNode,
} from '@/lib/cosmocoat/product-category-tree'
import { VISCOSITY_UNITS, type ViscosityUnit } from '@/lib/cosmocoat/product-viscosity'
import { notifyFactoryProductChanged } from '@/lib/cosmocoat/factory-product-events'

type ProductCategoryRef = {
  id: string
  name: string
  slug: string
}

type LinkedRecipe = {
  linkId: string
  id: string
  code: string
  name: string
  unitCost: number | null
  updatedAt: string
  categoryCode: string
  categoryName: string
  isCurrent: boolean
}

type FactoryProduct = {
  id: string
  productCode: string
  name: string
  categoryId: string | null
  category: ProductCategoryRef | null
  unit: string
  unitPrice: number | null
  notes: string
  viscosity: string | null
  viscosityUnit: ViscosityUnit | null
  viscosityLabel?: string | null
  currentRecipeId: string | null
  sortOrder: number
  updatedAt: string
  currentRecipe: {
    id: string
    code: string
    name: string
    unitCost: number | null
    productionSpeedRequirements?: string
    productionTimeRequirements?: string
    packagingRequirements?: string
    productionNotes?: string
  } | null
  recipes: LinkedRecipe[]
}

type RecipeOption = {
  id: string
  code: string
  name: string
  unitCost: number | null
  categoryCode: string
  categoryName: string
  viscosity: string | null
  viscosityUnit: ViscosityUnit | null
}

type ProductForm = {
  productCode: string
  name: string
  categoryId: string | null
  unit: string
  unitPrice: number | null
  notes: string
  viscosity: string
  viscosityUnit: ViscosityUnit
  sortOrder: number
  recipeIds: string[]
  currentRecipeId: string | null
}

const emptyForm: ProductForm = {
  productCode: '',
  name: '',
  categoryId: null,
  unit: 'kg',
  unitPrice: null,
  notes: '',
  viscosity: '',
  viscosityUnit: 'S',
  sortOrder: 0,
  recipeIds: [],
  currentRecipeId: null,
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

function CategoryPicker({
  value,
  tree,
  onChange,
}: {
  value: string | null
  tree: CategoryTreeNode[]
  onChange: (categoryId: string | null) => void
}) {
  const [query, setQuery] = useState('')
  const flat = useMemo(() => flattenCategoryTree(tree), [tree])
  const selected = flat.find(c => c.id === value) ?? null

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return flat
    return flat.filter(
      c => c.name.toLowerCase().includes(q) || c.pathLabel.toLowerCase().includes(q) || c.slug.includes(q),
    )
  }, [flat, query])

  return (
    <div className="space-y-1.5 sm:col-span-2">
      <label className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>产品类别</label>
      <input
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder={selected ? selected.pathLabel : '搜索或选择类别...'}
        className="w-full rounded-lg px-3 py-2.5 text-sm outline-none"
        style={inputStyle()}
      />
      <select
        value={value ?? ''}
        onChange={e => onChange(e.target.value || null)}
        className="w-full rounded-lg px-3 py-2.5 text-sm outline-none"
        style={inputStyle()}
        size={Math.min(Math.max(filtered.length + 1, 4), 8)}
      >
        <option value="">无类别</option>
        {filtered.map(option => (
          <option key={option.id} value={option.id}>
            {'—'.repeat(Math.max(0, option.depth - 1))} {option.name}
          </option>
        ))}
      </select>
    </div>
  )
}

function productToForm(product: FactoryProduct): ProductForm {
  return {
    productCode: product.productCode,
    name: product.name,
    categoryId: product.categoryId,
    unit: product.unit,
    unitPrice: product.unitPrice,
    notes: product.notes,
    viscosity: product.viscosity ?? '',
    viscosityUnit: product.viscosityUnit ?? 'S',
    sortOrder: product.sortOrder,
    recipeIds: product.recipes.map(r => r.id),
    currentRecipeId: product.currentRecipeId,
  }
}

function formPayload(form: ProductForm) {
  const { viscosity, viscosityUnit, ...rest } = form
  if (form.currentRecipeId) {
    return rest
  }
  const trimmedViscosity = viscosity.trim()
  const hasViscosity = trimmedViscosity.length > 0
  return {
    ...rest,
    viscosity: hasViscosity ? trimmedViscosity : null,
    viscosityUnit: hasViscosity ? viscosityUnit : null,
  }
}

function ProductEditor({
  product,
  recipeOptions,
  categoryTree,
  onClose,
  onSaved,
}: {
  product: FactoryProduct | null
  recipeOptions: RecipeOption[]
  categoryTree: CategoryTreeNode[]
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState<ProductForm>(product ? productToForm(product) : emptyForm)
  const [saving, setSaving] = useState(false)
  const [recipeSearch, setRecipeSearch] = useState('')
  const isEditing = !!product

  const linkedRecipes = useMemo(() => {
    return form.recipeIds
      .map(id => recipeOptions.find(r => r.id === id))
      .filter((r): r is RecipeOption => !!r)
  }, [form.recipeIds, recipeOptions])

  const currentRecipeOption = useMemo(() => {
    if (!form.currentRecipeId) return null
    return recipeOptions.find(r => r.id === form.currentRecipeId) ?? null
  }, [form.currentRecipeId, recipeOptions])

  const viscosityFromCurrentRecipe = !!form.currentRecipeId

  useEffect(() => {
    if (!currentRecipeOption) return
    setForm(prev => ({
      ...prev,
      viscosity: currentRecipeOption.viscosity ?? '',
      viscosityUnit: currentRecipeOption.viscosityUnit ?? 'S',
    }))
  }, [
    currentRecipeOption?.id,
    currentRecipeOption?.viscosity,
    currentRecipeOption?.viscosityUnit,
  ])

  const availableRecipes = useMemo(() => {
    const q = recipeSearch.trim().toLowerCase()
    return recipeOptions.filter(r => {
      if (form.recipeIds.includes(r.id)) return false
      if (!q) return true
      return (
        r.code.toLowerCase().includes(q)
        || r.name.toLowerCase().includes(q)
        || r.categoryName.toLowerCase().includes(q)
      )
    })
  }, [recipeOptions, form.recipeIds, recipeSearch])

  function patch<K extends keyof ProductForm>(key: K, value: ProductForm[K]) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  function addRecipe(recipeId: string) {
    if (form.recipeIds.includes(recipeId)) return
    const nextIds = [...form.recipeIds, recipeId]
    patch('recipeIds', nextIds)
    if (!form.currentRecipeId) patch('currentRecipeId', recipeId)
  }

  function removeRecipe(recipeId: string) {
    const nextIds = form.recipeIds.filter(id => id !== recipeId)
    patch('recipeIds', nextIds)
    if (form.currentRecipeId === recipeId) {
      patch('currentRecipeId', nextIds[0] ?? null)
    }
  }

  function setCurrentRecipe(recipeId: string) {
    if (!form.recipeIds.includes(recipeId)) return
    patch('currentRecipeId', recipeId)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await fetch(
        isEditing ? `/api/admin/cosmocoat/factory-products/${product.id}` : '/api/admin/cosmocoat/factory-products',
        {
          method: isEditing ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formPayload(form)),
        },
      )
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? '保存失败')
        return
      }
      toast.success(isEditing ? '产品已更新' : '产品已创建')
      if (isEditing) {
        notifyFactoryProductChanged(product.id)
      } else if (data.product?.id) {
        notifyFactoryProductChanged(data.product.id)
      }
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
      className="fixed inset-0 z-50 flex justify-end"
      style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(3px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="w-full max-w-xl h-full overflow-y-auto shadow-2xl"
        style={{ background: '#0E0E0A', borderLeft: '1px solid #2A2418' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b" style={{ background: '#111111', borderColor: '#2A2418' }}>
          <div>
            <h2 className="text-lg font-semibold" style={{ color: 'var(--foreground)' }}>
              {isEditing ? '编辑产品' : '添加产品'}
            </h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
              可关联多个配方，并指定一个当前配方
            </p>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-lg" style={{ color: 'var(--muted-foreground)' }}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <section className="space-y-3">
            <h3 className="text-sm font-semibold" style={{ color: '#C9A96E' }}>基本信息</h3>
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>产品编号</label>
                <input required value={form.productCode} onChange={e => patch('productCode', e.target.value)} className="w-full rounded-lg px-3 py-2.5 text-sm outline-none" style={inputStyle()} placeholder="PR-00-0004" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>单位</label>
                <input required value={form.unit} onChange={e => patch('unit', e.target.value)} className="w-full rounded-lg px-3 py-2.5 text-sm outline-none" style={inputStyle()} placeholder="kg" />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>产品名称</label>
                <input required value={form.name} onChange={e => patch('name', e.target.value)} className="w-full rounded-lg px-3 py-2.5 text-sm outline-none" style={inputStyle()} />
              </div>
              <CategoryPicker
                value={form.categoryId}
                tree={categoryTree}
                onChange={categoryId => patch('categoryId', categoryId)}
              />
              <div className="space-y-1.5">
                <label className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>单价 (元)</label>
                <input type="number" min={0} step="0.0001" value={form.unitPrice ?? ''} onChange={e => patch('unitPrice', e.target.value === '' ? null : Number(e.target.value))} className="w-full rounded-lg px-3 py-2.5 text-sm outline-none" style={inputStyle()} />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>排序</label>
                <input type="number" min={0} value={form.sortOrder} onChange={e => patch('sortOrder', Number(e.target.value) || 0)} className="w-full rounded-lg px-3 py-2.5 text-sm outline-none" style={inputStyle()} />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>
                  产品黏度（可选）
                  {viscosityFromCurrentRecipe && (
                    <span className="ml-2 font-normal" style={{ color: '#5A5040' }}>— 自动同步当前配方</span>
                  )}
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={form.viscosity}
                    onChange={e => patch('viscosity', e.target.value)}
                    readOnly={viscosityFromCurrentRecipe}
                    className="flex-1 min-w-0 rounded-lg px-3 py-2.5 text-sm outline-none"
                    style={{
                      ...inputStyle(),
                      ...(viscosityFromCurrentRecipe
                        ? { opacity: 0.85, cursor: 'not-allowed' }
                        : {}),
                    }}
                    placeholder="例如 9.7-9.8"
                  />
                  <select
                    value={form.viscosityUnit ?? 'S'}
                    onChange={e => patch('viscosityUnit', e.target.value as ViscosityUnit)}
                    disabled={viscosityFromCurrentRecipe}
                    className="w-24 shrink-0 rounded-lg px-3 py-2.5 text-sm outline-none disabled:opacity-85 disabled:cursor-not-allowed"
                    style={inputStyle()}
                  >
                    {VISCOSITY_UNITS.map(unit => (
                      <option key={unit} value={unit}>{unit === 'S' ? 'S（秒）' : 'KU'}</option>
                    ))}
                  </select>
                </div>
                <p className="text-xs" style={{ color: '#5A5040' }}>
                  {viscosityFromCurrentRecipe
                    ? '已关联当前配方时，黏度自动取自该配方；修改配方黏度后此处会同步更新'
                    : '支持输入范围值，单位可选 S 或 KU'}
                </p>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>备注</label>
                <textarea value={form.notes} onChange={e => patch('notes', e.target.value)} rows={2} className="w-full rounded-lg px-3 py-2.5 text-sm outline-none resize-y" style={inputStyle()} />
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-semibold" style={{ color: '#C9A96E' }}>关联配方说明</h3>
            <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
              生产工艺、质检与包装要求请在配方管理中维护；创建生产单时将按当前配方自动带出。
            </p>
            {form.currentRecipeId ? (
              <div className="rounded-lg px-3 py-2.5 text-sm" style={{ background: '#111108', border: '1px solid #2A2418' }}>
                <span style={{ color: 'var(--foreground)' }}>
                  当前配方：{linkedRecipes.find(r => r.id === form.currentRecipeId)?.name
                    ?? product?.currentRecipe?.name
                    ?? '—'}
                </span>
              </div>
            ) : (
              <p className="text-sm rounded-lg px-3 py-2.5" style={{ color: '#5A5040', border: '1px dashed #2A2418' }}>
                尚未指定当前配方
              </p>
            )}
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold" style={{ color: '#C9A96E' }}>关联配方</h3>
              <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{linkedRecipes.length} 个已关联</span>
            </div>

            {linkedRecipes.length === 0 ? (
              <p className="text-sm py-6 text-center rounded-lg" style={{ color: '#5A5040', border: '1px dashed #2A2418' }}>
                尚未关联配方，请从下方搜索添加
              </p>
            ) : (
              <div className="space-y-2">
                {linkedRecipes.map(recipe => (
                  <div
                    key={recipe.id}
                    className="flex items-start gap-3 p-3 rounded-lg"
                    style={{
                      background: form.currentRecipeId === recipe.id ? 'rgba(201,169,110,0.1)' : '#111108',
                      border: form.currentRecipeId === recipe.id ? '1px solid rgba(201,169,110,0.35)' : '1px solid #2A2418',
                    }}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs" style={{ color: '#C9A96E' }}>{recipe.code}</span>
                        <span className="text-sm font-medium truncate" style={{ color: 'var(--foreground)' }}>{recipe.name}</span>
                        {form.currentRecipeId === recipe.id && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ background: 'rgba(201,169,110,0.2)', color: '#C9A96E' }}>
                            <Star size={10} fill="currentColor" /> 当前配方
                          </span>
                        )}
                      </div>
                      <p className="text-xs mt-1" style={{ color: 'var(--muted-foreground)' }}>
                        {recipe.categoryCode} {recipe.categoryName} · 成本 {formatMoney(recipe.unitCost)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {form.currentRecipeId !== recipe.id && (
                        <button type="button" onClick={() => setCurrentRecipe(recipe.id)} className="px-2 py-1 rounded text-xs" style={{ color: '#C9A96E', border: '1px solid rgba(201,169,110,0.3)' }}>
                          设为当前
                        </button>
                      )}
                      <Link href={`/admin/cosmocoat-recipes/${recipe.id}`} className="p-1.5 rounded" style={{ color: 'var(--muted-foreground)' }} title="打开配方">
                        <ExternalLink size={14} />
                      </Link>
                      <button type="button" onClick={() => removeRecipe(recipe.id)} className="p-1.5 rounded" style={{ color: '#ef4444' }}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--muted-foreground)' }} />
              <input
                value={recipeSearch}
                onChange={e => setRecipeSearch(e.target.value)}
                placeholder="搜索配方编号、名称..."
                className="w-full pl-8 pr-3 py-2 rounded-lg text-sm outline-none"
                style={inputStyle()}
              />
            </div>
            {availableRecipes.length > 0 && (
              <div className="max-h-40 overflow-y-auto rounded-lg" style={{ border: '1px solid #2A2418' }}>
                {availableRecipes.slice(0, 20).map(recipe => (
                  <button
                    key={recipe.id}
                    type="button"
                    onClick={() => addRecipe(recipe.id)}
                    className="w-full flex items-center justify-between gap-3 px-3 py-2.5 text-left text-sm transition-colors hover:bg-[#111108]"
                    style={{ borderBottom: '1px solid #1E1C15' }}
                  >
                    <span>
                      <span className="font-mono text-xs mr-2" style={{ color: '#C9A96E' }}>{recipe.code}</span>
                      {recipe.name}
                    </span>
                    <Plus size={14} style={{ color: 'var(--muted-foreground)' }} />
                  </button>
                ))}
              </div>
            )}
          </section>

          <div className="flex gap-3 pt-2 sticky bottom-0 pb-2" style={{ background: 'linear-gradient(transparent, #0E0E0A 20%)' }}>
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-lg text-sm" style={{ border: '1px solid #2A2418', color: 'var(--muted-foreground)' }}>取消</button>
            <button type="submit" disabled={saving} className="flex-1 py-2.5 rounded-lg text-sm font-medium disabled:opacity-60" style={{ background: '#C9A96E', color: '#0A0805' }}>
              {saving ? '保存中...' : '保存'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function AdminCosmoCoatFactoryProductsPage() {
  const [items, setItems] = useState<FactoryProduct[]>([])
  const [categoryTree, setCategoryTree] = useState<CategoryTreeNode[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [categoryId, setCategoryId] = useState('ALL')
  const [recipeOptions, setRecipeOptions] = useState<RecipeOption[]>([])
  const [editorProduct, setEditorProduct] = useState<FactoryProduct | null | 'new'>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const flatCategories = useMemo(() => flattenCategoryTree(categoryTree), [categoryTree])

  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/cosmocoat/product-categories?tree=1&activeOnly=1')
      const data = await res.json()
      if (res.ok) setCategoryTree(data.tree ?? [])
    } catch {
      // non-blocking
    }
  }, [])

  const fetchItems = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: '50' })
      if (search.trim()) params.set('q', search.trim())
      if (categoryId !== 'ALL') params.set('categoryId', categoryId)
      const res = await fetch(`/api/admin/cosmocoat/factory-products?${params}`)
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? '加载失败')
        return
      }
      setItems(data.items ?? [])
      setTotal(data.total ?? 0)
      setTotalPages(data.totalPages ?? 1)
    } catch {
      toast.error('加载失败')
    } finally {
      setLoading(false)
    }
  }, [page, search, categoryId])

  useEffect(() => {
    fetchCategories()
  }, [fetchCategories])

  const fetchRecipeOptions = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/cosmocoat/recipe-categories')
      const data = await res.json()
      if (!res.ok) return
      const options: RecipeOption[] = []
      for (const category of data.categories ?? []) {
        for (const recipe of category.recipes ?? []) {
          options.push({
            id: recipe.id,
            code: recipe.code,
            name: recipe.name,
            unitCost: recipe.unitCost,
            categoryCode: category.code,
            categoryName: category.name,
            viscosity: recipe.viscosity?.trim() || null,
            viscosityUnit: recipe.viscosity ? (recipe.viscosityUnit ?? 'S') : null,
          })
        }
      }
      setRecipeOptions(options)
    } catch {
      // non-blocking
    }
  }, [])

  useEffect(() => {
    fetchRecipeOptions()
  }, [fetchRecipeOptions])

  useEffect(() => {
    const t = setTimeout(fetchItems, search ? 300 : 0)
    return () => clearTimeout(t)
  }, [fetchItems, search])

  useEffect(() => {
    setPage(1)
  }, [search, categoryId])

  async function deleteProduct(product: FactoryProduct) {
    if (!window.confirm(`确定删除产品「${product.name}」？`)) return
    setDeletingId(product.id)
    try {
      const res = await fetch(`/api/admin/cosmocoat/factory-products/${product.id}`, { method: 'DELETE' })
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

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>CosmoCoat 产品管理</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
            管理工厂产品，每个产品可关联多个配方并指定当前使用的配方。
          </p>
        </div>
        <button
          type="button"
          onClick={() => setEditorProduct('new')}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
          style={{ background: '#C9A96E', color: '#0A0805' }}
        >
          <Plus size={15} /> 添加产品
        </button>
      </div>

      <div style={card} className="p-4">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[220px] max-w-md">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--muted-foreground)' }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="搜索产品编号、名称..."
              className="w-full pl-8 pr-3 py-2 rounded-lg text-sm outline-none"
              style={inputStyle()}
            />
          </div>
          <select
            value={categoryId}
            onChange={e => setCategoryId(e.target.value)}
            className="rounded-lg px-3 py-2 text-sm outline-none min-w-[180px]"
            style={inputStyle()}
          >
            <option value="ALL">全部类别</option>
            {flatCategories.map(option => (
              <option key={option.id} value={option.id}>
                {'—'.repeat(Math.max(0, option.depth - 1))} {option.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div style={{ ...card, overflow: 'hidden' }}>
        {loading ? (
          <div className="py-16 text-center text-sm" style={{ color: 'var(--muted-foreground)' }}>加载中...</div>
        ) : items.length === 0 ? (
          <div className="py-16 text-center space-y-3">
            <Package size={32} className="mx-auto" style={{ color: '#5A5040' }} />
            <p className="text-sm" style={{ color: '#5A5040' }}>暂无产品，点击「添加产品」开始。</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th style={th}>产品编号</th>
                  <th style={th}>产品名称</th>
                  <th style={th}>类别</th>
                  <th style={th}>单位</th>
                  <th style={th}>单价</th>
                  <th style={th}>粘度</th>
                  <th style={{ ...th, textAlign: 'right' }}>配方成本</th>
                  <th style={th}>当前配方</th>
                  <th style={th}>关联配方</th>
                  <th style={{ ...th, textAlign: 'right' }}>操作</th>
                </tr>
              </thead>
              <tbody>
                {items.map(product => (
                  <tr
                    key={product.id}
                    className="cursor-pointer transition-colors hover:bg-[#111108]"
                    onClick={() => setEditorProduct(product)}
                  >
                    <td style={{ ...td, color: 'var(--foreground)', fontWeight: 500 }}>{product.productCode}</td>
                    <td style={td}>{product.name}</td>
                    <td style={td}>{product.category?.name ?? '—'}</td>
                    <td style={td}>{product.unit}</td>
                    <td style={td}>{formatMoney(product.unitPrice, 2)}</td>
                    <td style={td}>
                      {product.viscosityLabel ?? product.viscosity ?? '—'}
                    </td>
                    <td style={{ ...td, fontFamily: 'monospace', textAlign: 'right' }}>
                      {product.currentRecipe?.unitCost != null
                        ? formatMoney(product.currentRecipe.unitCost, 2)
                        : '-'}
                    </td>
                    <td style={td}>
                      {product.currentRecipe ? (
                        <span className="inline-flex items-center gap-1">
                          <Star size={12} style={{ color: '#C9A96E' }} fill="#C9A96E" />
                          <span>{product.currentRecipe.code} {product.currentRecipe.name}</span>
                        </span>
                      ) : '—'}
                    </td>
                    <td style={td}>{product.recipes.length} 个</td>
                    <td style={{ ...td, textAlign: 'right' }}>
                      <div className="flex items-center justify-end gap-1">
                        <button type="button" onClick={e => { e.stopPropagation(); setEditorProduct(product) }} className="p-1.5 rounded-md" style={{ color: 'var(--muted-foreground)' }}>
                          <Pencil size={14} />
                        </button>
                        <button type="button" onClick={e => { e.stopPropagation(); deleteProduct(product) }} disabled={deletingId === product.id} className="p-1.5 rounded-md disabled:opacity-40" style={{ color: '#ef4444' }}>
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
          <span>共 {total} 个产品</span>
          <div className="flex items-center gap-2">
            <button type="button" disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1.5 rounded-md disabled:opacity-40" style={{ border: '1px solid #2A2418' }}>上一页</button>
            <span>{page} / {totalPages}</span>
            <button type="button" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="px-3 py-1.5 rounded-md disabled:opacity-40" style={{ border: '1px solid #2A2418' }}>下一页</button>
          </div>
        </div>
      )}

      {editorProduct !== null && (
        <ProductEditor
          product={editorProduct === 'new' ? null : editorProduct}
          recipeOptions={recipeOptions}
          categoryTree={categoryTree}
          onClose={() => setEditorProduct(null)}
          onSaved={fetchItems}
        />
      )}
    </div>
  )
}
