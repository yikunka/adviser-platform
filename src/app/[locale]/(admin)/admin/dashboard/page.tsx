import { auth } from '@/lib/auth/auth'
import { prisma } from '@/lib/db/prisma'
import { getTranslations } from 'next-intl/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Link } from '@/i18n/navigation'
import {
  adminMenusAllow,
  computeEffectiveAdminMenus,
  type AdminMenuKey,
} from '@/lib/auth/admin-access'

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
    card: 'border border-[#C9A96E33] bg-[linear-gradient(180deg,rgba(201,169,110,0.10),rgba(201,169,110,0.02))]',
    eyebrow: '#C9A96E',
    tileBg: 'rgba(201,169,110,0.05)',
    tileBorder: 'rgba(201,169,110,0.22)',
    buttonBorder: 'rgba(201,169,110,0.28)',
    buttonHover: 'hover:bg-[#1A1A12]',
  },
} as const

const SFS_MENU_KEYS: AdminMenuKey[] = [
  'sfsOrders',
  'sfsCustomers',
  'sfsInvoices',
  'sfsDiamondSpecs',
  'sfsFactory',
]

type TodoKind = 'pending_quote' | 'pending_image' | 'cvd_due'

type SfsTodoItem = {
  id: string
  kind: TodoKind
  href: string
  title: string
  detail: string
  at: Date
}

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

function addDays(d: Date, days: number) {
  const next = new Date(d)
  next.setDate(next.getDate() + days)
  return next
}

