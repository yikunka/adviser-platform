import { auth } from '@/lib/auth/auth'
import { prisma } from '@/lib/db/prisma'
import { getTranslations } from 'next-intl/server'
import { redirect } from 'next/navigation'
import { Link } from '@/i18n/navigation'
import {
  Building2, ShieldCheck, Bell,
  ArrowRight, FilePlus,
  ShoppingCart,
} from 'lucide-react'
import { kycStatusLabel } from '@/lib/kyc/kyc-status'

const KYC_COLOR: Record<string, { bg: string; text: string }> = {
  APPROVED: { bg: 'rgba(16,185,129,0.12)',  text: '#10b981' },
  REJECTED: { bg: 'rgba(239,68,68,0.12)',   text: '#ef4444' },
  DRAFT:    { bg: 'rgba(120,113,108,0.15)', text: '#7A7060' },
  INACTIVE: { bg: 'rgba(120,113,108,0.12)', text: '#78716c' },
}

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const session = await auth()
  const { locale } = await params
  const user = session?.user
  if (!user?.id || !user.email) redirect(`/${locale}/login`)

  const t = await getTranslations('dashboard')

  const [companies, notifications, kycRecord] = await Promise.all([
    prisma.company.findMany({
      where: {
        OR: [
          { clientUserId: user.id },
          { pendingClientEmail: user.email.toLowerCase() },
        ],
      },
      select: { id: true, nameEn: true, nameZh: true, companyNumber: true },
      take: 5,
    }),
    prisma.notification.findMany({
      where: { userId: user.id, isRead: false },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
    prisma.keyPerson.findFirst({
      where: {
        OR: [
          { submittedByUserId: user.id },
          { companyLinks: { some: { company: { clientUserId: user.id } } } },
        ],
      },
      orderBy: { updatedAt: 'desc' },
      select: { kycStatus: true },
    }),
  ])

  const kycStatus = kycRecord?.kycStatus ?? null
  const kycColors = kycStatus ? (KYC_COLOR[kycStatus] ?? KYC_COLOR.DRAFT) : null

  const quickLinks = [
    { href: '/orders',    Icon: ShoppingCart, label: t('quickLinks.newOrder') },
    { href: '/kyc',       Icon: FilePlus,     label: t('quickLinks.uploadDoc') },
  ]

  return (
    <div className="p-6 space-y-7">

      {/* Page header */}
      <div>
        <h1 className="text-2xl font-semibold" style={{ color: 'var(--foreground)' }}>
          {t('title')}
        </h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--muted-foreground)' }}>
          {t('welcome', { name: user.name })}
        </p>
      </div>

      {/* ── Stat cards ── */}
      <div className="grid sm:grid-cols-3 gap-4">

        {/* Companies */}
        <div
          className="rounded-xl p-5 flex flex-col gap-3"
          style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--muted-foreground)' }}>
              {t('companies')}
            </span>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(201,169,110,0.12)' }}>
              <Building2 size={15} style={{ color: '#C9A96E' }} />
            </div>
          </div>
          <p className="text-3xl font-bold" style={{ color: '#C9A96E' }}>{companies.length}</p>
        </div>

        {/* KYC Status */}
        <div
          className="rounded-xl p-5 flex flex-col gap-3"
          style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--muted-foreground)' }}>
              {t('kycStatus')}
            </span>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: kycColors ? `${kycColors.text}18` : 'rgba(120,113,108,0.12)' }}>
              <ShieldCheck size={15} style={{ color: kycColors?.text ?? '#7A7060' }} />
            </div>
          </div>
          {kycStatus && kycColors ? (
            <span
              className="self-start px-2.5 py-1 rounded-full text-xs font-semibold"
              style={{ background: kycColors.bg, color: kycColors.text }}
            >
              {kycStatusLabel(kycStatus)}
            </span>
          ) : (
            <p className="text-3xl font-bold" style={{ color: '#7A7060' }}>—</p>
          )}
        </div>

        {/* Notifications */}
        <div
          className="rounded-xl p-5 flex flex-col gap-3"
          style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--muted-foreground)' }}>
              {t('notifications')}
            </span>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: notifications.length > 0 ? 'rgba(201,169,110,0.12)' : 'rgba(120,113,108,0.12)' }}>
              <Bell size={15} style={{ color: notifications.length > 0 ? '#C9A96E' : '#7A7060' }} />
            </div>
          </div>
          <p className="text-3xl font-bold" style={{ color: notifications.length > 0 ? '#C9A96E' : '#7A7060' }}>
            {notifications.length}
          </p>
        </div>
      </div>

      {/* ── Quick actions ── */}
      <div>
        <h2 className="text-xs font-medium uppercase tracking-wider mb-3" style={{ color: 'var(--muted-foreground)' }}>
          {t('quickLinksTitle')}
        </h2>
        <div className="grid sm:grid-cols-2 gap-3">
          {quickLinks.map(({ href, Icon, label }) => (
            <Link
              key={href}
              href={href}
              className="portal-card-hover group flex items-center gap-3 px-4 py-3.5 rounded-xl"
              style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
            >
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(201,169,110,0.1)', border: '1px solid rgba(201,169,110,0.2)' }}
              >
                <Icon size={16} style={{ color: '#C9A96E' }} />
              </div>
              <span className="text-sm font-medium flex-1" style={{ color: 'var(--foreground)' }}>
                {label}
              </span>
              <ArrowRight size={14} style={{ color: '#C9A96E', opacity: 0.5 }} />
            </Link>
          ))}
        </div>
      </div>

      {/* ── Companies ── */}
      {companies.length > 0 && (
        <div>
          <h2 className="text-xs font-medium uppercase tracking-wider mb-3" style={{ color: 'var(--muted-foreground)' }}>
            {t('companies')}
          </h2>
          <div className="rounded-xl overflow-hidden" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
            {companies.map((c, i) => (
              <Link
                key={c.id}
                href={`/companies/${c.id}`}
                className="portal-row-hover flex items-center justify-between px-5 py-4"
                style={{ borderBottom: i < companies.length - 1 ? '1px solid var(--border)' : 'none' }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0"
                    style={{ background: 'rgba(201,169,110,0.1)', color: '#C9A96E', border: '1px solid rgba(201,169,110,0.2)' }}
                  >
                    {(c.nameEn ?? '?').charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>{c.nameEn}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>{c.companyNumber}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* ── Notifications ── */}
      {notifications.length > 0 && (
        <div>
          <h2 className="text-xs font-medium uppercase tracking-wider mb-3" style={{ color: 'var(--muted-foreground)' }}>
            {t('notifications')}
          </h2>
          <div className="rounded-xl overflow-hidden" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
            {notifications.map((n, i) => (
              <div
                key={n.id}
                className="portal-row-hover flex items-start gap-3 px-5 py-4"
                style={{ borderBottom: i < notifications.length - 1 ? '1px solid var(--border)' : 'none' }}
              >
                <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style={{ background: '#C9A96E' }} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm" style={{ color: 'var(--foreground)' }}>{n.message}</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                    {new Date(n.createdAt).toLocaleDateString(locale === 'zh' ? 'zh-HK' : 'en-HK')}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
