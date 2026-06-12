'use client'

import { useMemo, useRef, useState } from 'react'
import { Check, ChevronDown, Search } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useFinancialWorkspace } from '@/components/admin/financial/FinancialCompanyContext'

export function FinancialCompanySelector() {
  const t = useTranslations('admin.financial')
  const { companies, selectedCompanyId, setSelectedCompanyId, loading } = useFinancialWorkspace()
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const selectedCompany = companies.find(c => c.id === selectedCompanyId) ?? null

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return companies
    return companies.filter(
      c =>
        c.nameEn.toLowerCase().includes(q) ||
        (c.companyCode?.toLowerCase().includes(q) ?? false),
    )
  }, [companies, search])

  function openDropdown() {
    setSearch('')
    setOpen(true)
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  function close() {
    setOpen(false)
    setSearch('')
  }

  function select(id: string) {
    setSelectedCompanyId(id)
    close()
  }

  function handleBlur(e: React.FocusEvent) {
    if (!containerRef.current?.contains(e.relatedTarget as Node)) close()
  }

  const triggerLabel = selectedCompany
    ? [selectedCompany.companyCode, selectedCompany.nameEn].filter(Boolean).join(' · ')
    : t('searchPlaceholder')

  return (
    <div className="rounded-lg border border-[#2A2418] bg-card p-4 space-y-3">
      <div>
        <h1 className="text-xl font-bold" style={{ color: 'var(--foreground)' }}>
          {t('selectCompanyTitle')}
        </h1>
        <p className="text-xs mt-1" style={{ color: 'var(--muted-foreground)' }}>
          {t('selectCompanySubtitle')}
        </p>
      </div>

      <div ref={containerRef} onBlur={handleBlur} className="relative w-full max-w-sm">
        {/* Trigger */}
        {!open ? (
          <button
            type="button"
            onClick={openDropdown}
            className="flex w-full items-center gap-2 rounded-md border border-[#2A2418] px-3 py-2 text-sm transition-colors hover:border-[#C9A96E66]"
            style={{ background: '#0E0E0A', color: selectedCompany ? 'var(--foreground)' : 'var(--muted-foreground)' }}
          >
            <span className="flex-1 text-left truncate">{triggerLabel}</span>
            {selectedCompany && (
              <Check size={13} style={{ color: '#C9A96E', flexShrink: 0 }} />
            )}
            <ChevronDown size={13} style={{ color: 'var(--muted-foreground)', flexShrink: 0 }} />
          </button>
        ) : (
          <div className="relative">
            <Search
              size={13}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
              style={{ color: 'var(--muted-foreground)' }}
            />
            <input
              ref={inputRef}
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => e.key === 'Escape' && close()}
              placeholder={t('searchPlaceholder')}
              className="w-full rounded-md border border-[#C9A96E66] py-2 pl-8 pr-3 text-sm outline-none"
              style={{ background: '#0E0E0A', color: 'var(--foreground)' }}
            />
          </div>
        )}

        {/* Dropdown list */}
        {open && (
          <div
            className="absolute top-full left-0 right-0 z-50 mt-1 max-h-64 overflow-y-auto rounded-md border border-[#2A2418]"
            style={{ background: '#0E0E0A', boxShadow: '0 4px 20px rgba(0,0,0,0.6)' }}
          >
            {loading ? (
              <div className="px-4 py-6 text-center text-sm" style={{ color: 'var(--muted-foreground)' }}>
                {t('loading')}
              </div>
            ) : filtered.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm" style={{ color: 'var(--muted-foreground)' }}>
                {t('empty')}
              </div>
            ) : (
              <div className="divide-y divide-[#2A2418]">
                {filtered.map(company => {
                  const isSelected = company.id === selectedCompanyId
                  return (
                    <button
                      key={company.id}
                      type="button"
                      onMouseDown={e => { e.preventDefault(); select(company.id) }}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors hover:bg-[#1A1A12]"
                      style={{ borderLeft: isSelected ? '2px solid #C9A96E' : '2px solid transparent' }}
                    >
                      <span
                        className="flex-1 truncate"
                        style={{ color: isSelected ? '#FFF7E6' : 'var(--foreground)' }}
                      >
                        {company.nameEn}
                      </span>
                      <span className="shrink-0 text-xs" style={{ color: isSelected ? '#C9A96E' : 'var(--muted-foreground)' }}>
                        {company.companyCode ?? '—'}
                      </span>
                      {isSelected && (
                        <Check size={12} className="shrink-0" style={{ color: '#C9A96E' }} />
                      )}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