export default async function AdminDashboardPage() {
  const session = await auth()
  const t = await getTranslations('admin.dashboard')
  const today = new Date()
  const thirtyDaysFromNow = addDays(today, 30)
  const sevenDaysFromNow = addDays(today, 7)
  const threeDaysFromNow = addDays(today, 3)
  const monthStart = startOfMonth(today)

  const userRow = session?.user?.id
    ? await prisma.user.findUnique({
        where: { id: session.user.id },
        select: {
          role: true,
          adminMenuKeys: true,
          adminPlatforms: true,
          adminRoles: { select: { role: { select: { permissions: true } } } },
        },
      })
    : null

  const menuAccess = userRow
    ? computeEffectiveAdminMenus({
        ...userRow,
        adminRolesPermissions: userRow.adminRoles.map(r => r.role.permissions),
      })
    : new Set<AdminMenuKey>()

  const canSee = (key: AdminMenuKey) => adminMenusAllow(menuAccess, key)
  const showSfs = SFS_MENU_KEYS.some(key => canSee(key))
  const canOrders = canSee('sfsOrders')
  const canInvoices = canSee('sfsInvoices')

  const [totalCompanies, pendingKyc, amlAlerts, upcomingAR] = await Promise.all([
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
  ])

  const adviserStats = [
    { label: t('totalCompanies'), value: totalCompanies, href: '/admin/companies', accent: '#38bdf8' },
    { label: t('pendingKyc'), value: pendingKyc, href: '/admin/kyc', accent: '#f59e0b' },
    { label: t('amlAlerts'), value: amlAlerts, href: '/admin/aml', accent: '#ef4444' },
    { label: t('upcomingAR'), value: upcomingAR, href: '/admin/companies', accent: '#10b981' },
  ]

  let sfsStats: { label: string; value: number; href: string; accent: string }[] = []
  let sfsTodos: SfsTodoItem[] = []
  let sfsQuickLinks: { href: string; label: string }[] = []

  if (showSfs) {
    const [
      pendingQuote,
      confirmedProduction,
      pendingImages,
      cvdDueSoon,
      awaitingInvoice,
      newThisMonth,
      pendingOrders,
      pendingAttachments,
      cvdWatchOrders,
    ] = await Promise.all([
      canOrders
        ? prisma.sfsOrder.count({ where: { status: 'PENDING' } })
        : Promise.resolve(0),
      canOrders
        ? prisma.sfsOrder.count({ where: { status: 'CONFIRMED' } })
        : Promise.resolve(0),
      canOrders
        ? prisma.sfsOrderStepAttachment.count({ where: { reviewStatus: 'PENDING' } })
        : Promise.resolve(0),
      canOrders
        ? prisma.sfsOrder.count({
            where: {
              status: { in: ['CONFIRMED', 'QUOTED'] },
              cvdEndAt: null,
              cvdExpectedEndAt: { not: null, lte: sevenDaysFromNow },
            },
          })
        : Promise.resolve(0),
      canOrders || canInvoices
        ? prisma.sfsOrder.count({
            where: {
              status: { in: ['CONFIRMED', 'COMPLETED'] },
              invoices: { none: {} },
            },
          })
        : Promise.resolve(0),
      canOrders
        ? prisma.sfsOrder.count({ where: { createdAt: { gte: monthStart } } })
        : Promise.resolve(0),
      canOrders
        ? prisma.sfsOrder.findMany({
            where: { status: 'PENDING' },
            orderBy: { createdAt: 'asc' },
            take: 6,
            select: {
              id: true,
              sampleCode: true,
              memorialName: true,
              clientName: true,
              createdAt: true,
            },
          })
        : Promise.resolve([]),
      canOrders
        ? prisma.sfsOrderStepAttachment.findMany({
            where: { reviewStatus: 'PENDING' },
            orderBy: { createdAt: 'asc' },
            take: 6,
            select: {
              id: true,
              createdAt: true,
              fileName: true,
              step: {
                select: {
                  particular: true,
                  phase: true,
                  order: {
                    select: {
                      id: true,
                      sampleCode: true,
                      clientName: true,
                      memorialName: true,
                    },
                  },
                },
              },
            },
          })
        : Promise.resolve([]),
      canOrders
        ? prisma.sfsOrder.findMany({
            where: {
              status: { in: ['CONFIRMED', 'QUOTED'] },
              cvdEndAt: null,
              cvdExpectedEndAt: { not: null, lte: threeDaysFromNow },
            },
            orderBy: { cvdExpectedEndAt: 'asc' },
            take: 6,
            select: {
              id: true,
              sampleCode: true,
              memorialName: true,
              clientName: true,
              cvdExpectedEndAt: true,
            },
          })
        : Promise.resolve([]),
    ])

    if (canOrders) {
      sfsStats.push(
        {
          label: t('sfs.pendingQuote'),
          value: pendingQuote,
          href: '/admin/sfs-orders?status=PENDING',
          accent: '#C9A96E',
        },
        {
          label: t('sfs.inProduction'),
          value: confirmedProduction,
          href: '/admin/sfs-orders?status=CONFIRMED',
          accent: '#10b981',
        },
        {
          label: t('sfs.pendingImages'),
          value: pendingImages,
          href: '/admin/sfs-orders?status=CONFIRMED',
          accent: '#f59e0b',
        },
        {
          label: t('sfs.cvdDueSoon'),
          value: cvdDueSoon,
          href: '/admin/sfs-orders?status=CONFIRMED',
          accent: '#ef4444',
        },
      )
    }
    if (canOrders || canInvoices) {
      sfsStats.push({
        label: t('sfs.awaitingInvoice'),
        value: awaitingInvoice,
        href: canInvoices ? '/admin/sfs-invoices' : '/admin/sfs-orders?status=CONFIRMED',
        accent: '#38bdf8',
      })
    }
    if (canOrders) {
      sfsStats.push({
        label: t('sfs.newThisMonth'),
        value: newThisMonth,
        href: '/admin/sfs-orders',
        accent: '#a78bfa',
      })
    }

    for (const order of pendingOrders) {
      sfsTodos.push({
        id: `quote-${order.id}`,
        kind: 'pending_quote',
        href: `/admin/sfs-orders/${order.id}`,
        title: order.sampleCode ?? order.memorialName,
        detail: `${order.clientName} · ${t('sfs.todo.pendingQuote')}`,
        at: order.createdAt,
      })
    }
    for (const attachment of pendingAttachments) {
      const order = attachment.step.order
      sfsTodos.push({
        id: `img-${attachment.id}`,
        kind: 'pending_image',
        href: `/admin/sfs-orders/${order.id}`,
        title: order.sampleCode ?? order.memorialName,
        detail: `${order.clientName} · ${t('sfs.todo.pendingImage')} · ${attachment.step.particular}`,
        at: attachment.createdAt,
      })
    }
    for (const order of cvdWatchOrders) {
      const due = order.cvdExpectedEndAt!
      const overdue = due.getTime() < today.getTime()
      sfsTodos.push({
        id: `cvd-${order.id}`,
        kind: 'cvd_due',
        href: `/admin/sfs-orders/${order.id}`,
        title: order.sampleCode ?? order.memorialName,
        detail: `${order.clientName} · ${overdue ? t('sfs.todo.cvdOverdue') : t('sfs.todo.cvdDueSoon')} · ${due.toLocaleDateString()}`,
        at: due,
      })
    }
    sfsTodos.sort((a, b) => a.at.getTime() - b.at.getTime())
    sfsTodos = sfsTodos.slice(0, 10)

    if (canSee('sfsCustomers')) sfsQuickLinks.push({ href: '/admin/sfs-customers', label: t('sfs.links.customers') })
    if (canOrders) sfsQuickLinks.push({ href: '/admin/sfs-orders', label: t('sfs.links.orders') })
    if (canSee('sfsFactory')) sfsQuickLinks.push({ href: '/admin/sfs-factory', label: t('sfs.links.pricing') })
    if (canSee('sfsDiamondSpecs')) sfsQuickLinks.push({ href: '/admin/sfs-diamond-specs', label: t('sfs.links.specs') })
    if (canInvoices) sfsQuickLinks.push({ href: '/admin/sfs-invoices', label: t('sfs.links.invoices') })
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>{t('title')}</h1>

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
            {adviserStats.map(({ label, value, href, accent }) => (
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

      {showSfs && (
        <Card className={moduleStyles.sfs.card}>
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: moduleStyles.sfs.eyebrow }}>
                SFS Diamond
              </p>
              <CardTitle className="text-base mt-1">{t('sfs.title')}</CardTitle>
              <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>{t('sfs.subtitle')}</p>
            </div>
            {canOrders && (
              <Link
                href="/admin/sfs-orders"
                className={`text-sm font-medium rounded-md px-3 py-2 transition-colors ${moduleStyles.sfs.buttonHover}`}
                style={{ color: moduleStyles.sfs.eyebrow, border: `1px solid ${moduleStyles.sfs.buttonBorder}` }}
              >
                {t('sfs.viewOrders')}
              </Link>
            )}
          </CardHeader>
          <CardContent className="space-y-5">
            {sfsStats.length > 0 && (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                {sfsStats.map(({ label, value, href, accent }) => (
                  <Link
                    key={label}
                    href={href}
                    className="group rounded-lg p-4 transition-colors hover:bg-[#1A1A12]"
                    style={{ border: `1px solid ${moduleStyles.sfs.tileBorder}`, background: moduleStyles.sfs.tileBg }}
                  >
                    <span className="block h-1 w-8 rounded-full mb-4" style={{ background: accent }} />
                    <p className="text-3xl font-bold tabular-nums" style={{ color: 'var(--foreground)' }}>{value}</p>
                    <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>{label}</p>
                  </Link>
                ))}
              </div>
            )}

            {sfsQuickLinks.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {sfsQuickLinks.map(link => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="text-xs font-medium rounded-full px-3 py-1.5 transition-colors hover:opacity-90"
                    style={{
                      color: moduleStyles.sfs.eyebrow,
                      border: `1px solid ${moduleStyles.sfs.buttonBorder}`,
                      background: 'rgba(201,169,110,0.06)',
                    }}
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            )}

            <div>
              <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--foreground)' }}>
                {t('sfs.todoTitle')}
              </h3>
              {sfsTodos.length === 0 ? (
                <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>{t('sfs.todoEmpty')}</p>
              ) : (
                <ul className="divide-y divide-[#2A2418] rounded-lg overflow-hidden" style={{ border: '1px solid #2A2418' }}>
                  {sfsTodos.map(item => (
                    <li key={item.id}>
                      <Link
                        href={item.href}
                        className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 px-4 py-3 text-sm transition-colors hover:bg-[#1A1A12]"
                      >
                        <span
                          className="inline-flex w-fit rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                          style={{
                            background:
                              item.kind === 'pending_quote'
                                ? 'rgba(201,169,110,0.14)'
                                : item.kind === 'pending_image'
                                  ? 'rgba(245,158,11,0.14)'
                                  : 'rgba(239,68,68,0.14)',
                            color:
                              item.kind === 'pending_quote'
                                ? '#C9A96E'
                                : item.kind === 'pending_image'
                                  ? '#f59e0b'
                                  : '#ef4444',
                          }}
                        >
                          {item.kind === 'pending_quote'
                            ? t('sfs.todo.badgeQuote')
                            : item.kind === 'pending_image'
                              ? t('sfs.todo.badgeImage')
                              : t('sfs.todo.badgeCvd')}
                        </span>
                        <span className="font-medium" style={{ color: 'var(--foreground)' }}>{item.title}</span>
                        <span className="sm:flex-1" style={{ color: 'var(--muted-foreground)' }}>{item.detail}</span>
                        <span className="whitespace-nowrap text-xs" style={{ color: '#5A5040' }}>
                          {item.at.toLocaleString()}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
