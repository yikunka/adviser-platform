'use client'

import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Input } from '@/components/ui/input'
import { useFinancialWorkspace } from '@/components/admin/financial/FinancialCompanyContext'

export function FinancialCompanySelector() {
  const t = useTranslations('admin.financial')
  const { companies, groups, selectedCompanyId, setSelectedCompanyId, loading } = useFinancialWorkspace()
  const [search, setSearch] = useState('')
  const [groupId, setGroupId] = useState('')

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return companies.filter(company => {
      if (groupId && company.groupId !== groupId) return false
      if (!q) return true
      return (
        company.nameEn.toLowerCase().includes(q) ||
        (company.companyCode?.toLowerCase().includes(q) ?? false) ||
        (company.group?.name.toLowerCase().includes(q) ?? false)
      )
    })
  }, [companies, search, groupId])

  return (
    <div className="rounded-lg border border-[#2A2418] bg-card p-4 space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--foreground)' }}>
            {t('selectCompanyTitle')}
          </h1>
          <p className="text-xs mt-1" style={{ color: 'var(--muted-foreground)' }}>
            {t('selectCompanySubtitle')}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="relative min-w-[220px] max-w-xs">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2"
              style={{ color: 'var(--muted-foreground)' }}
            />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={t('searchPlaceholder')}
              className="h-9 pl-9"
              style={{ background: '#0E0E0A', border: '1px solid #2A2418' }}
            />
          </div>
          <select
            value={groupId}
            onChange={e => setGroupId(e.target.value)}
            className="h-9 max-w-xs rounded-md px-3 text-sm"
            style={{ background: '#0A0A0A', border: '1px solid #2A2418', color: '#F0EAD8' }}
          >
            <option value="">{t('allGroups')}</option>
            {groups.map(group => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {loading ? (
          <div className="text-sm" style={{ color: 'var(--muted-foreground)' }}>{t('loading')}</div>
        ) : filtered.length === 0 ? (
          <div className="text-sm" style={{ color: 'var(--muted-foreground)' }}>{t('empty')}</div>
        ) : (
          filtered.map(company => {
            const active = company.id === selectedCompanyId
            return (
              <button
                key={company.id}
                type="button"
                onClick={() => setSelectedCompanyId(company.id)}
                className="shrink-0 rounded-md border px-3 py-2 text-left text-sm transition-colors"
                style={{
                  minWidth: 220,
                  borderColor: active ? '#C9A96E' : '#2A2418',
                  background: active ? 'rgba(201,169,110,0.12)' : '#0E0E0A',
                  color: active ? '#FFF7E6' : 'var(--foreground)',
                }}
              >
                <span className="block truncate font-semibold">{company.nameEn}</span>
                <span className="block truncate text-xs" style={{ color: active ? '#C9A96E' : 'var(--muted-foreground)' }}>
                  {company.companyCode ? `${company.companyCode} · ` : ''}
                  {company.group?.name ?? t('noGroup')}
                </span>
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}
