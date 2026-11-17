import type { Metadata, Viewport } from 'next'
import { sfsPageMetadata, sfsSeo, sfsSiteUrl } from '@/lib/seo'
import SFSHeader from './components/SFSHeader'
import SFSFooter from './components/SFSFooter'
import SFSProviders from './components/SFSProviders'
import SFSChatWidget from './components/SFSChatWidget'

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

const homeMeta = sfsPageMetadata({
  title: sfsSeo.title,
  description: sfsSeo.description,
  path: '/sfsdiamond',
  image: sfsSeo.image,
})

export const metadata: Metadata = {
  metadataBase: sfsSiteUrl,
  applicationName: 'SFS Diamond',
  keywords: sfsSeo.keywords,
  authors: [{ name: 'SFS Diamond' }],
  creator: 'SFS Diamond',
  publisher: 'SFS Diamond',
  // `absolute` blocks root layout `%s | 6AM Advisory` from appending
  title: {
    absolute: sfsSeo.title,
    template: '%s | SFS Diamond',
  },
  description: homeMeta.description,
  alternates: homeMeta.alternates,
  openGraph: homeMeta.openGraph,
  twitter: homeMeta.twitter,
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
