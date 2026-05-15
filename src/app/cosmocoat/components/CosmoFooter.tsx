/* eslint-disable @next/next/no-img-element */
import Link from 'next/link'

const MONO = "'Courier New', Courier, monospace"
const RED = '#ff2200'
const CYAN = '#00d4ff'

export default function CosmoFooter() {
  return (
    <footer
      style={{
        background: '#060606',
        borderTop: `2px solid ${RED}`,
        boxShadow: `0 -1px 0 rgba(255,34,0,0.12), 0 -12px 40px rgba(0,0,0,0.7)`,
      }}
    >
      {/* Subtle grid pattern */}
      <div
        style={{
          backgroundImage: `
            linear-gradient(rgba(255,34,0,0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,34,0,0.04) 1px, transparent 1px)
          `,
          backgroundSize: '44px 44px',
        }}
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-14 grid grid-cols-1 md:grid-cols-3 gap-12">

          {/* Brand */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <img
                src="/cosmocoat/logo.png"
                alt="COSMOCOAT"
                className="h-9 w-auto object-contain"
                style={{ filter: 'drop-shadow(0 0 5px rgba(255,34,0,0.35)) brightness(1.1)' }}
              />
              <div className="flex flex-col leading-none">
                <span className="text-[11px] font-bold tracking-[0.3em] uppercase" style={{ color: RED, fontFamily: MONO }}>
                  COSMO.COAT
                </span>
                <span className="text-[9px] tracking-[0.2em] uppercase mt-0.5" style={{ color: '#2e2e2e', fontFamily: MONO }}>
                  INDUSTRIAL COATINGS
                </span>
              </div>
            </div>
            <p className="text-xs leading-relaxed" style={{ color: '#444' }}>
              威栩（COSMO.COAT）源自意大利，由紫外线水漆技术先驱 Davide Rossi 创立。
              专注环保水性涂料和高性能油漆研发、生产与技术服务。
            </p>
            <a
              href="http://www.cosmocoat.cn"
              className="text-[10px] tracking-widest uppercase hover:opacity-60 transition-opacity"
              style={{ color: '#2e2e2e', fontFamily: MONO }}
            >
              www.cosmocoat.cn
            </a>
          </div>

          {/* Navigation */}
          <div className="flex flex-col gap-3">
            <p className="text-[9px] font-bold tracking-[0.35em] uppercase mb-3" style={{ color: CYAN, fontFamily: MONO }}>
              {'// NAVIGATION'}
            </p>
            {[
              ['首页', '/cosmocoat'],
              ['关于我们', '/cosmocoat/about'],
              ['产品中心', '/cosmocoat/products'],
              ['配套产品', '/cosmocoat/supporting'],
            ].map(([label, href]) => (
              <Link
                key={href}
                href={href}
                className="text-[10px] tracking-[0.15em] uppercase hover:text-white transition-colors duration-150 flex items-center gap-1.5"
                style={{ color: '#444', fontFamily: MONO }}
              >
                <span style={{ color: '#252525' }}>{'→'}</span> {label}
              </Link>
            ))}
          </div>

          {/* Contact */}
          <div className="flex flex-col gap-3">
            <p className="text-[9px] font-bold tracking-[0.35em] uppercase mb-3" style={{ color: CYAN, fontFamily: MONO }}>
              {'// CONTACT'}
            </p>
            <div className="text-[10px] leading-relaxed space-y-3" style={{ fontFamily: MONO }}>
              <div>
                <p className="mb-0.5 uppercase tracking-wider" style={{ color: '#3a3a3a' }}>UV光固化 / 色漆</p>
                <p style={{ color: '#555' }}>黄先生 · +86 155 4686 8835</p>
                <p style={{ color: '#444' }}>skaiwong@gmail.com</p>
              </div>
              <div style={{ borderTop: '1px solid #111', paddingTop: '10px' }}>
                <p className="mb-0.5 uppercase tracking-wider" style={{ color: '#3a3a3a' }}>建筑水漆</p>
                <p style={{ color: '#555' }}>郭先生 · +86 189 0734 2249</p>
              </div>
              <div style={{ borderTop: '1px solid #111', paddingTop: '10px' }}>
                <p className="mb-0.5 uppercase tracking-wider" style={{ color: '#3a3a3a' }}>Italy HQ</p>
                <p style={{ color: '#555' }}>Davide Rossi · +39 331 996 6720</p>
              </div>
            </div>
            <div className="flex items-end gap-4 pt-2">
              <img
                src="/cosmocoat/wechat-qr.jpg"
                alt="微信二维码"
                className="w-20 h-20 object-cover rounded-sm"
                style={{ border: '1px solid #1c1c1c', background: '#111' }}
              />
              <a
                href="https://beian.miit.gov.cn/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[9px] tracking-wider hover:opacity-60 transition-opacity"
                style={{ color: '#222', fontFamily: MONO }}
              >
                鄂ICP备2023025236
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div
        className="px-4 sm:px-6 py-4 text-center text-[9px] tracking-[0.25em] uppercase"
        style={{ color: '#1e1e1e', fontFamily: MONO, borderTop: '1px solid #0d0d0d' }}
      >
        © {new Date().getFullYear()} COSMO.COAT · 威栩华兴 · ALL RIGHTS RESERVED
      </div>
    </footer>
  )
}
