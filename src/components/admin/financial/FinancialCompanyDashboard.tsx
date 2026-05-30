'use client'

/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useState } from 'react'
import { ArrowRight, BookOpen, FileBarChart, FileText, Layers, WalletCards } from 'lucide-react'
import { Link } from '@/i18n/navigation'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useFinancialCompany } from '@/components/admin/financial/FinancialCompanyContext'

type FinancialStats = {
  totalAccounts: number
  draftJournals: number
  postedJournals: number
  ledgerEntries: number
}

const emptyStats: FinancialStats = {
  totalAccounts: 0,
  draftJournals: 0,
  postedJournals: 0,
  ledgerEntries: 0,
}

export function FinancialCompanyDashboard() {
  const company = useFinancialCompany()
  const [stats, setStats] = useState<FinancialStats>(emptyStats)
  const [loading, setLoading] = useState(true)
  const companyLabel = company.companyCode
    ? `${company.companyCode} · ${company.nameEn}`
    : company.nameEn

  useEffect(() => {
    setLoading(true)
    fetch(`/api/admin/financial/dashboard?companyId=${company.id}`)
      .then(async res => {
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Failed to load financial dashboard')
        setStats(data.stats ?? emptyStats)
      })
      .catch(error => toast.error(error instanceof Error ? error.message : 'Failed to load financial dashboard'))
      .finally(() => setLoading(false))
  }, [company.id])

  const statCards = [
    { label: 'Chart of Accounts', value: stats.totalAccounts, Icon: WalletCards, tone: '#38bdf8' },
    { label: 'Pending Journals', value: stats.draftJournals, Icon: FileText, tone: '#f59e0b' },
    { label: 'Posted Journals', value: stats.postedJournals, Icon: BookOpen, tone: '#10b981' },
    { label: 'Ledger Entries', value: stats.ledgerEntries, Icon: Layers, tone: '#C9A96E' },
  ]

  const modules = [
    {
      title: 'Chart of Accounts',
      desc: 'Maintain account hierarchy, types, and posting order.',
      href: `/admin/financial/${company.id}/accounts`,
      Icon: WalletCards,
    },
    {
      title: 'Journal Entries',
      desc: 'Create balanced vouchers, review drafts, and post entries.',
      href: `/admin/financial/${company.id}/journal`,
      Icon: FileText,
    },
    {
      title: 'General Ledger',
      desc: 'Inspect account activity with running balances.',
      href: `/admin/financial/${company.id}/ledger`,
      Icon: Layers,
    },
    {
      title: 'HKFRS Reports',
      desc: 'Trial balance, income statement, balance sheet, and cash flow.',
      href: `/admin/financial/${company.id}/reports`,
      Icon: FileBarChart,
    },
  ]

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-xs" style={{ color: '#7A7060' }}>
          <Link href="/admin/dashboard" className="hover:text-[#C9A96E]">
            Dashboard
          </Link>
          <span>/</span>
          <Link href="/admin/financial" className="hover:text-[#C9A96E]">
            财务管理
          </Link>
          <span>/</span>
          <span style={{ color: 'var(--muted-foreground)' }}>{companyLabel}</span>
        </div>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>
              {company.nameEn}
            </h1>
            <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
              {company.group?.name ?? 'Client company'} · Financial workspace
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="border-[#2A2418] text-[#C9A96E]">
              TCSP Accounting
            </Badge>
          </div>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {statCards.map(({ label, value, Icon, tone }) => (
          <Card key={label} className="rounded-lg border-[#2A2418] bg-card">
            <CardContent className="pt-2">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-3xl font-bold" style={{ color: 'var(--foreground)' }}>
                    {loading ? '-' : value.toLocaleString()}
                  </p>
                  <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
                    {label}
                  </p>
                </div>
                <span
                  className="inline-flex size-9 items-center justify-center rounded-md"
                  style={{ background: `${tone}1f`, color: tone, border: `1px solid ${tone}33` }}
                >
                  <Icon size={17} />
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {modules.map(({ title, desc, href, Icon }) => (
          <Link key={href} href={href} className="group">
            <Card className="h-full rounded-lg border-[#2A2418] bg-card transition-colors group-hover:border-[#C9A96E66]">
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <span
                    className="inline-flex size-9 items-center justify-center rounded-md"
                    style={{ background: 'rgba(201,169,110,0.12)', color: '#C9A96E' }}
                  >
                    <Icon size={17} />
                  </span>
                  <ArrowRight
                    size={15}
                    className="text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-[#C9A96E]"
                  />
                </div>
                <CardTitle>{title}</CardTitle>
                <CardDescription>{desc}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
