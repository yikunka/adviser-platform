import { auth } from '@/lib/auth/auth'
import { prisma } from '@/lib/db/prisma'
import { redirect } from 'next/navigation'
import { Link } from '@/i18n/navigation'

type Props = { params: Promise<{ locale: string }> }

export default async function ClientCompaniesPage({ params }: Props) {
  const session = await auth()
  const { locale } = await params

  if (!session) redirect(`/${locale}/login`)

  const companies = await prisma.company.findMany({
    where: {
      OR: [
        { clientUserId: session.user.id },
        { pendingClientEmail: session.user.email.toLowerCase() },
      ],
    },
    select: { id: true, nameEn: true, nameZh: true, companyNumber: true, status: true, annualReturnDate: true },
    orderBy: { createdAt: 'desc' },
  })

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold" style={{ color: '#F0EAD8' }}>My Companies</h1>

      {companies.length === 0 ? (
        <p className="text-sm" style={{ color: '#5A5040' }}>No companies assigned to your account yet.</p>
      ) : (
        <div className="rounded-lg overflow-hidden" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          <div className="grid grid-cols-[1.5fr_9rem_9rem_11rem_5rem] px-4 py-3 text-sm font-medium text-[#7A7060] bg-[#1A1A12] border-b border-[#2A2418]">
            <span>Company Name</span>
            <span>Co. No.</span>
            <span>Status</span>
            <span>Annual Return</span>
            <span />
          </div>
          <div className="divide-y divide-[#2A2418]">
            {companies.map(c => (
              <Link
                key={c.id}
                href={`/companies/${c.id}`}
                className="grid grid-cols-[1.5fr_9rem_9rem_11rem_5rem] items-center px-4 py-3 text-sm transition-colors hover:bg-[#1A1A12]"
              >
                <div className="font-medium" style={{ color: '#F0EAD8' }}>
                    {c.nameEn}
                    {c.nameZh && <span className="block text-xs mt-0.5" style={{ color: '#7A7060' }}>{c.nameZh}</span>}
                </div>
                <span style={{ color: '#9A8060' }}>{c.companyNumber ?? '—'}</span>
                <span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${c.status === 'ACTIVE' ? 'bg-[rgba(16,185,129,0.12)] text-[#10b981]' : 'bg-[rgba(120,113,108,0.15)] text-[#9A8060]'}`}>
                    {c.status}
                  </span>
                </span>
                <span style={{ color: '#9A8060' }}>
                  {c.annualReturnDate ? new Date(c.annualReturnDate).toLocaleDateString('en-HK') : '—'}
                </span>
                <span className="text-right text-xs" style={{ color: '#C9A96E' }}>View →</span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
