import { auth } from '@/lib/auth/auth'
import { prisma } from '@/lib/db/prisma'
import { getTranslations } from 'next-intl/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Link } from '@/i18n/navigation'
import { Prisma } from '@prisma/client'

const SFS_ORDER_STATUSES = ['PENDING', 'QUOTED', 'CONFIRMED', 'COMPLETED', 'CANCELLED'] as const

const moduleStyles = {
  adviser: {
    card: 'border border-[#2563EB33] bg-[linear-gradient(180deg,rgba(37,99,235,0.08),rgba(16,185,129,0.03))]',
    eyebrow: '#38bdf8',
    tileBg: 'rgba(37,99,235,0.05)',
    tileBorder: 'rgba(56,189,248,0.22)',
    buttonBorder: 'rgba(56,189,248,0.28)',
    buttonHover: 'hover:bg-[#0B1D22]',
  },
  sfs: {
    card: 'border border-[#C9A96E33] bg-[linear-gradient(180deg,rgba(201,169,110,0.08),rgba(201,169,110,0.025))]',
    eyebrow: '#C9A96E',
    tileBg: 'rgba(201,169,110,0.05)',
    tileBorder: 'rgba(201,169,110,0.24)',
    buttonBorder: 'rgba(201,169,110,0.28)',
    buttonHover: 'hover:bg-[#111108]',
  },
  cosmocoat: {
    card: 'border border-[#15803D33] bg-[linear-gradient(180deg,rgba(21,128,61,0.08),rgba(201,169,110,0.025))]',
    eyebrow: '#4ade80',
    tileBg: 'rgba(21,128,61,0.05)',
    tileBorder: 'rgba(74,222,128,0.22)',
    buttonBorder: 'rgba(74,222,128,0.28)',
    buttonHover: 'hover:bg-[#0D180F]',
  },
} as const

function isMissingTable(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2021'
}

