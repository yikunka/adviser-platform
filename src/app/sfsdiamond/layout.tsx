import type { Metadata } from 'next'
import SFSHeader from './components/SFSHeader'
import SFSFooter from './components/SFSFooter'
import SFSProviders from './components/SFSProviders'

export const metadata: Metadata = {
  title: 'SFS Diamond — Memorial Diamonds Hong Kong',
  description:
    'SFS Technology transforms cremated ashes and hair into certified lab-grown memorial diamonds using advanced CVD technology. Headquartered in Hong Kong.',
}

export default function SFSDiamondLayout({ children }: { children: React.ReactNode }) {
  return (
    <SFSProviders>
      <div className="sfs-root min-h-screen flex flex-col" style={{ background: '#FAFAF8', color: '#1A1A1A' }}>
        <SFSHeader />
        <main className="flex-1">{children}</main>
        <SFSFooter />
      </div>
    </SFSProviders>
  )
}
