'use client'

import { useEffect, useState, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { COMPANY_STATUS_LABELS } from '@/lib/company/company-status'
import {
  COMPANY_JURISDICTIONS,
  COMPANY_JURISDICTION_LABELS_ZH,
  companyJurisdictionLabelZh,
} from '@/lib/company/jurisdiction'
import { Link, useRouter } from '@/i18n/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'

type Company = {
  id: string
  companyCode?: string | null
  nameEn: string
  nameZh?: string
  companyNumber: string
  companyType?: string | null
  status: string
  serviceTier?: string
  financialEnabled: boolean
  dateOfIncorporation?: string | null
  assignedStaff?: { nameEn: string }
  financialManager?: { nameEn: string; email: string } | null
  clientUser?: { nameEn: string; email: string }
  ubos?: Array<{ nameEn: string; nameZh: string | null; effectivePercent: number }>
}

const STATUS_COLOR: Record<string, string> = {
  ACTIVE:       'bg-[rgba(16,185,129,0.12)] text-[#10b981]',
  INACTIVE:     'bg-[rgba(234,179,8,0.12)] text-[#eab308]',
  DEREGISTERED: 'bg-[rgba(120,113,108,0.15)] text-[#9A8060]',
}

function annualReturnDeadline(dateOfIncorporation: string | null | undefined) {
  if (!dateOfIncorporation) return '—'
  const date = new Date(dateOfIncorporation)
  if (Number.isNaN(date.getTime())) return '—'
  const deadline = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 42))
  return `${String(deadline.getUTCMonth() + 1).padStart(2, '0')}-${String(deadline.getUTCDate()).padStart(2, '0')}`
}

