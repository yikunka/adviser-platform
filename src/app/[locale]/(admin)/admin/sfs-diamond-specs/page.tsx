'use client'

import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ImagePlus, Loader2, Pencil, Plus, SlidersHorizontal, Trash2, X } from 'lucide-react'

type Category =
  | 'SOURCE'
  | 'COLOR'
  | 'CARAT'
  | 'SHAPE'
  | 'SETTING_TYPE'
  | 'RING_DESIGN'
  | 'NECKLACE_DESIGN'
  | 'EARRING_DESIGN'
  | 'BRACELET_DESIGN'
  | 'METAL'

type SpecOption = {
  id: string
  category: Category
  label: string
  value: string
  imageUrl: string | null
  price: string | number | null
  sortOrder: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}

type FormValues = {
  category: Category
  label: string
  value: string
  imageUrl: string
  price: string
  sortOrder: number
  isActive: boolean
}

/** Per-category helper text for the price field. */
function priceFieldHint(category: Category): string {
  switch (category) {
    case 'CARAT':
      return 'Diamond base price for this carat'
    case 'SOURCE':
    case 'COLOR':
    case 'SHAPE':
      return 'Additive adjustment (may be negative)'
    case 'METAL':
      return 'Metal price adjustment (added to jewellery)'
    case 'RING_DESIGN':
    case 'NECKLACE_DESIGN':
    case 'EARRING_DESIGN':
    case 'BRACELET_DESIGN':
      return 'Jewellery design price'
    default:
      return 'Not used in pricing for this category'
  }
}

function priceFieldLabel(category: Category): string {
  switch (category) {
    case 'CARAT':
      return 'Base price'
    case 'SOURCE':
    case 'COLOR':
    case 'SHAPE':
    case 'METAL':
      return 'Price adjustment'
    case 'RING_DESIGN':
    case 'NECKLACE_DESIGN':
    case 'EARRING_DESIGN':
    case 'BRACELET_DESIGN':
      return 'Design price'
    default:
      return 'Price'
  }
}

function formatPrice(price: string | number | null): string {
  if (price == null || price === '') return '—'
  const num = Number(price)
  if (Number.isNaN(num)) return '—'
  return num.toFixed(2)
}

const CATEGORIES: { value: Category; label: string; needsImage?: boolean }[] = [
  { value: 'SOURCE', label: 'Source', needsImage: true },
  { value: 'COLOR', label: 'Color', needsImage: true },
  { value: 'CARAT', label: 'Carat' },
  { value: 'SHAPE', label: 'Shape', needsImage: true },
  { value: 'SETTING_TYPE', label: 'Setting Type' },
  { value: 'RING_DESIGN', label: 'Ring Design', needsImage: true },
  { value: 'NECKLACE_DESIGN', label: 'Necklace Design', needsImage: true },
  { value: 'EARRING_DESIGN', label: 'Earring Design', needsImage: true },
  { value: 'BRACELET_DESIGN', label: 'Bracelet Design', needsImage: true },
  { value: 'METAL', label: 'Metal' },
]

const EMPTY_FORM: FormValues = {
  category: 'SOURCE',
  label: '',
  value: '',
  imageUrl: '',
  price: '',
  sortOrder: 0,
  isActive: true,
}

const CATEGORY_LABEL = Object.fromEntries(CATEGORIES.map(c => [c.value, c.label])) as Record<Category, string>
const IMAGE_CATEGORIES = new Set<Category>(CATEGORIES.filter(c => c.needsImage).map(c => c.value))

function toForm(option?: SpecOption | null, category: Category = 'SOURCE'): FormValues {
  if (!option) return { ...EMPTY_FORM, category }
  return {
    category: option.category,
    label: option.label,
    value: option.value,
    imageUrl: option.imageUrl ?? '',
    price: option.price == null || option.price === '' ? '' : String(option.price),
    sortOrder: option.sortOrder,
    isActive: option.isActive,
  }
}

