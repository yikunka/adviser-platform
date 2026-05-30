'use client'

/* eslint-disable react-hooks/set-state-in-effect */

import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Link } from '@/i18n/navigation'
import { toast } from 'sonner'

export type FinancialCompanyInfo = {
  id: string
  nameEn: string
  companyCode: string | null
  groupId?: string | null
  group?: { id: string; name: string } | null
}

// URL-based company context — when present, takes priority over the global selector context.
const UrlCompanyContext = createContext<FinancialCompanyInfo | null>(null)

export function UrlBasedCompanyProvider({
  company,
  children,
}: {
  company: FinancialCompanyInfo
  children: React.ReactNode
}) {
  return <UrlCompanyContext.Provider value={company}>{children}</UrlCompanyContext.Provider>
}

type FinancialCompanyContextValue = {
  companies: FinancialCompanyInfo[]
  groups: { id: string; name: string }[]
  company: FinancialCompanyInfo | null
  selectedCompanyId: string
  setSelectedCompanyId: (id: string) => void
  loading: boolean
}

const STORAGE_KEY = 'adviser.financial.selectedCompanyId'

const FinancialCompanyContext = createContext<FinancialCompanyContextValue | null>(null)

export function FinancialCompanyProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const [companies, setCompanies] = useState<FinancialCompanyInfo[]>([])
  const [groups, setGroups] = useState<{ id: string; name: string }[]>([])
  const [selectedCompanyId, setSelectedCompanyIdState] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setSelectedCompanyIdState(window.localStorage.getItem(STORAGE_KEY) ?? '')
    fetch('/api/admin/financial/scope')
      .then(async res => {
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Failed to load financial companies')
        setGroups(data.groups ?? [])
        setCompanies(data.companies ?? [])
      })
      .catch(error => toast.error(error instanceof Error ? error.message : 'Failed to load financial companies'))
      .finally(() => setLoading(false))
  }, [])

  const company = useMemo(
    () => companies.find(row => row.id === selectedCompanyId) ?? null,
    [companies, selectedCompanyId],
  )

  useEffect(() => {
    if (loading || selectedCompanyId || companies.length !== 1) return
    const onlyCompany = companies[0]!
    setSelectedCompanyIdState(onlyCompany.id)
    window.localStorage.setItem(STORAGE_KEY, onlyCompany.id)
  }, [companies, loading, selectedCompanyId])

  function setSelectedCompanyId(id: string) {
    setSelectedCompanyIdState(id)
    if (id) {
      window.localStorage.setItem(STORAGE_KEY, id)
    } else {
      window.localStorage.removeItem(STORAGE_KEY)
    }
  }

  const value = useMemo<FinancialCompanyContextValue>(
    () => ({ companies, groups, company, selectedCompanyId, setSelectedCompanyId, loading }),
    [companies, groups, company, selectedCompanyId, loading],
  )

  const isSelectorPage = /\/admin\/financial\/?$/.test(pathname.replace(/\/$/, ''))
  // URL-based company routes (/admin/financial/[companyId]/...) handle their own company guard
  // via UrlBasedCompanyProvider in the [companyId] layout — don't block them here.
  const isUrlCompanyRoute = /\/admin\/financial\/[^/]+\//.test(pathname)
  const needsCompany = pathname.includes('/admin/financial/') && !isSelectorPage && !isUrlCompanyRoute

  return (
    <FinancialCompanyContext.Provider value={value}>
      {needsCompany && !company && !loading ? (
        <div className="p-6">
          <div className="rounded-lg border border-[#2A2418] bg-card p-8 text-center">
            <p className="text-sm text-muted-foreground">Select a client company before opening this financial page.</p>
            <Link
              href="/admin/financial"
              className="mt-4 inline-flex rounded-md border border-[#2A2418] px-3 py-2 text-sm font-medium hover:border-[#C9A96E66]"
              style={{ color: '#C9A96E' }}
            >
              Choose company
            </Link>
          </div>
        </div>
      ) : (
        children
      )}
    </FinancialCompanyContext.Provider>
  )
}

export function useFinancialWorkspace(): FinancialCompanyContextValue {
  const context = useContext(FinancialCompanyContext)
  if (!context) {
    throw new Error('useFinancialWorkspace must be used within FinancialCompanyProvider')
  }
  return context
}

export function useFinancialCompany(): FinancialCompanyInfo {
  // URL-based company (from [companyId] layout) takes priority over the global selector.
  // Both hooks are always called to satisfy React's rules of hooks.
  const urlCompany = useContext(UrlCompanyContext)
  const workspace = useContext(FinancialCompanyContext)

  if (urlCompany) return urlCompany

  if (!workspace) throw new Error('useFinancialCompany must be used within FinancialCompanyProvider')
  if (!workspace.company) throw new Error('Select a financial company before opening this page')
  return workspace.company
}
