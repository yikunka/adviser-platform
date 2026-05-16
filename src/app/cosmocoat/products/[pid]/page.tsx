/* eslint-disable @next/next/no-img-element */
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { cosmoProductImageSrc, getCosmoProduct } from '../../data/products'
import { ossImg } from '@/lib/oss-img'

const MONO = "'Courier New', Courier, monospace"
const RED = '#ff2200'
const CYAN = '#00d4ff'

type Props = { params: Promise<{ pid: string }> }

export default async function CosmoProductDetailPage({ params }: Props) {
  const { pid } = await params
  const p = await getCosmoProduct(pid)
  if (!p) notFound()

  return (
    <div style={{ background: '#080808' }}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 md:py-14">

        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 mb-10 text-[11px] tracking-[0.12em] uppercase" style={{ color: '#8a8a8a', fontFamily: MONO }}>
          <Link href="/cosmocoat" className="transition-colors hover:text-white">首页</Link>
          <span style={{ color: '#5a5a5a' }}>{'/'}</span>
          <Link href="/cosmocoat/products" className="transition-colors hover:text-white">产品中心</Link>
          <span style={{ color: '#5a5a5a' }}>{'/'}</span>
          <span style={{ color: '#b8b8b8' }}>{p.title}</span>
        </nav>

        <div className="grid md:grid-cols-2 gap-10 items-start">
          {/* Image */}
          <div
            className="overflow-hidden"
            style={{ background: '#0d0d0d', border: '1px solid #1a1a1a', borderTop: `3px solid ${RED}` }}
          >
            <img
              src={ossImg(cosmoProductImageSrc(p), { w: 800 })}
              alt={p.title}
              className="w-full h-auto object-contain max-h-[520px] mx-auto"
              style={{ filter: 'grayscale(10%) brightness(0.85)' }}
            />
          </div>

          {/* Info */}
          <div>
            <p className="text-[10px] font-bold tracking-[0.35em] uppercase mb-3" style={{ color: CYAN, fontFamily: MONO }}>
              {'// PRODUCT DETAIL'}
            </p>
            <h1
              className="text-2xl md:text-3xl font-black mb-2"
              style={{ color: '#f0f0f0', letterSpacing: '-0.01em' }}
            >
              {p.title}
            </h1>
            <div
              className="w-12 h-px mb-6"
              style={{ background: `linear-gradient(90deg, ${RED}, transparent)`, boxShadow: `0 0 6px ${RED}` }}
            />
            <div
              className="text-[15px] sm:text-base leading-relaxed whitespace-pre-line"
              style={{ color: '#b8b8b8', borderLeft: `2px solid #1a1a1a`, paddingLeft: '1rem' }}
            >
              {p.summary}
            </div>
            <div className="mt-10">
              <Link
                href="/cosmocoat/products"
                className="inline-block text-[11px] font-bold px-6 py-3 tracking-[0.2em] uppercase transition-all hover:brightness-110"
                style={{
                  background: RED,
                  color: '#fff',
                  fontFamily: MONO,
                  boxShadow: `0 0 16px rgba(255,34,0,0.4)`,
                }}
              >
                ← 返回产品中心
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
