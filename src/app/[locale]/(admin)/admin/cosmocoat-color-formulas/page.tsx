'use client'

/* eslint-disable react-hooks/set-state-in-effect */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useRouter } from '@/i18n/navigation'
import { toast } from 'sonner'
import { Palette, Pencil, Plus, Search, Trash2, X } from 'lucide-react'
import { useAdminPermission } from '@/components/admin/AdminPermissionContext'
import {
  COLOR_FORMULA_CATEGORIES,
  factoryProductMatchesColorFormulaCategory,
} from '@/lib/cosmocoat/color-formula-categories'
import type { CosColorFormulaCategory } from '@prisma/client'
import { formatMoney } from '@/lib/cosmocoat/recipes'
import type { ColorFormulaFactoryProductOption } from '@/lib/cosmocoat/color-formula-factory-products'

type FormulaRow = {
  id: string
  code: string
  name: string
  category: CosColorFormulaCategory
  categoryLabel: string
  customerId: string | null
  customerName: string
  customer: { id: string; code: string; name: string; phone: string | null } | null
  technicalOwnerId: string | null
  technicalOwner: {
    id: string
    code: string
    name: string
    position: string | null
    department: string | null
    phone: string | null
    isActive: boolean
  } | null
  itemCount: number
  unitCost: number
  updatedAt: string
  factoryProduct: { id: string; productCode: string; name: string } | null
}

