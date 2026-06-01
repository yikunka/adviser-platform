'use client'

/* eslint-disable react-hooks/set-state-in-effect */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useRouter } from '@/i18n/navigation'
import { toast } from 'sonner'
import { Palette, Pencil, Plus, RefreshCw, Search, Sparkles, Trash2 } from 'lucide-react'
import { COLOR_FORMULA_CATEGORIES } from '@/lib/cosmocoat/color-formula-categories'
import type { CosColorFormulaCategory } from '@prisma/client'
import { formatMoney } from '@/lib/cosmocoat/recipes'
import type { ColorFormulaFactoryProductOption } from '@/lib/cosmocoat/color-formula-factory-products'

type FormulaRow = {
  id: string
  code: string
  name: string
  category: CosColorFormulaCategory
  categoryLabel: string
  colorCode: string
  customerName: string
  targetColor: string
  itemCount: number
  unitCost: number
  updatedAt: string
  factoryProduct: { id: string; productCode: string; name: string } | null
}

type FactoryProductOption = {
  id: string
  productCode: string
  name: string
  currentRecipeId: string | null
  category: { name: string } | null
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

function GenerateModal({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated: (id: string) => void
}) {
  const [products, setProducts] = useState<FactoryProductOption[]>([])
  const [loadingProducts, setLoadingProducts] = useState(true)
  const [productId, setProductId] = useState('')
  const [category, setCategory] = useState<CosColorFormulaCategory>('PU')
  const [generating, setGenerating] = useState(false)

  useEffect(() => {
    ;(async () => {
      setLoadingProducts(true)
      try {
        const res = await fetch('/api/admin/cosmocoat/factory-products?limit=500')
        const data = await res.json()
        if (!res.ok) {
          toast.error(data.error ?? '加载产品失败')
          return
        }
        setProducts(data.items ?? [])
      } catch {
        toast.error('加载产品失败')
      } finally {
        setLoadingProducts(false)
      }
    })()
  }, [])

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault()
    if (!productId) {
      toast.error('请选择产品')
      return
    }
    setGenerating(true)
    try {
      const res = await fetch('/api/admin/cosmocoat/color-formulas/generate-from-product', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ factoryProductId: productId, category }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? '生成失败')
        return
      }
      toast.success('已从产品当前配方生成调色配方')
      onCreated(data.formula.id)
      onClose()
    } catch {
      toast.error('生成失败')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-lg rounded-2xl p-6 space-y-4" style={{ background: '#111111', border: '1px solid #2A2418' }}>
        <h2 className="text-lg font-semibold" style={{ color: 'var(--foreground)' }}>从产品生成调色配方</h2>
        <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
          将创建一张关联该产品的调色配方，原料明细仅保留适用产品行。
        </p>
        <form onSubmit={handleGenerate} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>工厂产品</label>
            <select
              required
              value={productId}
              onChange={e => setProductId(e.target.value)}
              disabled={loadingProducts}
              className="w-full rounded-lg px-3 py-2.5 text-sm outline-none"
              style={inputStyle()}
            >
              <option value="">{loadingProducts ? '加载中...' : '选择产品'}</option>
              {products.map(p => (
                <option key={p.id} value={p.id}>
                  {p.productCode} · {p.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>主类别</label>
            <select
              value={category}
              onChange={e => setCategory(e.target.value as CosColorFormulaCategory)}
              className="w-full rounded-lg px-3 py-2.5 text-sm outline-none"
              style={inputStyle()}
            >
              {COLOR_FORMULA_CATEGORIES.map(c => (
                <option key={c.value} value={c.value}>{c.labelZh}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-lg text-sm" style={{ border: '1px solid #2A2418', color: 'var(--muted-foreground)' }}>
              取消
            </button>
            <button type="submit" disabled={generating} className="flex-1 py-2.5 rounded-lg text-sm font-medium disabled:opacity-60" style={{ background: '#C9A96E', color: '#0A0805' }}>
              {generating ? '生成中...' : '生成'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function PuSyncModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [syncing, setSyncing] = useState(false)
  const [result, setResult] = useState<{ deletedCount: number; createdCount: number; created: string[]; errors: string[] } | null>(null)

  async function handleSync() {
    setSyncing(true)
    try {
      const res = await fetch('/api/admin/cosmocoat/color-formulas/pu-sync', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? '同步失败')
        return
      }
      setResult(data)
      if (data.errors?.length === 0) toast.success(`已删除 ${data.deletedCount} 条，新建 ${data.createdCount} 条`)
      else toast.warning(`同步完成，部分产品失败（${data.errors.length} 条）`)
    } catch {
      toast.error('同步失败')
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-lg rounded-2xl p-6 space-y-4" style={{ background: '#111111', border: '1px solid #2A2418' }}>
        <h2 className="text-lg font-semibold" style={{ color: 'var(--foreground)' }}>PU 配方同步</h2>
        {!result ? (
          <>
            <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
              此操作将：<br />
              1. 删除所有 PU 类别的调色配方记录<br />
              2. 为所有 PU 类工厂产品自动生成新配方（含关联原料明细）<br /><br />
              <span style={{ color: '#ef4444' }}>⚠ 此操作不可撤销，请确认。</span>
            </p>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-lg text-sm" style={{ border: '1px solid #2A2418', color: 'var(--muted-foreground)' }}>
                取消
              </button>
              <button type="button" onClick={handleSync} disabled={syncing} className="flex-1 py-2.5 rounded-lg text-sm font-medium disabled:opacity-60" style={{ background: '#C8102E', color: '#fff' }}>
                {syncing ? '同步中...' : '确认同步'}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="text-sm space-y-1" style={{ color: 'var(--muted-foreground)' }}>
              <p>已删除：<b style={{ color: 'var(--foreground)' }}>{result.deletedCount}</b> 条</p>
              <p>已新建：<b style={{ color: 'var(--foreground)' }}>{result.createdCount}</b> 条</p>
              {result.errors.length > 0 && (
                <div className="mt-2 p-2 rounded text-xs" style={{ background: '#1E0808', color: '#ef4444', border: '1px solid #3a1111' }}>
                  {result.errors.map((e, i) => <div key={i}>{e}</div>)}
                </div>
              )}
            </div>
            <button type="button" onClick={onDone} className="w-full py-2.5 rounded-lg text-sm font-medium" style={{ background: '#C9A96E', color: '#0A0805' }}>
              完成
            </button>
          </>
        )}
      </div>
    </div>
  )
}

export default function CosmocoatColorFormulasPage() {
  const router = useRouter()
  const [items, setItems] = useState<FormulaRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [factoryProductId, setFactoryProductId] = useState('')
  const [factoryProducts, setFactoryProducts] = useState<ColorFormulaFactoryProductOption[]>([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [showGenerate, setShowGenerate] = useState(false)
  const [showPuSync, setShowPuSync] = useState(false)

  const fetchItems = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: '50' })
      if (search.trim()) params.set('q', search.trim())
      if (factoryProductId) params.set('factoryProductId', factoryProductId)
      else if (category) params.set('category', category)
      const res = await fetch(`/api/admin/cosmocoat/color-formulas?${params}`)
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
  }, [page, search, category, factoryProductId])

  useEffect(() => {
    ;(async () => {
      try {
        const res = await fetch('/api/admin/cosmocoat/color-formulas/factory-product-options')
        const data = await res.json()
        if (res.ok) setFactoryProducts(data.items ?? [])
      } catch {
        /* ignore */
      }
    })()
  }, [])

  const filteredProducts = useMemo(
    () => (category ? factoryProducts.filter(item => item.parentCategory === category) : []),
    [factoryProducts, category],
  )

  useEffect(() => {
    const t = setTimeout(fetchItems, search ? 300 : 0)
    return () => clearTimeout(t)
  }, [fetchItems, search])

  useEffect(() => {
    setPage(1)
  }, [search, category, factoryProductId])

  useEffect(() => {
    setFactoryProductId('')
  }, [category])

  async function deleteFormula(row: FormulaRow) {
    if (!window.confirm(`确定删除调色配方「${row.name}」？`)) return
    setDeletingId(row.id)
    try {
      const res = await fetch(`/api/admin/cosmocoat/color-formulas/${row.id}`, { method: 'DELETE' })
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
          <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>调色配方管理</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
            按主类别与工厂产品管理调色配方，支持从产品当前配方生成。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {category === 'PU' && (
            <button
              type="button"
              onClick={() => setShowPuSync(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm"
              style={{ border: '1px solid #C8102E33', color: '#E46480' }}
            >
              <RefreshCw size={15} /> PU 同步
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowGenerate(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm"
            style={{ border: '1px solid #2A2418', color: 'var(--muted-foreground)' }}
          >
            <Sparkles size={15} /> 从产品生成
          </button>
          <Link
            href={
              factoryProductId
                ? `/admin/cosmocoat-color-formulas/new?factoryProductId=${factoryProductId}&category=${
                    factoryProducts.find(p => p.id === factoryProductId)?.parentCategory ?? category
                  }`
                : category
                  ? `/admin/cosmocoat-color-formulas/new?category=${category}`
                  : '/admin/cosmocoat-color-formulas/new'
            }
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
            style={{ background: '#C9A96E', color: '#0A0805' }}
          >
            <Plus size={15} /> 新建配方
          </Link>
        </div>
      </div>

      <div style={card} className="p-4 flex flex-wrap gap-3">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setCategory('')
              setFactoryProductId('')
            }}
            className="px-3 py-1.5 rounded-lg text-sm"
            style={{
              background: !category && !factoryProductId ? 'rgba(201,169,110,0.15)' : 'transparent',
              color: !category && !factoryProductId ? '#C9A96E' : 'var(--muted-foreground)',
              border: '1px solid #2A2418',
            }}
          >
            全部
          </button>
          {COLOR_FORMULA_CATEGORIES.map(c => (
            <button
              key={c.value}
              type="button"
              onClick={() => {
                setCategory(c.value)
                setFactoryProductId('')
              }}
              className="px-3 py-1.5 rounded-lg text-sm"
              style={{
                background: category === c.value && !factoryProductId ? 'rgba(201,169,110,0.15)' : 'transparent',
                color: category === c.value && !factoryProductId ? '#C9A96E' : 'var(--muted-foreground)',
                border: '1px solid #2A2418',
              }}
            >
              {c.labelZh}
            </button>
          ))}
        </div>
        {category && filteredProducts.length > 0 && (
          <div className="flex flex-wrap gap-2 w-full">
            <button
              type="button"
              onClick={() => setFactoryProductId('')}
              className="px-3 py-1.5 rounded-lg text-xs"
              style={{
                background: !factoryProductId ? 'rgba(201,169,110,0.15)' : 'transparent',
                color: !factoryProductId ? '#C9A96E' : 'var(--muted-foreground)',
                border: '1px solid #2A2418',
              }}
            >
              全部{COLOR_FORMULA_CATEGORIES.find(item => item.value === category)?.labelZh}
            </button>
            {filteredProducts.map(option => (
              <button
                key={option.id}
                type="button"
                onClick={() => setFactoryProductId(option.id)}
                className="px-3 py-1.5 rounded-lg text-xs"
                style={{
                  background: factoryProductId === option.id ? 'rgba(201,169,110,0.15)' : 'transparent',
                  color: factoryProductId === option.id ? '#C9A96E' : 'var(--muted-foreground)',
                  border: '1px solid #2A2418',
                }}
              >
                {option.productCode} · {option.name}
              </button>
            ))}
          </div>
        )}
        <div className="relative flex-1 min-w-[14rem]">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--muted-foreground)' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="搜索编号、名称、色号、客户..."
            className="w-full pl-8 pr-3 py-2 rounded-lg text-sm outline-none"
            style={inputStyle()}
          />
        </div>
      </div>

      <div style={{ ...card, overflow: 'hidden' }}>
        {loading ? (
          <div className="py-16 text-center text-sm" style={{ color: 'var(--muted-foreground)' }}>加载中...</div>
        ) : items.length === 0 ? (
          <div className="py-16 text-center space-y-3">
            <Palette size={32} className="mx-auto" style={{ color: '#5A5040' }} />
            <p className="text-sm" style={{ color: '#5A5040' }}>暂无调色配方</p>
            <Link href="/admin/cosmocoat-color-formulas/new" className="inline-flex px-4 py-2 rounded-lg text-sm font-medium" style={{ background: '#C9A96E', color: '#0A0805' }}>
              新建配方
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th style={th}>编号</th>
                  <th style={th}>名称</th>
                  <th style={th}>类别</th>
                  <th style={th}>关联产品</th>
                  <th style={th}>色号</th>
                  <th style={th}>原料数</th>
                  <th style={th}>成本单价</th>
                  <th style={th}>更新时间</th>
                  <th style={{ ...th, textAlign: 'right' }}>操作</th>
                </tr>
              </thead>
              <tbody>
                {items.map(row => (
                  <tr
                    key={row.id}
                    className="cursor-pointer transition-colors hover:bg-[#111108]"
                    onClick={() => router.push(`/admin/cosmocoat-color-formulas/${row.id}`)}
                  >
                    <td style={{ ...td, color: 'var(--foreground)', fontWeight: 500 }}>{row.code}</td>
                    <td style={td}>{row.name}</td>
                    <td style={td}>{row.categoryLabel}</td>
                    <td style={td}>
                      {row.factoryProduct
                        ? `${row.factoryProduct.productCode} · ${row.factoryProduct.name}`
                        : '—'}
                    </td>
                    <td style={td}>{row.colorCode || '—'}</td>
                    <td style={td}>{row.itemCount}</td>
                    <td style={td}>{formatMoney(row.unitCost)}</td>
                    <td style={td}>{new Date(row.updatedAt).toLocaleDateString('zh-CN')}</td>
                    <td style={{ ...td, textAlign: 'right' }}>
                      <div className="flex items-center justify-end gap-1">
                        <Link
                          href={`/admin/cosmocoat-color-formulas/${row.id}`}
                          onClick={e => e.stopPropagation()}
                          className="p-1.5 rounded-md inline-flex"
                          style={{ color: 'var(--muted-foreground)' }}
                        >
                          <Pencil size={14} />
                        </Link>
                        <button
                          type="button"
                          onClick={e => { e.stopPropagation(); deleteFormula(row) }}
                          disabled={deletingId === row.id}
                          className="p-1.5 rounded-md disabled:opacity-40"
                          style={{ color: '#ef4444' }}
                        >
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
          <span>共 {total} 条</span>
          <div className="flex items-center gap-2">
            <button type="button" disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1.5 rounded-md disabled:opacity-40" style={{ border: '1px solid #2A2418' }}>上一页</button>
            <span>{page} / {totalPages}</span>
            <button type="button" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="px-3 py-1.5 rounded-md disabled:opacity-40" style={{ border: '1px solid #2A2418' }}>下一页</button>
          </div>
        </div>
      )}

      {showGenerate && (
        <GenerateModal
          onClose={() => setShowGenerate(false)}
          onCreated={id => router.push(`/admin/cosmocoat-color-formulas/${id}`)}
        />
      )}

      {showPuSync && (
        <PuSyncModal
          onClose={() => setShowPuSync(false)}
          onDone={() => { setShowPuSync(false); fetchItems() }}
        />
      )}
    </div>
  )
}
