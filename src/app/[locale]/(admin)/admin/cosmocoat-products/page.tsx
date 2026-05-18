'use client'

/* eslint-disable @next/next/no-img-element */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { ImagePlus, PackagePlus, Pencil, Search, Trash2, UploadCloud } from 'lucide-react'

type ProductType = 'feel' | 'lacquer' | 'uv' | 'special'

type Product = {
  id: string
  pid: string
  type: ProductType
  title: string
  teaser: string
  detail: string
  imagePath: string
  sortOrder: number
  isFeatured: boolean
  isVisible: boolean
  createdAt: string
}

type ProductForm = Omit<Product, 'id' | 'createdAt'>

const TYPE_OPTIONS: { key: ProductType; label: string }[] = [
  { key: 'feel', label: '手感漆' },
  { key: 'lacquer', label: '色漆/烤漆' },
  { key: 'uv', label: '环保UV' },
  { key: 'special', label: '特殊效果' },
]

const emptyForm: ProductForm = {
  pid: '',
  type: 'special',
  title: '',
  teaser: '',
  detail: '',
  imagePath: '',
  sortOrder: 0,
  isFeatured: false,
  isVisible: true,
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

function previewSrc(path: string) {
  const trimmed = path.trim()
  if (!trimmed) return ''
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  if (trimmed.startsWith('/')) return trimmed
  if (trimmed.startsWith('cosmocoat/')) return `/${trimmed}`
  return `/cosmocoat/${trimmed}`
}

function ProductModal({
  product,
  onClose,
  onSaved,
}: {
  product: Product | null
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState<ProductForm>(product ?? emptyForm)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const isEditing = !!product

  function patch<K extends keyof ProductForm>(key: K, value: ProductForm[K]) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  async function uploadImage(file: File) {
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/admin/cosmocoat/products/upload', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Image upload failed.')
        return
      }
      patch('imagePath', data.imagePath)
      toast.success('Image uploaded.')
    } catch {
      toast.error('Image upload failed.')
    } finally {
      setUploading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await fetch(isEditing ? `/api/admin/cosmocoat/products/${product.id}` : '/api/admin/cosmocoat/products', {
        method: isEditing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(res.status === 409 ? 'Product ID already exists.' : (data.error ?? 'Failed to save product.'))
        return
      }
      toast.success(isEditing ? 'Product updated.' : 'Product created.')
      onSaved()
      onClose()
    } catch {
      toast.error('Failed to save product.')
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
      <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl p-6 space-y-5" style={{ background: '#111111', border: '1px solid #2A2418' }}>
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold" style={{ color: 'var(--foreground)' }}>
            {isEditing ? 'Edit CosmoCoat Product' : 'Add CosmoCoat Product'}
          </h2>
          <button onClick={onClose} className="px-3 py-1 rounded-md text-sm" style={{ color: 'var(--muted-foreground)' }}>Close</button>
        </div>

        <form onSubmit={handleSubmit} className="grid lg:grid-cols-[1fr_18rem] gap-6">
          <div className="space-y-4">
            <div className="grid sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>Product ID</label>
                <input required value={form.pid} onChange={e => patch('pid', e.target.value)} className="w-full rounded-lg px-3 py-2.5 text-sm outline-none" style={inputStyle()} placeholder="1791543" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>Type</label>
                <select value={form.type} onChange={e => patch('type', e.target.value as ProductType)} className="w-full rounded-lg px-3 py-2.5 text-sm outline-none" style={inputStyle()}>
                  {TYPE_OPTIONS.map(option => <option key={option.key} value={option.key}>{option.label}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>Sort Order</label>
                <input type="number" min={0} value={form.sortOrder} onChange={e => patch('sortOrder', Number(e.target.value) || 0)} className="w-full rounded-lg px-3 py-2.5 text-sm outline-none" style={inputStyle()} />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>Product Name</label>
              <input required value={form.title} onChange={e => patch('title', e.target.value)} className="w-full rounded-lg px-3 py-2.5 text-sm outline-none" style={inputStyle()} placeholder="特殊效果 - 炫彩水滴" />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>List Summary</label>
              <textarea value={form.teaser} onChange={e => patch('teaser', e.target.value)} className="w-full min-h-20 rounded-lg px-3 py-2.5 text-sm outline-none resize-y" style={inputStyle()} placeholder="Short text shown in product lists" />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>Product Detail</label>
              <textarea required value={form.detail} onChange={e => patch('detail', e.target.value)} className="w-full min-h-44 rounded-lg px-3 py-2.5 text-sm outline-none resize-y" style={inputStyle()} placeholder="Detailed product description shown on the product detail page" />
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <label className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm" style={inputStyle()}>
                <input type="checkbox" checked={form.isVisible} onChange={e => patch('isVisible', e.target.checked)} />
                Visible on website
              </label>
              <label className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm" style={inputStyle()}>
                <input type="checkbox" checked={form.isFeatured} onChange={e => patch('isFeatured', e.target.checked)} />
                Featured on homepage
              </label>
            </div>
          </div>

          <div className="space-y-4">
            <div className="aspect-square overflow-hidden rounded-lg flex items-center justify-center" style={{ background: '#0E0E0A', border: '1px solid #2A2418' }}>
              {form.imagePath ? (
                <img src={previewSrc(form.imagePath)} alt="" className="w-full h-full object-cover" />
              ) : (
                <ImagePlus size={36} style={{ color: '#5A5040' }} />
              )}
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>Picture Path</label>
              <input required value={form.imagePath} onChange={e => patch('imagePath', e.target.value)} className="w-full rounded-lg px-3 py-2.5 text-sm outline-none" style={inputStyle()} placeholder="prod-1791543.png" />
            </div>
            <label className="flex items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-medium transition-opacity hover:opacity-85" style={{ background: 'rgba(201,169,110,0.12)', color: '#C9A96E', border: '1px solid rgba(201,169,110,0.25)', cursor: uploading ? 'wait' : 'pointer' }}>
              <UploadCloud size={15} />
              {uploading ? 'Uploading...' : 'Upload Picture'}
              <input type="file" accept="image/png,image/jpeg,image/webp" disabled={uploading} className="hidden" onChange={e => {
                const file = e.target.files?.[0]
                if (file) uploadImage(file)
                e.target.value = ''
              }} />
            </label>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-lg text-sm font-medium" style={{ border: '1px solid #2A2418', color: 'var(--muted-foreground)' }}>Cancel</button>
              <button type="submit" disabled={saving || uploading} className="flex-1 py-2.5 rounded-lg text-sm font-medium disabled:opacity-60" style={{ background: '#C9A96E', color: '#0A0805' }}>
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function AdminCosmoCoatProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [type, setType] = useState<'ALL' | ProductType>('ALL')
  const [modalProduct, setModalProduct] = useState<Product | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const fetchProducts = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search.trim()) params.set('q', search.trim())
      if (type !== 'ALL') params.set('type', type)
      const res = await fetch(`/api/admin/cosmocoat/products?${params}`)
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Failed to load products.')
        return
      }
      setProducts(data.products ?? [])
    } catch {
      toast.error('Failed to load products.')
    } finally {
      setLoading(false)
    }
  }, [search, type])

  useEffect(() => {
    const t = setTimeout(fetchProducts, search ? 300 : 0)
    return () => clearTimeout(t)
  }, [fetchProducts, search])

  const typeLabel = useMemo(() => new Map(TYPE_OPTIONS.map(option => [option.key, option.label])), [])

  function openCreate() {
    setModalProduct(null)
    setShowModal(true)
  }

  function openEdit(product: Product) {
    setModalProduct(product)
    setShowModal(true)
  }

  async function deleteProduct(product: Product) {
    if (!window.confirm(`Delete ${product.title}?`)) return
    setDeletingId(product.id)
    try {
      const res = await fetch(`/api/admin/cosmocoat/products/${product.id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Failed to delete product.')
        return
      }
      toast.success('Product deleted.')
      fetchProducts()
    } catch {
      toast.error('Failed to delete product.')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>CosmoCoat Products</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
            Manage product type, picture, homepage featuring, and detail pages.
          </p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-opacity hover:opacity-85" style={{ background: '#C9A96E', color: '#0A0805' }}>
          <PackagePlus size={15} />
          Add Product
        </button>
      </div>

      <div style={card} className="p-4 flex flex-col md:flex-row gap-3">
        <div className="flex gap-1 rounded-lg p-1 overflow-x-auto" style={{ background: '#0E0E0A' }}>
          {[{ key: 'ALL', label: 'All' }, ...TYPE_OPTIONS].map(option => (
            <button
              key={option.key}
              onClick={() => setType(option.key as 'ALL' | ProductType)}
              className="px-3 py-1.5 rounded-md text-xs font-medium transition-all whitespace-nowrap"
              style={{
                background: type === option.key ? '#1E1C14' : 'transparent',
                color: type === option.key ? '#C9A96E' : 'var(--muted-foreground)',
                border: type === option.key ? '1px solid #2A2418' : '1px solid transparent',
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
        <div className="relative flex-1 md:max-w-sm">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--muted-foreground)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search product ID, title, summary..." className="w-full pl-8 pr-3 py-2 rounded-lg text-sm outline-none" style={inputStyle()} />
        </div>
      </div>

      <div style={{ ...card, overflow: 'hidden' }}>
        {loading ? (
          <div className="py-16 text-center text-sm" style={{ color: 'var(--muted-foreground)' }}>Loading...</div>
        ) : products.length === 0 ? (
          <div className="py-16 text-center text-sm" style={{ color: '#5A5040' }}>No CosmoCoat products found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th style={th}>Product</th>
                  <th style={th}>Type</th>
                  <th style={th}>Homepage</th>
                  <th style={th}>Visible</th>
                  <th style={th}>Sort</th>
                  <th style={{ ...th, textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {products.map(product => (
                  <tr key={product.id} className="transition-colors hover:bg-[#111108]" style={{ opacity: product.isVisible ? 1 : 0.55 }}>
                    <td style={{ ...td, minWidth: '22rem' }}>
                      <div className="flex items-center gap-3">
                        <img src={previewSrc(product.imagePath)} alt="" className="w-12 h-12 object-cover rounded-md bg-[#0E0E0A]" style={{ border: '1px solid #2A2418' }} />
                        <div className="min-w-0">
                          <p className="font-medium truncate" style={{ color: 'var(--foreground)' }}>{product.title}</p>
                          <p className="text-xs truncate" style={{ color: '#7A7060' }}>{product.pid}</p>
                        </div>
                      </div>
                    </td>
                    <td style={td}>
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: 'rgba(56,189,248,0.12)', color: '#38bdf8' }}>
                        {typeLabel.get(product.type) ?? product.type}
                      </span>
                    </td>
                    <td style={td}>{product.isFeatured ? 'Featured' : 'No'}</td>
                    <td style={td}>{product.isVisible ? 'Visible' : 'Hidden'}</td>
                    <td style={td}>{product.sortOrder}</td>
                    <td style={{ ...td, textAlign: 'right' }}>
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openEdit(product)} title="Edit product" className="p-1.5 rounded-md transition-colors" style={{ color: 'var(--muted-foreground)' }} onMouseEnter={e => (e.currentTarget.style.color = '#C9A96E')} onMouseLeave={e => (e.currentTarget.style.color = 'var(--muted-foreground)')}>
                          <Pencil size={14} />
                        </button>
                        <button onClick={() => deleteProduct(product)} disabled={deletingId === product.id} title="Delete product" className="p-1.5 rounded-md transition-colors disabled:opacity-40" style={{ color: 'var(--muted-foreground)' }} onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')} onMouseLeave={e => (e.currentTarget.style.color = 'var(--muted-foreground)')}>
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

      {!loading && products.length > 0 && (
        <p className="text-xs" style={{ color: '#5A5040' }}>{products.length} product{products.length !== 1 ? 's' : ''} found</p>
      )}

      {showModal && (
        <ProductModal product={modalProduct} onClose={() => setShowModal(false)} onSaved={fetchProducts} />
      )}
    </div>
  )
}
