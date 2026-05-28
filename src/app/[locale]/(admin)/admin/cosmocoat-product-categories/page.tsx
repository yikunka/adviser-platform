'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { FolderTree, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { MAX_PRODUCT_CATEGORY_DEPTH } from '@/lib/cosmocoat/product-category-tree'

type ProductCategory = {
  id: string
  name: string
  description: string
  parentCategoryId: string | null
  slug: string
  image: string | null
  isActive: boolean
  createdAt: string
  parent: { id: string; name: string; slug: string } | null
  childCount: number
  productCount: number
}

type CategoryForm = {
  name: string
  description: string
  parentCategoryId: string | null
  slug: string
  image: string
  isActive: boolean
}

const emptyForm: CategoryForm = {
  name: '',
  description: '',
  parentCategoryId: null,
  slug: '',
  image: '',
  isActive: true,
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

function slugifyName(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function CategoryModal({
  category,
  categories,
  onClose,
  onSaved,
}: {
  category: ProductCategory | null
  categories: ProductCategory[]
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState<CategoryForm>(() => {
    if (!category) return emptyForm
    return {
      name: category.name,
      description: category.description,
      parentCategoryId: category.parentCategoryId,
      slug: category.slug,
      image: category.image ?? '',
      isActive: category.isActive,
    }
  })
  const [slugTouched, setSlugTouched] = useState(!!category)
  const [saving, setSaving] = useState(false)
  const isEditing = !!category

  const parentOptions = useMemo(() => {
    const excludeIds = new Set<string>()
    if (category) {
      excludeIds.add(category.id)
      const queue = categories.filter(c => c.parentCategoryId === category.id).map(c => c.id)
      while (queue.length) {
        const id = queue.shift()!
        excludeIds.add(id)
        for (const child of categories.filter(c => c.parentCategoryId === id)) {
          queue.push(child.id)
        }
      }
    }

    function depthOf(id: string): number {
      let depth = 1
      let current = categories.find(c => c.id === id)
      while (current?.parentCategoryId) {
        depth += 1
        current = categories.find(c => c.id === current!.parentCategoryId)
      }
      return depth
    }

    return categories
      .filter(c => !excludeIds.has(c.id))
      .filter(c => depthOf(c.id) < MAX_PRODUCT_CATEGORY_DEPTH)
      .sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))
  }, [categories, category])

  function patch<K extends keyof CategoryForm>(key: K, value: CategoryForm[K]) {
    setForm(prev => {
      const next = { ...prev, [key]: value }
      if (key === 'name' && !slugTouched) {
        next.slug = slugifyName(String(value))
      }
      return next
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await fetch(
        isEditing
          ? `/api/admin/cosmocoat/product-categories/${category.id}`
          : '/api/admin/cosmocoat/product-categories',
        {
          method: isEditing ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...form,
            parentCategoryId: form.parentCategoryId || null,
            image: form.image.trim() || null,
          }),
        },
      )
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? '保存失败')
        return
      }
      toast.success(isEditing ? '类别已更新' : '类别已创建')
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
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-lg rounded-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto" style={{ background: '#111111', border: '1px solid #2A2418' }}>
        <h2 className="text-lg font-semibold" style={{ color: 'var(--foreground)' }}>
          {isEditing ? '编辑产品类别' : '添加产品类别'}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>名称</label>
            <input required value={form.name} onChange={e => patch('name', e.target.value)} className="w-full rounded-lg px-3 py-2.5 text-sm outline-none" style={inputStyle()} />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>描述</label>
            <textarea value={form.description} onChange={e => patch('description', e.target.value)} className="w-full min-h-20 rounded-lg px-3 py-2.5 text-sm outline-none resize-y" style={inputStyle()} />
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>Slug</label>
              <input
                required
                value={form.slug}
                onChange={e => { setSlugTouched(true); patch('slug', e.target.value) }}
                className="w-full rounded-lg px-3 py-2.5 text-sm outline-none font-mono"
                style={inputStyle()}
                placeholder="feel-paint"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>父类别</label>
              <select
                value={form.parentCategoryId ?? ''}
                onChange={e => patch('parentCategoryId', e.target.value || null)}
                className="w-full rounded-lg px-3 py-2.5 text-sm outline-none"
                style={inputStyle()}
              >
                <option value="">无（顶级）</option>
                {parentOptions.map(option => (
                  <option key={option.id} value={option.id}>{option.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>图片 URL（可选）</label>
            <input value={form.image} onChange={e => patch('image', e.target.value)} className="w-full rounded-lg px-3 py-2.5 text-sm outline-none" style={inputStyle()} placeholder="/cosmocoat/category.png" />
          </div>
          <label className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm" style={inputStyle()}>
            <input type="checkbox" checked={form.isActive} onChange={e => patch('isActive', e.target.checked)} />
            启用
          </label>
          <p className="text-xs" style={{ color: '#5A5040' }}>最多支持 {MAX_PRODUCT_CATEGORY_DEPTH} 层类别层级。</p>
          <div className="flex gap-3 pt-2">
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

export default function AdminCosmoCoatProductCategoriesPage() {
  const [categories, setCategories] = useState<ProductCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [modalCategory, setModalCategory] = useState<ProductCategory | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const fetchCategories = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/cosmocoat/product-categories')
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? '加载类别失败')
        return
      }
      setCategories(data.categories ?? [])
    } catch {
      toast.error('加载类别失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchCategories()
  }, [fetchCategories])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return categories
    return categories.filter(
      c =>
        c.name.toLowerCase().includes(q)
        || c.description.toLowerCase().includes(q)
        || c.slug.toLowerCase().includes(q)
        || c.parent?.name.toLowerCase().includes(q),
    )
  }, [categories, search])

  function openCreate() {
    setModalCategory(null)
    setShowModal(true)
  }

  function openEdit(category: ProductCategory) {
    setModalCategory(category)
    setShowModal(true)
  }

  async function deleteCategory(category: ProductCategory) {
    if (!window.confirm(`删除类别「${category.name}」？`)) return
    setDeletingId(category.id)
    try {
      const res = await fetch(`/api/admin/cosmocoat/product-categories/${category.id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? '删除失败')
        return
      }
      toast.success('类别已删除')
      fetchCategories()
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
          <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>工厂产品类别</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
            管理 CosmoCoat 工厂产品分类，支持最多 {MAX_PRODUCT_CATEGORY_DEPTH} 层父子结构。
          </p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-opacity hover:opacity-85" style={{ background: '#C9A96E', color: '#0A0805' }}>
          <Plus size={15} />
          添加类别
        </button>
      </div>

      <div style={card} className="p-4">
        <div className="relative max-w-sm">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--muted-foreground)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="搜索名称、描述、slug..." className="w-full pl-8 pr-3 py-2 rounded-lg text-sm outline-none" style={inputStyle()} />
        </div>
      </div>

      <div style={{ ...card, overflow: 'hidden' }}>
        {loading ? (
          <div className="py-16 text-center text-sm" style={{ color: 'var(--muted-foreground)' }}>加载中...</div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-sm" style={{ color: '#5A5040' }}>
            <FolderTree size={32} className="mx-auto mb-3 opacity-40" />
            暂无产品类别
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th style={th}>名称</th>
                  <th style={th}>描述</th>
                  <th style={th}>父类别</th>
                  <th style={th}>状态</th>
                  <th style={th}>创建时间</th>
                  <th style={{ ...th, textAlign: 'right' }}>操作</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(category => (
                  <tr
                    key={category.id}
                    className="cursor-pointer transition-colors hover:bg-[#111108]"
                    onClick={() => openEdit(category)}
                  >
                    <td style={{ ...td, color: 'var(--foreground)' }}>
                      <p className="font-medium">{category.name}</p>
                      <p className="text-xs font-mono mt-0.5" style={{ color: '#7A7060' }}>{category.slug}</p>
                    </td>
                    <td style={{ ...td, maxWidth: '16rem' }}>
                      <p className="line-clamp-2">{category.description || '—'}</p>
                    </td>
                    <td style={td}>{category.parent?.name ?? '—'}</td>
                    <td style={td}>
                      <span
                        className="px-2 py-0.5 rounded-full text-xs font-medium"
                        style={{
                          background: category.isActive ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
                          color: category.isActive ? '#10b981' : '#ef4444',
                        }}
                      >
                        {category.isActive ? '启用' : '停用'}
                      </span>
                    </td>
                    <td style={td}>{formatDate(category.createdAt)}</td>
                    <td style={{ ...td, textAlign: 'right' }}>
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={e => { e.stopPropagation(); openEdit(category) }}
                          className="p-1.5 rounded-md"
                          style={{ color: 'var(--muted-foreground)' }}
                          title="编辑"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={e => { e.stopPropagation(); deleteCategory(category) }}
                          disabled={deletingId === category.id}
                          className="p-1.5 rounded-md disabled:opacity-40"
                          style={{ color: 'var(--muted-foreground)' }}
                          title="删除"
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

      {!loading && filtered.length > 0 && (
        <p className="text-xs" style={{ color: '#5A5040' }}>共 {filtered.length} 个类别</p>
      )}

      {showModal && (
        <CategoryModal
          category={modalCategory}
          categories={categories}
          onClose={() => setShowModal(false)}
          onSaved={fetchCategories}
        />
      )}
    </div>
  )
}
