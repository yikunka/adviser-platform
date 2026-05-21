/* eslint-disable @next/next/no-img-element */
import type { Metadata } from 'next'
import Link from 'next/link'
import { ossImg } from '@/lib/oss-img'
import {
  cosmoProductImageSrc,
  getProduct,
  PRODUCTS_PAGE_1_PIDS,
  PRODUCTS_PAGE_2_PIDS,
  getCosmoProducts,
  COSMO_CATEGORY_ORDER,
  COSMO_CATEGORY_LABEL,
  type CosmoProduct,
  type CosmoProductCategory,
} from '../data/products'

export const metadata: Metadata = {
  title: 'Industrial Coating Products',
  description: 'Browse CosmoCoat industrial coating products, including UV coatings, colour paints, tactile coatings and special effect coating solutions.',
  alternates: { canonical: '/cosmocoat/products' },
}

const MONO = "'Courier New', Courier, monospace"
const RED = '#ff2200'
const CYAN = '#00d4ff'
const PAGE_SIZE = 8

type Props = { searchParams: Promise<{ page?: string; category?: string }> }

function isCategoryParam(s: string | undefined): s is CosmoProductCategory {
  return s !== undefined && COSMO_CATEGORY_ORDER.includes(s as CosmoProductCategory)
}

function productsListQuery(pageNum: number, cat: CosmoProductCategory | null) {
  const params = new URLSearchParams()
  if (cat) params.set('category', cat)
  if (pageNum > 1) params.set('page', String(pageNum))
  const q = params.toString()
  return q ? `?${q}` : ''
}

