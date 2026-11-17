import Image from 'next/image'
import Link from 'next/link'
import type { ReactNode } from 'react'
import VideoPlayer from './components/VideoPlayer'
import EternityRing from './components/EternityRing'
import { ossImg } from '@/lib/oss-img'
import {
  SFS_SALES_MAILTO_OEM,
  SFS_SALES_PHONE_DISPLAY,
  SFS_SALES_TEL_HREF,
  SFS_SALES_WHATSAPP_HREF,
} from '@/lib/sfs/sales-contact'

const GOLD = '#C9A96E'
const INK = '#0A0805'
const PAPER = '#F7F4EE'
const MUTED = '#6B5E4A'

const FACTORY_PROOF = [
  { label: 'Model', value: 'In-house CVD' },
  { label: 'Lead time', value: '2–3 months' },
  { label: 'Quality', value: '4C + certificate' },
  { label: 'Traceability', value: 'Unique stone ID' },
  { label: 'Channel', value: 'OEM / white-label' },
]

const OEM_SERVICES = [
  {
    title: 'Loose memorial diamonds',
    desc: 'Ashes or hair to certified CVD stone — grown, cut, and graded in our factory for your brand.',
  },
  {
    title: 'White-label packaging',
    desc: 'Presentation systems and handover kits prepared for your brand identity and market.',
  },
  {
    title: 'Certificates & traceability',
    desc: '4C documentation and a unique ID linking each stone to the source remains you process.',
  },
  {
    title: 'Jewellery finishing (optional)',
    desc: 'Settings and finished pieces when you need more than a loose stone — scoped per programme.',
  },
]

const CUSTOMIZABLE = [
  { title: 'Stone specs', desc: 'Carat target, shape, and cut options within CVD memorial-diamond capability.' },
  { title: 'Certificate & QC pack', desc: 'Official grading paperwork and factory QC aligned to your delivery standard.' },
  { title: 'Packaging & brand face', desc: 'White-label boxes, inserts, and handover presentation for your label.' },
  { title: 'Settings & SKUs', desc: 'Ring, necklace, and other finishes when your line needs ready-to-sell jewellery.' },
  { title: 'Order workflow', desc: 'B2B portal for specs, status tracking, and repeat commissions after onboarding.' },
  { title: 'Trial before scale', desc: 'Start with a scoped trial order, then expand once quality and process fit.' },
]

const STANDARDS = [
  { title: 'Vertical integration', desc: 'Carbon extraction, CVD growth, cutting, and certification under one production system.' },
  { title: 'Documented QC', desc: '4C grading and quality certificates accompany every stone delivered to your programme.' },
  { title: 'Operational visibility', desc: 'Online ordering and live production status so your team stays ahead of every commission.' },
]

const CAPABILITIES = [
  {
    title: 'CVD Laboratory',
    desc: 'Heavy-asset growth — seed, plasma, and crystal control stay inside our facility.',
    img: '/sfsdiamond/cvd-machine.jpeg',
  },
  {
    title: 'Cut & Polish',
    desc: 'Precision finishing into the Eternity Cut, ready for your brand’s jewellery settings.',
    img: '/sfsdiamond/process-5.png',
  },
  {
    title: 'Certified Handover',
    desc: 'Quality documentation and packaging designed for professional client delivery under your label.',
    img: '/sfsdiamond/igi-quality-cert.png',
  },
  {
    title: 'OEM systems',
    desc: 'Ordering and live production tracking so brand partners stay ahead of every commission.',
    img: '/sfsdiamond/step-polish.jpg',
  },
]

