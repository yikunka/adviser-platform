'use client'

import { useCallback, useEffect, useState } from 'react'
import { Link, useRouter } from '@/i18n/navigation'
import { toast } from 'sonner'
import { Beaker, FolderCog, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { formatMoney } from '@/lib/cosmocoat/recipes'

type RecipeRow = {
  id: string
  code: string
  name: string
  batchQuantity: number
  unitCost: number | null
  notes: string
  updatedAt: string
  itemCount: number
  category: { id: string; code: string; name: string }
}

type RecipeCategory = {
  id: string
  code: string
  name: string
  sortOrder: number
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

function ModalShell({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: React.ReactNode
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-lg rounded-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto" style={{ background: '#111111', border: '1px solid #2A2418' }}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold" style={{ color: 'var(--foreground)' }}>{title}</h2>
          <button type="button" onClick={onClose} className="text-sm" style={{ color: 'var(--muted-foreground)' }}>关闭</button>
        </div>
        {children}
      </div>
    </div>
  )
}

function CategoryModal({
  category,
  onClose,
  onSaved,
}: {
  category: RecipeCategory | null
  onClose: () => void
  onSaved: () => void
}) {
  const [code, setCode] = useState(category?.code ?? '')
  const [name, setName] = useState(category?.name ?? '')
  const [sortOrder, setSortOrder] = useState(category?.sortOrder ?? 0)
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await fetch(
        category ? `/api/admin/cosmocoat/recipe-categories/${category.id}` : '/api/admin/cosmocoat/recipe-categories',
        {
          method: category ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code, name, sortOrder }),
        },
      )
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? '保存失败')
        return
      }
      toast.success(category ? '目录已更新' : '目录已添加')
      onSaved()
      onClose()
    } catch {
      toast.error('保存失败')
    } finally {
      setSaving(false)
    }
  }

  return (
    <ModalShell title={category ? '编辑目录' : '添加目录'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>目录编号</label>
            <input required value={code} onChange={e => setCode(e.target.value)} className="w-full rounded-lg px-3 py-2.5 text-sm outline-none" style={inputStyle()} placeholder="0012" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>排序</label>
            <input type="number" min={0} value={sortOrder} onChange={e => setSortOrder(Number(e.target.value) || 0)} className="w-full rounded-lg px-3 py-2.5 text-sm outline-none" style={inputStyle()} />
          </div>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>目录名称</label>
          <input required value={name} onChange={e => setName(e.target.value)} className="w-full rounded-lg px-3 py-2.5 text-sm outline-none" style={inputStyle()} />
        </div>
        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-lg text-sm" style={{ border: '1px solid #2A2418', color: 'var(--muted-foreground)' }}>取消</button>
          <button type="submit" disabled={saving} className="flex-1 py-2.5 rounded-lg text-sm font-medium disabled:opacity-60" style={{ background: '#C9A96E', color: '#0A0805' }}>
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </form>
    </ModalShell>
  )
}

