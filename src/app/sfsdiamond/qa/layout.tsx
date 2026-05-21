import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Memorial Diamond Q&A',
  description: 'Answers to common questions about creating SFS memorial diamonds from ashes or hair, including materials, timing, colour and traceability.',
  alternates: { canonical: '/sfsdiamond/qa' },
}

export default function SFSQaLayout({ children }: { children: React.ReactNode }) {
  return children
}
