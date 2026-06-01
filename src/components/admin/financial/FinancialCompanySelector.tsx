'use client'

import { useMemo, useState } from 'react'
import { Check, Search } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useFinancialWorkspace } from '@/components/admin/financial/FinancialCompanyContext'

export function FinancialCompanySelector() {
  const t = useTranslations('admin.financial')
  const { companies, selectedCompanyId, setSelectedCompanyId, loading } = useFinancialWorkspace()
  const [search, setSearch] = useState('')
  const [pendingCompanyId, setPendingCompanyId] = useState(selectedCompanyId)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return companies.filter(company => {
      if (!q) return true
      return (
        company.nameEn.toLowerCase().includes(q) ||
        (company.companyCode?.toLowerCase().includes(q) ?? false)
      )
    })
  }, [companies, search])

  const pendingCompany = companies.find(c => c.id === pendingCompanyId) ?? null
  const isDirty = pendingCompanyId !== selectedCompanyId

  function confirm() {
    if (pendingCompanyId) setSelectedCompanyId(pendingCompanyId)
  }

  return (
    <div className="rounded-lg border border-[#2A2418] bg-card p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--foreground)' }}>
            {t('selectCompanyTitle')}
          </h1>
          <p className="text-xs mt-1" style={{ color: 'var(--muted-foreground)' }}>
            {t('selectCompanySubtitle')}
          </p>
        </div>
        <Button
          size="sm"
          disabled={!isDirty || !pendingCompanyId}
          onClick={confirm}
          style={isDirty && pendingCompanyId ? { background: '#C9A96E', color: '#0E0E0A' } : {}}
        >
          <Check size={14} className="mr-1.5" />
          OK
        </Button>
      </div>

      {/* List */}
      <div className="rounded-md border border-[#2A2418] overflow-hidden">
        {/* Column header + search */}
        <div
          className="grid grid-cols-[1fr_9rem] gap-4 px-4 py-2 border-b border-[#2A2418]"
          style={{ background: '#1A1A12' }}
        >
          <div className="relative">
            <Search
              size={13}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
              style={{ color: 'var(--muted-foreground)' }}
            />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={t('searchPlaceholder')}
              className="h-7 pl-8 text-xs"
              style={{ background: '#0E0E0A', border: '1px solid #2A2418' }}
            />
          </div>
          <span className="text-xs font-medium self-center" style={{ color: 'var(--muted-foreground)' }}>
            Company Code
          </span>
        </div>

        {/* Rows */}
        <div className="divide-y divide-[#2A2418] max-h-72 overflow-y-auto">
          {loading ? (
            <div className="px-4 py-6 text-sm text-center" style={{ color: 'var(--muted-foreground)' }}>
              {t('loading')}
            </div>
          ) : filtered.length === 0 ? (
            <div className="px-4 py-6 text-sm text-center" style={{ color: 'var(--muted-foreground)' }}>
              {t('empty')}
            </div>
          ) : (
            filtered.map(company => {
              const isPending = company.id === pendingCompanyId
              const isConfirmed = company.id === selectedCompanyId
              return (
                <button
                  key={company.id}
                  type="button"
                  onClick={() => setPendingCompanyId(company.id)}
                  className="w-full grid grid-cols-[1fr_9rem] gap-4 px-4 py-3 text-left transition-colors hover:bg-[#1A1A12]"
                  style={{
                    background: isPending ? 'rgba(201,169,110,0.08)' : undefined,
                    borderLeft: isPending ? '2px solid #C9A96E' : '2px solid transparent',
                  }}
                >
                  <div className="min-w-0">
                    <span
                      className="block truncate text-sm font-medium"
                      style={{ color: isPending ? '#FFF7E6' : 'var(--foreground)' }}
                    >
                      {company.nameEn}
                      {isConfirmed && !isDirty && (
                        <Check
                          size={12}
                          className="inline ml-1.5 mb-0.5"
                          style={{ color: '#C9A96E' }}
                        />
                      )}
                    </span>
                  </div>
                  <span
                    className="text-sm self-center truncate"
                    style={{ color: isPending ? '#C9A96E' : 'var(--muted-foreground)' }}
                  >
                    {company.companyCode ?? '—'}
                  </span>
                </button>
              )
            })
          )}
        </div>
      </div>

      {/* Pending confirmation hint */}
      {isDirty && pendingCompany && (
        <p className="text-xs" style={{ color: '#C9A96E' }}>
          Selected: <span className="font-medium">{pendingCompany.nameEn}</span> — click OK to confirm
        </p>
      )}
    </div>
  )
}
