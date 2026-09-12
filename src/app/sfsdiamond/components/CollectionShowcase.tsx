'use client'

import { useEffect, useEffectEvent, useMemo, useState } from 'react'
import Image from 'next/image'
import {
  getDefaultSfsOrderSpecOptions,
  type SfsOrderSpecOptions,
  type SfsSpecOption,
} from '@/lib/sfs/diamond-spec-options'
import { formatSfsPriceLabel } from '@/lib/sfs/effective-pricing'

export type CollectionCategory = 'all' | 'ring' | 'necklace' | 'earring' | 'bracelet'

export type CollectionProduct = {
  id: string
  name: string
  price: string | null
  desc: string
  img: string
  category: Exclude<CollectionCategory, 'all'>
}

const FILTERS: { id: CollectionCategory; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'ring', label: 'Ring' },
  { id: 'necklace', label: 'Necklace' },
  { id: 'earring', label: 'Earring' },
  { id: 'bracelet', label: 'Bracelet' },
]

const GOLD = '#C9A96E'
const DARK = '#1A1A1A'
const MUTED = '#6B5E4A'

function categoryLabel(category: CollectionProduct['category']) {
  switch (category) {
    case 'ring':
      return 'Ring'
    case 'necklace':
      return 'Necklace'
    case 'earring':
      return 'Earring'
    case 'bracelet':
      return 'Bracelet'
  }
}

function categoryDesc(category: CollectionProduct['category'], design: string) {
  switch (category) {
    case 'ring':
      return `${design} ring setting for your memorial diamond.`
    case 'necklace':
      return `${design} necklace pendant crafted to hold your memorial diamond.`
    case 'earring':
      return `${design} earring design featuring your memorial diamond.`
    case 'bracelet':
      return `${design} bracelet setting for your memorial diamond.`
  }
}

function mapDesigns(
  options: SfsSpecOption[],
  category: CollectionProduct['category'],
): CollectionProduct[] {
  return options
    .filter(option => option.isActive && Boolean(option.imageUrl))
    .map(option => ({
      id: `${category}-${option.id}`,
      name: `${categoryLabel(category)} — ${option.label}`,
      price: formatSfsPriceLabel(option.price),
      desc: categoryDesc(category, option.label),
      img: option.imageUrl as string,
      category,
    }))
}

function productsFromSpecOptions(spec: SfsOrderSpecOptions): CollectionProduct[] {
  return [
    ...mapDesigns(spec.ringDesigns, 'ring'),
    ...mapDesigns(spec.necklaceDesigns, 'necklace'),
    ...mapDesigns(spec.earringDesigns, 'earring'),
    ...mapDesigns(spec.braceletDesigns, 'bracelet'),
  ]
}

