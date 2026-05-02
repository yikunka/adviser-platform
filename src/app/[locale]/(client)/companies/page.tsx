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
    where: { clientUserId: session.user.id },
    select: { id: true, nameEn: true, nameZh: true, companyNumber: true, status: true, annualReturnDate: true },
    orderBy: { createdAt: 'desc' },
  })

  return (
    <div className="p-6 space-y-4 max-w-4xl">
      <h1 className="text-2xl font-bold" style={{ color: '#F0EAD8' }}>My Companies</h1>

      {companies.length === 0 ? (
        <p className="text-sm" style={{ color: '#5A5040' }}>No companies assigned to your account yet.</p>
      ) : (
        <div className="rounded-lg overflow-hidden" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="text-left px-4 py-3 text-sm font-medium text-[#7A7060] bg-[#1A1A12] border-b border-[#2A2418]">Company Name</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-[#7A7060] bg-[#1A1A12] border-b border-[#2A2418]">Co. No.</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-[#7A7060] bg-[#1A1A12] border-b border-[#2A2418]">Status</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-[#7A7060] bg-[#1A1A12] border-b border-[#2A2418]">Annual Return</th>
                <th className="px-4 py-3 bg-[#1A1A12] border-b border-[#2A2418]" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2A2418]">
              {companies.map(c => (
                <tr key={c.id} className="hover:bg-[#1A1A12] transition-colors">
                  <td className="px-4 py-3 font-medium" style={{ color: '#F0EAD8' }}>
                    {c.nameEn}
                    {c.nameZh && <span className="block text-xs mt-0.5" style={{ color: '#7A7060' }}>{c.nameZh}</span>}
                  </td>
                  <td className="px-4 py-3 text-sm" style={{ color: '#9A8060' }}>{c.companyNumber ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${c.status === 'ACTIVE' ? 'bg-[rgba(16,185,129,0.12)] text-[#10b981]' : 'bg-[rgba(120,113,108,0.15)] text-[#9A8060]'}`}>
                      {c.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm" style={{ color: '#9A8060' }}>
                    {c.annualReturnDate ? new Date(c.annualReturnDate).toLocaleDateString('en-HK') : '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/companies/${c.id}`} className="text-xs hover:underline" style={{ color: '#C9A96E' }}>View →</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
