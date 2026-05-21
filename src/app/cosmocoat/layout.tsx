import type { Metadata } from 'next'
import { absoluteUrl, cosmoSeo } from '@/lib/seo'
import CosmoHeader from './components/CosmoHeader'
import CosmoFooter from './components/CosmoFooter'

export const metadata: Metadata = {
  title: {
    default: cosmoSeo.title,
    template: '%s | CosmoCoat',
  },
  description: cosmoSeo.description,
  keywords: cosmoSeo.keywords,
  alternates: {
    canonical: '/cosmocoat',
  },
  openGraph: {
    title: cosmoSeo.title,
    description: cosmoSeo.description,
    url: absoluteUrl('/cosmocoat'),
    siteName: 'CosmoCoat',
    type: 'website',
    locale: 'zh_CN',
    images: [{ url: absoluteUrl(cosmoSeo.image), width: 1200, height: 630, alt: 'CosmoCoat industrial coatings' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: cosmoSeo.title,
    description: cosmoSeo.description,
    images: [absoluteUrl(cosmoSeo.image)],
  },
}

export default function CosmoLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style>{`
        @keyframes cosmo-flicker {
          0%, 94%, 96%, 100% { opacity: 1; }
          95% { opacity: 0.96; }
        }
        .cosmo-root {
          animation: cosmo-flicker 12s ease-in-out infinite;
          -webkit-font-smoothing: antialiased;
          text-rendering: optimizeLegibility;
        }

        /* Hero — primary dark veil, irregular opacity pulse */
        @keyframes cosmo-veil {
          0%   { opacity: 0.80; }
          7%   { opacity: 0.40; }
          13%  { opacity: 0.78; }
          20%  { opacity: 0.18; }
          26%  { opacity: 0.68; }
          31%  { opacity: 0.88; }
          36%  { opacity: 0.36; }
          42%  { opacity: 0.74; }
          47%  { opacity: 0.94; }
          53%  { opacity: 0.22; }
          59%  { opacity: 0.72; }
          65%  { opacity: 0.10; }
          70%  { opacity: 0.84; }
          76%  { opacity: 0.40; }
          82%  { opacity: 0.76; }
          88%  { opacity: 0.28; }
          94%  { opacity: 0.82; }
          100% { opacity: 0.80; }
        }

        /* Hero — secondary spotlight vignette, different phase */
        @keyframes cosmo-veil-b {
          0%   { opacity: 0.52; }
          11%  { opacity: 0.14; }
          22%  { opacity: 0.66; }
          33%  { opacity: 0.06; }
          44%  { opacity: 0.58; }
          55%  { opacity: 0.74; }
          66%  { opacity: 0.18; }
          77%  { opacity: 0.62; }
          88%  { opacity: 0.08; }
          100% { opacity: 0.52; }
        }

        /* Hero — horizontal scanline sweep */
        @keyframes cosmo-scanline {
          0%   { top: -3px;   opacity: 0; }
          3%   { opacity: 1; }
          97%  { opacity: 0.5; }
          100% { top: 100%;  opacity: 0; }
        }

        /* Hero — secondary scanline, offset */
        @keyframes cosmo-scanline-b {
          0%   { top: -3px;  opacity: 0; }
          3%   { opacity: 0.6; }
          97%  { opacity: 0.2; }
          100% { top: 100%; opacity: 0; }
        }
      `}</style>
      <div
        className="cosmo-root min-h-screen flex flex-col relative"
        style={{
          background: '#080808',
          color: '#f0f0f0',
          fontFamily: '"Microsoft YaHei", "PingFang SC", "Noto Sans SC", sans-serif',
          lineHeight: 1.55,
        }}
      >
        {/* Scanline / CRT texture */}
        <div
          className="fixed inset-0 pointer-events-none"
          style={{
            zIndex: 9998,
            backgroundImage:
              'repeating-linear-gradient(0deg, transparent, transparent 4px, rgba(0,0,0,0.055) 4px, rgba(0,0,0,0.055) 5px)',
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