type CustomerOption = {
  id: string
  code: string
  name: string
  phone: string | null
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

function formatCustomerOption(customer: CustomerOption) {
  return `${customer.code} · ${customer.name}`
}

export default function CosmocoatColorFormulasPage() {
  const router = useRouter()
  const canViewDetail = useAdminPermission('cosmocoatColorFormulas.view')
  const [items, setItems] = useState<FormulaRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [factoryProductId, setFactoryProductId] = useState('')
  const [factoryProducts, setFactoryProducts] = useState<ColorFormulaFactoryProductOption[]>([])
  const [customerFilterId, setCustomerFilterId] = useState('')
  const [customerFilterSearch, setCustomerFilterSearch] = useState('')
  const [customerOptions, setCustomerOptions] = useState<CustomerOption[]>([])
  const [customerDropdownOpen, setCustomerDropdownOpen] = useState(false)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const fetchItems = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: '50' })
      if (search.trim()) params.set('q', search.trim())
      if (factoryProductId) params.set('factoryProductId', factoryProductId)
      else if (category) params.set('category', category)
      if (customerFilterId) params.set('customerId', customerFilterId)
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
  }, [page, search, category, factoryProductId, customerFilterId])

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

  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()
    const q = customerFilterSearch.trim()
    const t = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ limit: '30' })
        if (q) params.set('q', q)
        const res = await fetch(`/api/admin/cosmocoat/color-formulas/picker/customers?${params}`, {
          signal: controller.signal,
        })
        const data = await res.json()
        if (!cancelled && res.ok) setCustomerOptions(data.customers ?? [])
      } catch {
        /* ignore */
      }
    }, q ? 250 : 0)

    return () => {
      cancelled = true
      controller.abort()
      clearTimeout(t)
    }
  }, [customerFilterSearch])

  const filteredProducts = useMemo(
    () =>
      category
        ? factoryProducts.filter(item =>
            factoryProductMatchesColorFormulaCategory(
              item.categoryName ? { name: item.categoryName } : null,
              category as CosColorFormulaCategory,
            ),
          )
        : [],
    [factoryProducts, category],
  )

  useEffect(() => {
    const t = setTimeout(fetchItems, search ? 300 : 0)
    return () => clearTimeout(t)
  }, [fetchItems, search])

  useEffect(() => {
    setPage(1)
  }, [search, category, factoryProductId, customerFilterId])

  useEffect(() => {
    setFactoryProductId('')
  }, [category])

  function selectCustomerFilter(customer: CustomerOption) {
    setCustomerFilterId(customer.id)
    setCustomerFilterSearch(formatCustomerOption(customer))
    setCustomerDropdownOpen(false)
  }

  function clearCustomerFilter() {
    setCustomerFilterId('')
    setCustomerFilterSearch('')
  }

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
            按主类别与工厂产品管理调色配方；选择 PU 时仅显示工厂分类为「PU漆」的产品。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
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
        <div className="relative min-w-[16rem] flex-1">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--muted-foreground)' }} />
          <input
            value={customerFilterSearch}
            onFocus={() => setCustomerDropdownOpen(true)}
            onBlur={() => setTimeout(() => setCustomerDropdownOpen(false), 120)}
            onChange={e => {
              setCustomerFilterSearch(e.target.value)
              setCustomerFilterId('')
              setCustomerDropdownOpen(true)
            }}
            placeholder="按关联客户筛选"
            className="w-full pl-8 pr-9 py-2 rounded-lg text-sm outline-none"
            style={inputStyle()}
          />
          {(customerFilterId || customerFilterSearch) && (
            <button
              type="button"
              title="清除客户筛选"
              onMouseDown={e => e.preventDefault()}
              onClick={clearCustomerFilter}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md"
              style={{ color: 'var(--muted-foreground)' }}
            >
              <X size={13} />
            </button>
          )}
          {customerDropdownOpen && (
            <div
              className="absolute z-30 mt-1 w-full overflow-hidden rounded-lg shadow-xl"
              style={{ background: '#111108', border: '1px solid #2A2418' }}
            >
              <div className="max-h-56 overflow-y-auto">
                {customerOptions.length === 0 ? (
                  <div className="px-3 py-3 text-xs" style={{ color: '#5A5040' }}>未找到客户</div>
                ) : (
                  customerOptions.map(option => (
                    <button
                      key={option.id}
                      type="button"
                      onMouseDown={e => e.preventDefault()}
                      onClick={() => selectCustomerFilter(option)}
                      className="w-full px-3 py-2 text-left text-sm"
                      style={{
                        color: customerFilterId === option.id ? '#C9A96E' : 'var(--foreground)',
                        background: customerFilterId === option.id ? 'rgba(201,169,110,0.1)' : 'transparent',
                      }}
                    >
                      <span className="font-mono text-xs opacity-70 mr-2">{option.code}</span>
                      {option.name}
                      {option.phone && <span className="text-xs ml-2 opacity-60">{option.phone}</span>}
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
        <div className="relative flex-1 min-w-[14rem]">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--muted-foreground)' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="搜索编号、名称、客户、负责人..."
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
                  <th style={th}>客户</th>
                  <th style={th}>负责人员</th>
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
                    className={`transition-colors hover:bg-[#111108] ${canViewDetail ? 'cursor-pointer' : ''}`}
                    onClick={canViewDetail ? () => router.push(`/admin/cosmocoat-color-formulas/${row.id}`) : undefined}
                  >
                    <td style={{ ...td, color: 'var(--foreground)', fontWeight: 500 }}>{row.code}</td>
                    <td style={td}>{row.name}</td>
                    <td style={td}>{row.categoryLabel}</td>
                    <td style={td}>
                      {row.factoryProduct
                        ? `${row.factoryProduct.productCode} · ${row.factoryProduct.name}`
                        : '—'}
                    </td>
                    <td style={td}>
                      {row.customer
                        ? `${row.customer.code} · ${row.customer.name}`
                        : row.customerName || '—'}
                    </td>
                    <td style={td}>
                      {row.technicalOwner
                        ? `${row.technicalOwner.code} · ${row.technicalOwner.name}`
                        : '—'}
                    </td>
                    <td style={td}>{row.itemCount}</td>
                    <td style={td}>{formatMoney(row.unitCost)}</td>
                    <td style={td}>{new Date(row.updatedAt).toLocaleDateString('zh-CN')}</td>
                    <td style={{ ...td, textAlign: 'right' }}>
                      <div className="flex items-center justify-end gap-1">
                        {canViewDetail && (
                          <Link
                            href={`/admin/cosmocoat-color-formulas/${row.id}`}
                            onClick={e => e.stopPropagation()}
                            className="p-1.5 rounded-md inline-flex"
                            style={{ color: 'var(--muted-foreground)' }}
                          >
                            <Pencil size={14} />
                          </Link>
                        )}
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

    </div>
  )
}
