import Image from 'next/image'
import Link from 'next/link'
import VideoPlayer from './components/VideoPlayer'
import EternityRing from './components/EternityRing'
import { ossImg } from '@/lib/oss-img'

const FACTORY_PROOF = [
  { label: 'Production model', value: 'In-house CVD factory' },
  { label: 'Lead time', value: '2–3 months' },
  { label: 'Quality', value: '4C + certificate' },
  { label: 'Traceability', value: 'Live process tracking' },
  { label: 'Channel', value: 'B2B distributors only' },
]

const CAPABILITIES = [
  {
    title: 'CVD Laboratory',
    desc: 'Heavy-asset growth under our own roof — seed, plasma, and crystal control stay in-house.',
    img: '/sfsdiamond/cvd-machine.jpeg',
  },
  {
    title: 'Cut & Polish',
    desc: 'Precision finishing into our signature Eternity Cut, ready for partner jewellery settings.',
    img: '/sfsdiamond/process-5.png',
  },
  {
    title: 'Certified Delivery',
    desc: 'Quality documentation and branded presentation designed for professional client handover.',
    img: '/sfsdiamond/igi-quality-cert.png',
  },
  {
    title: 'Partner Visibility',
    desc: 'Online ordering and real-time production status so distributors stay ahead of every commission.',
    img: '/sfsdiamond/step-polish.jpg',
  },
]

const PROCESS = [
  { step: '01', title: 'Partner Order', desc: 'Distributors place commissions through our B2B workflow with clear specs and documentation.' },
  { step: '02', title: 'Secure Intake', desc: 'Ashes or hair received via verified courier or in-person handover — labelled and logged.' },
  { step: '03', title: 'Carbon Extraction', desc: 'Laboratory purification isolates carbon from remains under controlled protocols.' },
  { step: '04', title: 'CVD Growth', desc: 'Atoms deposit layer by layer in our reactors until a real diamond crystal forms.' },
  { step: '05', title: 'Cut & Finish', desc: 'Master craftsmen shape the Eternity Cut and polish for brilliance and fire.' },
  { step: '06', title: 'Certify & Ship', desc: 'Quality certificate, traceability, and packaging — ready for your local market clients.' },
]

const PARTNER_SUPPORTS = [
  {
    num: '01',
    title: 'Global Distributor Development',
    desc: 'Training, product guidance, and go-to-market collaboration so you can own your regional memorial-diamond market with confidence.',
  },
  {
    num: '02',
    title: 'Packaging Support',
    desc: 'Premium presentation and packaging systems that deliver a consistent, high-end brand experience to every client you serve.',
  },
  {
    num: '03',
    title: 'Online Order System',
    desc: 'A partner-ready platform to place and manage commissions — built for professional B2B volume, not consumer checkout.',
  },
  {
    num: '04',
    title: 'Real-Time Process Tracking',
    desc: 'Live production status from intake to delivery, so your team — and your clients — always know where each diamond stands.',
  },
]

const TEAM = [
  { name: 'Kenny Wong', role: 'Tech Lead', img: '/sfsdiamond/team-1.jpg' },
  { name: 'Patrick Lau', role: 'Sales Lead', img: '/sfsdiamond/team-2.png' },
  { name: 'Ema Li', role: 'Product Designer', img: '/sfsdiamond/team-3.jpg' },
]

