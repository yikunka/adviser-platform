'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { formatSfsPriceLabel, isAdditiveSfsPriceCategory } from '@/lib/sfs/effective-pricing'
import { CircleDollarSign, Loader2, Search } from 'lucide-react'
import type { SfsDiamondSpecCategory } from '@prisma/client'

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
  price: string | number | null
  sortOrder: number
  isActive: boolean
}

type CustomerRow = {
  id: string
  source: 'ACCOUNT' | 'MANUAL' | 'ORDER_ONLY'
  customerId: string | null
  name: string
  email: string | null
  phone: string | null
  orderCount: number
}

type PriceOverride = { category: Category; value: string; price: string | number }

type PriceSectionId = 'base' | 'addon' | 'jewellery'

type PriceSection = {
  id: PriceSectionId
  title: string
  subtitle: string
  categories: { value: Category; label: string }[]
}

const PRICE_SECTIONS: PriceSection[] = [
  {
    id: 'base',
    title: '基础价格',
    subtitle: 'Carat base price for each diamond (HK$).',
    categories: [{ value: 'CARAT', label: 'Carat' }],
  },
  {
    id: 'addon',
    title: 'Add-on',
    subtitle: 'Adjustments added on top of the carat base (+/− HKD).',
    categories: [
      { value: 'SOURCE', label: 'Source' },
      { value: 'COLOR', label: 'Color' },
      { value: 'SHAPE', label: 'Shape' },
      { value: 'METAL', label: 'Metal' },
    ],
  },
  {
    id: 'jewellery',
    title: '首饰价格',
    subtitle: 'Jewellery design prices added after the diamond portion (HK$).',
    categories: [
      { value: 'RING_DESIGN', label: 'Ring Design' },
      { value: 'NECKLACE_DESIGN', label: 'Necklace Design' },
      { value: 'EARRING_DESIGN', label: 'Earring Design' },
      { value: 'BRACELET_DESIGN', label: 'Bracelet Design' },
    ],
  },
]

const PRICE_CATEGORIES = PRICE_SECTIONS.flatMap(section => section.categories)
const PRICE_CATEGORY_SET = new Set(PRICE_CATEGORIES.map(c => c.value))
const CATEGORY_ORDER = PRICE_CATEGORIES.map(c => c.value)

function isAdditiveCategory(category: Category) {
  return isAdditiveSfsPriceCategory(category as SfsDiamondSpecCategory)
}

function displayPrice(price: string | number | null, category: Category): string {
  if (price == null || price === '') return '—'
  const num = Number(price)
  if (Number.isNaN(num)) return '—'
  return formatSfsPriceLabel(num, { additive: isAdditiveCategory(category) }) ?? '—'
}

function sortOptions(rows: SpecOption[]) {
  return [...rows].sort((a, b) => {
    if (a.category !== b.category) {
      return CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category)
    }
    return a.sortOrder - b.sortOrder || a.label.localeCompare(b.label)
  })
}

function SectionFilterChips({
  value,
  onChange,
}: {
  value: PriceSectionId | 'ALL'
  onChange: (next: PriceSectionId | 'ALL') => void
}) {
  const chips: { id: PriceSectionId | 'ALL'; label: string }[] = [
    { id: 'ALL', label: '全部' },
    ...PRICE_SECTIONS.map(section => ({ id: section.id, label: section.title })),
  ]
  return (
    <div className="flex flex-wrap gap-2">
      {chips.map(chip => (
        <button
          key={chip.id}
          type="button"
          onClick={() => onChange(chip.id)}
          className="rounded-full px-3 py-1.5 text-xs font-medium border transition-colors"
          style={{
            borderColor: value === chip.id ? '#C9A96E' : '#2A2418',
            color: value === chip.id ? '#C9A96E' : 'var(--muted-foreground)',
            background: value === chip.id ? 'rgba(201,169,110,0.12)' : '#0A0A0A',
          }}
        >
          {chip.label}
        </button>
      ))}
    </div>
  )
}

function FormulaHint() {
  return (
    <p className="text-xs rounded-md px-3 py-2" style={{ background: 'rgba(201,169,110,0.08)', color: '#C9A96E' }}>
      计价：钻石部分 = 克拉基础 + Source + Color + Shape；首饰部分 = Design + Metal；客户下单页会即时加总。
    </p>
  )
}

