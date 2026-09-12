import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import CollectionShowcase from '../components/CollectionShowcase'

export const metadata: Metadata = {
  title: 'Memorial Diamonds',
  description: 'Discover our Eternity Cut memorial diamonds and bespoke jewellery crafted from cremated ashes.',
  alternates: { canonical: '/sfsdiamond/memorial-diamonds' },
}

const MEANINGS = [
  {
    title: 'Eternal Love',
    desc: 'An everlasting connection — the ∞ form represents a love that has no end and no beginning.',
    img: '/sfsdiamond/necklace-life.jpg',
  },
  {
    title: 'Unbreakable Bond',
    desc: 'The enduring spirit of your loved one, bound into the hardest substance on earth.',
    img: '/sfsdiamond/meaning-unbreakable-bond.png',
  },
  {
    title: 'Timeless Tribute',
    desc: 'A gem that shines forever — just like the cherished memories held within it.',
    img: '/sfsdiamond/meaning-timeless-tribute.png',
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
          <p className="text-xs uppercase tracking-widest mb-3" style={{ color: '#C9A96E' }}>SFS Diamond</p>
          <h1 className="text-4xl md:text-6xl font-bold" style={{ color: '#FFFFFF', fontFamily: 'Georgia, serif' }}>
            Memorial Diamonds
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
            <p className="text-xs uppercase tracking-widest mb-4" style={{ color: '#C9A96E' }}>Our Signature</p>
            <h2 className="text-3xl md:text-4xl font-bold mb-6" style={{ fontFamily: 'Georgia, serif', color: '#1A1A1A' }}>
              The Eternity Cut
            </h2>
            <div className="space-y-4 text-sm leading-relaxed" style={{ color: '#4A3E30' }}>
              <p>
                Every SFS memorial diamond is shaped into our signature Eternity Cut — modelled on the
                infinity symbol (∞). This timeless form embodies eternal love, an unbreakable bond,
                and the continuity of memory across generations.
              </p>
              <p>
                Each diamond is then hand-polished by master craftsmen to maximise brilliance and fire,
                ensuring that the light it carries reflects the life it honours.
              </p>
            </div>
            <div className="mt-8 rounded-2xl p-6 grid grid-cols-2 gap-4" style={{ background: '#F2EDE3' }}>
              {[
                ['Technology',  'CVD'],
                ['Size',        '1.0 ± 0.1 ct'],
                ['Timeline',    '2 – 3 months'],
                ['Ashes',       '≥ 60 g required'],
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
            <p className="text-xs uppercase tracking-widest mb-3" style={{ color: '#C9A96E' }}>Meaning Behind the Cut</p>
            <h2 className="text-3xl md:text-4xl font-bold" style={{ fontFamily: 'Georgia, serif', color: '#F5F0E8' }}>
              Four Eternal Truths
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
            <p className="text-xs uppercase tracking-widest mb-3" style={{ color: '#C9A96E' }}>Our Collection</p>
            <h2 className="text-3xl md:text-4xl font-bold" style={{ fontFamily: 'Georgia, serif', color: '#1A1A1A' }}>
              Forever with Your Loved One
            </h2>
            <p className="mt-4 text-sm max-w-xl mx-auto" style={{ color: '#6B5E4A' }}>
              Browse our jewellery settings — rings, necklaces, earrings, and bracelets — and find
              the design that will carry your memorial diamond.
            </p>
          </div>
          <CollectionShowcase />
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-20 text-center" style={{ background: '#F2EDE3' }}>
        <div className="max-w-xl mx-auto px-6">
          <h2 className="text-2xl md:text-3xl font-bold mb-4" style={{ fontFamily: 'Georgia, serif', color: '#1A1A1A' }}>
            Ready to Begin?
          </h2>
          <p className="text-sm leading-relaxed mb-8" style={{ color: '#4A3E30' }}>
            Contact our team to discuss your memorial diamond. We&apos;ll answer every question and
            guide you with warmth throughout the entire journey.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <a
              href="tel:+85265600073"
              className="px-8 py-3.5 rounded-full font-medium text-sm transition-all hover:opacity-90"
              style={{ background: '#1A1A1A', color: '#F5F0E8' }}
            >
              Call (852) 6560 0073
            </a>
            <Link
              href="/sfsdiamond/qa"
              className="px-8 py-3.5 rounded-full font-medium text-sm border transition-all hover:bg-black/5"
              style={{ border: '1px solid #C9A96E', color: '#1A1A1A' }}
            >
              Read FAQ
            </Link>
          </div>
        </div>
      </section>
    </>
  )
}
