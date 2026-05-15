import type { Metadata } from 'next'
import CosmoHeader from './components/CosmoHeader'
import CosmoFooter from './components/CosmoFooter'

export const metadata: Metadata = {
  title: 'COSMOCOAT 威栩 — 工业涂料',
  description: '威栩（COSMO.COAT）专业工业涂料企业，UV水漆技术先驱，环保水性涂料解决方案。',
}

export default function CosmoLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style>{`
        @keyframes cosmo-flicker {
          0%, 94%, 96%, 100% { opacity: 1; }
          95% { opacity: 0.88; }
        }
        .cosmo-root { animation: cosmo-flicker 12s ease-in-out infinite; }
      `}</style>
      <div
        className="cosmo-root min-h-screen flex flex-col relative"
        style={{
          background: '#080808',
          color: '#f0f0f0',
          fontFamily: '"Microsoft YaHei", "PingFang SC", sans-serif',
        }}
      >
        {/* Scanline / CRT texture */}
        <div
          className="fixed inset-0 pointer-events-none"
          style={{
            zIndex: 9998,
            backgroundImage:
              'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.16) 3px, rgba(0,0,0,0.16) 4px)',
          }}
        />
        {/* Edge vignette */}
        <div
          className="fixed inset-0 pointer-events-none"
          style={{
            zIndex: 9997,
            background:
              'radial-gradient(ellipse 100% 100% at 50% 50%, transparent 50%, rgba(0,0,0,0.5) 100%)',
          }}
        />
        <CosmoHeader />
        <main className="flex-1 relative z-0">{children}</main>
        <CosmoFooter />
      </div>
    </>
  )
}
