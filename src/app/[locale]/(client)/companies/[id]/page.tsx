import { auth } from '@/lib/auth/auth'
import { prisma } from '@/lib/db/prisma'
import { notFound, redirect } from 'next/navigation'
import { Link } from '@/i18n/navigation'

type Props = { params: Promise<{ locale: string; id: string }> }

const thStyle = 'text-left px-4 py-3 text-sm font-medium text-[#7A7060] bg-[#1A1A12] border-b border-[#2A2418]'
const tdStyle = 'px-4 py-3 text-sm text-[#9A8060]'
const tdPrimary = 'px-4 py-3 text-sm font-medium text-[#F0EAD8]'
const cardStyle: React.CSSProperties = { background: 'var(--card)', border: '1px solid var(--border)' }

const STATUTORY_DOCS = [
  { type: 'CI', label: 'Certificate of Incorporation (CI)' },
  { type: 'NNC1', label: 'Incorporation Form (NNC1)' },
  { type: 'AA', label: 'Articles of Association (AA)' },
  { type: 'BR', label: 'Business Registration Certificate (BR)' },
] as const

const REGISTER_DOCS = {
  directors: { type: 'ROD', label: 'Register of Directors' },
  members: { type: 'ROM', label: 'Register of Members' },
  controllers: { type: 'ROSC', label: 'Register of Significant Controllers' },
} as const

function fmt(d: Date | null | undefined) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-HK')
}

function fmtMonthDay(d: Date | null | undefined) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-HK', { month: 'short', day: 'numeric' })
}

function docHref(id: string) {
  return `/api/documents/${id}/download?redirect=1`
}

function DownloadLink({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <a
      href={docHref(id)}
      className="inline-flex items-center rounded-md border px-2.5 py-1.5 text-xs font-medium hover:underline"
      style={{ borderColor: '#2A2418', color: '#C9A96E' }}
    >
      {children}
    </a>
  )
}

function EmptyDocRow({ children }: { children: React.ReactNode }) {
  return <p className="px-4 py-3 text-sm" style={{ color: '#5A5040' }}>{children}</p>
}

function docYear(doc: { effectiveDate: Date | null; notes: string | null }) {
  if (doc.effectiveDate) return String(new Date(doc.effectiveDate).getFullYear())
  return doc.notes?.match(/\d{4}/)?.[0] ?? 'Unknown'
}

