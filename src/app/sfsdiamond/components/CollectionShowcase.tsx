'use client'

import { useEffect, useEffectEvent, useState } from 'react'
import Image from 'next/image'

export type CollectionCategory = 'all' | 'diamond' | 'necklace' | 'ring'

export type CollectionProduct = {
  id: string
  name: string
  price: string
  desc: string
  img: string
  category: Exclude<CollectionCategory, 'all'>
}

export const COLLECTION_PRODUCTS: CollectionProduct[] = [
  {
    id: 'memorial-diamond',
    name: 'Memorial Diamond',
    price: 'HK$10,999',
    desc: "A certified CVD diamond grown from your loved one's ashes or hair.",
    img: '/sfsdiamond/eternity-cut.jpg',
    category: 'diamond',
  },
  {
    id: 'necklace-life',
    name: 'Necklace — Life',
    price: 'HK$99,999',
    desc: 'Memorial diamond set in a delicate life-symbol pendant.',
    img: '/sfsdiamond/necklace-life.jpg',
    category: 'necklace',
  },
  {
    id: 'necklace-bagua',
    name: 'Necklace — Bagua',
    price: 'HK$99,999',
    desc: 'Diamond pendant with traditional Bagua eight-trigram design.',
    img: '/sfsdiamond/necklace-bagua.jpg',
    category: 'necklace',
  },
  {
    id: 'necklace-buddha',
    name: 'Necklace — Buddha',
    price: 'HK$99,999',
    desc: 'Memorial diamond set within a serene Buddha silhouette pendant.',
    img: '/sfsdiamond/necklace-buddha.jpg',
    category: 'necklace',
  },
  {
    id: 'necklace-cross',
    name: 'Necklace — Cross',
    price: 'HK$99,999',
    desc: 'A Christian cross pendant encasing the memorial diamond.',
    img: '/sfsdiamond/necklace-cross.png',
    category: 'necklace',
  },
  {
    id: 'necklace-classic',
    name: 'Necklace — Classic',
    price: 'HK$99,999',
    desc: 'A refined classic pendant setting for your memorial diamond.',
    img: '/sfsdiamond/order/necklace-classic.jpeg',
    category: 'necklace',
  },
  {
    id: 'necklace-yinyang',
    name: 'Necklace — Yin Yang',
    price: 'HK$99,999',
    desc: 'Balanced yin-yang pendant designed to cradle the memorial stone.',
    img: '/sfsdiamond/order/necklace-yinyang.jpeg',
    category: 'necklace',
  },
  {
    id: 'ring-classic',
    name: 'Diamond Ring — Classic',
    price: 'HK$99,999',
    desc: 'A timeless classic solitaire ring featuring the memorial stone.',
    img: '/sfsdiamond/ring-classic.jpg',
    category: 'ring',
  },
  {
    id: 'ring-solitaire',
    name: 'Diamond Ring — Solitaire',
    price: 'HK$99,999',
    desc: 'Clean solitaire mount that lets the memorial diamond take centre stage.',
    img: '/sfsdiamond/order/ring-solitaire.png',
    category: 'ring',
  },
  {
    id: 'ring-halo',
    name: 'Diamond Ring — Halo',
    price: 'HK$99,999',
    desc: 'A luminous halo setting that amplifies the fire of your memorial diamond.',
    img: '/sfsdiamond/order/ring-halo.png',
    category: 'ring',
  },
  {
    id: 'ring-pave',
    name: 'Diamond Ring — Pavé',
    price: 'HK$99,999',
    desc: 'Pavé band detailing for a soft cascade of brilliance around the centre stone.',
    img: '/sfsdiamond/order/ring-pave.png',
    category: 'ring',
  },
]

const FILTERS: { id: CollectionCategory; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'diamond', label: 'Diamond' },
  { id: 'necklace', label: 'Necklace' },
  { id: 'ring', label: 'Ring' },
]

const GOLD = '#C9A96E'
const DARK = '#1A1A1A'
const MUTED = '#6B5E4A'

function categoryLabel(category: CollectionProduct['category']) {
  switch (category) {
    case 'diamond':
      return 'Loose diamond'
    case 'necklace':
      return 'Necklace'
    case 'ring':
      return 'Ring'
  }
}

export default function CollectionShowcase() {
  const [filter, setFilter] = useState<CollectionCategory>('all')
  const [activeId, setActiveId] = useState(COLLECTION_PRODUCTS[0]?.id ?? '')
  const [paused, setPaused] = useState(false)

  const filtered =
    filter === 'all'
      ? COLLECTION_PRODUCTS
      : COLLECTION_PRODUCTS.filter(p => p.category === filter)

  const active =
    filtered.find(p => p.id === activeId)
    ?? filtered[0]
    ?? COLLECTION_PRODUCTS[0]

  const onAutoAdvance = useEffectEvent(() => {
    if (paused || filtered.length < 2) return
    const index = filtered.findIndex(p => p.id === active.id)
    const next = filtered[(index + 1) % filtered.length]
    if (next) setActiveId(next.id)
  })

  useEffect(() => {
    if (!filtered.some(p => p.id === activeId) && filtered[0]) {
      setActiveId(filtered[0].id)
    }
  }, [filter, filtered, activeId])

  useEffect(() => {
    const timer = window.setInterval(() => onAutoAdvance(), 4200)
    return () => window.clearInterval(timer)
  }, [filter, paused, active.id, filtered.length, onAutoAdvance])

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-center justify-center gap-2">
        {FILTERS.map(item => {
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
            <p className="text-sm font-bold" style={{ color: GOLD }}>{active.price}</p>

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
          {filtered.map((product, index) => {
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
                  animationDelay: `${index * 40}ms`,
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
                  <p className="text-xs font-semibold" style={{ color: GOLD }}>{product.price}</p>
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
