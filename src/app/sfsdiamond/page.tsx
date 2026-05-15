import Image from 'next/image'
import Link from 'next/link'
import VideoPlayer from './components/VideoPlayer'
import EternityRing from './components/EternityRing'
import { ossImg } from '@/lib/oss-img'

const PROCESS = [
  { step: '01', title: 'Confirm Order',    desc: 'Contact our team to begin. We guide you through every option and handle paperwork with care.',           img: '/sfsdiamond/process-1.jpg' },
  { step: '02', title: 'Collect Remains',  desc: 'Deliver 60g of ashes or 1g of hair to us in person or via secure, verified courier.',                    img: '/sfsdiamond/process-2.jpg' },
  { step: '03', title: 'Extract Carbon',   desc: 'Our laboratory carefully purifies and extracts carbon using physical and chemical processes.',             img: '/sfsdiamond/process-3.jpg' },
  { step: '04', title: 'Grow Diamond',     desc: 'Carbon atoms are deposited layer by layer inside our CVD reactor, forming a perfect crystal lattice.',    img: '/sfsdiamond/process-4.jpg' },
  { step: '05', title: 'Cut & Polish',     desc: 'Master craftsmen shape your diamond to our signature Eternity Cut, then hand-polish for maximum brilliance.', img: '/sfsdiamond/process-5.png' },
  { step: '06', title: 'Delivery',         desc: 'Your certified memorial diamond is delivered within 2–3 months, accompanied by a full quality certificate.',   img: '/sfsdiamond/process-6.jpeg' },
]

const TEAM = [
  { name: 'Kenny Wong',  role: 'Tech Lead',        img: '/sfsdiamond/team-1.jpg' },
  { name: 'Mia Chen',    role: 'Art Director',      img: '/sfsdiamond/team-2.jpg' },
  { name: 'Ema Li',      role: 'Product Designer',  img: '/sfsdiamond/team-3.jpg' },
]

const PILLARS = [
  { icon: '◈', title: 'Precision with Purpose',            desc: 'Every diamond is grown with exacting scientific precision, ensuring the memory it carries is perfectly preserved.' },
  { icon: '◎', title: 'Trust & Transparency',              desc: 'Unique traceability codes track your loved one\'s remains throughout the entire transformation process.' },
  { icon: '✦', title: 'A Tribute Beyond Time',             desc: 'Diamonds are forever. So is the love that created them. Our memorial stones outlast generations.' },
  { icon: '⬡', title: 'More Than Science',                 desc: 'We approach each commission as a sacred commitment — combining laboratory excellence with genuine compassion.' },
]

