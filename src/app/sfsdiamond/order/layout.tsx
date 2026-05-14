import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth/auth'

export default async function SFSOrderLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session || session.user.platform !== 'SFS_DIAMOND') {
    redirect('/sfsdiamond/login')
  }
  return <>{children}</>
}
