/* eslint-disable @next/next/no-img-element */
import Link from 'next/link'
import { getProduct, HOME_FEATURED_PIDS } from './data/products'

const MONO = "'Courier New', Courier, monospace"
const RED = '#ff2200'
const CYAN = '#00d4ff'

function SectionLabel({ children, color = CYAN }: { children: React.ReactNode; color?: string }) {
  return (
    <p className="text-[10px] font-bold tracking-[0.4em] uppercase mb-4" style={{ color, fontFamily: MONO }}>
      {'// '}{children}
    </p>
  )
}

function RedLine() {
  return (
    <div
      className="w-16 h-px my-5"
      style={{ background: `linear-gradient(90deg, ${RED}, transparent)`, boxShadow: `0 0 8px ${RED}` }}
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
        {/* Hero bg image — ghosted */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: "url('/cosmocoat/hero-banner.jpeg')",
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            opacity: 0.07,
            mixBlendMode: 'luminosity',
          }}
        />
        {/* Grid lines */}
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
        {/* Red left rail */}
        <div
          className="absolute left-0 top-0 bottom-0 w-px pointer-events-none"
          style={{
            background: `linear-gradient(180deg, transparent 5%, ${RED} 40%, transparent 90%)`,
            boxShadow: `0 0 20px ${RED}`,
          }}
        />

        {/* Hero content */}
        <div className="relative z-10 max-w-6xl mx-auto px-6 sm:px-10 py-24 w-full">
          <SectionLabel color={CYAN}>INDUSTRIAL COATING SOLUTIONS</SectionLabel>

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

          <RedLine />

          <p
            className="text-base sm:text-lg tracking-[0.25em] mb-10"
            style={{ color: '#3e3e3e', fontFamily: MONO }}
          >
            威栩 · 华兴 · 工业涂料
          </p>

          <div className="flex flex-wrap gap-4">
            <Link
              href="/cosmocoat/products"
              className="text-[11px] font-bold px-8 py-4 tracking-[0.2em] uppercase transition-all hover:brightness-110"
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
              className="text-[11px] font-bold px-8 py-4 tracking-[0.2em] uppercase transition-all hover:bg-white/5"
              style={{
                border: '1px solid rgba(255,255,255,0.12)',
                color: '#666',
                fontFamily: MONO,
              }}
            >
              关于我们
            </Link>
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
        <div className="max-w-6xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4">
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
              <span className="text-[8px] tracking-[0.35em] uppercase mb-1.5" style={{ color: '#2a2a2a', fontFamily: MONO }}>
                {s.label}
              </span>
              <span className="text-xs font-bold tracking-[0.1em] uppercase" style={{ color: CYAN, fontFamily: MONO }}>
                {s.value}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ══ COMPANY INTRO ══ */}
      <section className="max-w-6xl mx-auto px-6 sm:px-10 py-20">
        <SectionLabel>ABOUT</SectionLabel>
        <div className="grid md:grid-cols-[1fr_2fr] gap-12 items-start">
          <div>
            <h2
              className="text-3xl sm:text-4xl font-black leading-tight mb-6"
              style={{ color: '#f0f0f0', letterSpacing: '-0.01em' }}
            >
              化学<br />
              <span style={{ color: RED }}>即美学</span>
            </h2>
            <p className="text-[10px] tracking-[0.2em] uppercase" style={{ color: '#2a2a2a', fontFamily: MONO }}>
              Chemistry is beautiful
            </p>
            <RedLine />
            <Link
              href="/cosmocoat/about"
              className="inline-block text-[10px] tracking-[0.2em] uppercase px-5 py-3 transition-all hover:bg-white/5"
              style={{ border: `1px solid rgba(255,34,0,0.35)`, color: RED, fontFamily: MONO }}
            >
              了解更多 →
            </Link>
          </div>
          <div
            className="text-sm leading-[1.9] text-justify"
            style={{ color: '#555', borderLeft: `2px solid ${RED}`, paddingLeft: '1.5rem' }}
          >
            <p className="mb-4" style={{ borderLeft: `2px solid #141414`, paddingLeft: '1rem', marginLeft: '-2.5rem' }} />
            <p className="mb-4">
              威栩（COSMO.COAT）业务遍布各个不同的国家和文化。本公司从事不同工业建筑油漆与水漆开发、技术服务与生产。创始人是Davide Rossi，是紫外线水漆的起源技术人员之一。
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

      {/* ══ OFFERINGS — 3 CARDS ══ */}
      <section
        className="py-20"
        style={{ background: '#09090a', borderTop: '1px solid #111', borderBottom: '1px solid #111' }}
      >
        <div className="max-w-6xl mx-auto px-6 sm:px-10">
          <SectionLabel>OUR OFFERINGS</SectionLabel>
          <h2 className="text-2xl sm:text-3xl font-black mb-12" style={{ color: '#f0f0f0', letterSpacing: '-0.01em' }}>
            业务范围
          </h2>
          <div className="grid md:grid-cols-3 gap-5">
            {[
              {
                accent: RED,
                label: 'COMPANY',
                title: '关于我们',
                href: '/cosmocoat/about',
                img: '/cosmocoat/home-about-visual.png',
                desc: '威栩（COSMO.COAT）是一家源自意大利的创新型工业涂料企业，专注于环保水性涂料和高性能油漆的研发、生产与技术服务。',
              },
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
                    src={card.img}
                    alt={card.title}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    style={{ opacity: 0.7, filter: 'grayscale(25%)' }}
                  />
                </div>
                <div className="p-5 flex flex-col gap-3 flex-1">
                  <p className="text-[9px] tracking-[0.35em] uppercase font-bold" style={{ color: card.accent, fontFamily: MONO }}>
                    {card.label}
                  </p>
                  <h3 className="text-xl font-black" style={{ color: '#f0f0f0' }}>
                    {card.title}
                  </h3>
                  <p className="text-xs leading-relaxed flex-1" style={{ color: '#4a4a4a' }}>
                    {card.desc}
                  </p>
                  <p
                    className="text-[10px] tracking-[0.2em] uppercase mt-auto pt-3"
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

      {/* ══ FEATURED PRODUCTS ══ */}
      <section className="max-w-6xl mx-auto px-6 sm:px-10 py-20">
        <div className="flex items-end justify-between mb-12">
          <div>
            <SectionLabel>FEATURED PRODUCTS</SectionLabel>
            <h2 className="text-2xl sm:text-3xl font-black" style={{ color: '#f0f0f0', letterSpacing: '-0.01em' }}>
              推荐产品
            </h2>
          </div>
          <Link
            href="/cosmocoat/products"
            className="hidden sm:block text-[10px] tracking-[0.2em] uppercase px-5 py-2.5 transition-all hover:bg-white/5"
            style={{ border: '1px solid #1e1e1e', color: '#3a3a3a', fontFamily: MONO }}
          >
            查看全部 →
          </Link>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {featured.map(p => {
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
                    src={`/cosmocoat/${p.imageFile}`}
                    alt={p.title}
                    className="w-full h-full object-cover transition-transform duration-400 group-hover:scale-105"
                    style={{ filter: 'grayscale(15%)', opacity: 0.8 }}
                  />
                </div>
                <div className="p-3" style={{ borderTop: '1px solid #141414' }}>
                  <p className="text-[8px] tracking-[0.2em] uppercase mb-1" style={{ color: '#282828', fontFamily: MONO }}>
                    PRODUCT
                  </p>
                  <p className="text-xs font-bold leading-tight line-clamp-2" style={{ color: '#bbb' }}>
                    {p.title}
                  </p>
                </div>
              </Link>
            )
          })}
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
          <p className="text-xs mb-10 mx-auto max-w-md" style={{ color: '#333', fontFamily: MONO }}>
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