function StandardPricesPanel() {
  const [options, setOptions] = useState<SpecOption[]>([])
  const [loading, setLoading] = useState(true)
  const [sectionFilter, setSectionFilter] = useState<PriceSectionId | 'ALL'>('ALL')
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [savingId, setSavingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/sfs-diamond-specs')
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'Failed to load specs')
      const rows: SpecOption[] = (data.options ?? []).filter((o: SpecOption) => PRICE_CATEGORY_SET.has(o.category))
      setOptions(rows)
      const next: Record<string, string> = {}
      for (const row of rows) {
        next[row.id] = row.price == null || row.price === '' ? '' : String(Number(row.price))
      }
      setDrafts(next)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load standard prices.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const sections = useMemo(() => {
    const visible = sectionFilter === 'ALL'
      ? PRICE_SECTIONS
      : PRICE_SECTIONS.filter(section => section.id === sectionFilter)
    return visible
      .map(section => ({
        ...section,
        groups: section.categories
          .map(cat => ({
            category: cat.value,
            label: cat.label,
            additive: isAdditiveCategory(cat.value),
            options: sortOptions(options.filter(o => o.category === cat.value)),
          }))
          .filter(group => group.options.length > 0),
      }))
      .filter(section => section.groups.length > 0)
  }, [options, sectionFilter])

  async function savePrice(option: SpecOption) {
    const raw = (drafts[option.id] ?? '').trim()
    const price = raw === '' ? null : Number(raw)
    if (raw !== '' && Number.isNaN(price)) {
      toast.error(`Invalid price for ${option.label}.`)
      return
    }
    setSavingId(option.id)
    try {
      const res = await fetch(`/api/admin/sfs-diamond-specs/${option.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ price }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'Save failed')
      setOptions(prev => prev.map(item => (item.id === option.id ? data.option : item)))
      setDrafts(prev => ({
        ...prev,
        [option.id]: data.option.price == null || data.option.price === '' ? '' : String(Number(data.option.price)),
      }))
      toast.success(`Saved ${option.label}.`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed.')
    } finally {
      setSavingId(null)
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
        按「基础价格 → Add-on → 首饰价格」维护标准价。规格名称与图片仍在 Diamond Specs。
      </p>
      <FormulaHint />
      <SectionFilterChips value={sectionFilter} onChange={setSectionFilter} />

      {loading ? (
        <Card>
          <CardContent className="py-12 text-center text-sm" style={{ color: 'var(--muted-foreground)' }}>
            <Loader2 size={16} className="inline animate-spin mr-2" /> Loading...
          </CardContent>
        </Card>
      ) : sections.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm" style={{ color: 'var(--muted-foreground)' }}>
            No priced options yet. Add options under Diamond Specs first.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-5">
          {sections.map(section => (
            <div key={section.id} className="space-y-3">
              <div>
                <h3 className="text-sm font-semibold" style={{ color: '#C9A96E' }}>{section.title}</h3>
                <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>{section.subtitle}</p>
              </div>
              {section.groups.map(group => (
                <Card key={group.category}>
                  <CardContent className="p-0">
                    <div className="px-4 py-2.5 flex items-center justify-between border-b border-[#2A2418]">
                      <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--foreground)' }}>
                        {group.label}
                      </span>
                      <span className="text-[10px] font-medium" style={{ color: 'var(--muted-foreground)' }}>
                        {group.additive ? 'Add-on (+/−)' : 'Amount (HK$)'}
                      </span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead style={{ background: '#111108', borderBottom: '1px solid #2A2418' }}>
                          <tr>
                            <th className="px-4 py-2.5 text-left font-medium" style={{ color: 'var(--muted-foreground)' }}>Option</th>
                            <th className="px-4 py-2.5 text-right font-medium" style={{ color: 'var(--muted-foreground)' }}>Current</th>
                            <th className="px-4 py-2.5 text-right font-medium" style={{ color: 'var(--muted-foreground)' }}>
                              {group.additive ? 'New add-on' : 'New price'}
                            </th>
                            <th className="px-4 py-2.5 w-24" />
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#2A2418]">
                          {group.options.map(option => {
                            const draft = drafts[option.id] ?? ''
                            const dirty = (option.price == null || option.price === '' ? '' : String(Number(option.price))) !== draft.trim()
                            return (
                              <tr key={option.id} className="hover:bg-[#1A1A12]/50">
                                <td className="px-4 py-2.5 min-w-[200px]" style={{ color: 'var(--foreground)' }}>
                                  {option.label}
                                  {!option.isActive && (
                                    <span className="ml-2 text-[10px]" style={{ color: 'var(--muted-foreground)' }}>(hidden)</span>
                                  )}
                                </td>
                                <td className="px-4 py-2.5 text-right tabular-nums" style={{ color: 'var(--muted-foreground)' }}>
                                  {displayPrice(option.price, option.category)}
                                </td>
                                <td className="px-4 py-2.5 text-right">
                                  <div className="inline-flex items-center gap-1.5 justify-end">
                                    {group.additive && (
                                      <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>+</span>
                                    )}
                                    <Input
                                      type="number"
                                      step="0.01"
                                      className="max-w-[9rem] text-right"
                                      value={draft}
                                      placeholder="0"
                                      onChange={e => setDrafts(prev => ({ ...prev, [option.id]: e.target.value }))}
                                    />
                                  </div>
                                </td>
                                <td className="px-4 py-2.5 text-right">
                                  <Button
                                    size="sm"
                                    disabled={!dirty || savingId === option.id}
                                    onClick={() => void savePrice(option)}
                                  >
                                    {savingId === option.id ? <Loader2 size={13} className="animate-spin" /> : null}
                                    Save
                                  </Button>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function CustomerPricesPanel() {
  const [customers, setCustomers] = useState<CustomerRow[]>([])
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string>('')
  const [loadingCustomers, setLoadingCustomers] = useState(true)
  const [specOptions, setSpecOptions] = useState<SpecOption[]>([])
  const [draftPrices, setDraftPrices] = useState<Record<string, string>>({})
  const [loadingPrices, setLoadingPrices] = useState(false)
  const [saving, setSaving] = useState(false)
  const [sectionFilter, setSectionFilter] = useState<PriceSectionId | 'ALL'>('ALL')
  const [boundCustomerId, setBoundCustomerId] = useState<string | null>(null)

  const selected = customers.find(c => c.id === selectedId) ?? null
  const resolvedCustomerId = boundCustomerId ?? selected?.customerId ?? null

  const loadCustomers = useCallback(async () => {
    setLoadingCustomers(true)
    try {
      const params = new URLSearchParams({ page: '1' })
      if (search.trim()) params.set('q', search.trim())
      const res = await fetch(`/api/admin/sfs-customers?${params}`)
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error ?? 'Failed to load customers')
      const rows: CustomerRow[] = (json.customers ?? []).filter((c: CustomerRow) => c.source !== 'ORDER_ONLY' || c.customerId)
      setCustomers(rows)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load customers.')
    } finally {
      setLoadingCustomers(false)
    }
  }, [search])

  useEffect(() => {
    const t = setTimeout(() => void loadCustomers(), search ? 250 : 0)
    return () => clearTimeout(t)
  }, [loadCustomers, search])

  const loadPrices = useCallback(async (customer: CustomerRow) => {
    setLoadingPrices(true)
    setBoundCustomerId(customer.customerId)
    try {
      const [overridesRes, specsRes] = await Promise.all([
        fetch(`/api/admin/sfs-customers/${encodeURIComponent(customer.id)}/price-overrides`),
        fetch('/api/admin/sfs-diamond-specs'),
      ])
      const overridesJson = await overridesRes.json().catch(() => ({}))
      const specsJson = await specsRes.json().catch(() => ({}))
      if (!overridesRes.ok) throw new Error(overridesJson.error ?? 'Failed to load overrides')
      if (overridesJson.customerId) setBoundCustomerId(overridesJson.customerId)
      const options: SpecOption[] = (specsJson.options ?? []).filter((o: SpecOption) => PRICE_CATEGORY_SET.has(o.category))
      setSpecOptions(options)
      const overrideMap = new Map(
        ((overridesJson.overrides ?? []) as PriceOverride[]).map(o => [`${o.category}|${o.value}`, String(Number(o.price))]),
      )
      const drafts: Record<string, string> = {}
      for (const option of options) {
        drafts[`${option.category}|${option.value}`] = overrideMap.get(`${option.category}|${option.value}`) ?? ''
      }
      setDraftPrices(drafts)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load client prices.')
      setSpecOptions([])
      setDraftPrices({})
    } finally {
      setLoadingPrices(false)
    }
  }, [])

  useEffect(() => {
    if (!selected) {
      setSpecOptions([])
      setDraftPrices({})
      setBoundCustomerId(null)
      return
    }
    void loadPrices(selected)
  }, [selected, loadPrices])

  const sections = useMemo(() => {
    const visible = sectionFilter === 'ALL'
      ? PRICE_SECTIONS
      : PRICE_SECTIONS.filter(section => section.id === sectionFilter)
    return visible
      .map(section => ({
        ...section,
        groups: section.categories
          .map(cat => ({
            category: cat.value,
            label: cat.label,
            additive: isAdditiveCategory(cat.value),
            options: sortOptions(specOptions.filter(o => o.category === cat.value)),
          }))
          .filter(group => group.options.length > 0),
      }))
      .filter(section => section.groups.length > 0)
  }, [sectionFilter, specOptions])

  async function savePriceList() {
    if (!selected) return
    if (!resolvedCustomerId) {
      toast.error('This customer has no profile yet. Save the customer under SFS Customers first.')
      return
    }
    const next: PriceOverride[] = []
    for (const option of specOptions) {
      const key = `${option.category}|${option.value}`
      const raw = (draftPrices[key] ?? '').trim()
      if (raw === '') continue
      const price = Number(raw)
      if (Number.isNaN(price)) {
        toast.error(`Invalid price for ${option.label}.`)
        return
      }
      next.push({ category: option.category, value: option.value, price })
    }
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/sfs-customers/${encodeURIComponent(selected.id)}/price-overrides`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          overrides: next.map(o => ({ category: o.category, value: o.value, price: Number(o.price) })),
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error ?? 'Save failed')
      if (json.customerId) setBoundCustomerId(json.customerId)
      toast.success('Client price list saved.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed.')
    } finally {
      setSaving(false)
    }
  }

  const overrideCount = Object.values(draftPrices).filter(v => v.trim() !== '').length

  return (
    <div className="space-y-4">
      <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
        选择客户后，按「基础价格 → Add-on → 首饰价格」设置客户价。空白 = 用标准价。
      </p>
      <FormulaHint />

      <div className="flex flex-wrap items-end gap-3">
        <label className="space-y-1.5 block min-w-[240px] flex-1 max-w-md">
          <span className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>Search customers</span>
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--muted-foreground)' }} />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Name, email, phone..."
              className="pl-8"
            />
          </div>
        </label>
        <label className="space-y-1.5 block min-w-[280px] flex-1 max-w-lg">
          <span className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>Customer</span>
          <Select
            value={selectedId || undefined}
            onValueChange={value => setSelectedId(value ?? '')}
          >
            <SelectTrigger className="w-full" style={{ background: '#0A0A0A', border: '1px solid #2A2418' }}>
              <SelectValue placeholder={loadingCustomers ? 'Loading...' : 'Select a customer'} />
            </SelectTrigger>
            <SelectContent>
              {customers.map(customer => (
                <SelectItem key={customer.id} value={customer.id}>
                  {customer.name}
                  {customer.phone ? ` · ${customer.phone}` : customer.email ? ` · ${customer.email}` : ''}
                  {` (${customer.orderCount} orders)`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
      </div>

      {!selected ? (
        <Card>
          <CardContent className="py-12 text-center text-sm" style={{ color: 'var(--muted-foreground)' }}>
            Select a customer to edit their price list.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3 rounded-md p-4" style={{ background: '#0A0A0A', border: '1px solid #2A2418' }}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
                {selected.name}
              </h3>
              <p className="text-xs mt-1" style={{ color: 'var(--muted-foreground)' }}>
                {[selected.phone, selected.email].filter(Boolean).join(' · ') || 'No contact details'}
              </p>
            </div>
            <Button type="button" size="sm" disabled={saving || loadingPrices || !resolvedCustomerId} onClick={() => void savePriceList()}>
              {saving ? 'Saving…' : `Save list (${overrideCount})`}
            </Button>
          </div>

          {!resolvedCustomerId && (
            <p className="text-xs rounded-md px-3 py-2" style={{ background: 'rgba(201,169,110,0.08)', color: '#C9A96E' }}>
              This row has no customer profile yet. Open SFS Customers, edit and save the profile once, then return here.
            </p>
          )}

          <SectionFilterChips value={sectionFilter} onChange={setSectionFilter} />

          {loadingPrices ? (
            <p className="text-xs py-6 text-center" style={{ color: 'var(--muted-foreground)' }}>
              <Loader2 size={14} className="inline animate-spin mr-2" /> Loading price list...
            </p>
          ) : sections.length === 0 ? (
            <p className="text-xs py-6 text-center" style={{ color: 'var(--muted-foreground)' }}>
              No diamond specs found. Add options under Diamond Specs first.
            </p>
          ) : (
            <div className="space-y-5">
              {sections.map(section => (
                <div key={section.id} className="space-y-3">
                  <div>
                    <h4 className="text-sm font-semibold" style={{ color: '#C9A96E' }}>{section.title}</h4>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>{section.subtitle}</p>
                  </div>
                  {section.groups.map(group => (
                    <div key={group.category} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--foreground)' }}>
                          {group.label}
                        </p>
                        <span className="text-[10px]" style={{ color: 'var(--muted-foreground)' }}>
                          {group.additive ? 'Add-on (+/−)' : 'Amount (HK$)'}
                        </span>
                      </div>
                      <div className="overflow-x-auto rounded-md" style={{ border: '1px solid #2A2418' }}>
                        <table className="w-full text-sm">
                          <thead style={{ background: '#111108' }}>
                            <tr>
                              <th className="px-3 py-2 text-left font-medium" style={{ color: 'var(--muted-foreground)' }}>Option</th>
                              <th className="px-3 py-2 text-right font-medium" style={{ color: 'var(--muted-foreground)' }}>Standard</th>
                              <th className="px-3 py-2 text-right font-medium" style={{ color: 'var(--muted-foreground)' }}>This client</th>
                              <th className="px-3 py-2 w-20" />
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#2A2418]">
                            {group.options.map(option => {
                              const key = `${option.category}|${option.value}`
                              const globalPrice = option.price == null ? null : Number(option.price)
                              const draft = draftPrices[key] ?? ''
                              const isOverride = draft.trim() !== ''
                              return (
                                <tr key={key} style={{ background: isOverride ? 'rgba(201,169,110,0.06)' : undefined }}>
                                  <td className="px-3 py-2" style={{ color: 'var(--foreground)' }}>
                                    {option.label}
                                    {!option.isActive && (
                                      <span className="ml-2 text-[10px]" style={{ color: 'var(--muted-foreground)' }}>(hidden)</span>
                                    )}
                                  </td>
                                  <td className="px-3 py-2 text-right tabular-nums" style={{ color: 'var(--muted-foreground)' }}>
                                    {displayPrice(option.price, option.category)}
                                  </td>
                                  <td className="px-3 py-2 text-right">
                                    <div className="inline-flex items-center gap-1.5 justify-end ml-auto">
                                      {group.additive && (
                                        <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>+</span>
                                      )}
                                      <Input
                                        type="number"
                                        step="0.01"
                                        className="max-w-[8rem] text-right"
                                        value={draft}
                                        placeholder={globalPrice == null ? '0' : String(globalPrice)}
                                        disabled={!resolvedCustomerId}
                                        onChange={e => setDraftPrices(prev => ({ ...prev, [key]: e.target.value }))}
                                      />
                                    </div>
                                  </td>
                                  <td className="px-3 py-2 text-right">
                                    {isOverride && (
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        disabled={!resolvedCustomerId}
                                        onClick={() => setDraftPrices(prev => ({ ...prev, [key]: '' }))}
                                      >
                                        Reset
                                      </Button>
                                    )}
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function SfsFactoryPage() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: 'var(--foreground)' }}>
          <CircleDollarSign size={22} style={{ color: '#C9A96E' }} />
          价格管理
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
          基础价格 + Add-on + 首饰价格；客户下单页会即时加总。
        </p>
      </div>

      <Tabs defaultValue="standard" className="space-y-4">
        <TabsList className="bg-[#0E0E0A] border border-[#2A2418]">
          <TabsTrigger value="standard">标准价格</TabsTrigger>
          <TabsTrigger value="customer">客户价格</TabsTrigger>
        </TabsList>
        <TabsContent value="standard">
          <StandardPricesPanel />
        </TabsContent>
        <TabsContent value="customer">
          <CustomerPricesPanel />
        </TabsContent>
      </Tabs>
    </div>
  )
}