export default function SFSHomePage() {
  return (
    <>
      {/* ── Hero ── */}
      <section className="relative min-h-screen flex items-center overflow-hidden" style={{ background: '#050305' }}>
        {/* SVG atmospheric background */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={ossImg('/sfsdiamond/hero-love.svg')} alt="" aria-hidden className="absolute inset-0 w-full h-full object-cover pointer-events-none" />
        <EternityRing />
        {/* Desktop: readability panel on left. Mobile: keep left side readable — avoid strong shadow that eats narrow lines */}
        <div
          className="absolute inset-0 hidden md:block pointer-events-none"
          style={{ background: 'linear-gradient(90deg, rgba(2,1,3,0.82) 0%, rgba(2,1,3,0.60) 28%, rgba(2,1,3,0.20) 52%, transparent 68%)' }}
        />
        <div
          className="absolute inset-0 md:hidden pointer-events-none"
          style={{
            background:
              'linear-gradient(165deg, rgba(2,1,3,0.94) 0%, rgba(2,1,3,0.68) min(72vw, 18rem), rgba(2,1,3,0.28) max(82vw, 20rem), transparent 100%)',
          }}
        />
        {/* Ring side — very subtle inner glow so crystal reads against dark */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse 38% 55% at 70% 50%, rgba(201,169,110,0.07) 0%, transparent 100%)' }}
        />
        {/* Top + bottom edge fade for clean framing */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'linear-gradient(180deg, rgba(2,1,3,0.55) 0%, transparent 18%, transparent 80%, rgba(2,1,3,0.65) 100%)' }}
        />

        <div
          className={[
            'relative z-10 box-border w-full py-24',
            'max-md:mx-0 max-md:max-w-none max-md:pl-[max(1rem,calc(env(safe-area-inset-left,0px)+14px))]',
            'max-md:pr-[max(1rem,calc(env(safe-area-inset-right,0px)+14px))]',
            // 桌面：不要用 translate（窄屏笔记本会裁切）；用「随视口变」的左边距把文案放进渐变区
            'md:mx-auto md:max-w-6xl md:pl-[clamp(2.5rem,min(14vw,8rem),8rem)] md:pr-[clamp(1.5rem,4vw,2.5rem)]',
          ].join(' ')}
        >
          <p
            className="mb-5 text-xs uppercase tracking-[0.3em] hyphens-none"
            style={{ color: '#C9A96E', textWrap: 'balance' }}
          >
            Memorial Diamond · CVD Technology
          </p>
          <h1
            className="mb-6 max-w-3xl font-bold leading-[1.1] text-[clamp(2.125rem,6.5vw+0.85rem,3.5rem)] md:text-7xl md:leading-tight"
            style={{ color: '#FFFFFF', fontFamily: 'Georgia, "Times New Roman", serif' }}
          >
            For{' '}
            <span data-sfs-hero-eternity-anchor>Forever</span>
            <br />
            <span style={{ color: '#C9A96E' }}>Love</span>
          </h1>
          <p
            className="mb-10 max-w-xl text-base leading-relaxed hyphens-none sm:text-lg md:text-xl"
            style={{ color: 'rgba(245,240,232,0.85)', textWrap: 'pretty' }}
          >
            Turning love into everlasting brilliance. We transform cremated ashes or hair into
            certified lab-grown diamonds — a luminous tribute that lasts forever.
          </p>
          <div className="flex flex-wrap gap-4">
            <Link
              href="/sfsdiamond/order"
              className="px-8 py-3.5 rounded-full font-medium text-sm transition-all hover:opacity-90"
              style={{ background: '#C9A96E', color: '#0A0805' }}
            >
              Place Your Order
            </Link>
            <Link
              href="/sfsdiamond/memorial-diamonds"
              className="px-8 py-3.5 rounded-full font-medium text-sm border transition-all hover:bg-white/10"
              style={{ border: '1px solid rgba(245,240,232,0.4)', color: '#F5F0E8' }}
            >
              Explore Memorial Diamonds
            </Link>
          </div>
        </div>
      </section>

      {/* ── Core pillars ── */}
      <section className="py-24" style={{ background: '#FAFAF8' }}>
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <p className="text-xs uppercase tracking-widest mb-3" style={{ color: '#C9A96E' }}>Our Promise</p>
            <h2 className="text-3xl md:text-4xl font-bold" style={{ fontFamily: 'Georgia, serif', color: '#1A1A1A' }}>
              Precision, Trust &amp; Compassion
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {PILLARS.map(p => (
              <div
                key={p.title}
                className="rounded-2xl p-7 flex flex-col gap-4"
                style={{ background: '#FFFFFF', border: '1px solid #EDE7D8', boxShadow: '0 1px 12px rgba(0,0,0,0.04)' }}
              >
                <span className="text-2xl" style={{ color: '#C9A96E' }}>{p.icon}</span>
                <h3 className="font-semibold text-base" style={{ color: '#1A1A1A' }}>{p.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: '#6B5E4A' }}>{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Diamond visual + about ── */}
      <section className="py-24" style={{ background: '#F2EDE3' }}>
        <div className="max-w-6xl mx-auto px-6 grid md:grid-cols-2 gap-14 items-center">
          <div className="relative rounded-3xl overflow-hidden aspect-square max-w-md mx-auto md:mx-0 shadow-xl">
            <Image src="/sfsdiamond/diamond-crystal.jpg" alt="Diamond crystal" fill sizes="(max-width: 768px) 100vw, 50vw" className="object-cover" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-widest mb-4" style={{ color: '#C9A96E' }}>What We Do</p>
            <h2 className="text-3xl md:text-4xl font-bold mb-6" style={{ fontFamily: 'Georgia, serif', color: '#1A1A1A' }}>
              Diamonds Born<br />from Life Itself
            </h2>
            <div className="space-y-4 text-sm leading-relaxed" style={{ color: '#4A3E30' }}>
              <p>
                SFS Technology Group is a global leader in memorial diamond creation. Unlike other
                providers, we operate our own laboratory and CVD factory — a heavy-asset company
                with full in-house control over every stage of production.
              </p>
              <p>
                We believe that <em>love never fades; it takes on a new form.</em> Through Chemical
                Vapor Deposition, carbon extracted from your loved one's remains is guided — atom by
                atom — into a perfect crystalline lattice: a real, certified diamond.
              </p>
              <p>
                Each stone comes with a unique traceability code and quality certificate. This is not
                merely science — it is a sacred commitment to the families who trust us.
              </p>
            </div>
            <Link
              href="/sfsdiamond/about"
              className="inline-block mt-8 text-sm font-medium border-b-2 transition-opacity hover:opacity-70"
              style={{ borderColor: '#C9A96E', color: '#1A1A1A' }}
            >
              About SFS Technology →
            </Link>
          </div>
        </div>
      </section>

      {/* ── Video ── */}
      <section className="py-24" style={{ background: '#111111' }}>
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-12">
            <p className="text-xs uppercase tracking-widest mb-3" style={{ color: '#C9A96E' }}>See It for Yourself</p>
            <h2 className="text-3xl md:text-4xl font-bold" style={{ fontFamily: 'Georgia, serif', color: '#F5F0E8' }}>
              The Art of Transformation
            </h2>
          </div>
          <div className="flex justify-center">
            <VideoPlayer src={ossImg('/sfsdiamond/hero.mp4')} poster={ossImg('/sfsdiamond/hero-diamond.jpg', { w: 420 })} />
          </div>
        </div>
      </section>

      {/* ── 6-step process ── */}
      <section className="py-24" style={{ background: '#FAFAF8' }}>
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <p className="text-xs uppercase tracking-widest mb-3" style={{ color: '#C9A96E' }}>From Ashes to Diamond</p>
            <h2 className="text-3xl md:text-4xl font-bold" style={{ fontFamily: 'Georgia, serif', color: '#1A1A1A' }}>
              Six Steps of Transformation
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {PROCESS.map(p => (
              <div
                key={p.step}
                className="rounded-2xl overflow-hidden"
                style={{ background: '#FFFFFF', border: '1px solid #EDE7D8', boxShadow: '0 1px 12px rgba(0,0,0,0.04)' }}
              >
                <div className="relative h-52 w-full">
                  <Image src={p.img} alt={p.title} fill className="object-cover" />
                  <div
                    className="absolute top-4 left-4 rounded-full w-9 h-9 flex items-center justify-center text-xs font-bold"
                    style={{ background: '#C9A96E', color: '#0A0805' }}
                  >
                    {p.step}
                  </div>
                </div>
                <div className="p-6">
                  <h3 className="font-semibold text-base mb-2" style={{ color: '#1A1A1A' }}>{p.title}</h3>
                  <p className="text-sm leading-relaxed" style={{ color: '#6B5E4A' }}>{p.desc}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="text-center mt-12">
            <Link
              href="/sfsdiamond/technology"
              className="inline-block px-8 py-3.5 rounded-full font-medium text-sm transition-all hover:opacity-90"
              style={{ background: '#1A1A1A', color: '#F5F0E8' }}
            >
              Deep Dive into Our Technology
            </Link>
          </div>
        </div>
      </section>

      {/* ── Team ── */}
      <section className="py-24" style={{ background: '#111111' }}>
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <p className="text-xs uppercase tracking-widest mb-3" style={{ color: '#C9A96E' }}>The People Behind Each Diamond</p>
            <h2 className="text-3xl md:text-4xl font-bold" style={{ fontFamily: 'Georgia, serif', color: '#F5F0E8' }}>
              Our Team
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 max-w-3xl mx-auto">
            {TEAM.map(m => (
              <div key={m.name} className="flex flex-col items-center gap-4 text-center">
                <div className="relative w-28 h-28 rounded-full overflow-hidden" style={{ boxShadow: '0 0 0 2px #C9A96E' }}>
                  <Image src={m.img} alt={m.name} fill className="object-cover" />
                </div>
                <div>
                  <p className="font-semibold text-base" style={{ color: '#F5F0E8' }}>{m.name}</p>
                  <p className="text-sm mt-1" style={{ color: '#7A6A58' }}>{m.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-24 text-center" style={{ background: '#F2EDE3' }}>
        <div className="max-w-2xl mx-auto px-6">
          <p className="text-xs uppercase tracking-widest mb-4" style={{ color: '#C9A96E' }}>Begin the Journey</p>
          <h2 className="text-3xl md:text-4xl font-bold mb-6" style={{ fontFamily: 'Georgia, serif', color: '#1A1A1A' }}>
            Keep Your Loved One<br />Close, Forever
          </h2>
          <p className="text-sm leading-relaxed mb-10" style={{ color: '#4A3E30' }}>
            Every memorial diamond is unique — as unique as the life it honours. Reach out to our
            team and we'll walk you through the entire process with patience and care.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link
              href="/sfsdiamond/order"
              className="px-8 py-3.5 rounded-full font-medium text-sm transition-all hover:opacity-90"
              style={{ background: '#C9A96E', color: '#0A0805' }}
            >
              Place Your Order
            </Link>
            <a
              href="tel:+85265600073"
              className="px-8 py-3.5 rounded-full font-medium text-sm transition-all hover:opacity-90"
              style={{ background: '#1A1A1A', color: '#F5F0E8' }}
            >
              Call (852) 6560 0073
            </a>
            <a
              href="mailto:sfsdiamonds@gmail.com"
              className="px-8 py-3.5 rounded-full font-medium text-sm border transition-all hover:bg-black/5"
              style={{ border: '1px solid #C9A96E', color: '#1A1A1A' }}
            >
              Email Us
            </a>
          </div>
        </div>
      </section>
    </>
  )
}
