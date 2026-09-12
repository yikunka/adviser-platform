import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth/auth'
import { FeedbackWidget } from '@/components/feedback/FeedbackWidget'
import { getSfsAccountAccess } from '@/lib/sfs/account-approval'
import SfsPendingApprovalNotice from '../components/SfsPendingApprovalNotice'

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
}

export default async function SFSDashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session) redirect('/sfsdiamond/login')
  if (session.user.platform !== 'SFS_DIAMOND') redirect('/sfsdiamond/login')

  const access = await getSfsAccountAccess(session.user.id, session.user.platform)
  if (!access.approved) {
    return (
      <>
        <SfsPendingApprovalNotice status={access.status} name={session.user.name} />
        <FeedbackWidget locale="en" />
      </>
    )
  }

  return (
    <>
      {children}
      <FeedbackWidget locale="en" />
    </>
  )
}
