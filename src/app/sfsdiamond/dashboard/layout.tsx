import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth/auth'
import { FeedbackWidget } from '@/components/feedback/FeedbackWidget'

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
}

export default async function SFSDashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session) redirect('/sfsdiamond/login')
  // Ensure the user belongs to the SFS Diamond platform
  if (session.user.platform !== 'SFS_DIAMOND') redirect('/sfsdiamond/login')
  return (
    <>
      {children}
      <FeedbackWidget locale="en" />
    </>
  )
}
