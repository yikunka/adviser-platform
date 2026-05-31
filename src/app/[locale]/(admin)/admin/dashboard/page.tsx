import { auth } from '@/lib/auth/auth'
import { prisma } from '@/lib/db/prisma'
import { getTranslations } from 'next-intl/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Link } from '@/i18n/navigation'

export default async function AdminDashboardPage() {
  await auth()
  const t = await getTranslations('admin.dashboard')
  const today = new Date()
  const thirtyDaysFromNow = new Date(today)
  thirtyDaysFromNow.setDate(today.getDate() + 30)

  const [totalCompanies, pendingKyc, amlAlerts, upcomingAR] = await Promise.all([
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
