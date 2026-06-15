import type { Metadata, Viewport } from 'next'
import { absoluteUrl, sfsSeo } from '@/lib/seo'
import SFSHeader from './components/SFSHeader'
import SFSFooter from './components/SFSFooter'
import SFSProviders from './components/SFSProviders'
import SFSChatWidget from './components/SFSChatWidget'

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export const metadata: Metadata = {
  title: {
    default: sfsSeo.title,
    template: '%s | SFS Diamond',
  },
  description: sfsSeo.description,
  keywords: sfsSeo.keywords,
  alternates: {
    canonical: '/sfsdiamond',
  },
  openGraph: {
    title: sfsSeo.title,
    description: sfsSeo.description,
    url: absoluteUrl('/sfsdiamond'),
    siteName: 'SFS Diamond',
    type: 'website',
    locale: 'en_HK',
    images: [{ url: absoluteUrl(sfsSeo.image), width: 1200, height: 630, alt: 'SFS Diamond memorial diamond' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: sfsSeo.title,
    description: sfsSeo.description,
    images: [absoluteUrl(sfsSeo.image)],
  },
}

export default function SFSDiamondLayout({ children }: { children: React.ReactNode }) {
  return (
    <SFSProviders>
      <div className="sfs-root min-h-screen flex flex-col" style={{ background: '#FAFAF8', color: '#1A1A1A' }}>
        <SFSHeader />
        <main className="flex-1">{children}</main>
        <SFSFooter />
        <SFSChatWidget />
      </div>
    </SFSProviders>
  )
}