function CategoryManageModal({
  categories,
  onClose,
  onRefresh,
}: {
  categories: RecipeCategory[]
  onClose: () => void
  onRefresh: () => void
}) {
  const [editing, setEditing] = useState<RecipeCategory | null | 'new'>(null)

  async function deleteCategory(category: RecipeCategory) {
    if (!window.confirm(`删除目录「${category.name}」？其下配方也会一并删除。`)) return
    try {
      const res = await fetch(`/api/admin/cosmocoat/recipe-categories/${category.id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? '删除失败')
        return
      }
      toast.success('目录已删除')
      onRefresh()
    } catch {
      toast.error('删除失败')
    }
  }

  return (
    <>
      <ModalShell title="配方目录管理" onClose={onClose}>
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => setEditing('new')}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium"
            style={{ background: '#C9A96E', color: '#0A0805' }}
          >
            <Plus size={14} /> 添加目录
          </button>
          {categories.length === 0 ? (
            <p className="text-sm py-6 text-center" style={{ color: '#5A5040' }}>暂无目录</p>
          ) : (
            <div className="space-y-2">
              {categories.map(category => (
                <div key={category.id} className="flex items-center gap-3 p-3 rounded-lg" style={{ background: '#111108', border: '1px solid #2A2418' }}>
                  <span className="font-mono text-xs" style={{ color: '#C9A96E' }}>{category.code}</span>
                  <span className="flex-1 text-sm truncate">{category.name}</span>
                  <button type="button" onClick={() => setEditing(category)} className="p-1.5 rounded" style={{ color: 'var(--muted-foreground)' }}>
                    <Pencil size={14} />
                  </button>
                  <button type="button" onClick={() => deleteCategory(category)} className="p-1.5 rounded" style={{ color: '#ef4444' }}>
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </ModalShell>
      {editing !== null && (
        <CategoryModal
          category={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={onRefresh}
        />
      )}
    </>
  )
}

export default function AdminCosmoCoatRecipesPage() {
  const router = useRouter()
  const [items, setItems] = useState<RecipeRow[]>([])
  const [categories, setCategories] = useState<RecipeCategory[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [showCategoryManage, setShowCategoryManage] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const fetchItems = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: '50' })
      if (search.trim()) params.set('q', search.trim())
      if (categoryId) params.set('categoryId', categoryId)
      const res = await fetch(`/api/admin/cosmocoat/recipes?${params}`)
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? '加载失败')
        return
      }
      setItems(data.items ?? [])
      setCategories(data.categories ?? [])
      setTotal(data.total ?? 0)
      setTotalPages(data.totalPages ?? 1)
    } catch {
      toast.error('加载失败')
    } finally {
      setLoading(false)
    }
  }, [page, search, categoryId])

  useEffect(() => {
    const t = setTimeout(fetchItems, search ? 300 : 0)
    return () => clearTimeout(t)
  }, [fetchItems, search])

  useEffect(() => {
    setPage(1)
  }, [search, categoryId])

  async function deleteRecipe(recipe: RecipeRow) {
    if (!window.confirm(`确定删除配方「${recipe.name}」？`)) return
    setDeletingId(recipe.id)
    try {
      const res = await fetch(`/api/admin/cosmocoat/recipes/${recipe.id}`, { method: 'DELETE' })
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
          <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>CosmoCoat 配方管理</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
            配方列表与详情编辑，支持原料明细与成本自动计算。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setShowCategoryManage(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm"
            style={{ border: '1px solid #2A2418', color: 'var(--muted-foreground)' }}
          >
            <FolderCog size={15} /> 目录管理
          </button>
          <Link
            href="/admin/cosmocoat-recipes/new"
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
            style={{ background: '#C9A96E', color: '#0A0805' }}
          >
            <Plus size={15} /> 新建配方
          </Link>
        </div>
      </div>

      <div style={card} className="p-4 flex flex-wrap gap-3">
        <select value={categoryId} onChange={e => setCategoryId(e.target.value)} className="rounded-lg px-3 py-2 text-sm outline-none" style={inputStyle()}>
          <option value="">全部分类</option>
          {categories.map(c => (
            <option key={c.id} value={c.id}>{c.code} {c.name}</option>
          ))}
        </select>
        <div className="relative flex-1 min-w-[14rem]">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--muted-foreground)' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="搜索配方编号、名称..."
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
            <Beaker size={32} className="mx-auto" style={{ color: '#5A5040' }} />
            <p className="text-sm" style={{ color: '#5A5040' }}>
              {categories.length === 0 ? '请先添加配方目录，再新建配方。' : '暂无配方，点击「新建配方」开始。'}
            </p>
            {categories.length === 0 ? (
              <button type="button" onClick={() => setShowCategoryManage(true)} className="px-4 py-2 rounded-lg text-sm font-medium" style={{ background: '#C9A96E', color: '#0A0805' }}>
                添加目录
              </button>
            ) : (
              <Link href="/admin/cosmocoat-recipes/new" className="inline-flex px-4 py-2 rounded-lg text-sm font-medium" style={{ background: '#C9A96E', color: '#0A0805' }}>
                新建配方
              </Link>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th style={th}>配方编号</th>
                  <th style={th}>配方名称</th>
                  <th style={th}>目录</th>
                  <th style={th}>原料数</th>
                  <th style={th}>成本单价</th>
                  <th style={th}>更新时间</th>
                  <th style={{ ...th, textAlign: 'right' }}>操作</th>
                </tr>
              </thead>
              <tbody>
                {items.map(recipe => (
                  <tr
                    key={recipe.id}
                    className="cursor-pointer transition-colors hover:bg-[#111108]"
                    onClick={() => router.push(`/admin/cosmocoat-recipes/${recipe.id}`)}
                  >
                    <td style={{ ...td, color: 'var(--foreground)', fontWeight: 500 }}>{recipe.code}</td>
                    <td style={td}>{recipe.name}</td>
                    <td style={td}>
                      <span className="font-mono text-xs mr-1.5 opacity-70">{recipe.category.code}</span>
                      {recipe.category.name}
                    </td>
                    <td style={td}>{recipe.itemCount}</td>
                    <td style={td}>{formatMoney(recipe.unitCost)}</td>
                    <td style={td}>{new Date(recipe.updatedAt).toLocaleDateString('zh-CN')}</td>
                    <td style={{ ...td, textAlign: 'right' }}>
                      <div className="flex items-center justify-end gap-1">
                        <Link
                          href={`/admin/cosmocoat-recipes/${recipe.id}`}
                          onClick={e => e.stopPropagation()}
                          className="p-1.5 rounded-md inline-flex"
                          style={{ color: 'var(--muted-foreground)' }}
                        >
                          <Pencil size={14} />
                        </Link>
                        <button
                          type="button"
                          onClick={e => { e.stopPropagation(); deleteRecipe(recipe) }}
                          disabled={deletingId === recipe.id}
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
          <span>共 {total} 条配方</span>
          <div className="flex items-center gap-2">
            <button type="button" disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1.5 rounded-md disabled:opacity-40" style={{ border: '1px solid #2A2418' }}>上一页</button>
            <span>{page} / {totalPages}</span>
            <button type="button" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="px-3 py-1.5 rounded-md disabled:opacity-40" style={{ border: '1px solid #2A2418' }}>下一页</button>
          </div>
        </div>
      )}

      {showCategoryManage && (
        <CategoryManageModal
          categories={categories}
          onClose={() => setShowCategoryManage(false)}
          onRefresh={fetchItems}
        />
      )}
    </div>
  )
}
