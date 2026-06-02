import { auth } from '@/lib/auth/auth'
import { prisma } from '@/lib/db/prisma'
import { getTranslations } from 'next-intl/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Link } from '@/i18n/navigation'

const SFS_ORDER_STATUSES = ['PENDING', 'QUOTED', 'CONFIRMED', 'COMPLETED', 'CANCELLED'] as const

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
    prisma.company.count({
      where: {
        annualReturnDate: {
          gte: today,
          lte: thirtyDaysFromNow,
        },
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

  const recentActivity = await prisma.auditLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10,
    include: { user: { select: { nameEn: true } } },
  })

  const stats = [
    { label: t('totalCompanies'), value: totalCompanies, href: '/admin/companies', color: 'bg-blue-500' },
    { label: t('pendingKyc'), value: pendingKyc, href: '/admin/kyc', color: 'bg-yellow-500' },
    { label: t('amlAlerts'), value: amlAlerts, href: '/admin/aml', color: 'bg-red-500' },
    { label: t('upcomingAR'), value: upcomingAR, href: '/admin/companies', color: 'bg-green-500' },
  ]

  const sfsStatusCountMap = new Map(sfsStatusCounts.map(item => [item.status, item._count._all]))
  const sfsActiveOrders = SFS_ORDER_STATUSES
    .filter(status => status !== 'COMPLETED' && status !== 'CANCELLED')
    .reduce((sum, status) => sum + (sfsStatusCountMap.get(status) ?? 0), 0)

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>{t('title')}</h1>

      {/* Stats */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(({ label, value, href, color }) => (
          <Link key={label} href={href}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="pt-6">
                <div className={`inline-block w-3 h-3 rounded-full ${color} mb-2`} />
                <p className="text-3xl font-bold" style={{ color: 'var(--foreground)' }}>{value}</p>
                <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>{label}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* SFS order stats */}
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-base">{t('sfs.title')}</CardTitle>
            <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>{t('sfs.subtitle')}</p>
          </div>
          <Link
            href="/admin/sfs-orders"
            className="text-sm font-medium rounded-md px-3 py-2 transition-colors hover:bg-[#111108]"
            style={{ color: '#C9A96E', border: '1px solid rgba(201,169,110,0.25)' }}
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
              <div key={item.label} className="rounded-lg p-4" style={{ border: '1px solid var(--border)', background: 'rgba(201,169,110,0.04)' }}>
                <p className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>{item.value}</p>
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
