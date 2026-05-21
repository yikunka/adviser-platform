import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth/auth'

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
}

export default async function SFSOrderLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session || session.user.platform !== 'SFS_DIAMOND') {
    redirect('/sfsdiamond/login')
  }
  return <>{children}</>
}