export default function SFSHomePage() {
  return (
    <>
      {/* ── Hero: memorial warmth + factory identity ── */}
      <section className="relative min-h-screen flex items-center overflow-hidden" style={{ background: '#050305' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={ossImg('/sfsdiamond/hero-love.svg')} alt="" aria-hidden className="absolute inset-0 w-full h-full object-cover pointer-events-none" />
        <EternityRing />
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
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse 38% 55% at 70% 50%, rgba(201,169,110,0.07) 0%, transparent 100%)' }}
        />
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'linear-gradient(180deg, rgba(2,1,3,0.55) 0%, transparent 18%, transparent 80%, rgba(2,1,3,0.65) 100%)' }}
        />

        <div
          className={[
            'relative z-10 box-border w-full py-24',
            'max-md:mx-0 max-md:max-w-none max-md:pl-[max(1rem,calc(env(safe-area-inset-left,0px)+14px))]',
            'max-md:pr-[max(1rem,calc(env(safe-area-inset-right,0px)+14px))]',
            'md:mx-auto md:max-w-6xl md:pl-[clamp(2.5rem,min(14vw,8rem),8rem)] md:pr-[clamp(1.5rem,4vw,2.5rem)]',
          ].join(' ')}
        >
          <p
            className="mb-5 text-xs uppercase tracking-[0.3em] hyphens-none"
            style={{ color: '#C9A96E', textWrap: 'balance' }}
          >
            B2B Memorial Diamond Factory · CVD
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
            We manufacture certified memorial diamonds from ashes or hair — and equip professional
            distributors with the factory, packaging, and systems to own their local markets.
          </p>
          <div className="flex flex-wrap gap-4">
            <a
              href="mailto:patricklau@sfsdiamonds.com?subject=SFS%20Distributor%20Partnership"
              className="px-8 py-3.5 rounded-full font-medium text-sm transition-all hover:opacity-90"
              style={{ background: '#C9A96E', color: '#0A0805' }}
            >
              Become a Distributor
            </a>
            <Link
              href="/sfsdiamond/technology"
              className="px-8 py-3.5 rounded-full font-medium text-sm border transition-all hover:bg-white/10"
              style={{ border: '1px solid rgba(245,240,232,0.4)', color: '#F5F0E8' }}
            >
              See Our Factory Process
            </Link>
          </div>
        </div>
      </section>

      {/* ── Factory proof ── */}
      <section style={{ background: '#0A0805', borderTop: '1px solid rgba(201,169,110,0.18)' }}>
        <div className="max-w-6xl mx-auto px-6 py-10 md:py-12">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-8 md:gap-6">
            {FACTORY_PROOF.map(item => (
              <div key={item.label} className="md:border-l md:pl-5 first:md:border-l-0 first:md:pl-0" style={{ borderColor: 'rgba(201,169,110,0.16)' }}>
                <p className="text-[10px] uppercase tracking-[0.2em] mb-2" style={{ color: '#C9A96E' }}>
                  {item.label}
                </p>
                <p className="text-sm md:text-base font-semibold leading-snug" style={{ color: '#F5F0E8', fontFamily: 'Georgia, serif' }}>
                  {item.value}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Own the factory ── */}
      <section className="py-24 md:py-28" style={{ background: '#F2EDE3' }}>
        <div className="max-w-6xl mx-auto px-6 grid lg:grid-cols-2 gap-14 lg:gap-20 items-center">
          <div className="relative order-2 lg:order-1">
            <div className="relative rounded-[2rem] overflow-hidden aspect-[4/5] max-w-lg shadow-xl">
              <Image
                src="/sfsdiamond/chemical.jpg"
                alt="SFS CVD laboratory and factory floor"
                fill
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="object-cover"
              />
            </div>
            <div
              className="absolute -bottom-5 -right-2 md:right-6 max-w-[14rem] rounded-2xl p-5"
              style={{ background: '#0A0805', border: '1px solid rgba(201,169,110,0.35)' }}
            >
              <p className="text-[10px] uppercase tracking-[0.18em] mb-2" style={{ color: '#C9A96E' }}>
                Heavy-asset producer
              </p>
              <p className="text-sm leading-snug" style={{ color: '#F5F0E8', fontFamily: 'Georgia, serif' }}>
                Own lab. Own CVD. Full production control.
              </p>
            </div>
          </div>

          <div className="order-1 lg:order-2">
            <p className="text-xs uppercase tracking-widest mb-4" style={{ color: '#C9A96E' }}>
              The Factory Behind the Diamond
            </p>
            <h2
              className="text-3xl md:text-5xl font-bold mb-6 leading-[1.15]"
              style={{ fontFamily: 'Georgia, serif', color: '#1A1A1A' }}
            >
              Diamonds grown in our laboratory — not traded from a middleman.
            </h2>
            <div className="space-y-4 text-sm md:text-base leading-relaxed" style={{ color: '#4A3E30' }}>
              <p>
                SFS Technology Group is a memorial-diamond manufacturer. We extract carbon from
                ashes or hair, grow real diamonds through Chemical Vapor Deposition, cut our
                signature Eternity form, and ship certified stones to professional partners.
              </p>
              <p>
                Love never fades; it takes a new form. We keep the science rigorous and the
                reverence intact — so distributors can sell with factory-backed trust.
              </p>
            </div>
            <div className="mt-9 flex flex-wrap gap-4">
              <Link
                href="/sfsdiamond/about"
                className="text-sm font-medium border-b-2 pb-0.5 transition-opacity hover:opacity-70"
                style={{ borderColor: '#C9A96E', color: '#1A1A1A' }}
              >
                About SFS Technology →
              </Link>
              <Link
                href="/sfsdiamond/memorial-diamonds"
                className="text-sm font-medium border-b-2 pb-0.5 transition-opacity hover:opacity-70"
                style={{ borderColor: '#C9A96E', color: '#1A1A1A' }}
              >
                View memorial diamonds →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Manufacturing capabilities ── */}
      <section className="py-24" style={{ background: '#FAFAF8' }}>
        <div className="max-w-6xl mx-auto px-6">
          <div className="max-w-2xl mb-14">
            <p className="text-xs uppercase tracking-widest mb-3" style={{ color: '#C9A96E' }}>
              What Partners Get
            </p>
            <h2 className="text-3xl md:text-4xl font-bold" style={{ fontFamily: 'Georgia, serif', color: '#1A1A1A' }}>
              Factory capability, not just a product catalogue.
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 lg:gap-6">
            {CAPABILITIES.map((item, i) => (
              <article
                key={item.title}
                className="relative overflow-hidden rounded-[1.75rem] min-h-[17rem] md:min-h-[20rem]"
              >
                <Image
                  src={item.img}
                  alt={item.title}
                  fill
                  sizes="(max-width: 640px) 100vw, 50vw"
                  className="object-cover transition-transform duration-700 hover:scale-105"
                />
                <div
                  className="absolute inset-0"
                  style={{
                    background:
                      'linear-gradient(to top, rgba(10,8,5,0.88) 0%, rgba(10,8,5,0.35) 45%, rgba(10,8,5,0.12) 100%)',
                  }}
                />
                <div className="absolute inset-x-0 bottom-0 p-6 md:p-7">
                  <p className="text-[10px] uppercase tracking-[0.2em] mb-2" style={{ color: '#C9A96E' }}>
                    0{i + 1}
                  </p>
                  <h3 className="text-xl font-semibold mb-2" style={{ fontFamily: 'Georgia, serif', color: '#F5F0E8' }}>
                    {item.title}
                  </h3>
                  <p className="text-sm leading-relaxed max-w-md" style={{ color: 'rgba(245,240,232,0.72)' }}>
                    {item.desc}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── B2B partners ── */}
      <section className="relative overflow-hidden" style={{ background: '#0A0805' }}>
        <div className="absolute inset-0">
          <Image
            src="/sfsdiamond/company.jpg"
            alt=""
            fill
            sizes="100vw"
            className="object-cover"
            style={{ opacity: 0.22 }}
            aria-hidden
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                'linear-gradient(115deg, rgba(10,8,5,0.94) 0%, rgba(10,8,5,0.78) 42%, rgba(10,8,5,0.55) 100%)',
            }}
          />
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                'radial-gradient(ellipse 50% 60% at 85% 20%, rgba(201,169,110,0.14) 0%, transparent 70%)',
            }}
          />
        </div>

        <div className="relative z-10 max-w-6xl mx-auto px-6 py-24 md:py-28">
          <div className="grid lg:grid-cols-[1.15fr_0.85fr] gap-12 lg:gap-16 items-end mb-16 md:mb-20">
            <div>
              <p className="text-xs uppercase tracking-[0.28em] mb-5" style={{ color: '#C9A96E' }}>
                Business Partners
              </p>
              <h2
                className="text-3xl md:text-5xl font-bold leading-[1.12] mb-6"
                style={{ fontFamily: 'Georgia, serif', color: '#F5F0E8' }}
              >
                B2B Only.
                <br />
                <span style={{ color: '#C9A96E' }}>Your Market.</span>
                <br />
                Our Factory.
              </h2>
              <p className="max-w-xl text-sm md:text-base leading-relaxed mb-9" style={{ color: 'rgba(245,240,232,0.72)' }}>
                SFS works exclusively with professional distributors. We put our CVD laboratory,
                branded packaging, online ordering, and live production tracking behind partners
                who want to build — and own — their local memorial-diamond market.
              </p>
              <div className="flex flex-wrap gap-3">
                <a
                  href="mailto:patricklau@sfsdiamonds.com?subject=SFS%20Distributor%20Partnership"
                  className="px-8 py-3.5 rounded-full font-medium text-sm transition-all hover:opacity-90"
                  style={{ background: '#C9A96E', color: '#0A0805' }}
                >
                  Become a Distributor
                </a>
                <a
                  href="tel:+85265600073"
                  className="px-8 py-3.5 rounded-full font-medium text-sm border transition-all hover:bg-white/5"
                  style={{ border: '1px solid rgba(201,169,110,0.55)', color: '#F5F0E8' }}
                >
                  Call (852) 6560 0073
                </a>
              </div>
            </div>

            <div className="lg:pb-2">
              <div
                className="rounded-3xl p-7 md:p-8"
                style={{
                  background: 'rgba(245,240,232,0.05)',
                  border: '1px solid rgba(201,169,110,0.28)',
                  backdropFilter: 'blur(8px)',
                }}
              >
                <p
                  className="text-xl md:text-2xl leading-snug mb-5"
                  style={{ fontFamily: 'Georgia, serif', color: '#F5F0E8' }}
                >
                  Not a retail brand. A factory partner for professionals who sell with trust.
                </p>
                <p className="text-sm leading-relaxed mb-6" style={{ color: 'rgba(245,240,232,0.62)' }}>
                  From first enquiry to certified delivery, we equip distributors with the systems
                  and craftsmanship that turn local demand into lasting client relationships.
                </p>
                <div className="flex flex-wrap gap-x-8 gap-y-3 text-xs uppercase tracking-[0.18em]" style={{ color: '#C9A96E' }}>
                  <span>Factory Direct</span>
                  <span>Partner Systems</span>
                  <span>Global Reach</span>
                </div>
              </div>
            </div>
          </div>

          <div
            className="grid grid-cols-1 md:grid-cols-2 overflow-hidden rounded-3xl"
            style={{ border: '1px solid rgba(201,169,110,0.22)' }}
          >
            {PARTNER_SUPPORTS.map((item, i) => (
              <div
                key={item.title}
                className={[
                  'group p-7 md:p-8 transition-colors duration-300 hover:bg-white/[0.04]',
                  i < PARTNER_SUPPORTS.length - 1 ? 'border-b md:border-b-0' : '',
                  i % 2 === 0 ? 'md:border-r' : '',
                  i < 2 ? 'md:border-b' : '',
                ].join(' ')}
                style={{
                  background: 'rgba(10,8,5,0.35)',
                  borderColor: 'rgba(201,169,110,0.14)',
                }}
              >
                <p
                  className="text-xs font-semibold tracking-[0.2em] mb-4 transition-colors duration-300 group-hover:text-[#E4C78A]"
                  style={{ color: '#C9A96E' }}
                >
                  {item.num}
                </p>
                <h3
                  className="text-lg font-semibold mb-3"
                  style={{ fontFamily: 'Georgia, serif', color: '#F5F0E8' }}
                >
                  {item.title}
                </h3>
                <p className="text-sm leading-relaxed" style={{ color: 'rgba(245,240,232,0.58)' }}>
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Video ── */}
      <section className="py-24" style={{ background: '#111111' }}>
        <div className="max-w-6xl mx-auto px-6">
          <div className="max-w-2xl mb-12">
            <p className="text-xs uppercase tracking-widest mb-3" style={{ color: '#C9A96E' }}>Inside Production</p>
            <h2 className="text-3xl md:text-4xl font-bold" style={{ fontFamily: 'Georgia, serif', color: '#F5F0E8' }}>
              From remains to certified brilliance.
            </h2>
          </div>
          <div className="flex justify-center">
            <VideoPlayer src={ossImg('/sfsdiamond/hero.mp4')} poster={ossImg('/sfsdiamond/hero-diamond.jpg', { w: 420 })} />
          </div>
        </div>
      </section>

      {/* ── Production journey (editorial, not card grid) ── */}
      <section className="py-24" style={{ background: '#FAFAF8' }}>
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-14">
            <div className="max-w-xl">
              <p className="text-xs uppercase tracking-widest mb-3" style={{ color: '#C9A96E' }}>
                Production Journey
              </p>
              <h2 className="text-3xl md:text-4xl font-bold" style={{ fontFamily: 'Georgia, serif', color: '#1A1A1A' }}>
                Six controlled stages from partner order to certified stone.
              </h2>
            </div>
            <Link
              href="/sfsdiamond/technology"
              className="shrink-0 text-sm font-medium border-b-2 pb-0.5 transition-opacity hover:opacity-70 self-start md:self-auto"
              style={{ borderColor: '#C9A96E', color: '#1A1A1A' }}
            >
              Deep dive into technology →
            </Link>
          </div>

          <ol className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-10 gap-y-10">
            {PROCESS.map(p => (
              <li key={p.step} className="flex gap-4">
                <span
                  className="shrink-0 text-sm font-semibold tracking-[0.14em] pt-0.5"
                  style={{ color: '#C9A96E' }}
                >
                  {p.step}
                </span>
                <div>
                  <h3 className="text-base font-semibold mb-2" style={{ color: '#1A1A1A' }}>
                    {p.title}
                  </h3>
                  <p className="text-sm leading-relaxed" style={{ color: '#6B5E4A' }}>
                    {p.desc}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── Team ── */}
      <section className="py-24" style={{ background: '#111111' }}>
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <p className="text-xs uppercase tracking-widest mb-3" style={{ color: '#C9A96E' }}>Partnership Team</p>
            <h2 className="text-3xl md:text-4xl font-bold" style={{ fontFamily: 'Georgia, serif', color: '#F5F0E8' }}>
              People behind every commission
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

      {/* ── Closing CTA: partner-first ── */}
      <section className="py-24" style={{ background: '#F2EDE3' }}>
        <div className="max-w-3xl mx-auto px-6 text-center">
          <p className="text-xs uppercase tracking-widest mb-4" style={{ color: '#C9A96E' }}>
            Partner with SFS
          </p>
          <h2 className="text-3xl md:text-4xl font-bold mb-6" style={{ fontFamily: 'Georgia, serif', color: '#1A1A1A' }}>
            Bring a memorial diamond factory<br className="hidden sm:block" /> into your market.
          </h2>
          <p className="text-sm leading-relaxed mb-10" style={{ color: '#4A3E30' }}>
            Talk to our team about distributor terms, packaging, online ordering, and real-time
            production tracking. We manufacture; you own the relationship with your clients.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <a
              href="mailto:patricklau@sfsdiamonds.com?subject=SFS%20Distributor%20Partnership"
              className="px-8 py-3.5 rounded-full font-medium text-sm transition-all hover:opacity-90"
              style={{ background: '#C9A96E', color: '#0A0805' }}
            >
              Become a Distributor
            </a>
            <a
              href="tel:+85265600073"
              className="px-8 py-3.5 rounded-full font-medium text-sm transition-all hover:opacity-90"
              style={{ background: '#1A1A1A', color: '#F5F0E8' }}
            >
              Call (852) 6560 0073
            </a>
            <Link
              href="/sfsdiamond/order"
              className="px-8 py-3.5 rounded-full font-medium text-sm border transition-all hover:bg-black/5"
              style={{ border: '1px solid #C9A96E', color: '#1A1A1A' }}
            >
              Partner Order Portal
            </Link>
          </div>
        </div>
      </section>
    </>
  )
}
