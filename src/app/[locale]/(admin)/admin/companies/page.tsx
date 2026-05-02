'use client'

import { useEffect, useState, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { useParams } from 'next/navigation'
import { toast } from 'sonner'
import { Link } from '@/i18n/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'

type Company = {
  id: string
  nameEn: string
  nameZh?: string
  companyNumber: string
  status: string
  serviceTier?: string
  annualReturnDate?: string
  assignedStaff?: { nameEn: string }
  clientUser?: { nameEn: string; email: string }
}

const STATUS_COLOR: Record<string, string> = {
  ACTIVE:       'bg-[rgba(16,185,129,0.12)] text-[#10b981]',
  DORMANT:      'bg-[rgba(234,179,8,0.12)] text-[#eab308]',
  STRUCK_OFF:   'bg-[rgba(239,68,68,0.12)] text-[#ef4444]',
  DEREGISTERED: 'bg-[rgba(120,113,108,0.15)] text-[#9A8060]',
}

export default function CompaniesPage() {
  const t = useTranslations('admin.companies')
  const params = useParams()
  const locale = (params.locale as string) ?? 'zh'
  const [companies, setCompanies] = useState<Company[]>([])
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)

  const fetchCompanies = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/companies?q=${encodeURIComponent(search)}&page=${page}`)
      const json = await res.json()
      setCompanies(json.companies ?? [])
      setTotal(json.total ?? 0)
    } catch {
      toast.error('Failed to load companies')
    } finally {
      setLoading(false)
    }
  }, [search, page])

  useEffect(() => { fetchCompanies() }, [fetchCompanies])

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>{t('title')}</h1>
        <Link href="/admin/companies/new">
          <Button>{t('add')}</Button>
        </Link>
      </div>

      <div className="flex gap-2">
        <Input
          placeholder={t('search')}
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1) }}
          className="max-w-xs"
        />
      </div>

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead style={{ background: '#1A1A12', borderBottom: '1px solid #2A2418' }}>
              <tr>
                <th className="px-4 py-3 text-left font-medium" style={{ color: 'var(--muted-foreground)' }}>{t('companyName')}</th>
                <th className="px-4 py-3 text-left font-medium" style={{ color: 'var(--muted-foreground)' }}>{t('companyNumber')}</th>
                <th className="px-4 py-3 text-left font-medium" style={{ color: 'var(--muted-foreground)' }}>{t('status')}</th>
                <th className="px-4 py-3 text-left font-medium" style={{ color: 'var(--muted-foreground)' }}>{t('client')}</th>
                <th className="px-4 py-3 text-left font-medium" style={{ color: 'var(--muted-foreground)' }}>{t('arDate')}</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2A2418]">
              {loading ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center" style={{ color: 'var(--muted-foreground)' }}>Loading...</td></tr>
              ) : companies.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center" style={{ color: 'var(--muted-foreground)' }}>{t('empty')}</td></tr>
              ) : companies.map(c => (
                <tr key={c.id} className="transition-colors hover:bg-[#1A1A12]">
                  <td className="px-4 py-3">
                    <p className="font-medium" style={{ color: 'var(--foreground)' }}>{c.nameEn}</p>
                    {c.nameZh && <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{c.nameZh}</p>}
                  </td>
                  <td className="px-4 py-3" style={{ color: 'var(--muted-foreground)' }}>{c.companyNumber}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOR[c.status] ?? ''}`}>
                      {c.status}
                    </span>
                  </td>
                  <td className="px-4 py-3" style={{ color: 'var(--muted-foreground)' }}>{c.clientUser?.nameEn ?? '—'}</td>
                  <td className="px-4 py-3" style={{ color: 'var(--muted-foreground)' }}>
                    {c.annualReturnDate ? new Date(c.annualReturnDate).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/admin/companies/${c.id}`}>
                      <Button size="sm" variant="outline">{t('view')}</Button>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Pagination */}
      {total > 20 && (
        <div className="flex justify-between items-center text-sm" style={{ color: 'var(--muted-foreground)' }}>
          <p>Total: {total}</p>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
            <Button size="sm" variant="outline" disabled={page * 20 >= total} onClick={() => setPage(p => p + 1)}>Next</Button>
          </div>
        </div>
      )}
    </div>
  )
}
