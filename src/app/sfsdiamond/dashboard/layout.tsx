import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth/auth'

export default async function SFSDashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session) redirect('/sfsdiamond/login')
  // Ensure the user belongs to the SFS Diamond platform
  if (session.user.platform !== 'SFS_DIAMOND') redirect('/sfsdiamond/login')
  return <>{children}</>
}