function SpecModal({
  option,
  defaultCategory,
  onClose,
  onSaved,
}: {
  option: SpecOption | null
  defaultCategory: Category
  onClose: () => void
  onSaved: () => void
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [form, setForm] = useState<FormValues>(() => toForm(option, defaultCategory))
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)

  function update<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setForm(prev => ({
      ...prev,
      [key]: value,
      ...(key === 'label' && !option && !prev.value ? { value: String(value) } : {}),
    }))
  }

  async function uploadImage(file: File) {
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/admin/sfs-diamond-specs/upload', { method: 'POST', body: fd })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'Upload failed')
      update('imageUrl', data.imageUrl)
      toast.success('Image uploaded.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Image upload failed.')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await fetch(
        option ? `/api/admin/sfs-diamond-specs/${option.id}` : '/api/admin/sfs-diamond-specs',
        {
          method: option ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...form,
            value: form.value.trim() || form.label.trim(),
            imageUrl: form.imageUrl.trim() || null,
            price: form.price.trim() === '' ? null : Number(form.price),
          }),
        },
      )
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'Save failed')
      toast.success(option ? 'Spec option updated.' : 'Spec option created.')
      onSaved()
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed.')
    } finally {
      setSaving(false)
    }
  }

  const showImageHint = IMAGE_CATEGORIES.has(form.category)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-2xl rounded-lg p-6 space-y-5" style={{ background: '#111111', border: '1px solid #2A2418' }}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold" style={{ color: 'var(--foreground)' }}>
              {option ? 'Edit diamond spec' : 'Create diamond spec'}
            </h2>
            <p className="text-xs mt-1" style={{ color: 'var(--muted-foreground)' }}>
              Active options are shown on the SFS Diamond customer order wizard.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 inline-flex items-center justify-center rounded-md"
            style={{ color: 'var(--muted-foreground)', border: '1px solid #2A2418' }}
            aria-label="Close"
          >
            <X size={14} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-1.5">
              <span className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>Category</span>
              <Select value={form.category} onValueChange={v => update('category', (v ?? 'SHAPE') as Category)}>
                <SelectTrigger className="w-full" style={{ background: '#0A0A0A', border: '1px solid #2A2418' }}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(category => (
                    <SelectItem key={category.value} value={category.value}>{category.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>

            <label className="space-y-1.5">
              <span className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>Sort order</span>
              <Input
                type="number"
                min={0}
                value={form.sortOrder}
                onChange={e => update('sortOrder', Number(e.target.value))}
              />
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-1.5">
              <span className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>Display label</span>
              <Input value={form.label} onChange={e => update('label', e.target.value)} required maxLength={120} />
            </label>
            <label className="space-y-1.5">
              <span className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>Submitted value</span>
              <Input value={form.value} onChange={e => update('value', e.target.value)} maxLength={120} placeholder="Defaults to label" />
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-1.5">
              <span className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>
                {priceFieldLabel(form.category)} (HKD)
              </span>
              <Input
                type="number"
                step="0.01"
                value={form.price}
                onChange={e => update('price', e.target.value)}
                placeholder="Leave blank for 0"
              />
              <span className="text-[11px]" style={{ color: 'var(--muted-foreground)' }}>
                {priceFieldHint(form.category)}
              </span>
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-[160px_1fr]">
            <div
              className="h-36 rounded-lg flex items-center justify-center overflow-hidden"
              style={{ background: '#0A0A0A', border: '1px solid #2A2418' }}
            >
              {form.imageUrl ? (
                <img src={form.imageUrl} alt={form.label || 'Spec image'} className="h-full w-full object-contain p-3" />
              ) : (
                <ImagePlus size={28} style={{ color: '#5A5040' }} />
              )}
            </div>
            <div className="space-y-2">
              <label className="space-y-1.5 block">
                <span className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>Image URL</span>
                <Input value={form.imageUrl} onChange={e => update('imageUrl', e.target.value)} maxLength={2000} placeholder="/sfsdiamond/order/cut-round.jpeg or OSS URL" />
              </label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,.heic,.heif"
                className="hidden"
                onChange={e => {
                  const file = e.target.files?.[0]
                  if (file) void uploadImage(file)
                }}
              />
              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                  {uploading ? <Loader2 size={14} className="animate-spin" /> : <ImagePlus size={14} />}
                  Upload image
                </Button>
                <span className="text-xs" style={{ color: showImageHint ? '#C9A96E' : 'var(--muted-foreground)' }}>
                  Images are used for Source, Color, Shape, Ring Design, Necklace Design, Earring Design, and Bracelet Design.
                </span>
              </div>
            </div>
          </div>

          <label className="inline-flex items-center gap-2 text-sm" style={{ color: 'var(--foreground)' }}>
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={e => update('isActive', e.target.checked)}
              className="h-4 w-4 accent-[#C9A96E]"
            />
            Active on order page
          </label>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving || uploading}>
              {saving ? <Loader2 size={14} className="animate-spin" /> : option ? <Pencil size={14} /> : <Plus size={14} />}
              {saving ? 'Saving...' : option ? 'Save changes' : 'Create option'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

type PriceTier = {
  id: string
  minCount: number
  maxCount: number | null
  discountRate: string | number
  sortOrder: number
}

type TierDraft = { minCount: string; maxCount: string; discountPct: string }

const EMPTY_TIER_DRAFT: TierDraft = { minCount: '', maxCount: '', discountPct: '' }

/** Quantity-based diamond discount tiers (applied to the diamond price portion by order total count). */
function PriceTierSection() {
  const [tiers, setTiers] = useState<PriceTier[]>([])
  const [loading, setLoading] = useState(true)
  const [draft, setDraft] = useState<TierDraft>(EMPTY_TIER_DRAFT)
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/sfs-diamond-specs/price-tiers')
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'Failed to load tiers')
      setTiers(data.tiers ?? [])
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load tiers.')
    } finally {
      setLoading(false)
    }
  }, [])

  // eslint-disable-next-line react-hooks/set-state-in-effect -- load() updates state asynchronously after fetching saved tiers.
  useEffect(() => { void load() }, [load])

  async function addTier() {
    const minCount = Number(draft.minCount)
    const discountPct = Number(draft.discountPct)
    if (!Number.isInteger(minCount) || minCount < 1) {
      toast.error('Min count must be a whole number ≥ 1.')
      return
    }
    const maxCount = draft.maxCount.trim() === '' ? null : Number(draft.maxCount)
    if (maxCount != null && (!Number.isInteger(maxCount) || maxCount < minCount)) {
      toast.error('Max count must be a whole number ≥ min count.')
      return
    }
    if (Number.isNaN(discountPct) || discountPct < 0 || discountPct > 100) {
      toast.error('Discount must be between 0 and 100%.')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/admin/sfs-diamond-specs/price-tiers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ minCount, maxCount, discountRate: discountPct / 100, sortOrder: minCount }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'Failed to add tier')
      setDraft(EMPTY_TIER_DRAFT)
      toast.success('Tier added.')
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add tier.')
    } finally {
      setSaving(false)
    }
  }

  async function deleteTier(id: string) {
    if (!window.confirm('Delete this discount tier?')) return
    setBusyId(id)
    try {
      const res = await fetch(`/api/admin/sfs-diamond-specs/price-tiers/${id}`, { method: 'DELETE' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'Delete failed')
      setTiers(prev => prev.filter(t => t.id !== id))
      toast.success('Tier deleted.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <Card>
      <CardContent className="p-5 space-y-4">
        <div>
          <h2 className="text-lg font-semibold" style={{ color: 'var(--foreground)' }}>Quantity discount tiers</h2>
          <p className="text-xs mt-1" style={{ color: 'var(--muted-foreground)' }}>
            Discount on the diamond price (carat + color + shape) based on the total number of diamonds in an order. The most specific matching tier applies.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead style={{ background: '#111108', borderBottom: '1px solid #2A2418' }}>
              <tr>
                {['Min count', 'Max count', 'Discount', ''].map((h, i) => (
                  <th key={i} className="px-4 py-2.5 text-left font-medium whitespace-nowrap" style={{ color: 'var(--muted-foreground)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2A2418]">
              {loading ? (
                <tr><td colSpan={4} className="px-4 py-8 text-center" style={{ color: 'var(--muted-foreground)' }}><Loader2 size={14} className="inline animate-spin mr-2" />Loading...</td></tr>
              ) : tiers.length === 0 ? (
                <tr><td colSpan={4} className="px-4 py-8 text-center" style={{ color: 'var(--muted-foreground)' }}>No discount tiers. Diamonds are priced at full base price.</td></tr>
              ) : tiers.map(tier => (
                <tr key={tier.id} className="align-middle">
                  <td className="px-4 py-2.5 tabular-nums" style={{ color: 'var(--foreground)' }}>{tier.minCount}</td>
                  <td className="px-4 py-2.5 tabular-nums" style={{ color: 'var(--foreground)' }}>{tier.maxCount ?? '∞'}</td>
                  <td className="px-4 py-2.5 tabular-nums" style={{ color: '#C9A96E' }}>{(Number(tier.discountRate) * 100).toFixed(2)}%</td>
                  <td className="px-4 py-2.5 text-right">
                    <Button size="sm" variant="outline" onClick={() => void deleteTier(tier.id)} disabled={busyId === tier.id}>
                      {busyId === tier.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                      Delete
                    </Button>
                  </td>
                </tr>
              ))}
              <tr>
                <td className="px-4 py-2.5">
                  <Input type="number" min={1} value={draft.minCount} placeholder="e.g. 3" onChange={e => setDraft(d => ({ ...d, minCount: e.target.value }))} />
                </td>
                <td className="px-4 py-2.5">
                  <Input type="number" min={1} value={draft.maxCount} placeholder="blank = ∞" onChange={e => setDraft(d => ({ ...d, maxCount: e.target.value }))} />
                </td>
                <td className="px-4 py-2.5">
                  <Input type="number" step="0.01" min={0} max={100} value={draft.discountPct} placeholder="% e.g. 5" onChange={e => setDraft(d => ({ ...d, discountPct: e.target.value }))} />
                </td>
                <td className="px-4 py-2.5 text-right">
                  <Button size="sm" onClick={() => void addTier()} disabled={saving}>
                    {saving ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                    Add tier
                  </Button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}

export default function SfsDiamondSpecsPage() {
  const [options, setOptions] = useState<SpecOption[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<Category | 'ALL'>('SOURCE')
  const [editing, setEditing] = useState<SpecOption | null>(null)
  const [creating, setCreating] = useState(false)
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  const fetchOptions = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/sfs-diamond-specs')
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'Failed to load specs')
      setOptions(data.options ?? [])
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load specs.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    async function loadInitialOptions() {
      try {
        const res = await fetch('/api/admin/sfs-diamond-specs')
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data.error ?? 'Failed to load specs')
        if (!cancelled) setOptions(data.options ?? [])
      } catch (err) {
        if (!cancelled) toast.error(err instanceof Error ? err.message : 'Failed to load specs.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void loadInitialOptions()
    return () => { cancelled = true }
  }, [])

  const filtered = useMemo(() => {
    const rows = filter === 'ALL' ? options : options.filter(option => option.category === filter)
    return [...rows].sort((a, b) => {
      if (a.category !== b.category) return CATEGORIES.findIndex(c => c.value === a.category) - CATEGORIES.findIndex(c => c.value === b.category)
      return a.sortOrder - b.sortOrder || a.label.localeCompare(b.label)
    })
  }, [filter, options])

  async function toggleActive(option: SpecOption) {
    setUpdatingId(option.id)
    try {
      const res = await fetch(`/api/admin/sfs-diamond-specs/${option.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !option.isActive }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'Update failed')
      setOptions(prev => prev.map(item => item.id === option.id ? data.option : item))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Update failed.')
    } finally {
      setUpdatingId(null)
    }
  }

  async function deleteOption(option: SpecOption) {
    if (!window.confirm(`Delete "${option.label}"? Existing submitted orders keep their saved text values.`)) return
    setUpdatingId(option.id)
    try {
      const res = await fetch(`/api/admin/sfs-diamond-specs/${option.id}`, { method: 'DELETE' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'Delete failed')
      setOptions(prev => prev.filter(item => item.id !== option.id))
      toast.success('Spec option deleted.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed.')
    } finally {
      setUpdatingId(null)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>SFS Diamond Specs</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
            Manage customer-facing order options for source material, diamond color, carat, shape, setting, design, and metal.
          </p>
        </div>
        <Button onClick={() => setCreating(true)}>
          <Plus size={14} />
          Create option
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setFilter('ALL')}
          className="rounded-full px-3 py-1.5 text-xs font-medium border transition-colors"
          style={{
            borderColor: filter === 'ALL' ? '#C9A96E' : '#2A2418',
            color: filter === 'ALL' ? '#C9A96E' : 'var(--muted-foreground)',
            background: filter === 'ALL' ? 'rgba(201,169,110,0.12)' : '#0A0A0A',
          }}
        >
          All
        </button>
        {CATEGORIES.map(category => (
          <button
            key={category.value}
            type="button"
            onClick={() => setFilter(category.value)}
            className="rounded-full px-3 py-1.5 text-xs font-medium border transition-colors"
            style={{
              borderColor: filter === category.value ? '#C9A96E' : '#2A2418',
              color: filter === category.value ? '#C9A96E' : 'var(--muted-foreground)',
              background: filter === category.value ? 'rgba(201,169,110,0.12)' : '#0A0A0A',
            }}
          >
            {category.label}
          </button>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead style={{ background: '#111108', borderBottom: '1px solid #2A2418' }}>
                <tr>
                  {['Preview', 'Category', 'Label', 'Value', 'Price', 'Sort', 'Status', 'Actions'].map(h => (
                    <th key={h} className="px-4 py-3 text-left font-medium whitespace-nowrap" style={{ color: 'var(--muted-foreground)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2A2418]">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center" style={{ color: 'var(--muted-foreground)' }}>
                      <Loader2 size={16} className="inline animate-spin mr-2" /> Loading...
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <SlidersHorizontal size={28} style={{ color: '#C9A96E', opacity: 0.45 }} />
                        <span style={{ color: 'var(--muted-foreground)' }}>No spec options yet.</span>
                      </div>
                    </td>
                  </tr>
                ) : filtered.map(option => (
                  <tr key={option.id} className="hover:bg-[#1A1A12]/50 align-middle">
                    <td className="px-4 py-3">
                      <div className="h-14 w-20 rounded-md flex items-center justify-center overflow-hidden" style={{ background: '#0A0A0A', border: '1px solid #2A2418' }}>
                        {option.imageUrl ? (
                          <img src={option.imageUrl} alt={option.label} className="h-full w-full object-contain p-1.5" />
                        ) : (
                          <span className="text-xs" style={{ color: '#5A5040' }}>No image</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap" style={{ color: 'var(--muted-foreground)' }}>{CATEGORY_LABEL[option.category]}</td>
                    <td className="px-4 py-3 min-w-[180px] font-medium" style={{ color: 'var(--foreground)' }}>{option.label}</td>
                    <td className="px-4 py-3 min-w-[180px]" style={{ color: 'var(--muted-foreground)' }}>{option.value}</td>
                    <td className="px-4 py-3 whitespace-nowrap tabular-nums" style={{ color: option.price == null || option.price === '' ? '#5A5040' : 'var(--foreground)' }}>{formatPrice(option.price)}</td>
                    <td className="px-4 py-3 whitespace-nowrap" style={{ color: 'var(--muted-foreground)' }}>{option.sortOrder}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        className="inline-flex rounded-full px-2 py-0.5 text-xs font-medium"
                        style={{
                          background: option.isActive ? 'rgba(16,185,129,0.14)' : 'rgba(120,113,108,0.16)',
                          color: option.isActive ? '#10b981' : '#9A8060',
                        }}
                      >
                        {option.isActive ? 'Active' : 'Hidden'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <Button size="sm" variant="outline" onClick={() => void toggleActive(option)} disabled={updatingId === option.id}>
                          {updatingId === option.id ? <Loader2 size={13} className="animate-spin" /> : null}
                          {option.isActive ? 'Hide' : 'Show'}
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setEditing(option)}>
                          <Pencil size={13} />
                          Edit
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => void deleteOption(option)} disabled={updatingId === option.id}>
                          <Trash2 size={13} />
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <PriceTierSection />

      {creating && (
        <SpecModal
          option={null}
          defaultCategory={filter === 'ALL' ? 'SOURCE' : filter}
          onClose={() => setCreating(false)}
          onSaved={fetchOptions}
        />
      )}
      {editing && (
        <SpecModal
          option={editing}
          defaultCategory={editing.category}
          onClose={() => setEditing(null)}
          onSaved={fetchOptions}
        />
      )}
    </div>
  )
}
