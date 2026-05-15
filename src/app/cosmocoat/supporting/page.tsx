/* eslint-disable @next/next/no-img-element */
const MONO = "'Courier New', Courier, monospace"
const RED = '#ff2200'
const CYAN = '#00d4ff'

function SectionLabel({ children, color = CYAN }: { children: React.ReactNode; color?: string }) {
  return (
    <p className="text-[9px] font-bold tracking-[0.4em] uppercase mb-4" style={{ color, fontFamily: MONO }}>
      {'// '}{children}
    </p>
  )
}

function ChemCard({
  img, title, desc, align = 'left', accent = RED,
}: {
  img: string; title: string; desc: string; align?: 'left' | 'right'; accent?: string
}) {
  return (
    <section className="max-w-6xl mx-auto px-6 sm:px-10 py-12">
      <div className={`grid md:grid-cols-2 gap-10 items-center ${align === 'right' ? 'md:flex-row-reverse' : ''}`}>
        <div className={align === 'right' ? 'order-1 md:order-2' : ''}>
          <div className="overflow-hidden" style={{ border: '1px solid #1a1a1a', borderTop: `3px solid ${accent}` }}>
            <img
              src={img}
              alt={title}
              className="w-full"
              style={{ filter: 'grayscale(15%) brightness(0.8)' }}
            />
          </div>
        </div>
        <div className={`space-y-4 ${align === 'right' ? 'order-2 md:order-1 md:text-right' : ''}`}>
          <p className="text-[9px] font-bold tracking-[0.35em] uppercase" style={{ color: accent, fontFamily: MONO }}>
            {'// FORMULA'}
          </p>
          <h2
            className="text-3xl sm:text-4xl font-black"
            style={{ color: '#f0f0f0', letterSpacing: '-0.01em' }}
          >
            {title}
          </h2>
          <div
            className="w-12 h-px"
            style={{ background: `linear-gradient(90deg, ${accent}, transparent)`, marginLeft: align === 'right' ? 'auto' : '0' }}
          />
          <p className="text-sm leading-relaxed" style={{ color: '#555' }}>
            {desc}
          </p>
        </div>
      </div>
    </section>
  )
}

export default function CosmoSupportingPage() {
  return (
    <div style={{ background: '#080808' }}>

      {/* ── PAGE HEADER ── */}
      <div className="border-b py-10 px-6" style={{ borderColor: '#111', background: '#09090a' }}>
        <div className="max-w-6xl mx-auto">
          <SectionLabel>SOLUTIONS</SectionLabel>
          <h1 className="text-3xl sm:text-4xl font-black" style={{ color: '#f0f0f0', letterSpacing: '-0.01em' }}>
            配套产品
          </h1>
        </div>
      </div>

      {/* ── AB SECTION HEADER ── */}
      <div className="max-w-6xl mx-auto px-6 sm:px-10 pt-14 pb-4">
        <p className="text-[9px] tracking-[0.4em] uppercase font-bold mb-4" style={{ color: CYAN, fontFamily: MONO }}>
          {'// SERIES 01'}
        </p>
        <h2 className="text-2xl sm:text-3xl font-black" style={{ color: '#f0f0f0' }}>
          配套产品 <span style={{ color: RED }}>AB剂</span>
        </h2>
      </div>

      {/* Intro image + desc */}
      <section className="max-w-6xl mx-auto px-6 sm:px-10 py-10 grid md:grid-cols-2 gap-10 items-center">
        <div className="overflow-hidden" style={{ border: '1px solid #1a1a1a' }}>
          <img
            src="/cosmocoat/support-ab-top.png"
            alt="AB剂"
            className="w-full max-w-lg mx-auto"
            style={{ filter: 'grayscale(15%) brightness(0.8)' }}
          />
        </div>
        <div className="space-y-5">
          <p className="text-[9px] font-bold tracking-[0.35em] uppercase" style={{ color: RED, fontFamily: MONO }}>
            {'// PROBLEM'}
          </p>
          <h2 className="text-2xl sm:text-3xl font-black" style={{ color: '#f0f0f0' }}>废油水混合物</h2>
          <div className="w-12 h-px" style={{ background: `linear-gradient(90deg, ${RED}, transparent)`, boxShadow: `0 0 6px ${RED}` }} />
          <p className="text-sm leading-relaxed" style={{ color: '#555' }}>
            平常我们在喷涂时水廉柜中的废油水混合物，需要做到处理。
          </p>
        </div>
      </section>

      {/* A剂 */}
      <div style={{ borderTop: '1px solid #111', background: '#09090a' }}>
        <ChemCard
          img="/cosmocoat/support-ab-a.png"
          title="A剂"
          desc="废油水混合物加入A剂后充分搅拌，废油水开始反应结合，达到油水分离。"
          align="right"
          accent={CYAN}
        />
      </div>

      {/* B剂 */}
      <div style={{ borderTop: '1px solid #111' }}>
        <ChemCard
          img="/cosmocoat/support-ab-b.png"
          title="B剂"
          desc="加入B剂后，废油开始结合，形成油块，方便清理。"
          align="left"
          accent={RED}
        />
      </div>

      {/* Divider line */}
      <div
        className="w-full h-px"
        style={{
          background: `linear-gradient(90deg, transparent, ${RED}, ${CYAN}, transparent)`,
          boxShadow: `0 0 12px rgba(255,34,0,0.3)`,
        }}
      />

      {/* ── PIGMENT SECTION ── */}
      <div className="max-w-6xl mx-auto px-6 sm:px-10 pt-14 pb-4" style={{ borderTop: '1px solid #111' }}>
        <p className="text-[9px] tracking-[0.4em] uppercase font-bold mb-4" style={{ color: CYAN, fontFamily: MONO }}>
          {'// SERIES 02'}
        </p>
        <h2 className="text-2xl sm:text-3xl font-black" style={{ color: '#f0f0f0' }}>
          高浓度<span style={{ color: CYAN }}>色精</span>/<span style={{ color: RED }}>色浆</span>
        </h2>
      </div>

      <section className="max-w-6xl mx-auto px-6 sm:px-10 pb-20 grid md:grid-cols-2 gap-6">
        {[
          { label: '色精', img: '/cosmocoat/support-pigment-left.png', accent: CYAN },
          { label: '色浆', img: '/cosmocoat/support-pigment-right.png', accent: RED },
        ].map(item => (
          <div key={item.label} className="relative overflow-hidden group" style={{ border: '1px solid #1a1a1a', borderTop: `3px solid ${item.accent}` }}>
            <div
              className="absolute top-3 left-4 z-10 text-2xl font-black"
              style={{
                color: item.accent,
                fontFamily: MONO,
                textShadow: `0 0 12px ${item.accent}`,
              }}
            >
              {item.label}
            </div>
            <img
              src={item.img}
              alt={item.label}
              className="w-full transition-transform duration-500 group-hover:scale-[1.03]"
              style={{ filter: 'grayscale(10%) brightness(0.75)' }}
            />
          </div>
        ))}
      </section>

    </div>
  )
}