export default async function AdminDashboardPage() {
  await auth()
  const t = await getTranslations('admin.dashboard')
  const today = new Date()
  const thirtyDaysFromNow = new Date(today)
  thirtyDaysFromNow.setDate(today.getDate() + 30)
  const thirtyDaysAgo = new Date(today)
  thirtyDaysAgo.setDate(today.getDate() - 30)

  const [totalCompanies, pendingKyc, amlAlerts, upcomingAR, sfsTotalOrders, sfsStatusCounts, sfsRecentOrders] = await Promise.all([
    prisma.company.count({ where: { status: 'ACTIVE' } }),
    prisma.keyPerson.count({ where: { kycStatus: 'SUBMITTED' } }),
    prisma.aMLAlert.count({ where: { resolution: 'PENDING' } }),
    prisma.annualFiling.count({
      where: {
        status: { in: ['NOT_STARTED', 'IN_PREPARATION', 'OVERDUE'] },
        filingDeadline: {
          gte: today,
          lte: thirtyDaysFromNow,
        },
        company: { status: 'ACTIVE' },
      },
    }),
    prisma.sfsOrder.count(),
    prisma.sfsOrder.groupBy({
      by: ['status'],
      _count: { _all: true },
    }),
    prisma.sfsOrder.count({
      where: {
        createdAt: {
          gte: thirtyDaysAgo,
        },
      },
    }),
  ])

  const cosmocoatStats = await (async () => {
    try {
      const [pendingRecipeChanges, draftSampleOrders, inProgressSampleOrders] = await Promise.all([
        prisma.cosTableRecipeChangeRequest.count({
          where: {
            status: 'PENDING',
            requestedBy: {
              role: { not: 'SUPER_ADMIN' },
            },
          },
        }),
        prisma.cosSampleOrder.count({ where: { status: 'DRAFT' } }),
        prisma.cosSampleOrder.count({ where: { status: 'IN_PROGRESS' } }),
      ])

      return { pendingRecipeChanges, draftSampleOrders, inProgressSampleOrders }
    } catch (error) {
      if (isMissingTable(error)) {
        return { pendingRecipeChanges: 0, draftSampleOrders: 0, inProgressSampleOrders: 0 }
      }
      throw error
    }
  })()

  const recentActivity = await prisma.auditLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10,
    include: { user: { select: { nameEn: true } } },
  })

  const stats = [
    { label: t('totalCompanies'), value: totalCompanies, href: '/admin/companies', accent: '#38bdf8' },
    { label: t('pendingKyc'), value: pendingKyc, href: '/admin/kyc', accent: '#f59e0b' },
    { label: t('amlAlerts'), value: amlAlerts, href: '/admin/aml', accent: '#ef4444' },
    { label: t('upcomingAR'), value: upcomingAR, href: '/admin/companies', accent: '#10b981' },
  ]

  const sfsStatusCountMap = new Map(sfsStatusCounts.map(item => [item.status, item._count._all]))
  const sfsActiveOrders = SFS_ORDER_STATUSES
    .filter(status => status !== 'COMPLETED' && status !== 'CANCELLED')
    .reduce((sum, status) => sum + (sfsStatusCountMap.get(status) ?? 0), 0)

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>{t('title')}</h1>

      {/* Adviser stats */}
      <Card className={moduleStyles.adviser.card}>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: moduleStyles.adviser.eyebrow }}>
              Adviser
            </p>
            <CardTitle className="text-base mt-1">{t('adviser.title')}</CardTitle>
            <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>{t('adviser.subtitle')}</p>
          </div>
          <Link
            href="/admin/companies"
            className={`text-sm font-medium rounded-md px-3 py-2 transition-colors ${moduleStyles.adviser.buttonHover}`}
            style={{ color: moduleStyles.adviser.eyebrow, border: `1px solid ${moduleStyles.adviser.buttonBorder}` }}
          >
            {t('adviser.viewCompanies')}
          </Link>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {stats.map(({ label, value, href, accent }) => (
              <Link
                key={label}
                href={href}
                className="group rounded-lg p-4 transition-colors hover:bg-[#0B1D22]"
                style={{ border: `1px solid ${moduleStyles.adviser.tileBorder}`, background: moduleStyles.adviser.tileBg }}
              >
                <span className="block h-1 w-8 rounded-full mb-4" style={{ background: accent }} />
                <p className="text-3xl font-bold tabular-nums" style={{ color: 'var(--foreground)' }}>{value}</p>
                <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>{label}</p>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* SFS order stats */}
      <Card className={moduleStyles.sfs.card}>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: moduleStyles.sfs.eyebrow }}>
              SFS Diamond
            </p>
            <CardTitle className="text-base mt-1">{t('sfs.title')}</CardTitle>
            <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>{t('sfs.subtitle')}</p>
          </div>
          <Link
            href="/admin/sfs-orders"
            className={`text-sm font-medium rounded-md px-3 py-2 transition-colors ${moduleStyles.sfs.buttonHover}`}
            style={{ color: moduleStyles.sfs.eyebrow, border: `1px solid ${moduleStyles.sfs.buttonBorder}` }}
          >
            {t('sfs.viewOrders')}
          </Link>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid sm:grid-cols-3 gap-4">
            {[
              { label: t('sfs.totalOrders'), value: sfsTotalOrders },
              { label: t('sfs.activeOrders'), value: sfsActiveOrders },
              { label: t('sfs.last30Days'), value: sfsRecentOrders },
            ].map(item => (
              <div
                key={item.label}
                className="rounded-lg p-4"
                style={{ border: `1px solid ${moduleStyles.sfs.tileBorder}`, background: moduleStyles.sfs.tileBg }}
              >
                <span className="block h-1 w-8 rounded-full mb-4" style={{ background: moduleStyles.sfs.eyebrow }} />
                <p className="text-2xl font-bold tabular-nums" style={{ color: 'var(--foreground)' }}>{item.value}</p>
                <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>{item.label}</p>
              </div>
            ))}
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>{t('sfs.statusDistribution')}</h2>
              <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{t('sfs.orderCount')}</span>
            </div>
            <div className="space-y-2">
              {SFS_ORDER_STATUSES.map(status => {
                const count = sfsStatusCountMap.get(status) ?? 0
                const percentage = sfsTotalOrders > 0 ? Math.round((count / sfsTotalOrders) * 100) : 0

                return (
                  <Link
                    key={status}
                    href="/admin/sfs-orders"
                    className="grid grid-cols-[8rem_1fr_4rem] items-center gap-3 rounded-md px-3 py-2 transition-colors hover:bg-[#111108]"
                  >
                    <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                      {t(`sfs.statuses.${status}`)}
                    </span>
                    <span className="h-2 rounded-full overflow-hidden" style={{ background: '#2A2418' }}>
                      <span
                        className="block h-full rounded-full"
                        style={{
                          width: `${percentage}%`,
                          background: status === 'CANCELLED' ? '#EF4444' : status === 'COMPLETED' ? '#10B981' : '#C9A96E',
                        }}
                      />
                    </span>
                    <span className="text-sm text-right tabular-nums" style={{ color: 'var(--muted-foreground)' }}>
                      {count}
                    </span>
                  </Link>
                )
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* CosmoCoat stats */}
      <Card className={moduleStyles.cosmocoat.card}>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: moduleStyles.cosmocoat.eyebrow }}>
              CosmoCoat
            </p>
            <CardTitle className="text-base mt-1">{t('cosmocoat.title')}</CardTitle>
            <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>{t('cosmocoat.subtitle')}</p>
          </div>
          <Link
            href="/admin/cosmocoat-sample-orders"
            className={`text-sm font-medium rounded-md px-3 py-2 transition-colors ${moduleStyles.cosmocoat.buttonHover}`}
            style={{ color: moduleStyles.cosmocoat.eyebrow, border: `1px solid ${moduleStyles.cosmocoat.buttonBorder}` }}
          >
            {t('cosmocoat.viewOperations')}
          </Link>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              {
                label: t('cosmocoat.pendingRecipeChanges'),
                value: cosmocoatStats.pendingRecipeChanges,
                href: '/admin/cosmocoat-recipe-approvals',
                accent: '#f59e0b',
              },
              {
                label: t('cosmocoat.draftSampleOrders'),
                value: cosmocoatStats.draftSampleOrders,
                href: '/admin/cosmocoat-sample-orders?status=DRAFT',
                accent: '#94a3b8',
              },
              {
                label: t('cosmocoat.inProgressSampleOrders'),
                value: cosmocoatStats.inProgressSampleOrders,
                href: '/admin/cosmocoat-sample-orders?status=IN_PROGRESS',
                accent: '#38bdf8',
              },
            ].map(({ label, value, href, accent }) => (
              <Link
                key={label}
                href={href}
                className="group rounded-lg p-4 transition-colors hover:bg-[#0D180F]"
                style={{ border: `1px solid ${moduleStyles.cosmocoat.tileBorder}`, background: moduleStyles.cosmocoat.tileBg }}
              >
                <span className="block h-1 w-8 rounded-full mb-4" style={{ background: accent }} />
                <p className="text-3xl font-bold tabular-nums" style={{ color: 'var(--foreground)' }}>{value}</p>
                <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>{label}</p>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recent activity */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('recentActivity')}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {recentActivity.length === 0 ? (
            <p className="px-6 py-4 text-sm" style={{ color: 'var(--muted-foreground)' }}>{t('noActivity')}</p>
          ) : (
            <ul className="divide-y divide-[#2A2418]">
              {recentActivity.map(log => (
                <li key={log.id} className="px-6 py-3 flex gap-3 text-sm">
                  <span className="whitespace-nowrap" style={{ color: '#5A5040' }}>
                    {new Date(log.createdAt).toLocaleString()}
                  </span>
                  <span className="font-medium" style={{ color: 'var(--foreground)' }}>{log.user?.nameEn ?? '—'}</span>
                  <span style={{ color: 'var(--muted-foreground)' }}>{log.action} {log.entityType}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
