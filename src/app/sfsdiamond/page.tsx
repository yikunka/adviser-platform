import Image from 'next/image'
import Link from 'next/link'
import type { ReactNode } from 'react'
import VideoPlayer from './components/VideoPlayer'
import EternityRing from './components/EternityRing'
import { ossImg } from '@/lib/oss-img'

const GOLD = '#C9A96E'
const INK = '#0A0805'
const PAPER = '#F7F4EE'
const MUTED = '#6B5E4A'

const FACTORY_PROOF = [
  { label: 'Model', value: 'In-house CVD' },
  { label: 'Lead time', value: '2–3 months' },
  { label: 'Quality', value: '4C + certificate' },
  { label: 'Traceability', value: 'Live tracking' },
  { label: 'Channel', value: 'B2B only' },
]

const STANDARDS = [
  { title: 'Vertical integration', desc: 'Carbon extraction, CVD growth, cutting, and certification under one production system.' },
  { title: 'Documented QC', desc: '4C grading and quality certificates accompany every memorial diamond delivered to partners.' },
  { title: 'Operational visibility', desc: 'Distributors follow each commission with online ordering and real-time process status.' },
]

const CAPABILITIES = [
  {
    title: 'CVD Laboratory',
    desc: 'Heavy-asset growth — seed, plasma, and crystal control stay inside our facility.',
    img: '/sfsdiamond/cvd-machine.jpeg',
  },
  {
    title: 'Cut & Polish',
    desc: 'Precision finishing into the Eternity Cut, ready for partner jewellery settings.',
    img: '/sfsdiamond/process-5.png',
  },
  {
    title: 'Certified Handover',
    desc: 'Quality documentation and packaging designed for professional client delivery.',
    img: '/sfsdiamond/igi-quality-cert.png',
  },
  {
    title: 'Partner Systems',
    desc: 'Ordering and live production tracking so your team stays ahead of every commission.',
    img: '/sfsdiamond/step-polish.jpg',
  },
]

const PROCESS = [
  { step: '01', title: 'Partner order', desc: 'Specs locked through B2B workflow with clear documentation.' },
  { step: '02', title: 'Secure intake', desc: 'Ashes or hair received, labelled, and logged under chain of custody.' },
  { step: '03', title: 'Carbon extraction', desc: 'Laboratory purification isolates carbon under controlled protocols.' },
  { step: '04', title: 'CVD growth', desc: 'Atoms deposit layer by layer until a real diamond crystal forms.' },
  { step: '05', title: 'Cut & finish', desc: 'Eternity Cut shaping and polish for brilliance and fire.' },
  { step: '06', title: 'Certify & ship', desc: 'Certificate, traceability, and packaging for your market.' },
]

const PARTNER_SUPPORTS = [
  {
    num: '01',
    title: 'Distributor development',
    desc: 'Training, product guidance, and go-to-market support for regional market ownership.',
  },
  {
    num: '02',
    title: 'Packaging programme',
    desc: 'Presentation systems that keep a consistent premium handover for every client.',
  },
  {
    num: '03',
    title: 'Online order platform',
    desc: 'Partner workflows built for professional volume — not consumer checkout.',
  },
  {
    num: '04',
    title: 'Real-time tracking',
    desc: 'Live production status from intake to delivery for your team and clients.',
  },
]

const TEAM = [
  { name: 'Kenny Wong', role: 'Tech Lead', img: '/sfsdiamond/team-1.jpg' },
  { name: 'Patrick Lau', role: 'Sales Lead', img: '/sfsdiamond/team-2.png' },
  { name: 'Ema Li', role: 'Product Designer', img: '/sfsdiamond/team-3.jpg' },
]

function CtaPrimary({ href, children }: { href: string; children: ReactNode }) {
  const className =
    'inline-flex items-center justify-center px-7 py-3.5 text-sm font-semibold tracking-wide transition-opacity hover:opacity-90'
  const style = { background: GOLD, color: INK }
  if (href.startsWith('mailto:') || href.startsWith('tel:')) {
    return (
      <a href={href} className={className} style={style}>
        {children}
      </a>
    )
  }
  return (
    <Link href={href} className={className} style={style}>
      {children}
    </Link>
  )
}