function ClientYearGroupedDocList({
  docs,
}: {
  docs: Array<{ id: string; name: string; createdAt: Date; notes: string | null; effectiveDate: Date | null }>
}) {
  const groups = docs.reduce<Record<string, typeof docs>>((acc, doc) => {
    const year = docYear(doc)
    ;(acc[year] ??= []).push(doc)
    return acc
  }, {})
  const years = Object.keys(groups).sort((a, b) => Number(b) - Number(a))

  if (years.length === 0) return <EmptyDocRow>No files uploaded yet.</EmptyDocRow>

  return (
    <>
      {years.map(year => (
        <div key={year} style={{ borderTop: '1px solid #2A2418' }}>
          <div className="px-4 py-2.5 text-sm font-medium" style={{ color: '#F0EAD8' }}>
            {year}
            <span className="ml-2 text-xs font-normal" style={{ color: '#5A5040' }}>
              {groups[year].length} file{groups[year].length !== 1 ? 's' : ''}
            </span>
          </div>
          <ul className="divide-y divide-[#2A2418]">
            {groups[year].map(doc => (
              <li key={doc.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <span className="min-w-0 truncate text-sm" style={{ color: '#F0EAD8' }}>{doc.name}</span>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-xs" style={{ color: '#5A5040' }}>{fmt(doc.createdAt)}</span>
                  <DownloadLink id={doc.id}>Download</DownloadLink>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </>
  )
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
      documents: { where: { deletedAt: null }, orderBy: { createdAt: 'desc' } },
    },
  })

  const ownsCompany = company
    && (company.clientUserId === session.user.id || company.pendingClientEmail === session.user.email.toLowerCase())
  if (!company || !ownsCompany) notFound()

  const sections = [
    { label: 'Registered Address', value: company.registeredAddress ?? '—' },
    { label: 'Date of Incorporation', value: company.dateOfIncorporation ? fmt(company.dateOfIncorporation) : '—' },
    { label: 'Business Nature', value: company.businessNature ?? '—' },
    { label: 'Annual Return Day', value: fmtMonthDay(company.annualReturnDate) },
  ]
  const isGeneratedDoc = (doc: typeof company.documents[number]) => doc.name.startsWith(`${doc.documentType} —`)
  const latestGeneratedDoc = (docType: string) => company.documents.find(d => d.documentType === docType && isGeneratedDoc(d))
  const annualReturnPrefill = latestGeneratedDoc('NAR1')

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

      {/* Overview documents */}
      <section className="space-y-4">
        {STATUTORY_DOCS.map(({ type, label }) => {
          const docs = company.documents.filter(d => d.documentType === type && !isGeneratedDoc(d))
          return (
            <div key={type} className="rounded-lg overflow-hidden" style={cardStyle}>
              <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid #2A2418' }}>
                <span className="text-sm font-semibold" style={{ color: '#F0EAD8' }}>{label}</span>
              </div>
              {docs.length === 0 ? (
                <EmptyDocRow>No files uploaded yet.</EmptyDocRow>
              ) : (
                <ul className="divide-y divide-[#2A2418]">
                  {docs.map(doc => (
                    <li key={doc.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                      <span className="min-w-0 truncate text-sm" style={{ color: '#F0EAD8' }}>{doc.name}</span>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="text-xs" style={{ color: '#5A5040' }}>{fmt(doc.createdAt)}</span>
                        <DownloadLink id={doc.id}>Download</DownloadLink>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )
        })}

        <div className="rounded-lg overflow-hidden" style={cardStyle}>
          <div className="px-4 py-3" style={{ borderBottom: '1px solid #2A2418' }}>
            <span className="text-sm font-semibold" style={{ color: '#F0EAD8' }}>Annual Return (NAR1)</span>
          </div>
          {company.documents.filter(d => d.documentType === 'NAR1' && !isGeneratedDoc(d)).length === 0 ? (
            <EmptyDocRow>No NAR1 files uploaded yet.</EmptyDocRow>
          ) : (
            <ul className="divide-y divide-[#2A2418]">
              {company.documents.filter(d => d.documentType === 'NAR1' && !isGeneratedDoc(d)).map(doc => (
                <li key={doc.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <div className="min-w-0">
                    <span className="block truncate text-sm" style={{ color: '#F0EAD8' }}>{doc.name}</span>
                    <span className="text-xs" style={{ color: '#5A5040' }}>{doc.notes ?? (doc.effectiveDate ? `Year: ${new Date(doc.effectiveDate).getFullYear()}` : 'Year not set')}</span>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-xs" style={{ color: '#5A5040' }}>{fmt(doc.createdAt)}</span>
                    <DownloadLink id={doc.id}>Download</DownloadLink>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-lg overflow-hidden" style={cardStyle}>
          <div className="px-4 py-3" style={{ borderBottom: '1px solid #2A2418' }}>
            <span className="text-sm font-semibold" style={{ color: '#F0EAD8' }}>Audit and Tax Computation</span>
            <p className="text-xs mt-1" style={{ color: '#5A5040' }}>Files are grouped by year. Multiple files per year may be available.</p>
          </div>
          <ClientYearGroupedDocList
            docs={company.documents.filter(d => d.documentType === 'AUDIT_TAX' && !isGeneratedDoc(d))}
          />
        </div>

        <div className="rounded-lg p-4 space-y-3" style={cardStyle}>
          <div>
            <h3 className="text-sm font-semibold" style={{ color: '#F0EAD8' }}>Annual Return Pre-fill</h3>
            <p className="text-xs mt-1" style={{ color: '#5A5040' }}>
              {annualReturnPrefill ? `Latest prepared ${fmt(annualReturnPrefill.createdAt)}` : 'The pre-fill document will appear when it is ready.'}
            </p>
          </div>
          {annualReturnPrefill ? <DownloadLink id={annualReturnPrefill.id}>Download NAR1</DownloadLink> : <p className="text-sm" style={{ color: '#5A5040' }}>Not ready yet.</p>}
        </div>
      </section>

      {/* Directors */}
      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: '#7A7060' }}>Directors ({company.directors.length})</h2>
          {latestGeneratedDoc(REGISTER_DOCS.directors.type) ? (
            <DownloadLink id={latestGeneratedDoc(REGISTER_DOCS.directors.type)!.id}>Download ROD</DownloadLink>
          ) : null}
        </div>
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
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: '#7A7060' }}>Members ({company.members.length})</h2>
          {latestGeneratedDoc(REGISTER_DOCS.members.type) ? (
            <DownloadLink id={latestGeneratedDoc(REGISTER_DOCS.members.type)!.id}>Download ROM</DownloadLink>
          ) : null}
        </div>
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
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: '#7A7060' }}>Significant Controllers ({company.significantControllers.length})</h2>
          {latestGeneratedDoc(REGISTER_DOCS.controllers.type) ? (
            <DownloadLink id={latestGeneratedDoc(REGISTER_DOCS.controllers.type)!.id}>Download ROSC</DownloadLink>
          ) : null}
        </div>
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
