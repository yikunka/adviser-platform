import { auth } from '@/lib/auth/auth'
import { prisma } from '@/lib/db/prisma'
import { notFound, redirect } from 'next/navigation'
import { Link } from '@/i18n/navigation'

type Props = { params: Promise<{ locale: string; id: string }> }

const thStyle = 'text-left px-4 py-3 text-sm font-medium text-[#7A7060] bg-[#1A1A12] border-b border-[#2A2418]'
const tdStyle = 'px-4 py-3 text-sm text-[#9A8060]'
const tdPrimary = 'px-4 py-3 text-sm font-medium text-[#F0EAD8]'

function fmt(d: Date | null | undefined) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-HK')
}

export default async function ClientCompanyDetailPage({ params }: Props) {
  const session = await auth()
  const { locale, id } = await params

  if (!session) redirect(`/${locale}/login`)

  const company = await prisma.company.findUnique({
    where: { id },
    include: {
      directors: { orderBy: { dateOfAppointment: 'desc' } },
      members: { orderBy: { createdAt: 'desc' } },
      significantControllers: { orderBy: { becomingDate: 'desc' } },
    },
  })

  if (!company || company.clientUserId !== session.user.id) notFound()

  const sections = [
    { label: 'Registered Address', value: company.registeredAddress ?? '—' },
    { label: 'Date of Incorporation', value: company.dateOfIncorporation ? fmt(company.dateOfIncorporation) : '—' },
    { label: 'Business Nature', value: company.businessNature ?? '—' },
    { label: 'Annual Return Date', value: company.annualReturnDate ? fmt(company.annualReturnDate) : '—' },
  ]

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <Link href="/companies" className="text-sm mb-2 block" style={{ color: '#7A7060' }}>← Back to Companies</Link>
        <h1 className="text-2xl font-bold" style={{ color: '#F0EAD8' }}>{company.nameEn}</h1>
        {company.nameZh && <p className="mt-0.5 text-sm" style={{ color: '#9A8060' }}>{company.nameZh}</p>}
        {company.companyNumber && <p className="text-xs mt-1" style={{ color: '#5A5040' }}>Co. No. {company.companyNumber}</p>}
      </div>

      {/* Overview */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide mb-3" style={{ color: '#7A7060' }}>Overview</h2>
        <div className="rounded-lg overflow-hidden divide-y divide-[#2A2418]" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          {sections.map(({ label, value }) => (
            <div key={label} className="flex px-4 py-3">
              <span className="w-52 shrink-0 text-sm font-medium" style={{ color: '#7A7060' }}>{label}</span>
              <span className="text-sm" style={{ color: '#F0EAD8' }}>{value}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Directors */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide mb-3" style={{ color: '#7A7060' }}>Directors ({company.directors.length})</h2>
        <div className="rounded-lg overflow-hidden" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className={thStyle}>Name</th>
                <th className={thStyle}>Appointed</th>
                <th className={thStyle}>Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2A2418]">
              {company.directors.map(d => (
                <tr key={d.id}>
                  <td className={tdPrimary}>{d.nameEn}{d.nameZh ? ` (${d.nameZh})` : ''}</td>
                  <td className={tdStyle}>{fmt(d.dateOfAppointment)}</td>
                  <td className={tdStyle}>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${d.status === 'ACTIVE' ? 'bg-[rgba(16,185,129,0.12)] text-[#10b981]' : 'bg-[rgba(120,113,108,0.15)] text-[#9A8060]'}`}>
                      {d.status}
                    </span>
                  </td>
                </tr>
              ))}
              {company.directors.length === 0 && (
                <tr><td colSpan={3} className="px-4 py-6 text-center text-sm" style={{ color: '#5A5040' }}>No directors on record</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Members */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide mb-3" style={{ color: '#7A7060' }}>Members ({company.members.length})</h2>
        <div className="rounded-lg overflow-hidden" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className={thStyle}>Name</th>
                <th className={thStyle}>Share Class</th>
                <th className={thStyle}>Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2A2418]">
              {company.members.map(m => (
                <tr key={m.id}>
                  <td className={tdPrimary}>{m.nameEn}{m.nameZh ? ` (${m.nameZh})` : ''}</td>
                  <td className={tdStyle}>{m.shareClass}</td>
                  <td className={tdStyle}>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${m.status === 'ACTIVE' ? 'bg-[rgba(16,185,129,0.12)] text-[#10b981]' : 'bg-[rgba(120,113,108,0.15)] text-[#9A8060]'}`}>
                      {m.status}
                    </span>
                  </td>
                </tr>
              ))}
              {company.members.length === 0 && (
                <tr><td colSpan={3} className="px-4 py-6 text-center text-sm" style={{ color: '#5A5040' }}>No members on record</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Significant Controllers */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide mb-3" style={{ color: '#7A7060' }}>Significant Controllers ({company.significantControllers.length})</h2>
        <div className="rounded-lg overflow-hidden" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className={thStyle}>Name</th>
                <th className={thStyle}>Nature of Control</th>
                <th className={thStyle}>Becoming Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2A2418]">
              {company.significantControllers.map(sc => (
                <tr key={sc.id}>
                  <td className={tdPrimary}>{sc.nameEn}{sc.nameZh ? ` (${sc.nameZh})` : ''}</td>
                  <td className={tdStyle}>{sc.natureOfControl ?? '—'}</td>
                  <td className={tdStyle}>{fmt(sc.becomingDate)}</td>
                </tr>
              ))}
              {company.significantControllers.length === 0 && (
                <tr><td colSpan={3} className="px-4 py-6 text-center text-sm" style={{ color: '#5A5040' }}>No significant controllers on record</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
