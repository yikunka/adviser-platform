import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import CollectionShowcase from '../components/CollectionShowcase'
import SfsProductImageDisclaimer from '../components/SfsProductImageDisclaimer'
import { SFS_SALES_MAILTO_PARTNERSHIP } from '@/lib/sfs/sales-contact'

export const metadata: Metadata = {
  title: 'Memorial Diamonds',
  description: 'Eternity Cut memorial diamonds for professional distributors — CVD, certification, and jewellery settings.',
  alternates: { canonical: '/sfsdiamond/memorial-diamonds' },
}

const MEANINGS = [
  {
    title: 'Eternal Love',
    desc: 'An everlasting connection — the ∞ form represents a love that has no end and no beginning.',
    img: '/sfsdiamond/meaning-eternal-love.png',
  },
  {
    title: 'Unbreakable Bond',
    desc: 'The enduring spirit of your loved one, bound into the hardest substance on earth.',
    img: '/sfsdiamond/meaning-unbreakable-bond-dna.png',
  },
  {
    title: 'Timeless Tribute',
    desc: 'A gem that shines forever — just like the cherished memories held within it.',
    img: '/sfsdiamond/meaning-timeless-tribute-universe.png',
  },
  {
    title: 'Symbol of Continuity',
    desc: 'Love and memory live on infinitely. The Eternity Cut is a visible promise of that continuity.',
    img: '/sfsdiamond/meaning-continuity.png',
  },
]

export default function MemorialDiamondsPage() {
  return (
    <>
      {/* ── Hero ── */}
      <section className="relative h-[60vh] flex items-end overflow-hidden">
        <div className="absolute inset-0">
          <Image src="/sfsdiamond/masonry.jpg" alt="Memorial diamonds" fill sizes="100vw" className="object-cover" priority />
          <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(10,8,5,0.85) 0%, rgba(10,8,5,0.3) 60%, transparent 100%)' }} />
        </div>
        <div className="relative z-10 max-w-6xl mx-auto px-6 pb-16 w-full">
          <p className="text-xs uppercase tracking-widest mb-3" style={{ color: '#C9A96E' }}>Product programme</p>
          <h1 className="text-4xl md:text-6xl font-bold" style={{ color: '#FFFFFF', fontFamily: 'Georgia, serif' }}>
            What your market sells
          </h1>
        </div>
      </section>

      {/* ── Eternity Cut ── */}
      <section className="py-24" style={{ background: '#FAFAF8' }}>
        <div className="max-w-6xl mx-auto px-6 grid md:grid-cols-2 gap-14 items-center">
          <div className="relative rounded-3xl overflow-hidden shadow-xl" style={{ aspectRatio: '1/1', maxWidth: 480 }}>
            <Image src="/sfsdiamond/eternity-symbol.png" alt="Eternity Cut" fill sizes="(max-width: 768px) 100vw, 480px" className="object-cover" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-widest mb-4" style={{ color: '#C9A96E' }}>Signature cut</p>
            <h2 className="text-3xl md:text-4xl font-bold mb-6" style={{ fontFamily: 'Georgia, serif', color: '#1A1A1A' }}>
              The Eternity Cut
            </h2>
            <div className="space-y-4 text-sm leading-relaxed" style={{ color: '#4A3E30' }}>
              <p>
                Every SFS memorial diamond is finished in the Eternity Cut, modelled on the infinity
                symbol. It is the form your client sees. The factory grows, cuts, and certifies it.
              </p>
              <p>
                Settings available to partners are ring, necklace, earring, bracelet, and loose stone.
                A custom jewellery design can be uploaded for quotation.
              </p>
            </div>
            <div className="mt-8 rounded-2xl p-6 grid grid-cols-2 gap-4" style={{ background: '#F2EDE3' }}>
              {[
                ['Technology',  'CVD, in-house'],
                ['Size',        'About 1.0 ct'],
                ['Lead time',   '2–3 months'],
                ['Material',    '60 g ash or 1 g hair'],
                ['Certificate', 'Official IGI'],
                ['Settings',    'Ring to loose stone'],
              ].map(([k, v]) => (
                <div key={k}>
                  <p className="text-xs uppercase tracking-wider mb-1" style={{ color: '#C9A96E' }}>{k}</p>
                  <p className="text-sm font-semibold" style={{ color: '#1A1A1A' }}>{v}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Four meanings ── */}
      <section className="py-24" style={{ background: '#111111' }}>
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <p className="text-xs uppercase tracking-widest mb-3" style={{ color: '#C9A96E' }}>Language for your client</p>
            <h2 className="text-3xl md:text-4xl font-bold" style={{ fontFamily: 'Georgia, serif', color: '#F5F0E8' }}>
              What the cut means
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {MEANINGS.map(m => (
              <div
                key={m.title}
                className="rounded-2xl overflow-hidden flex flex-col"
                style={{ background: '#1C1A16', border: '1px solid #2A2418' }}
              >
                <div className="relative h-44">
                  <Image src={m.img} alt={m.title} fill sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw" className="object-cover" />
                  <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(28,26,22,0.85) 0%, transparent 60%)' }} />
                </div>
                <div className="p-5 flex flex-col gap-2">
                  <h3 className="font-semibold text-sm" style={{ color: '#F5F0E8' }}>{m.title}</h3>
                  <p className="text-xs leading-relaxed" style={{ color: '#7A6A58' }}>{m.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Product collection (dynamic) ── */}
      <section className="py-24" style={{ background: '#FAFAF8' }}>
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-12">
            <p className="text-xs uppercase tracking-widest mb-3" style={{ color: '#C9A96E' }}>Partner catalogue</p>
            <h2 className="text-3xl md:text-4xl font-bold" style={{ fontFamily: 'Georgia, serif', color: '#1A1A1A' }}>
              Settings you can offer
            </h2>
            <p className="mt-4 text-sm max-w-xl mx-auto" style={{ color: '#6B5E4A' }}>
              Rings, necklaces, earrings, and bracelets from the current programme. Prices stay off
              this public page. Approved partners see live prices when they place an order.
            </p>
          </div>
          <SfsProductImageDisclaimer className="mb-10 text-xs leading-relaxed space-y-2 max-w-3xl mx-auto text-center" style={{ color: '#6B5E4A' }} />
          <CollectionShowcase />
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-20 text-center" style={{ background: '#F2EDE3' }}>
        <div className="max-w-xl mx-auto px-6">
          <h2 className="text-2xl md:text-3xl font-bold mb-4" style={{ fontFamily: 'Georgia, serif', color: '#1A1A1A' }}>
            Offer this programme in your market
          </h2>
          <p className="text-sm leading-relaxed mb-8" style={{ color: '#4A3E30' }}>
            Ask for distributor terms. Approved partners place orders in the portal after staff approval.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <a
              href={SFS_SALES_MAILTO_PARTNERSHIP}
              className="px-8 py-3.5 rounded-full font-medium text-sm transition-all hover:opacity-90"
              style={{ background: '#1A1A1A', color: '#F5F0E8' }}
            >
              Become a distributor
            </a>
            <Link
              href="/sfsdiamond/login"
              className="px-8 py-3.5 rounded-full font-medium text-sm border transition-all hover:bg-black/5"
              style={{ border: '1px solid #C9A96E', color: '#1A1A1A' }}
            >
              Partner login
            </Link>
          </div>
        </div>
      </section>
    </>
  )
}
