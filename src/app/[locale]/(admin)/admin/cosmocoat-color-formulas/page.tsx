'use client'

/* eslint-disable react-hooks/set-state-in-effect */

import { useCallback, useEffect, useState } from 'react'
import { Link, useRouter } from '@/i18n/navigation'
import { toast } from 'sonner'
import { Palette, Pencil, Plus, Search, Sparkles, Trash2 } from 'lucide-react'
import { COLOR_FORMULA_CATEGORIES } from '@/lib/cosmocoat/color-formula-categories'
import type { CosColorFormulaCategory } from '@prisma/client'
import { formatMoney } from '@/lib/cosmocoat/recipes'

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
          将复制该产品「当前配方」中的原料行。产品须已设定当前配方。
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
                  {!p.currentRecipeId ? '（无当前配方）' : ''}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>配方类别</label>
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

export default function CosmocoatColorFormulasPage() {
  const router = useRouter()
  const [items, setItems] = useState<FormulaRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [showGenerate, setShowGenerate] = useState(false)

  const fetchItems = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: '50' })
      if (search.trim()) params.set('q', search.trim())
      if (category) params.set('category', category)
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
  }, [page, search, category])

  useEffect(() => {
    const t = setTimeout(fetchItems, search ? 300 : 0)
    return () => clearTimeout(t)
  }, [fetchItems, search])

  useEffect(() => {
    setPage(1)
  }, [search, category])

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
            按 PU / 烤漆 / 高温烤漆 / 低温烤漆分类管理调色配方，支持从产品当前配方生成。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setShowGenerate(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm"
            style={{ border: '1px solid #2A2418', color: 'var(--muted-foreground)' }}
          >
            <Sparkles size={15} /> 从产品生成
          </button>
          <Link
            href="/admin/cosmocoat-color-formulas/new"
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
            onClick={() => setCategory('')}
            className="px-3 py-1.5 rounded-lg text-sm"
            style={{
              background: !category ? 'rgba(201,169,110,0.15)' : 'transparent',
              color: !category ? '#C9A96E' : 'var(--muted-foreground)',
              border: '1px solid #2A2418',
            }}
          >
            全部
          </button>
          {COLOR_FORMULA_CATEGORIES.map(c => (
            <button
              key={c.value}
              type="button"
              onClick={() => setCategory(c.value)}
              className="px-3 py-1.5 rounded-lg text-sm"
              style={{
                background: category === c.value ? 'rgba(201,169,110,0.15)' : 'transparent',
                color: category === c.value ? '#C9A96E' : 'var(--muted-foreground)',
                border: '1px solid #2A2418',
              }}
            >
              {c.labelZh}
            </button>
          ))}
        </div>
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
    </div>
  )
}
