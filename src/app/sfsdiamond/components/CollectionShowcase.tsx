'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  getDefaultSfsOrderSpecOptions,
  type SfsOrderSpecOptions,
  type SfsSpecOption,
} from '@/lib/sfs/diamond-spec-options'

export type CollectionCategory = 'all' | 'ring' | 'necklace' | 'earring' | 'bracelet'

export type CollectionProduct = {
  id: string
  name: string
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
const BORDER = '#EDE7D8'
const PLACEHOLDER = '/sfsdiamond/diamond-crystal.jpg'

/** Reliable local photos keyed by category + normalised design label. */
const LOCAL_IMAGE_BY_KEY: Record<string, string> = {
  'ring:solitaire': '/sfsdiamond/order/ring-solitaire.png',
  'ring:pave': '/sfsdiamond/order/ring-pave.png',
  'ring:pavé': '/sfsdiamond/order/ring-pave.png',
  'ring:halo': '/sfsdiamond/order/ring-halo.png',
  'ring:r-classic': '/sfsdiamond/order/ring-R-Classic.jpg',
  'ring:classic': '/sfsdiamond/ring-classic.jpg',
  'necklace:classic': '/sfsdiamond/order/necklace-classic.jpeg',
  'necklace:plain': '/sfsdiamond/order/necklace-plain.jpeg',
  'necklace:buddha': '/sfsdiamond/order/necklace-buddha.jpeg',
  'necklace:cross': '/sfsdiamond/order/necklace-cross.jpeg',
  'necklace:yinyang': '/sfsdiamond/order/necklace-yinyang.jpeg',
  'necklace:yin-yang': '/sfsdiamond/order/necklace-yinyang.jpeg',
  'necklace:life': '/sfsdiamond/necklace-life.jpg',
  'necklace:bagua': '/sfsdiamond/necklace-bagua.jpg',
  'bracelet:classic': '/sfsdiamond/order/necklace-classic.jpeg',
  'bracelet:plain': '/sfsdiamond/order/necklace-plain.jpeg',
}

const CATEGORY_FALLBACK: Record<CollectionProduct['category'], string> = {
  ring: '/sfsdiamond/ring-classic.jpg',
  necklace: '/sfsdiamond/order/necklace-classic.jpeg',
  earring: '/sfsdiamond/diamond-crystal.jpg',
  bracelet: '/sfsdiamond/order/necklace-plain.jpeg',
}

function normaliseKey(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-')
}

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

function localImageFor(category: CollectionProduct['category'], label: string, value: string) {
  return (
    LOCAL_IMAGE_BY_KEY[`${category}:${normaliseKey(label)}`]
    ?? LOCAL_IMAGE_BY_KEY[`${category}:${normaliseKey(value)}`]
    ?? null
  )
}

/**
 * Prefer a stable public path when possible. Absolute/signed OSS URLs often break
 * through Next `<Image>` + the CDN loader — we still try them first when no local
 * match exists, then fall back via <ProductPhoto onError>.
 */
function resolveImage(
  category: CollectionProduct['category'],
  label: string,
  value: string,
  imageUrl: string | null,
): string | null {
  const local = localImageFor(category, label, value)
  if (imageUrl?.startsWith('/sfsdiamond/')) return imageUrl
  if (local) return local
  if (imageUrl?.startsWith('http://') || imageUrl?.startsWith('https://')) return imageUrl
  if (imageUrl?.startsWith('/')) return imageUrl
  return CATEGORY_FALLBACK[category] ?? PLACEHOLDER
}

function mapDesigns(
  options: SfsSpecOption[],
  category: CollectionProduct['category'],
): CollectionProduct[] {
  return options
    .filter(option => option.isActive)
    .map(option => {
      const img = resolveImage(category, option.label, option.value, option.imageUrl)
      if (!img) return null
      return {
        id: `${category}-${option.id}`,
        name: `${categoryLabel(category)} — ${option.label}`,
        desc: categoryDesc(category, option.label),
        img,
        category,
      }
    })
    .filter((item): item is CollectionProduct => item != null)
}

function productsFromSpecOptions(spec: SfsOrderSpecOptions): CollectionProduct[] {
  return [
    ...mapDesigns(spec.ringDesigns, 'ring'),
    ...mapDesigns(spec.necklaceDesigns, 'necklace'),
    ...mapDesigns(spec.earringDesigns, 'earring'),
    ...mapDesigns(spec.braceletDesigns, 'bracelet'),
  ]
}

function ProductPhoto({
  src,
  alt,
  category,
  label,
}: {
  src: string
  alt: string
  category: CollectionProduct['category']
  label: string
}) {
  const [current, setCurrent] = useState(src)

  useEffect(() => {
    setCurrent(src)
  }, [src])

  return (
    // Native <img>: signed OSS URLs and absolute CDNs break under next/image + oss-loader.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={current}
      alt={alt}
      className="h-full w-full object-contain p-5 transition-transform duration-500 group-hover:scale-[1.03]"
      loading="lazy"
      decoding="async"
      onError={() => {
        const local = localImageFor(category, label, label)
        const fallback = local ?? CATEGORY_FALLBACK[category] ?? PLACEHOLDER
        if (current !== fallback) setCurrent(fallback)
      }}
    />
  )
}

export default function CollectionShowcase() {
  const [products, setProducts] = useState<CollectionProduct[]>(() =>
    productsFromSpecOptions(getDefaultSfsOrderSpecOptions()),
  )
  const [filter, setFilter] = useState<CollectionCategory>('all')
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

  if (filtered.length === 0) {
    return (
      <p className="text-center text-sm" style={{ color: MUTED }}>
        {loading ? 'Loading collection…' : 'No jewellery products are available yet.'}
      </p>
    )
  }

  return (
    <div className="space-y-10">
      <div
        className="flex flex-wrap items-center justify-center gap-x-1 gap-y-2 border-b pb-1"
        style={{ borderColor: BORDER }}
        role="tablist"
        aria-label="Collection categories"
      >
        {availableFilters.map(item => {
          const selected = filter === item.id
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setFilter(item.id)}
              className="relative px-4 py-2.5 text-xs font-semibold tracking-[0.14em] uppercase transition-colors"
              style={{ color: selected ? DARK : MUTED }}
            >
              {item.label}
              <span
                className="absolute inset-x-3 bottom-0 h-0.5 rounded-full transition-opacity"
                style={{ background: GOLD, opacity: selected ? 1 : 0 }}
              />
            </button>
          )
        })}
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map(product => {
          const designLabel = product.name.includes('—')
            ? product.name.split('—').slice(1).join('—').trim()
            : product.name
          return (
            <article
              key={product.id}
              className="group overflow-hidden rounded-2xl transition-shadow duration-300 hover:shadow-[0_12px_36px_rgba(26,26,26,0.08)]"
              style={{
                background: '#FFFFFF',
                border: `1px solid ${BORDER}`,
              }}
            >
              <div
                className="relative aspect-[5/4] overflow-hidden"
                style={{
                  background:
                    'linear-gradient(165deg, #F7F3EB 0%, #EFE8DA 48%, #E8DFD0 100%)',
                }}
              >
                <ProductPhoto
                  src={product.img}
                  alt={product.name}
                  category={product.category}
                  label={designLabel}
                />
                <div
                  className="pointer-events-none absolute left-4 top-4 rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]"
                  style={{ background: 'rgba(255,255,255,0.88)', color: GOLD }}
                >
                  {categoryLabel(product.category)}
                </div>
              </div>
              <div className="space-y-2 px-5 py-4">
                <h3
                  className="text-lg font-semibold leading-snug"
                  style={{ fontFamily: 'Georgia, serif', color: DARK }}
                >
                  {designLabel}
                </h3>
                <p className="text-sm leading-relaxed" style={{ color: MUTED }}>
                  {product.desc}
                </p>
              </div>
            </article>
          )
        })}
      </div>
    </div>
  )
}
