import { Prisma } from '@prisma/client'
import { ArrowRight, BookOpen, FileText, Layers, WalletCards } from 'lucide-react'
import { Link } from '@/i18n/navigation'
import { prisma } from '@/lib/db/prisma'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export const dynamic = 'force-dynamic'

type FinancialStats = {
  totalAccounts: number
  draftJournals: number
  postedJournals: number
  ledgerEntries: number
}

async function getFinancialStats(): Promise<FinancialStats> {
  try {
    const [totalAccounts, draftJournals, postedJournals, ledgerEntries] = await Promise.all([
      prisma.finAccount.count(),
      prisma.journalEntry.count({ where: { status: 'DRAFT' } }),
      prisma.journalEntry.count({ where: { status: 'POSTED' } }),
      prisma.ledger.count(),
    ])

    return { totalAccounts, draftJournals, postedJournals, ledgerEntries }
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2021') {
      return { totalAccounts: 0, draftJournals: 0, postedJournals: 0, ledgerEntries: 0 }
    }
    throw error
  }
}

export default async function AdminFinancialPage() {
  const stats = await getFinancialStats()

  const statCards = [
    { label: 'Total Accounts', value: stats.totalAccounts, Icon: WalletCards, tone: '#38bdf8' },
    { label: 'Pending Journals', value: stats.draftJournals, Icon: FileText, tone: '#f59e0b' },
    { label: 'Posted Journals', value: stats.postedJournals, Icon: BookOpen, tone: '#10b981' },
    { label: 'Ledger Entries', value: stats.ledgerEntries, Icon: Layers, tone: '#C9A96E' },
  ]

  const modules = [
    {
      title: 'Accounts',
      desc: 'Maintain the chart of accounts, hierarchy, account type, and posting order.',
      href: '/admin/financial/accounts',
      Icon: WalletCards,
    },
    {
      title: 'Journal Entries',
      desc: 'Create balanced vouchers, review drafts, and submit accounting entries.',
      href: '/admin/financial/journal',
      Icon: FileText,
    },
    {
      title: 'Ledger',
      desc: 'Inspect account-level activity with running balances and exportable reports.',
      href: '/admin/financial/ledger',
      Icon: Layers,
    },
  ]

  return (
    <div className="p-6 space-y-6">
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-xs" style={{ color: '#7A7060' }}>
          <Link href="/admin/dashboard" className="hover:text-[#C9A96E]">Dashboard</Link>
          <span>/</span>
          <span style={{ color: 'var(--muted-foreground)' }}>Financial Accounting</span>
        </div>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>
              Financial Accounting
            </h1>
            <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
              Manage chart of accounts, journal vouchers, and general ledger reporting.
            </p>
          </div>
          <Badge variant="outline" className="border-[#2A2418] text-[#C9A96E]">
            Adviser Finance
          </Badge>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {statCards.map(({ label, value, Icon, tone }) => (
          <Card key={label} className="rounded-lg border-[#2A2418] bg-card">
            <CardContent className="pt-2">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-3xl font-bold" style={{ color: 'var(--foreground)' }}>
                    {value.toLocaleString()}
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

      <div className="grid lg:grid-cols-3 gap-4">
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
                  <ArrowRight size={15} className="text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-[#C9A96E]" />
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
