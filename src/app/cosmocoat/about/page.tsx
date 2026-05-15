/* eslint-disable @next/next/no-img-element */
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

export default function CosmoAboutPage() {
  return (
    <div style={{ background: '#080808' }}>

      {/* ── PAGE HERO ── */}
      <div className="relative w-full min-h-[220px] md:min-h-[340px] overflow-hidden flex items-end">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: "url('/cosmocoat/about-hero.jpeg')",
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            opacity: 0.25,
            filter: 'grayscale(40%)',
          }}
        />
        <div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(to bottom, rgba(8,8,8,0.4) 0%, #080808 100%)' }}
        />
        <div className="relative z-10 max-w-5xl mx-auto px-6 sm:px-10 pb-10 pt-16 w-full">
          <SectionLabel>COMPANY</SectionLabel>
          <h1 className="text-3xl sm:text-5xl font-black" style={{ color: '#f0f0f0', letterSpacing: '-0.02em' }}>
            华兴<span style={{ color: RED }}>·</span>威栩
          </h1>
          <p className="text-[11px] tracking-[0.25em] mt-3 uppercase" style={{ color: '#333', fontFamily: MONO }}>
            Chemistry is beautiful
          </p>
        </div>
      </div>

      {/* ── INTRO TEXT ── */}
      <div className="max-w-5xl mx-auto px-6 sm:px-10 py-14">
        <div
          className="text-sm leading-[1.9] text-justify space-y-5"
          style={{ color: '#555', borderLeft: `2px solid ${RED}`, paddingLeft: '1.5rem' }}
        >
          <p>威栩（COSMO.COAT）业务遍布各个不同的国家和文化。</p>
          <p>
            本公司从事不同工业建筑油漆与水漆开发，技术服务与生产。本公司是源自于意大利COSMOCOAT公司，创始人是Davide Rossi，是紫外线水漆的起源技术人员之一。COSMOCOAT有别于其他的油漆企业，我们是一家创新和技术驱动型公司，每年投资大量资源与技术人员开发更新最为先进的油漆水漆技术。经过几年于中国的摸索发展，我们于市场上被认知为具有中国适应性的欧洲技术企业。
          </p>
          <p>威栩公司的企业文化、愿景和价值观来自多个国家和地区的客户与员工团结一致，在多元化的文化背景下工作。</p>
          <p>威栩（COSMO.COAT）自成立以来一直秉承认真专注的企业精神，努力打造企业各种竞争实力。</p>
        </div>
      </div>

      {/* ── COMPANY DISTRIBUTION ── */}
      <section className="py-16" style={{ background: '#09090a', borderTop: '1px solid #111', borderBottom: '1px solid #111' }}>
        <div className="max-w-6xl mx-auto px-6 sm:px-10">
          <SectionLabel>GLOBAL PRESENCE</SectionLabel>
          <h2 className="text-2xl sm:text-4xl font-black mb-12" style={{ color: '#f0f0f0', letterSpacing: '-0.01em' }}>
            公司分布
          </h2>

          <div className="grid lg:grid-cols-2 gap-12 items-start mb-16">
            <div
              className="overflow-hidden"
              style={{ border: '1px solid #181818' }}
            >
              <img src="/cosmocoat/about-map-china.png" alt="" className="w-full" style={{ filter: 'grayscale(20%) brightness(0.8)' }} />
            </div>
            <div className="text-sm leading-[1.9] text-justify space-y-4" style={{ color: '#555' }}>
              <p>
                威栩（COSMO.COAT）是源自意大利的欧洲知名涂料企业，在欧洲设有专业的研发中心与实验室，专注于环保水性涂料和高性能工业涂料的研发与创新。公司致力于为全球客户提供专利技术与定制化解决方案，帮助用户解决工程与工业涂装中的实际问题。
              </p>
              <p>
                威栩坚持&ldquo;一对一研发服务模式&rdquo;，根据客户的特殊需求定制配方与产品，广泛应用于金属、机械、家具、建筑等多个领域。
              </p>
              <p>
                为更好服务亚洲市场，威栩在中国湖北设立新公司，结合欧洲技术优势与本土需求，提供高效、环保、可持续的涂料与配套设施产品。
              </p>
            </div>
          </div>

          {/* China factories */}
          <div className="grid md:grid-cols-2 gap-8 mb-16">
            {[
              { sub: 'Hubei Factory in China', title: '中国湖北工厂', img: '/cosmocoat/about-factory-hubei.jpg', caption: '威栩（COSMO.COAT）位於中國湖北省工廠' },
              { sub: 'Dong guang in China', title: '中国东莞工厂', img: '/cosmocoat/about-factory-dongguan.jpg', caption: '威栩（COSMO.COAT）位於中國东莞省工廠' },
            ].map(f => (
              <div key={f.title} className="flex flex-col gap-3">
                <p className="text-[9px] tracking-[0.3em] uppercase" style={{ color: '#333', fontFamily: MONO }}>{f.sub}</p>
                <h3 className="text-xl font-black" style={{ color: '#f0f0f0' }}>{f.title}</h3>
                <div className="overflow-hidden" style={{ border: '1px solid #181818' }}>
                  <img src={f.img} alt="" className="w-full" style={{ filter: 'grayscale(20%) brightness(0.75)' }} />
                </div>
                <p className="text-[10px] text-center tracking-wider" style={{ color: '#2e2e2e', fontFamily: MONO }}>{f.caption}</p>
              </div>
            ))}
          </div>

          <div className="text-sm leading-[1.9] text-justify space-y-4 mb-16 max-w-4xl mx-auto" style={{ color: '#555' }}>
            <p>
              威栩（COSMO.COAT）的东莞工厂成立于1978年，拥有花园式厂房，总面积万余平方米，多功能的质检化验室及完善的管理系统，地处交通极为便捷的珠江三角洲中心地带。
            </p>
            <p>
              威栩（COSMO.COAT）在本行业中不断的开拓和钻研，至今拥有精湛的技术和创新的精神，主要以生产高品质的油漆、油墨及配套使用的各类溶剂、添加剂。主要有各类防紫外光固化特殊用漆、塑胶产品漆、合金产品漆、汽车工程漆、机械工程漆、海事船舶漆、隔热，防腐蚀等，多年以来深受国内外客户的支持与信赖。
            </p>
          </div>

          {/* Italy factory */}
          <div
            className="grid lg:grid-cols-2 gap-10 items-start max-w-5xl mx-auto p-8"
            style={{ background: '#0d0d0d', border: '1px solid #181818', borderLeft: `3px solid ${CYAN}` }}
          >
            <div>
              <p className="text-[9px] tracking-[0.3em] uppercase mb-3" style={{ color: CYAN, fontFamily: MONO }}>Italian factory</p>
              <h3 className="text-2xl font-black mb-6" style={{ color: '#f0f0f0' }}>意大利工厂</h3>
              <div className="text-sm leading-relaxed text-justify space-y-4" style={{ color: '#555' }}>
                <p>
                  意大利威栩于90年代创建于意大利洛迪省萨龙诺，创始人为Davide Rossi。威栩公司的业务重点在于应用化学。经多年发展，威栩本身于涂层高端市场盛名于其本身高度专业化与高技术含量的涂料产品研究与开发。
                </p>
                <p>
                  意大利威栩业务遍及欧洲、北美洲、亚太区和拉丁美洲，在近75个国家生产经营工程与工业用产品，高占了欧洲高端UV涂料的一大份额。
                </p>
              </div>
            </div>
            <div style={{ border: '1px solid #1a1a1a' }}>
              <img src="/cosmocoat/about-factory-italy.jpg" alt="" className="w-full" style={{ filter: 'grayscale(20%) brightness(0.75)' }} />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4 mt-10 max-w-4xl mx-auto">
            {['/cosmocoat/about-gallery-1.jpg', '/cosmocoat/about-gallery-2.jpg'].map((src, i) => (
              <div key={i} style={{ border: '1px solid #181818', overflow: 'hidden' }}>
                <img src={src} alt="" className="w-full object-cover" style={{ filter: 'grayscale(25%) brightness(0.7)' }} />
              </div>
            ))}
          </div>
        </div>
      </section>

    </div>
  )
}