const PROCESS = [
  { step: '01', title: 'OEM brief', desc: 'Share brand needs, target specs, packaging, and market — we scope capability and lead time.' },
  { step: '02', title: 'Trial order', desc: 'Lock a first commission to validate quality, paperwork, and handover fit.' },
  { step: '03', title: 'Secure intake', desc: 'Ashes or hair received, labelled, and logged under chain of custody.' },
  { step: '04', title: 'CVD growth', desc: 'Atoms deposit layer by layer until a real diamond crystal forms.' },
  { step: '05', title: 'Cut & finish', desc: 'Eternity Cut shaping, polish, and optional jewellery setting.' },
  { step: '06', title: 'Certify & ship', desc: 'Certificate, traceability, and white-label packaging for your brand.' },
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
  if (href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('http')) {
    return (
      <a href={href} className={className} style={style} {...(href.startsWith('http') ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
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
  if (href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('http')) {
    return (
      <a
        href={href}
        className={`${className} hover:bg-white/5`}
        style={style}
        {...(href.startsWith('http') ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      >
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
              SFS Technology Group · OEM / White-label Manufacturing
            </p>
          </div>
          <h1
            className="mb-6 max-w-3xl font-bold leading-[1.08] text-[clamp(2.1rem,4.6vw+0.6rem,3.6rem)] md:text-[3.75rem] md:leading-[1.08]"
            style={{ color: '#FFFFFF', fontFamily: 'Georgia, "Times New Roman", serif' }}
          >
            Memorial diamond OEM
            <br />
            <span style={{ color: GOLD }}>for your own brand.</span>
          </h1>
          <p
            className="mb-10 max-w-lg text-base leading-relaxed sm:text-lg"
            style={{ color: 'rgba(245,240,232,0.82)' }}
          >
            Factory-backed CVD production, certification, packaging, and optional jewellery finishing —
            white-label so you sell under your brand, not ours.
          </p>
          <div className="flex flex-wrap gap-3">
            <CtaPrimary href={SFS_SALES_MAILTO_OEM}>
              Request OEM quote
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

      {/* ── Product under your brand ── */}
      <section className="relative min-h-[70vh] flex items-center overflow-hidden" style={{ background: '#050305' }}>
        <EternityRing />
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'linear-gradient(90deg, rgba(2,1,3,0.88) 0%, rgba(2,1,3,0.55) 42%, rgba(2,1,3,0.2) 100%)' }}
        />
        <div className="relative z-10 max-w-6xl mx-auto px-6 py-24 w-full">
          <p className="text-[11px] uppercase tracking-[0.28em] mb-5" style={{ color: GOLD }}>
            What your brand delivers
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
            The Eternity Cut is the memorial diamond your clients receive. We grow it, certify it,
            and hand it over under your label — factory science behind your brand story.
          </p>
          <CtaGhost href="/sfsdiamond/memorial-diamonds" dark>
            View the product programme
          </CtaGhost>
        </div>
      </section>

      {/* ── Manufacturer statement ── */}
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
                Your brand. Our factory.
              </h2>
              <p className="text-sm md:text-[15px] leading-relaxed mb-5" style={{ color: MUTED }}>
                We extract carbon from ashes or hair, grow certified diamonds through Chemical Vapor
                Deposition, cut our signature Eternity form, and deliver with documentation your
                clients can trust — white-labelled for your programme.
              </p>
              <p className="text-sm md:text-[15px] leading-relaxed mb-10" style={{ color: MUTED }}>
                Build or extend a memorial-diamond line without building a CVD plant. We manufacture;
                you own the brand and the client relationship.
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

      {/* ── What we OEM ── */}
      <section className="py-20 md:py-24" style={{ background: '#FFFFFF', borderTop: '1px solid #E8E2D6' }}>
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-12 pb-8" style={{ borderBottom: '1px solid #E8E2D6' }}>
            <div className="max-w-xl">
              <p className="text-[11px] uppercase tracking-[0.28em] mb-3" style={{ color: GOLD }}>
                OEM scope
              </p>
              <h2 className="text-2xl md:text-3xl font-bold" style={{ fontFamily: 'Georgia, serif', color: INK }}>
                What we can manufacture for your brand.
              </h2>
            </div>
            <p className="text-sm max-w-sm leading-relaxed" style={{ color: MUTED }}>
              From loose certified stones to white-label packaging and optional finished jewellery —
              scoped to your programme.
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-x-12 gap-y-10">
            {OEM_SERVICES.map((item, i) => (
              <div key={item.title} className="flex gap-4">
                <span className="shrink-0 text-xs font-semibold tracking-[0.16em] pt-1" style={{ color: GOLD }}>
                  0{i + 1}
                </span>
                <div>
                  <h3 className="text-lg font-semibold mb-2" style={{ fontFamily: 'Georgia, serif', color: INK }}>
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

      {/* ── Customizable ── */}
      <section className="py-20 md:py-24" style={{ background: PAPER, borderTop: '1px solid #E8E2D6' }}>
        <div className="max-w-6xl mx-auto px-6">
          <div className="mb-12 pb-8" style={{ borderBottom: '1px solid #E0D8C8' }}>
            <p className="text-[11px] uppercase tracking-[0.28em] mb-3" style={{ color: GOLD }}>
              Customisation
            </p>
            <h2 className="text-2xl md:text-3xl font-bold max-w-2xl" style={{ fontFamily: 'Georgia, serif', color: INK }}>
              What you can tailor — and how to start.
            </h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-10 gap-y-10">
            {CUSTOMIZABLE.map(item => (
              <div key={item.title}>
                <h3 className="text-base font-semibold mb-2" style={{ color: INK }}>
                  {item.title}
                </h3>
                <p className="text-sm leading-relaxed" style={{ color: MUTED }}>
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
          <div className="mt-12 flex flex-wrap gap-3">
            <CtaPrimary href={SFS_SALES_MAILTO_OEM}>
              Request trial / quote
            </CtaPrimary>
            <CtaGhost href={SFS_SALES_WHATSAPP_HREF}>
              WhatsApp sales
            </CtaGhost>
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
                Built for brands that need process, not promises.
              </h2>
            </div>
            <p className="text-sm max-w-sm leading-relaxed" style={{ color: MUTED }}>
              Clear production ownership, documented quality, and systems that keep every commission transparent.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-0">
            {STANDARDS.map((item, i) => (
              <div key={item.title} className="py-6 md:py-0 md:px-8 first:md:pl-0 last:md:pr-0">
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

      {/* ── Capability gallery ── */}
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

      {/* ── How to engage OEM ── */}
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
          <div className="grid lg:grid-cols-12 gap-12 lg:gap-10 items-start">
            <div className="lg:col-span-7">
              <p className="text-[11px] uppercase tracking-[0.28em] mb-5" style={{ color: GOLD }}>
                Start an OEM programme
              </p>
              <h2
                className="text-3xl md:text-5xl font-bold leading-[1.1] mb-6"
                style={{ fontFamily: 'Georgia, serif', color: '#F5F0E8' }}
              >
                Trial first.
                <br />
                Then scale under your label.
              </h2>
              <p className="max-w-xl text-sm md:text-base leading-relaxed mb-8" style={{ color: 'rgba(245,240,232,0.7)' }}>
                Tell us your brand, target markets, and what you need manufactured. We confirm
                capability, lead time, and a trial path — then production tracking for ongoing volume.
              </p>
              <div className="flex flex-wrap gap-3">
                <CtaPrimary href={SFS_SALES_MAILTO_OEM}>
                  Request OEM quote
                </CtaPrimary>
                <CtaGhost href={SFS_SALES_TEL_HREF} dark>
                  {SFS_SALES_PHONE_DISPLAY}
                </CtaGhost>
                <CtaGhost href={SFS_SALES_WHATSAPP_HREF} dark>
                  WhatsApp
                </CtaGhost>
              </div>
              <dl className="mt-10 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4 max-w-xl">
                {[
                  ['Engagement', 'OEM / white-label brands'],
                  ['Trial', 'Scoped first order to validate fit'],
                  ['Lead time', 'Typically 2–3 months'],
                  ['Certificate', 'Official IGI specifications'],
                  ['Packaging', 'White-label handover programme'],
                  ['MOQ / pricing', 'Confirmed with sales per programme'],
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
                  Not a retail consumer storefront. A manufacturing partner for brands that sell with trust.
                </p>
                <div className="pt-5 flex flex-wrap gap-x-6 gap-y-2 text-[11px] uppercase tracking-[0.18em]" style={{ borderTop: '1px solid rgba(201,169,110,0.2)', color: GOLD }}>
                  <span>Factory direct</span>
                  <span>White-label</span>
                  <span>Trial ready</span>
                </div>
              </div>
            </div>
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
              See the transformation process behind every OEM commission.
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
                Six stages from OEM brief to certified stone.
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
              OEM team
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
            Ready to OEM memorial diamonds under your brand?
          </h2>
          <p className="text-sm leading-relaxed mb-10 max-w-xl mx-auto" style={{ color: MUTED }}>
            Share your programme goals, packaging needs, and trial volume. We confirm what we can
            manufacture, lead time, and next steps.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <CtaPrimary href={SFS_SALES_MAILTO_OEM}>
              Request OEM quote
            </CtaPrimary>
            <CtaGhost href={SFS_SALES_TEL_HREF}>
              {SFS_SALES_PHONE_DISPLAY}
            </CtaGhost>
            <CtaGhost href={SFS_SALES_WHATSAPP_HREF}>
              WhatsApp
            </CtaGhost>
            <CtaGhost href="/sfsdiamond/order">
              B2B order portal
            </CtaGhost>
          </div>
        </div>
      </section>
    </>
  )
}