function CtaGhost({ href, children, dark = false }: { href: string; children: ReactNode; dark?: boolean }) {
  const className =
    'inline-flex items-center justify-center px-7 py-3.5 text-sm font-medium tracking-wide transition-colors'
  const style = dark
    ? { border: '1px solid rgba(245,240,232,0.35)', color: '#F5F0E8' }
    : { border: `1px solid ${GOLD}`, color: INK }
  if (href.startsWith('mailto:') || href.startsWith('tel:')) {
    return (
      <a href={href} className={`${className} hover:bg-white/5`} style={style}>
        {children}
      </a>
    )
  }
  return (
    <Link href={href} className={`${className} hover:bg-black/[0.03]`} style={style}>
      {children}
    </Link>
  )
}

export default function SFSHomePage() {
  return (
    <>
      {/* ── Hero ── */}
      <section className="relative min-h-screen flex items-center overflow-hidden" style={{ background: '#050305' }}>
        <Image
          src="/sfsdiamond/chemical.jpg"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover opacity-35"
          aria-hidden
        />
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'linear-gradient(90deg, rgba(2,1,3,0.92) 0%, rgba(2,1,3,0.72) 46%, rgba(2,1,3,0.45) 100%)' }}
        />

        <div
          className={[
            'relative z-10 box-border w-full py-24',
            'max-md:mx-0 max-md:max-w-none max-md:pl-[max(1rem,calc(env(safe-area-inset-left,0px)+14px))]',
            'max-md:pr-[max(1rem,calc(env(safe-area-inset-right,0px)+14px))]',
            'md:mx-auto md:max-w-6xl md:pl-[clamp(2.5rem,min(14vw,8rem),8rem)] md:pr-[clamp(1.5rem,4vw,2.5rem)]',
          ].join(' ')}
        >
          <div className="mb-7 flex items-center gap-3">
            <span className="h-px w-8" style={{ background: GOLD }} />
            <p className="text-[11px] uppercase tracking-[0.32em]" style={{ color: GOLD }}>
              SFS Technology Group · Memorial Diamond Manufacturer
            </p>
          </div>
          <h1
            className="mb-6 max-w-3xl font-bold leading-[1.08] text-[clamp(2.1rem,4.6vw+0.6rem,3.6rem)] md:text-[3.75rem] md:leading-[1.08]"
            style={{ color: '#FFFFFF', fontFamily: 'Georgia, "Times New Roman", serif' }}
          >
            Memorial diamonds
            <br />
            <span style={{ color: GOLD }}>for professional distributors.</span>
          </h1>
          <p
            className="mb-10 max-w-lg text-base leading-relaxed sm:text-lg"
            style={{ color: 'rgba(245,240,232,0.82)' }}
          >
            Factory-backed memorial diamonds for professional distributors — CVD production,
            certification, packaging, and partner systems under one roof.
          </p>
          <div className="flex flex-wrap gap-3">
            <CtaPrimary href="mailto:patricklau@sfsdiamonds.com?subject=SFS%20Distributor%20Partnership">
              Partner with SFS
            </CtaPrimary>
            <CtaGhost href="/sfsdiamond/technology" dark>
              Factory &amp; technology
            </CtaGhost>
          </div>
        </div>
      </section>

      {/* ── Institutional proof bar ── */}
      <section style={{ background: INK, borderTop: '1px solid rgba(201,169,110,0.2)' }}>
        <div className="max-w-6xl mx-auto px-6 py-8 md:py-0">
          <div className="grid grid-cols-2 md:grid-cols-5 md:divide-x" style={{ borderColor: 'rgba(201,169,110,0.14)' }}>
            {FACTORY_PROOF.map(item => (
              <div key={item.label} className="py-5 md:py-9 md:px-5">
                <p className="text-[10px] uppercase tracking-[0.22em] mb-2" style={{ color: 'rgba(201,169,110,0.75)' }}>
                  {item.label}
                </p>
                <p className="text-sm font-semibold leading-snug" style={{ color: '#F5F0E8', fontFamily: 'Georgia, serif' }}>
                  {item.value}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Product story partners sell ── */}
      <section className="relative min-h-[70vh] flex items-center overflow-hidden" style={{ background: '#050305' }}>
        <EternityRing />
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'linear-gradient(90deg, rgba(2,1,3,0.88) 0%, rgba(2,1,3,0.55) 42%, rgba(2,1,3,0.2) 100%)' }}
        />
        <div className="relative z-10 max-w-6xl mx-auto px-6 py-24 w-full">
          <p className="text-[11px] uppercase tracking-[0.28em] mb-5" style={{ color: GOLD }}>
            The product your clients receive
          </p>
          <h2
            className="mb-6 max-w-xl text-4xl md:text-6xl font-bold leading-[1.05]"
            style={{ color: '#FFFFFF', fontFamily: 'Georgia, serif' }}
          >
            For <span data-sfs-hero-eternity-anchor>Forever</span>
            <br />
            <span style={{ color: GOLD }}>Love</span>
          </h2>
          <p className="max-w-lg text-sm md:text-base leading-relaxed mb-8" style={{ color: 'rgba(245,240,232,0.78)' }}>
            The Eternity Cut is the memorial diamond your market sells. We grow it, certify it,
            and hand it over so your client hears a story of love — backed by a factory.
          </p>
          <CtaGhost href="/sfsdiamond/memorial-diamonds" dark>
            View the product programme
          </CtaGhost>
        </div>
      </section>

      {/* ── Manufacturer statement — full-bleed editorial ── */}
      <section className="relative overflow-hidden" style={{ background: PAPER }}>
        <div className="grid lg:grid-cols-2 min-h-[36rem]">
          <div className="relative min-h-[22rem] lg:min-h-full">
            <Image
              src="/sfsdiamond/chemical.jpg"
              alt="SFS CVD laboratory and factory floor"
              fill
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-cover"
              priority
            />
            <div
              className="absolute inset-0"
              style={{ background: 'linear-gradient(to top, rgba(10,8,5,0.45) 0%, transparent 45%)' }}
            />
            <div className="absolute bottom-0 left-0 right-0 p-6 md:p-8">
              <p className="text-[10px] uppercase tracking-[0.22em] mb-1" style={{ color: GOLD }}>
                Heavy-asset production
              </p>
              <p className="text-sm" style={{ color: 'rgba(245,240,232,0.85)' }}>
                Own laboratory · Own CVD · Full process control
              </p>
            </div>
          </div>

          <div className="flex items-center px-6 py-16 md:px-12 lg:px-16 lg:py-20">
            <div className="max-w-xl">
              <p className="text-[11px] uppercase tracking-[0.28em] mb-5" style={{ color: GOLD }}>
                SFS Technology Group
              </p>
              <h2
                className="text-3xl md:text-[2.75rem] font-bold leading-[1.15] mb-6"
                style={{ fontFamily: 'Georgia, serif', color: INK }}
              >
                A memorial diamond manufacturer — not a trading desk.
              </h2>
              <p className="text-sm md:text-[15px] leading-relaxed mb-5" style={{ color: MUTED }}>
                We extract carbon from ashes or hair, grow certified diamonds through Chemical Vapor
                Deposition, cut our signature Eternity form, and ship to professional partners with
                documentation your clients can trust.
              </p>
              <p className="text-sm md:text-[15px] leading-relaxed mb-10" style={{ color: MUTED }}>
                Love never fades; it takes a new form. We keep the science rigorous and the reverence
                intact — so distributors sell with factory-backed authority.
              </p>
              <div className="flex flex-wrap gap-x-8 gap-y-3">
                <Link
                  href="/sfsdiamond/about"
                  className="text-sm font-medium tracking-wide border-b pb-0.5 transition-opacity hover:opacity-70"
                  style={{ borderColor: GOLD, color: INK }}
                >
                  Company profile
                </Link>
                <Link
                  href="/sfsdiamond/memorial-diamonds"
                  className="text-sm font-medium tracking-wide border-b pb-0.5 transition-opacity hover:opacity-70"
                  style={{ borderColor: GOLD, color: INK }}
                >
                  Product programme
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Operating standards ── */}
      <section className="py-20 md:py-24" style={{ background: '#FFFFFF', borderTop: '1px solid #E8E2D6' }}>
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-12 pb-8" style={{ borderBottom: '1px solid #E8E2D6' }}>
            <div className="max-w-xl">
              <p className="text-[11px] uppercase tracking-[0.28em] mb-3" style={{ color: GOLD }}>
                Operating standards
              </p>
              <h2 className="text-2xl md:text-3xl font-bold" style={{ fontFamily: 'Georgia, serif', color: INK }}>
                Built for partners who need process, not promises.
              </h2>
            </div>
            <p className="text-sm max-w-sm leading-relaxed" style={{ color: MUTED }}>
              Clear production ownership, documented quality, and systems that keep every commission transparent.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-0">
            {STANDARDS.map((item, i) => (
              <div
                key={item.title}
                className="py-6 md:py-0 md:px-8 first:md:pl-0 last:md:pr-0"
                style={{ borderLeft: i === 0 ? undefined : undefined }}
              >
                <div
                  className="md:pl-8 h-full"
                  style={{ borderLeft: i === 0 ? 'none' : '1px solid #E8E2D6' }}
                >
                  <p className="text-[11px] font-semibold tracking-[0.2em] mb-4" style={{ color: GOLD }}>
                    0{i + 1}
                  </p>
                  <h3 className="text-lg font-semibold mb-3" style={{ fontFamily: 'Georgia, serif', color: INK }}>
                    {item.title}
                  </h3>
                  <p className="text-sm leading-relaxed" style={{ color: MUTED }}>
                    {item.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Capability gallery — sharp edges, editorial ── */}
      <section style={{ background: INK }}>
        <div className="max-w-6xl mx-auto px-6 py-16 md:py-20">
          <div className="mb-10 md:mb-12">
            <p className="text-[11px] uppercase tracking-[0.28em] mb-3" style={{ color: GOLD }}>
              Production capability
            </p>
            <h2 className="text-2xl md:text-4xl font-bold max-w-2xl" style={{ fontFamily: 'Georgia, serif', color: '#F5F0E8' }}>
              From reactor to certified stone — under our control.
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-px" style={{ background: 'rgba(201,169,110,0.18)' }}>
            {CAPABILITIES.map((item, i) => (
              <article key={item.title} className="relative min-h-[16rem] md:min-h-[18rem] overflow-hidden group" style={{ background: '#111111' }}>
                <Image
                  src={item.img}
                  alt={item.title}
                  fill
                  sizes="(max-width: 640px) 100vw, 50vw"
                  className="object-cover opacity-55 transition-transform duration-700 group-hover:scale-[1.03] group-hover:opacity-65"
                />
                <div
                  className="absolute inset-0"
                  style={{ background: 'linear-gradient(to top, rgba(10,8,5,0.92) 0%, rgba(10,8,5,0.35) 55%, rgba(10,8,5,0.15) 100%)' }}
                />
                <div className="absolute inset-x-0 bottom-0 p-6 md:p-7">
                  <p className="text-[10px] uppercase tracking-[0.22em] mb-2" style={{ color: GOLD }}>
                    0{i + 1}
                  </p>
                  <h3 className="text-xl font-semibold mb-2" style={{ fontFamily: 'Georgia, serif', color: '#F5F0E8' }}>
                    {item.title}
                  </h3>
                  <p className="text-sm leading-relaxed max-w-md" style={{ color: 'rgba(245,240,232,0.65)' }}>
                    {item.desc}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── B2B partners ── */}
      <section className="relative overflow-hidden" style={{ background: '#08060A' }}>
        <div className="absolute inset-0">
          <Image
            src="/sfsdiamond/company.jpg"
            alt=""
            fill
            sizes="100vw"
            className="object-cover"
            style={{ opacity: 0.18 }}
            aria-hidden
          />
          <div
            className="absolute inset-0"
            style={{ background: 'linear-gradient(105deg, rgba(8,6,10,0.96) 0%, rgba(8,6,10,0.82) 48%, rgba(8,6,10,0.55) 100%)' }}
          />
        </div>

        <div className="relative z-10 max-w-6xl mx-auto px-6 py-20 md:py-28">
          <div className="grid lg:grid-cols-12 gap-12 lg:gap-10 items-start mb-14">
            <div className="lg:col-span-7">
              <p className="text-[11px] uppercase tracking-[0.28em] mb-5" style={{ color: GOLD }}>
                Global partnership
              </p>
              <h2
                className="text-3xl md:text-5xl font-bold leading-[1.1] mb-6"
                style={{ fontFamily: 'Georgia, serif', color: '#F5F0E8' }}
              >
                B2B only.
                <br />
                Your market. Our factory.
              </h2>
              <p className="max-w-xl text-sm md:text-base leading-relaxed mb-8" style={{ color: 'rgba(245,240,232,0.7)' }}>
                SFS works exclusively with professional distributors. We put CVD manufacturing,
                packaging, online ordering, and live tracking behind partners building memorial-diamond
                businesses in their regions.
              </p>
              <div className="flex flex-wrap gap-3">
                <CtaPrimary href="mailto:patricklau@sfsdiamonds.com?subject=SFS%20Distributor%20Partnership">
                  Become a distributor
                </CtaPrimary>
                <CtaGhost href="tel:+85265600073" dark>
                  (852) 6560 0073
                </CtaGhost>
              </div>
              <dl className="mt-10 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4 max-w-xl">
                {[
                  ['Territory', 'Discussed per market'],
                  ['Minimum order', 'Priced per commission'],
                  ['Lead time', '2–3 months'],
                  ['Certificate', 'Official IGI specifications'],
                  ['Packaging', 'Partner handover programme'],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-[10px] uppercase tracking-[0.18em] mb-1" style={{ color: GOLD }}>{label}</dt>
                    <dd className="text-sm" style={{ color: 'rgba(245,240,232,0.82)' }}>{value}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <div className="lg:col-span-5 lg:pt-2">
              <div className="p-7 md:p-8" style={{ border: '1px solid rgba(201,169,110,0.28)', background: 'rgba(245,240,232,0.03)' }}>
                <p className="text-lg md:text-xl leading-snug mb-4" style={{ fontFamily: 'Georgia, serif', color: '#F5F0E8' }}>
                  Not a retail brand. A manufacturing partner for professionals who sell with trust.
                </p>
                <div className="pt-5 flex flex-wrap gap-x-6 gap-y-2 text-[11px] uppercase tracking-[0.18em]" style={{ borderTop: '1px solid rgba(201,169,110,0.2)', color: GOLD }}>
                  <span>Factory direct</span>
                  <span>Partner systems</span>
                  <span>Global reach</span>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2" style={{ border: '1px solid rgba(201,169,110,0.2)' }}>
            {PARTNER_SUPPORTS.map((item, i) => (
              <div
                key={item.title}
                className={[
                  'p-7 md:p-8 transition-colors duration-300 hover:bg-white/[0.03]',
                  i < PARTNER_SUPPORTS.length - 1 ? 'border-b md:border-b-0' : '',
                  i % 2 === 0 ? 'md:border-r' : '',
                  i < 2 ? 'md:border-b' : '',
                ].join(' ')}
                style={{ borderColor: 'rgba(201,169,110,0.16)' }}
              >
                <p className="text-[11px] font-semibold tracking-[0.2em] mb-4" style={{ color: GOLD }}>
                  {item.num}
                </p>
                <h3 className="text-lg font-semibold mb-3" style={{ fontFamily: 'Georgia, serif', color: '#F5F0E8' }}>
                  {item.title}
                </h3>
                <p className="text-sm leading-relaxed" style={{ color: 'rgba(245,240,232,0.55)' }}>
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Production film ── */}
      <section className="py-20 md:py-24" style={{ background: '#111111' }}>
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid lg:grid-cols-12 gap-10 items-end mb-10">
            <div className="lg:col-span-7">
              <p className="text-[11px] uppercase tracking-[0.28em] mb-3" style={{ color: GOLD }}>
                Inside production
              </p>
              <h2 className="text-2xl md:text-4xl font-bold" style={{ fontFamily: 'Georgia, serif', color: '#F5F0E8' }}>
                From remains to certified brilliance.
              </h2>
            </div>
            <p className="lg:col-span-5 text-sm leading-relaxed" style={{ color: 'rgba(245,240,232,0.55)' }}>
              See the transformation process that underpins every partner commission.
            </p>
          </div>
          <div className="flex justify-center">
            <VideoPlayer src={ossImg('/sfsdiamond/hero.mp4')} poster={ossImg('/sfsdiamond/hero-diamond.jpg', { w: 420 })} />
          </div>
        </div>
      </section>

      {/* ── Six-stage journey ── */}
      <section className="py-20 md:py-24" style={{ background: PAPER }}>
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-12 pb-8" style={{ borderBottom: '1px solid #E0D8C8' }}>
            <div className="max-w-xl">
              <p className="text-[11px] uppercase tracking-[0.28em] mb-3" style={{ color: GOLD }}>
                Controlled production
              </p>
              <h2 className="text-2xl md:text-3xl font-bold" style={{ fontFamily: 'Georgia, serif', color: INK }}>
                Six stages from partner order to certified stone.
              </h2>
            </div>
            <Link
              href="/sfsdiamond/technology"
              className="shrink-0 text-sm font-medium border-b pb-0.5 transition-opacity hover:opacity-70 self-start md:self-auto"
              style={{ borderColor: GOLD, color: INK }}
            >
              Technology deep dive
            </Link>
          </div>

          <ol className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-12 gap-y-10">
            {PROCESS.map(p => (
              <li key={p.step} className="flex gap-4">
                <span className="shrink-0 text-xs font-semibold tracking-[0.16em] pt-1" style={{ color: GOLD }}>
                  {p.step}
                </span>
                <div>
                  <h3 className="text-base font-semibold mb-2" style={{ color: INK }}>
                    {p.title}
                  </h3>
                  <p className="text-sm leading-relaxed" style={{ color: MUTED }}>
                    {p.desc}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── Team ── */}
      <section className="py-20 md:py-24" style={{ background: INK }}>
        <div className="max-w-6xl mx-auto px-6">
          <div className="mb-12 pb-8" style={{ borderBottom: '1px solid rgba(201,169,110,0.18)' }}>
            <p className="text-[11px] uppercase tracking-[0.28em] mb-3" style={{ color: GOLD }}>
              Partnership team
            </p>
            <h2 className="text-2xl md:text-3xl font-bold" style={{ fontFamily: 'Georgia, serif', color: '#F5F0E8' }}>
              People behind every commission
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-10">
            {TEAM.map(m => (
              <div key={m.name} className="flex items-center gap-4">
                <div className="relative w-16 h-16 overflow-hidden shrink-0" style={{ border: `1px solid ${GOLD}` }}>
                  <Image src={m.img} alt={m.name} fill className="object-cover" />
                </div>
                <div>
                  <p className="font-semibold text-base" style={{ color: '#F5F0E8' }}>{m.name}</p>
                  <p className="text-xs mt-1 uppercase tracking-[0.14em]" style={{ color: 'rgba(201,169,110,0.8)' }}>{m.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Closing ── */}
      <section className="py-20 md:py-24" style={{ background: PAPER }}>
        <div className="max-w-3xl mx-auto px-6 text-center">
          <p className="text-[11px] uppercase tracking-[0.28em] mb-4" style={{ color: GOLD }}>
            Engage SFS
          </p>
          <h2 className="text-3xl md:text-4xl font-bold mb-5" style={{ fontFamily: 'Georgia, serif', color: INK }}>
            Bring a memorial diamond factory into your market.
          </h2>
          <p className="text-sm leading-relaxed mb-10 max-w-xl mx-auto" style={{ color: MUTED }}>
            Discuss distributor terms, packaging, ordering, and production tracking. We manufacture;
            you own the client relationship.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <CtaPrimary href="mailto:patricklau@sfsdiamonds.com?subject=SFS%20Distributor%20Partnership">
              Become a distributor
            </CtaPrimary>
            <CtaGhost href="tel:+85265600073">
              Call (852) 6560 0073
            </CtaGhost>
            <CtaGhost href="/sfsdiamond/order">
              Partner order portal
            </CtaGhost>
          </div>
        </div>
      </section>
    </>
  )
}