export default async function CosmoProductsPage({ searchParams }: Props) {
  const sp = await searchParams
  const allProducts = await getCosmoProducts()
  const usesDatabaseProducts = allProducts.length > 0 && allProducts.some(p => p.sortOrder !== undefined || p.isFeatured !== undefined)
  const categoryFilter = isCategoryParam(sp.category) ? sp.category : null

  let requestedPage =
    categoryFilter === null && !usesDatabaseProducts
      ? sp.page === '2'
        ? 2
        : 1
      : Math.max(1, Math.floor(Number.parseInt(sp.page ?? '1', 10) || 1))

  let items: CosmoProduct[]
  let totalPages: number

  if (categoryFilter === null && !usesDatabaseProducts) {
    totalPages = 2
    requestedPage = Math.min(requestedPage, totalPages)
    const pids = requestedPage === 2 ? PRODUCTS_PAGE_2_PIDS : PRODUCTS_PAGE_1_PIDS
    items = pids.map(id => getProduct(id)).filter(Boolean) as CosmoProduct[]
  } else {
    const filtered = categoryFilter === null
      ? allProducts
      : allProducts.filter(p => p.category === categoryFilter)
    totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
    const page = Math.min(requestedPage, totalPages)
    const start = (page - 1) * PAGE_SIZE
    items = filtered.slice(start, start + PAGE_SIZE)
    requestedPage = page
  }

  const sidebarRows: { label: string; href: string; indent: boolean; key: string }[] = [
    { label: '全部分类', href: '/cosmocoat/products', indent: false, key: 'all' },
    ...COSMO_CATEGORY_ORDER.map(cat => ({
      label: COSMO_CATEGORY_LABEL[cat],
      href: `/cosmocoat/products${productsListQuery(1, cat)}`,
      indent: true as const,
      key: cat,
    })),
  ]

  return (
    <div style={{ background: '#080808', minHeight: '60vh' }}>
      {/* Page header */}
      <div
        className="border-b py-10 px-6"
        style={{ borderColor: '#111', background: '#09090a' }}
      >
        <div className="max-w-6xl mx-auto">
          <p className="text-[10px] font-bold tracking-[0.35em] uppercase mb-3" style={{ color: CYAN, fontFamily: MONO }}>
            {'// PRODUCTS'}
          </p>
          <h1 className="text-3xl sm:text-4xl font-black" style={{ color: '#f0f0f0', letterSpacing: '-0.01em' }}>
            产品中心
          </h1>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 md:py-14 flex flex-col md:flex-row gap-10">
        {/* Sidebar */}
        <aside className="md:w-52 shrink-0">
          <p className="text-[10px] font-bold tracking-[0.3em] uppercase mb-4" style={{ color: CYAN, fontFamily: MONO }}>
            {'// CATEGORIES'}
          </p>
          <div className="h-px mb-5" style={{ background: `linear-gradient(90deg, ${RED}, transparent)` }} />
          <ul className="space-y-0 text-[11px]" style={{ fontFamily: MONO }}>
            {sidebarRows.map(item => {
              const active =
                item.key === 'all' ? categoryFilter === null : categoryFilter === item.key
              return (
                <li key={item.key}>
                  <Link
                    href={item.href}
                    className="flex items-center gap-2 py-2.5 tracking-[0.12em] uppercase transition-colors hover:text-white"
                    style={{
                      color: active ? '#f0f0f0' : item.indent ? '#9a9a9a' : '#b0b0b0',
                      paddingLeft: item.indent ? '1rem' : '0',
                      borderBottom: '1px solid #111',
                    }}
                  >
                    {item.indent && <span style={{ color: active ? RED : '#5a5a5a' }}>{'>'}</span>}
                    {item.label}
                  </Link>
                </li>
              )
            })}
          </ul>
        </aside>

        {/* Product grid */}
        <div className="flex-1 min-w-0">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {items.map(p => {
              if (!p) return null
              return (
                <Link
                  key={p.pid}
                  href={`/cosmocoat/products/${p.pid}`}
                  className="group flex flex-col overflow-hidden transition-all duration-300"
                  style={{ background: '#0e0e0e', border: '1px solid #181818' }}
                >
                  <div className="aspect-square bg-neutral-900 overflow-hidden">
                    <img
                      src={ossImg(cosmoProductImageSrc(p), { w: 500 })}
                      alt={p.title}
                      className="w-full h-full object-cover transition-transform duration-400 group-hover:scale-105"
                      style={{ filter: 'grayscale(15%)', opacity: 0.8 }}
                    />
                  </div>
                  <div className="p-3 flex flex-col gap-1.5" style={{ borderTop: '1px solid #141414' }}>
                    <p className="text-[9px] tracking-[0.18em] uppercase" style={{ color: '#6a6a6a', fontFamily: MONO }}>
                      PRODUCT
                    </p>
                    <p className="text-[13px] font-bold leading-snug line-clamp-2" style={{ color: '#d8d8d8' }}>
                      {p.title}
                    </p>
                    {p.teaser && (
                      <p className="text-[11px] leading-relaxed line-clamp-2" style={{ color: '#8a8a8a' }}>
                        {p.teaser}
                      </p>
                    )}
                  </div>
                </Link>
              )
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <nav className="mt-12 flex flex-wrap items-center justify-center gap-2" style={{ fontFamily: MONO }}>
              {categoryFilter === null
                ? (
                    [
                      { label: '第一页', page: 1 },
                      { label: '1', page: 1 },
                      { label: '2', page: 2 },
                      { label: '>>', page: 2 },
                      { label: '最后页', page: totalPages },
                    ].map(item => {
                      const isActive = (item.label === '1' && requestedPage === 1) || (item.label === '2' && requestedPage === 2)
                      return (
                        <Link
                          key={item.label}
                          href={`/cosmocoat/products${productsListQuery(item.page, null)}`}
                          className="text-[11px] tracking-[0.12em] px-3 py-2 transition-all"
                          style={{
                            color: isActive ? '#fff' : '#9a9a9a',
                            background: isActive ? RED : 'transparent',
                            border: `1px solid ${isActive ? RED : '#1e1e1e'}`,
                            boxShadow: isActive ? `0 0 12px rgba(255,34,0,0.35)` : 'none',
                          }}
                        >
                          {item.label}
                        </Link>
                      )
                    })
                  )
                : (
                    Array.from({ length: totalPages }, (_, i) => i + 1).map(num => {
                      const isActive = num === requestedPage
                      return (
                        <Link
                          key={num}
                          href={`/cosmocoat/products${productsListQuery(num, categoryFilter)}`}
                          className="text-[11px] tracking-[0.12em] px-3 py-2 transition-all min-w-[2.25rem] text-center"
                          style={{
                            color: isActive ? '#fff' : '#9a9a9a',
                            background: isActive ? RED : 'transparent',
                            border: `1px solid ${isActive ? RED : '#1e1e1e'}`,
                            boxShadow: isActive ? `0 0 12px rgba(255,34,0,0.35)` : 'none',
                          }}
                        >
                          {num}
                        </Link>
                      )
                    })
                  )}
            </nav>
          )}
        </div>
      </div>
    </div>
  )
}
