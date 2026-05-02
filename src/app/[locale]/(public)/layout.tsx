import PublicHeader from '@/components/layout/PublicHeader'
import PublicFooter from '@/components/layout/PublicFooter'

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{ background: '#0C0C0C', color: '#F0EAD8' }}
      className="theme-dark flex min-h-screen flex-col"
    >
      <PublicHeader />
      <main className="flex-1">{children}</main>
      <PublicFooter />
    </div>
  )
}