export default function CompaniesPage() {
  const t = useTranslations('admin.companies')
  const router = useRouter()
  const [companies, setCompanies] = useState<Company[]>([])
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [jurisdiction, setJurisdiction] = useState('')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [updatingFinancialId, setUpdatingFinancialId] = useState<string | null>(null)

  const fetchCompanies = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ q: search, page: String(page) })
      if (jurisdiction) params.set('jurisdiction', jurisdiction)
      const res = await fetch(`/api/admin/companies?${params}`)
      const json = await res.json()
      setCompanies(json.companies ?? [])
      setTotal(json.total ?? 0)
    } catch {
      toast.error('Failed to load companies')
    } finally {
      setLoading(false)
    }
  }, [search, jurisdiction, page])

  async function toggleFinancialModule(company: Company, enabled: boolean) {
    const previous = company.financialEnabled
    setUpdatingFinancialId(company.id)
    setCompanies(current => current.map(row => row.id === company.id ? { ...row, financialEnabled: enabled } : row))

    try {
      const res = await fetch(`/api/admin/companies/${company.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ financialEnabled: enabled }),
      })
      if (!res.ok) throw new Error('Failed to update financial module')
      toast.success(enabled ? t('financialEnabledOn') : t('financialEnabledOff'))
    } catch {
      setCompanies(current => current.map(row => row.id === company.id ? { ...row, financialEnabled: previous } : row))
      toast.error(t('financialToggleFailed'))
    } finally {
      setUpdatingFinancialId(null)
    }
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect -- fetchCompanies updates state after the async request resolves.
  useEffect(() => { fetchCompanies() }, [fetchCompanies])

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>{t('title')}</h1>
        <Link href="/admin/companies/new">
          <Button>{t('add')}</Button>
        </Link>
      </div>

      <div className="flex gap-2 flex-wrap items-center">
        <Input
          placeholder={t('search')}
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1) }}
          className="max-w-xs"
        />
        <select
          value={jurisdiction}
          onChange={e => { setJurisdiction(e.target.value); setPage(1) }}
          aria-label={t('jurisdictionFilter')}
          className="h-9 rounded-md px-3 text-sm"
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border-subtle)',
            color: 'var(--foreground)',
            outline: 'none',
            minWidth: '9rem',
          }}
        >
          <option value="" style={{ background: 'var(--surface-raised)' }}>{t('jurisdictionAll')}</option>
          {COMPANY_JURISDICTIONS.map(j => (
            <option key={j} value={j} style={{ background: 'var(--surface-raised)' }}>
              {COMPANY_JURISDICTION_LABELS_ZH[j]}
            </option>
          ))}
        </select>
      </div>

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead style={{ background: 'var(--surface-panel)', borderBottom: '1px solid var(--border-subtle)' }}>
              <tr>
                <th className="px-4 py-3 text-left font-medium" style={{ color: 'var(--muted-foreground)' }}>{t('companyCode')}</th>
                <th className="px-4 py-3 text-left font-medium" style={{ color: 'var(--muted-foreground)' }}>{t('jurisdictionColumn')}</th>
                <th className="px-4 py-3 text-left font-medium" style={{ color: 'var(--muted-foreground)' }}>{t('companyName')}</th>
                <th className="px-4 py-3 text-left font-medium" style={{ color: 'var(--muted-foreground)' }}>{t('companyNumber')}</th>
                <th className="px-4 py-3 text-left font-medium" style={{ color: 'var(--muted-foreground)' }}>{t('incorporationDate')}</th>
                <th className="px-4 py-3 text-left font-medium" style={{ color: 'var(--muted-foreground)' }}>周年申报截止日</th>
                <th className="px-4 py-3 text-left font-medium" style={{ color: 'var(--muted-foreground)' }}>{t('ubo')}</th>
                <th className="px-4 py-3 text-left font-medium" style={{ color: 'var(--muted-foreground)' }}>{t('status')}</th>
                <th className="px-4 py-3 text-left font-medium" style={{ color: 'var(--muted-foreground)' }}>{t('client')}</th>
                <th className="px-4 py-3 text-left font-medium" style={{ color: 'var(--muted-foreground)' }}>{t('financialModule')}</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">
              {loading ? (
                <tr><td colSpan={11} className="px-4 py-8 text-center" style={{ color: 'var(--muted-foreground)' }}>Loading...</td></tr>
              ) : companies.length === 0 ? (
                <tr><td colSpan={11} className="px-4 py-8 text-center" style={{ color: 'var(--muted-foreground)' }}>{t('empty')}</td></tr>
              ) : companies.map(c => (
                <tr
                  key={c.id}
                  className="cursor-pointer transition-colors hover:bg-[var(--surface-panel)]"
                  tabIndex={0}
                  onClick={() => router.push(`/admin/companies/${c.id}`)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ' ') router.push(`/admin/companies/${c.id}`)
                  }}
                >
                  <td className="px-4 py-3 font-semibold" style={{ color: '#C9A96E' }}>{c.companyCode ?? '—'}</td>
                  <td className="px-4 py-3" style={{ color: 'var(--muted-foreground)' }}>
                    {companyJurisdictionLabelZh(c.companyType) ?? '—'}
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium" style={{ color: 'var(--foreground)' }}>{c.nameEn}</p>
                    {c.nameZh && <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{c.nameZh}</p>}
                  </td>
                  <td className="px-4 py-3" style={{ color: 'var(--muted-foreground)' }}>{c.companyNumber}</td>
                  <td className="px-4 py-3" style={{ color: 'var(--muted-foreground)' }}>
                    {c.dateOfIncorporation ? new Date(c.dateOfIncorporation).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-4 py-3 font-semibold" style={{ color: '#C9A96E' }}>
                    {annualReturnDeadline(c.dateOfIncorporation)}
                  </td>
                  <td className="px-4 py-3 max-w-[14rem]">
                    {(c.ubos?.length ?? 0) === 0 ? (
                      <span style={{ color: 'var(--muted-foreground)' }}>—</span>
                    ) : (
                      <div className="space-y-1">
                        {c.ubos!.map((u, i) => (
                          <p key={`${u.nameEn}-${i}`} className="leading-snug">
                            <span className="font-medium" style={{ color: 'var(--foreground)' }}>
                              {u.nameZh || u.nameEn}
                            </span>
                            <span className="text-xs ml-1.5" style={{ color: '#C9A96E' }}>
                              {u.effectivePercent.toFixed(u.effectivePercent % 1 === 0 ? 0 : 2)}%
                            </span>
                          </p>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOR[c.status] ?? ''}`}>
                      {COMPANY_STATUS_LABELS[c.status as keyof typeof COMPANY_STATUS_LABELS] ?? c.status}
                    </span>
                  </td>
                  <td className="px-4 py-3" style={{ color: 'var(--muted-foreground)' }}>{c.clientUser?.nameEn ?? '—'}</td>
                  <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={c.financialEnabled}
                      aria-label={`${t('financialModule')}: ${c.nameEn}`}
                      disabled={updatingFinancialId === c.id}
                      onClick={e => {
                        e.stopPropagation()
                        void toggleFinancialModule(c, !c.financialEnabled)
                      }}
                      className="inline-flex h-6 w-11 items-center rounded-full border transition-colors disabled:cursor-not-allowed disabled:opacity-60"
                      style={{
                        borderColor: c.financialEnabled ? '#C9A96E' : 'var(--border-subtle)',
                        background: c.financialEnabled ? 'rgba(201,169,110,0.35)' : 'var(--surface-input)',
                      }}
                    >
                      <span
                        className="block size-4 rounded-full transition-transform"
                        style={{
                          transform: c.financialEnabled ? 'translateX(22px)' : 'translateX(3px)',
                          background: c.financialEnabled ? '#C9A96E' : '#7A7060',
                        }}
                      />
                    </button>
                    {c.financialEnabled && (
                      <p className="mt-1 text-[11px]" style={{ color: c.financialManager ? '#7A7060' : '#ef4444' }}>
                        {c.financialManager?.nameEn ?? '未指派财务管理员'}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-xs font-medium" style={{ color: '#C9A96E' }}>
                    {t('view')} →
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