export default function CollectionShowcase() {
  const [products, setProducts] = useState<CollectionProduct[]>(() =>
    productsFromSpecOptions(getDefaultSfsOrderSpecOptions()),
  )
  const [filter, setFilter] = useState<CollectionCategory>('all')
  const [activeId, setActiveId] = useState('')
  const [paused, setPaused] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch('/api/sfsdiamond/pricing')
        if (!res.ok) return
        const json = await res.json()
        const next = productsFromSpecOptions(json.specOptions as SfsOrderSpecOptions)
        if (!cancelled && next.length > 0) setProducts(next)
      } catch {
        // Keep default catalog fallback.
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [])

  const availableFilters = useMemo(() => {
    const present = new Set(products.map(p => p.category))
    return FILTERS.filter(f => f.id === 'all' || present.has(f.id as Exclude<CollectionCategory, 'all'>))
  }, [products])

  const filtered = useMemo(
    () => (filter === 'all' ? products : products.filter(p => p.category === filter)),
    [filter, products],
  )

  const active = filtered.find(p => p.id === activeId) ?? filtered[0]

  useEffect(() => {
    if (!filtered.some(p => p.id === activeId) && filtered[0]) {
      setActiveId(filtered[0].id)
    }
  }, [filter, filtered, activeId])

  const onAutoAdvance = useEffectEvent(() => {
    if (paused || filtered.length < 2 || !active) return
    const index = filtered.findIndex(p => p.id === active.id)
    const next = filtered[(index + 1) % filtered.length]
    if (next) setActiveId(next.id)
  })

  useEffect(() => {
    const timer = window.setInterval(() => onAutoAdvance(), 4200)
    return () => window.clearInterval(timer)
  }, [filter, paused, active?.id, filtered.length, onAutoAdvance])

  if (!active) {
    return (
      <p className="text-center text-sm" style={{ color: MUTED }}>
        {loading ? 'Loading collection…' : 'No jewellery products with photos are available yet.'}
      </p>
    )
  }

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-center justify-center gap-2">
        {availableFilters.map(item => {
          const selected = filter === item.id
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setFilter(item.id)}
              className="rounded-full px-4 py-2 text-xs font-semibold tracking-wide transition-all"
              style={{
                background: selected ? DARK : '#FFFFFF',
                color: selected ? '#F5F0E8' : MUTED,
                border: `1px solid ${selected ? DARK : '#EDE7D8'}`,
              }}
            >
              {item.label}
            </button>
          )
        })}
      </div>

      <div
        className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr] lg:items-stretch"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onFocusCapture={() => setPaused(true)}
        onBlurCapture={e => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setPaused(false)
        }}
      >
        <div
          className="relative overflow-hidden rounded-3xl"
          style={{
            minHeight: '22rem',
            background: '#111111',
            border: '1px solid #2A2418',
          }}
        >
          <div key={active.id} className="absolute inset-0 transition-opacity duration-500">
            <Image
              src={active.img}
              alt={active.name}
              fill
              sizes="(max-width: 1024px) 100vw, 60vw"
              className="object-cover"
              priority
            />
            <div
              className="absolute inset-0"
              style={{
                background:
                  'linear-gradient(to top, rgba(10,8,5,0.88) 0%, rgba(10,8,5,0.35) 45%, rgba(10,8,5,0.15) 100%)',
              }}
            />
          </div>

          <div className="relative z-10 flex h-full min-h-[22rem] flex-col justify-end p-6 md:p-8">
            <p className="mb-2 text-[10px] uppercase tracking-[0.24em]" style={{ color: GOLD }}>
              {categoryLabel(active.category)}
            </p>
            <h3
              className="mb-2 text-2xl font-bold md:text-3xl"
              style={{ fontFamily: 'Georgia, serif', color: '#FFFFFF' }}
            >
              {active.name}
            </h3>
            <p className="mb-4 max-w-lg text-sm leading-relaxed" style={{ color: '#D8CFC0' }}>
              {active.desc}
            </p>
            {active.price ? (
              <p className="text-sm font-bold" style={{ color: GOLD }}>{active.price}</p>
            ) : null}

            <div className="mt-6 flex flex-wrap gap-2">
              {filtered.map(product => {
                const selected = product.id === active.id
                return (
                  <button
                    key={product.id}
                    type="button"
                    aria-label={`Show ${product.name}`}
                    onClick={() => setActiveId(product.id)}
                    className="h-1.5 rounded-full transition-all"
                    style={{
                      width: selected ? '1.75rem' : '0.65rem',
                      background: selected ? GOLD : 'rgba(245,240,232,0.35)',
                    }}
                  />
                )
              })}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:gap-4 content-start">
          {filtered.map(product => {
            const selected = product.id === active.id
            return (
              <button
                key={product.id}
                type="button"
                onClick={() => setActiveId(product.id)}
                className="group overflow-hidden rounded-2xl text-left transition-all"
                style={{
                  background: '#FFFFFF',
                  border: `1px solid ${selected ? GOLD : '#EDE7D8'}`,
                  boxShadow: selected ? '0 8px 28px rgba(201,169,110,0.18)' : '0 1px 12px rgba(0,0,0,0.04)',
                }}
              >
                <div className="relative aspect-[4/3] overflow-hidden">
                  <Image
                    src={product.img}
                    alt={product.name}
                    fill
                    sizes="(max-width: 640px) 50vw, 20vw"
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                </div>
                <div className="space-y-1 p-3">
                  <p className="text-[10px] uppercase tracking-wider" style={{ color: GOLD }}>
                    {categoryLabel(product.category)}
                  </p>
                  <p className="text-sm font-semibold leading-snug" style={{ color: DARK }}>
                    {product.name}
                  </p>
                  {product.price ? (
                    <p className="text-xs font-semibold" style={{ color: GOLD }}>{product.price}</p>
                  ) : null}
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
