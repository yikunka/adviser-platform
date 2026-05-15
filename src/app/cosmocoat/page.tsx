/* eslint-disable @next/next/no-img-element */
import Link from 'next/link'
import { getProduct, HOME_FEATURED_PIDS } from './data/products'
import { ossImg } from '@/lib/oss-img'

const MONO = "'Courier New', Courier, monospace"
const RED = '#ff2200'
const CYAN = '#00d4ff'

function SectionLabel({ children, color = CYAN }: { children: React.ReactNode; color?: string }) {
  return (
    <p className="text-[11px] font-bold tracking-[0.35em] uppercase mb-4" style={{ color, fontFamily: MONO }}>
      {'// '}{children}
    </p>
  )
}

function RedLine({ align = 'left' }: { align?: 'left' | 'right' }) {
  return (
    <div
      className={`w-16 h-px my-5 ${align === 'right' ? 'ml-auto' : ''}`}
      style={{
        background:
          align === 'right'
            ? `linear-gradient(270deg, ${RED}, transparent)`
            : `linear-gradient(90deg, ${RED}, transparent)`,
        boxShadow: `0 0 8px ${RED}`,
      }}
    />
  )
}

export default function CosmoHomePage() {
  const featured = HOME_FEATURED_PIDS.map(pid => getProduct(pid)).filter(Boolean)

  return (
    <div style={{ background: '#080808' }}>

      {/* ══ HERO ══ */}
      <section
        className="relative w-full min-h-[92vh] flex items-center overflow-hidden"
        style={{
          background: [
            'radial-gradient(ellipse 80% 90% at -5% 55%, rgba(255,34,0,0.16) 0%, transparent 55%)',
            'radial-gradient(ellipse 60% 70% at 108% 25%, rgba(0,212,255,0.09) 0%, transparent 50%)',
            'radial-gradient(ellipse 50% 60% at 55% 90%, rgba(250,184,58,0.05) 0%, transparent 45%)',
            '#080808',
          ].join(', '),
        }}
      >
        {/* ── Layer 1: hero bg — visible base, greyscale ── */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `url('${ossImg('/cosmocoat/hero-banner.jpeg', { w: 1920, quality: 75 })}')`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            opacity: 0.48,
            filter: 'grayscale(55%) brightness(0.65)',
          }}
        />

        {/* ── Layer 2: primary dark veil — irregular pulse 9.7s ── */}
        <div
          className="absolute inset-0"
          style={{
            background: '#080808',
            animation: 'cosmo-veil 9.7s ease-in-out infinite',
          }}
        />

        {/* ── Layer 3: spotlight vignette — out of phase 6.3s ──
              transparent center-left → dark edges
              creates non-uniform reveal: centre breathes brighter  */}
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse 58% 75% at 28% 52%, transparent 0%, #080808 68%)',
            animation: 'cosmo-veil-b 6.3s ease-in-out infinite',
            animationDelay: '-2.8s',
          }}
        />

        {/* ── Layer 4: right-edge shadow — keeps text legible ── */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'linear-gradient(100deg, transparent 30%, rgba(8,8,8,0.7) 70%, #080808 100%)',
          }}
        />

        {/* ── Layer 5: primary scanline sweep 4.5s ── */}
        <div
          className="absolute left-0 right-0 h-[2px] pointer-events-none"
          style={{
            background: `linear-gradient(90deg, transparent 5%, rgba(255,34,0,0.65) 30%, rgba(0,212,255,0.45) 70%, transparent 95%)`,
            boxShadow: `0 0 10px rgba(255,34,0,0.5), 0 0 4px rgba(0,212,255,0.3)`,
            animation: 'cosmo-scanline 4.5s linear infinite',
          }}
        />

        {/* ── Layer 6: secondary scanline, slower + offset ── */}
        <div
          className="absolute left-0 right-0 h-px pointer-events-none"
          style={{
            background: `linear-gradient(90deg, transparent 15%, rgba(0,212,255,0.3) 50%, transparent 85%)`,
            animation: 'cosmo-scanline-b 7.2s linear infinite',
            animationDelay: '-3.5s',
          }}
        />

        {/* ── Layer 7: grid lines (static) ── */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: [
              'linear-gradient(rgba(255,34,0,0.04) 1px, transparent 1px)',
              'linear-gradient(90deg, rgba(255,34,0,0.04) 1px, transparent 1px)',
            ].join(', '),
            backgroundSize: '60px 60px',
          }}
        />

        {/* ── Layer 8: red left rail ── */}
        <div
          className="absolute left-0 top-0 bottom-0 w-px pointer-events-none"
          style={{
            background: `linear-gradient(180deg, transparent 5%, ${RED} 40%, transparent 90%)`,
            boxShadow: `0 0 20px ${RED}`,
          }}
        />

        {/* Hero：大屏上 SectionLabel 独占右上第一行；第二行左侧按钮顶对齐右侧 COSMO 顶边 */}
        <div className="relative z-10 max-w-7xl w-full mx-auto px-4 sm:px-8 lg:px-12 py-20 sm:py-24">
          <div className="grid grid-cols-1 lg:grid-cols-2 lg:grid-rows-[auto,auto] gap-y-10 lg:gap-x-8 lg:gap-y-4 w-full items-start">
            <div className="flex justify-end lg:col-start-2 lg:row-start-1">
              <SectionLabel color={CYAN}>INDUSTRIAL COATING SOLUTIONS</SectionLabel>
            </div>

            <div className="flex flex-col items-center lg:items-start lg:col-start-1 lg:row-start-2 order-3 lg:order-none">
              <div className="flex flex-wrap justify-center lg:justify-start gap-3 sm:gap-4">
                <Link
                  href="/cosmocoat/products"
                  className="text-[13px] sm:text-sm font-bold px-9 py-4 sm:px-11 sm:py-[1.15rem] tracking-[0.16em] uppercase transition-all hover:brightness-110"
                  style={{
                    background: RED,
                    color: '#fff',
                    fontFamily: MONO,
                    boxShadow: `0 0 20px rgba(255,34,0,0.5), inset 0 1px 0 rgba(255,255,255,0.1)`,
                  }}
                >
                  探索产品 ▶
                </Link>
                <Link
                  href="/cosmocoat/about"
                  className="text-[13px] sm:text-sm font-bold px-9 py-4 sm:px-11 sm:py-[1.15rem] tracking-[0.16em] uppercase transition-all hover:bg-white/5"
                  style={{
                    border: '1px solid rgba(255,255,255,0.18)',
                    color: '#c8c8c8',
                    fontFamily: MONO,
                  }}
                >
                  关于我们
                </Link>
              </div>
              <p
                className="text-base sm:text-lg tracking-[0.22em] mt-6 max-w-xl text-center lg:text-left"
                style={{ color: '#a3a3a3', fontFamily: MONO }}
              >
                威栩 · 华兴 · 工业涂料
              </p>
            </div>

            <div className="flex flex-col items-end text-right lg:col-start-2 lg:row-start-2 order-2 lg:order-none">
              <h1
                className="font-black leading-none mb-1 select-none"
                style={{
                  fontSize: 'clamp(4rem, 15vw, 9.5rem)',
                  color: '#f0f0f0',
                  letterSpacing: '-0.02em',
                  textShadow: '0 0 60px rgba(255,34,0,0.1)',
                }}
              >
                COSMO
              </h1>
              <h1
                className="font-black leading-none"
                style={{
                  fontSize: 'clamp(4rem, 15vw, 9.5rem)',
                  color: RED,
                  letterSpacing: '-0.02em',
                  textShadow: `0 0 40px rgba(255,34,0,0.55), 0 0 80px rgba(255,34,0,0.2)`,
                }}
              >
                .COAT
              </h1>

              <RedLine align="right" />
            </div>
          </div>
        </div>

        {/* Bottom gradient fade */}
        <div
          className="absolute bottom-0 left-0 right-0 h-32 pointer-events-none"
          style={{ background: 'linear-gradient(transparent, #080808)' }}
        />
      </section>

      {/* ══ STATS BAR ══ */}
      <div style={{ borderTop: '1px solid #111', borderBottom: '1px solid #111', background: '#09090a' }}>
        <div className="max-w-7xl w-full mx-auto px-4 sm:px-8 lg:px-12 grid grid-cols-2 md:grid-cols-4">
          {[
            { label: 'ORIGIN', value: 'ITALY' },
            { label: 'TECH', value: 'UV PIONEER' },
            { label: 'OPERATIONS', value: 'CN + EU' },
            { label: 'SPECIALTY', value: 'CUSTOM' },
          ].map((s, i) => (
            <div
              key={s.label}
              className="flex flex-col items-center py-5 px-4 text-center"
              style={{ borderRight: i < 3 ? '1px solid #111' : 'none' }}
            >
              <span className="text-[10px] tracking-[0.3em] uppercase mb-1.5" style={{ color: '#6e6e6e', fontFamily: MONO }}>
                {s.label}
              </span>
              <span className="text-sm font-bold tracking-[0.08em] uppercase" style={{ color: CYAN, fontFamily: MONO }}>
                {s.value}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ══ 化工艺术（化学即美学） ══ */}
      <section className="max-w-7xl w-full mx-auto px-4 sm:px-8 lg:px-12 py-16 sm:py-20">
        <SectionLabel>化工艺术 · CHEMISTRY</SectionLabel>
        <div className="grid md:grid-cols-[1fr_2fr] gap-10 md:gap-12 items-start">
          <div>
            <h2
              className="text-3xl sm:text-4xl font-black leading-tight mb-6"
              style={{ color: '#f0f0f0', letterSpacing: '-0.01em' }}
            >
              化学<br />
              <span style={{ color: RED }}>即美学</span>
            </h2>
            <p className="text-[11px] tracking-[0.18em] uppercase" style={{ color: '#7a7a7a', fontFamily: MONO }}>
              Chemistry is beautiful
            </p>
            <RedLine />
            <Link
              href="/cosmocoat/about"
              className="inline-block text-[11px] tracking-[0.18em] uppercase px-5 py-3 transition-all hover:bg-white/5"
              style={{ border: `1px solid rgba(255,34,0,0.45)`, color: RED, fontFamily: MONO }}
            >
              了解更多 →
            </Link>
          </div>
          <div
            className="text-[15px] sm:text-base leading-[1.85] text-justify"
            style={{ color: '#b8b8b8', borderLeft: `2px solid ${RED}`, paddingLeft: '1.5rem' }}
          >
            <p className="mb-4">
              威栩（COSMO.COAT）业务遍布各个不同的国家和文化。本公司从事不同工业建筑油漆与水漆开发、技术服务与生产。创始人是Davide
              Rossi，是紫外线水漆的起源技术人员之一。
            </p>
            <p className="mb-4">
              COSMO.COAT 有别于其他的油漆企业，我们是一家创新和技术驱动型公司，每年投资大量资源与技术人员开发更新最为先进的油漆水漆技术。经过几年于中国的摸索发展，我们于市场上被认知为具有中国适应性的欧洲技术企业。
            </p>
            <p>
              威栩（COSMO.COAT）自成立以来一直秉承认真专注的企业精神，努力打造企业各种竞争实力。公司的企业文化、愿景和价值观来自多个国家和地区的客户与员工团结一致。
            </p>
          </div>
        </div>
      </section>

      {/* ══ OFFERINGS — 产品与配套 ══ */}
      <section
        className="py-20"
        style={{ background: '#09090a', borderTop: '1px solid #111', borderBottom: '1px solid #111' }}
      >
        <div className="max-w-7xl w-full mx-auto px-4 sm:px-8 lg:px-12">
          <SectionLabel>OUR OFFERINGS</SectionLabel>
          <h2 className="text-2xl sm:text-3xl font-black mb-10 sm:mb-12" style={{ color: '#f0f0f0', letterSpacing: '-0.01em' }}>
            产品与配套
          </h2>
          <div className="grid sm:grid-cols-2 gap-6 lg:gap-8 max-w-5xl mx-auto">
            {[
              {
                accent: CYAN,
                label: 'PRODUCTS',
                title: '产品中心',
                href: '/cosmocoat/products',
                img: '/cosmocoat/home-product-center.png',
                desc: '引进全套国际涂料行业最先进生产线和管理标准，集科研、生产、服务为一体，打造主流涂料品牌。',
              },
              {
                accent: '#fab83a',
                label: 'SOLUTIONS',
                title: '配套产品',
                href: '/cosmocoat/supporting',
                img: '/cosmocoat/home-supporting-visual.png',
                desc: 'COSMO.COAT 推出全新的配套设施产品，为客户提供一站式高效服务解决方案。',
              },
            ].map(card => (
              <Link
                key={card.href}
                href={card.href}
                className="group flex flex-col overflow-hidden transition-all duration-300"
                style={{
                  background: '#0e0e0e',
                  border: '1px solid #181818',
                  borderTop: `3px solid ${card.accent}`,
                }}
              >
                <div className="overflow-hidden aspect-[4/3] bg-neutral-900">
                  <img
                    src={ossImg(card.img, { w: 800 })}
                    alt={card.title}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    style={{ opacity: 0.7, filter: 'grayscale(25%)' }}
                  />
                </div>
                <div className="p-5 flex flex-col gap-3 flex-1">
                  <p className="text-[10px] tracking-[0.28em] uppercase font-bold" style={{ color: card.accent, fontFamily: MONO }}>
                    {card.label}
                  </p>
                  <h3 className="text-xl font-black" style={{ color: '#f0f0f0' }}>
                    {card.title}
                  </h3>
                  <p className="text-sm leading-relaxed flex-1" style={{ color: '#9a9a9a' }}>
                    {card.desc}
                  </p>
                  <p
                    className="text-[11px] tracking-[0.18em] uppercase mt-auto pt-3"
                    style={{ color: card.accent, fontFamily: MONO, borderTop: '1px solid #161616' }}
                  >
                    查看详情 →
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ══ FEATURED PRODUCTS — horizontal scroll ══ */}
      <section className="max-w-7xl w-full mx-auto px-4 sm:px-8 lg:px-12 py-16 sm:py-20">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-8 sm:mb-10">
          <div>
            <SectionLabel>FEATURED PRODUCTS</SectionLabel>
            <h2 className="text-2xl sm:text-3xl font-black" style={{ color: '#f0f0f0', letterSpacing: '-0.01em' }}>
              推荐产品
            </h2>
          </div>
          <Link
            href="/cosmocoat/products"
            className="text-[11px] tracking-[0.18em] uppercase px-5 py-2.5 transition-all hover:bg-white/5 shrink-0"
            style={{ border: '1px solid #2a2a2a', color: '#9a9a9a', fontFamily: MONO }}
          >
            查看全部 →
          </Link>
        </div>

        <div
          className="overflow-x-auto pb-4 -mx-4 px-4 sm:mx-0 sm:px-0 snap-x snap-mandatory"
          style={{
            scrollbarColor: `${RED} #111`,
            scrollbarWidth: 'thin',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          <div className="flex gap-4 sm:gap-5 w-max pr-2">
          {featured.map(p => {
            if (!p) return null
            return (
              <Link
                key={p.pid}
                href={`/cosmocoat/products/${p.pid}`}
                className="group flex flex-col overflow-hidden transition-all duration-300 snap-start shrink-0 w-[9.5rem] sm:w-[11rem]"
                style={{ background: '#0e0e0e', border: '1px solid #181818' }}
              >
                <div className="aspect-square bg-neutral-900 overflow-hidden w-full">
                  <img
                    src={ossImg(`/cosmocoat/${p.imageFile}`, { w: 400 })}
                    alt={p.title}
                    className="w-full h-full object-cover transition-transform duration-400 group-hover:scale-105"
                    style={{ filter: 'grayscale(15%)', opacity: 0.8 }}
                  />
                </div>
                <div className="p-3 flex-1" style={{ borderTop: '1px solid #141414' }}>
                  <p className="text-[9px] tracking-[0.18em] uppercase mb-1" style={{ color: '#6a6a6a', fontFamily: MONO }}>
                    PRODUCT
                  </p>
                  <p className="text-[13px] font-bold leading-snug line-clamp-3" style={{ color: '#d8d8d8' }}>
                    {p.title}
                  </p>
                </div>
              </Link>
            )
          })}
          </div>
        </div>
      </section>

      {/* ══ BOTTOM CTA ══ */}
      <section
        className="relative py-24 overflow-hidden text-center"
        style={{
          background: [
            'radial-gradient(ellipse 80% 100% at 50% 50%, rgba(255,34,0,0.1) 0%, transparent 70%)',
            '#09090a',
          ].join(', '),
          borderTop: '1px solid #111',
        }}
      >
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: [
              'linear-gradient(rgba(255,34,0,0.05) 1px, transparent 1px)',
              'linear-gradient(90deg, rgba(255,34,0,0.05) 1px, transparent 1px)',
            ].join(', '),
            backgroundSize: '50px 50px',
          }}
        />
        <div
          className="absolute top-0 left-0 right-0 h-px pointer-events-none"
          style={{ background: `linear-gradient(90deg, transparent, ${RED}, transparent)`, boxShadow: `0 0 16px ${RED}` }}
        />
        <div className="relative z-10 max-w-4xl mx-auto px-6">
          <SectionLabel>GET IN TOUCH</SectionLabel>
          <h2
            className="text-3xl sm:text-5xl font-black mb-4"
            style={{ color: '#f0f0f0', letterSpacing: '-0.02em' }}
          >
            关于我们
          </h2>
          <p className="text-sm mb-10 mx-auto max-w-md leading-relaxed" style={{ color: '#8a8a8a', fontFamily: MONO }}>
            威栩（COSMO.COAT）自成立以来一直秉承认真专注的企业精神
          </p>
          <Link
            href="/cosmocoat/about"
            className="inline-block text-[11px] font-bold px-10 py-4 tracking-[0.2em] uppercase transition-all hover:brightness-110"
            style={{
              background: RED,
              color: '#fff',
              fontFamily: MONO,
              boxShadow: `0 0 24px rgba(255,34,0,0.5), inset 0 1px 0 rgba(255,255,255,0.1)`,
            }}
          >
            了解更多 ▶
          </Link>
        </div>
      </section>

    </div>
  )
}
