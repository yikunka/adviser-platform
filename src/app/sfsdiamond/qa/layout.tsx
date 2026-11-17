import type { Metadata } from 'next'
import { sfsPageMetadata } from '@/lib/seo'

export const metadata: Metadata = sfsPageMetadata({
  title: 'Memorial Diamond Q&A',
  description:
    'Answers to common questions about creating SFS memorial diamonds from ashes or hair, including materials, timing, colour and traceability.',
  path: '/sfsdiamond/qa',
})

export default function SFSQaLayout({ children }: { children: React.ReactNode }) {
  return children
}
