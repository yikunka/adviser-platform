'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { usePathname, useParams } from 'next/navigation'
import { Link } from '@/i18n/navigation'
import { signOut } from 'next-auth/react'
import Image from 'next/image'
import {
  LayoutDashboard,
  Building2,
  ClipboardCheck,
  ShieldAlert,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronRight,
  Bell,
  Lock,
  Users,
  Diamond,
} from 'lucide-react'

const NAV_GROUPS = [
  {
    labelKey: 'main',
    items: [
      { href: '/admin/dashboard',  key: 'dashboard',  Icon: LayoutDashboard },
    ],
  },
  {
    labelKey: 'adviser',
    items: [
      { href: '/admin/companies',  key: 'companies',  Icon: Building2       },
      { href: '/admin/kyc',        key: 'kyc',        Icon: ClipboardCheck  },
      { href: '/admin/aml',        key: 'aml',        Icon: ShieldAlert     },
    ],
  },
  {
    labelKey: 'sfsDiamond',
    items: [
      { href: '/admin/users',      key: 'users',      Icon: Users           },
      { href: '/admin/sfs-orders', key: 'sfsOrders',  Icon: Diamond         },
    ],
  },
  {
    labelKey: 'system',
    items: [
      { href: '/admin/settings',   key: 'settings',   Icon: Settings        },
    ],
  },
] as const

const ROLE_BADGE: Record<string, { label: string; bg: string; text: string }> = {
  SUPER_ADMIN: { label: 'Super Admin', bg: 'rgba(201,169,110,0.18)', text: '#C9A96E' },
  COMPLIANCE:  { label: 'Compliance',  bg: 'rgba(99,102,241,0.18)',  text: '#818cf8' },
  STAFF:       { label: 'Staff',       bg: 'rgba(16,185,129,0.15)', text: '#10b981' },
}

export default function AdminShell({
  children,
  userName,
  userRole,
}: {
  children: React.ReactNode
  userName: string
  userRole: string
}) {
  const t = useTranslations('nav')
  const tAdmin = useTranslations('admin')
  const pathname = usePathname()
  const params = useParams()
  const locale = (params.locale as string) ?? 'zh'
  const [sidebarOpen, setSidebarOpen] = useState(false)

  function isActive(href: string) {
    // match on the path segment after /admin/
    return pathname.includes(href)
  }

  const roleBadge = ROLE_BADGE[userRole] ?? { label: userRole, bg: 'rgba(120,113,108,0.15)', text: '#9A8060' }

  return (
    <div
      className="theme-dark min-h-screen flex"
      style={{ background: 'var(--background)', color: 'var(--foreground)' }}
    >
      {/* ── Sidebar ── */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50 w-64 flex flex-col
          transform transition-transform duration-300 ease-in-out
          md:static md:translate-x-0
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
        style={{ background: '#080808', borderRight: '1px solid var(--sidebar-border)' }}
      >
        {/* Logo + admin tag */}
        <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--sidebar-border)' }}>
          <Link href="/" className="flex items-center gap-3" onClick={() => setSidebarOpen(false)}>
            <Image src="/logo.png" alt="" width={26} height={26} className="object-contain flex-shrink-0" />
            <Image src="/logo_text.avif" alt="6AM Advisory" width={100} height={26} className="object-contain" style={{ filter: 'brightness(1.08)' }} />
          </Link>
          <div className="mt-3 flex items-center gap-2">
            <Lock size={10} style={{ color: '#7A7060' }} />
            <span className="text-xs" style={{ color: '#7A7060' }}>Admin Console</span>
          </div>
        </div>

        {/* Role badge */}
        <div className="px-5 pt-4 pb-2">
          <span
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
            style={{ background: roleBadge.bg, color: roleBadge.text }}
          >
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: roleBadge.text }} />
            {roleBadge.label}
          </span>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-3 space-y-5 overflow-y-auto">
          {NAV_GROUPS.map(group => (
            <div key={group.labelKey}>
              <p
                className="px-3 mb-1.5 text-xs font-medium uppercase tracking-widest"
                style={{ color: '#6A5A40' }}
              >
                {tAdmin(`nav.${group.labelKey}`)}
              </p>
              {group.items.map(({ href, key, Icon }) => {
                const active = isActive(href)
                return (
                  <Link
                    key={key}
                    href={href}
                    onClick={() => setSidebarOpen(false)}
                    className="group flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-all duration-150 relative mb-0.5"
                    style={{
                      background: active ? 'var(--sidebar-accent)' : 'transparent',
                      color: active ? '#C9A96E' : 'var(--sidebar-foreground)',
                      opacity: active ? 1 : 0.7,
                    }}
                  >
                    {active && (
                      <span
                        className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r-full"
                        style={{ background: '#C9A96E' }}
                      />
                    )}
                    <Icon
                      size={15}
                      strokeWidth={active ? 2 : 1.5}
                      style={{ color: active ? '#C9A96E' : 'inherit', flexShrink: 0 }}
                    />
                    <span className="flex-1">{t(key as 'dashboard')}</span>
                    {active && <ChevronRight size={12} style={{ color: '#C9A96E', opacity: 0.6 }} />}
                  </Link>
                )
              })}
            </div>
          ))}
        </nav>

        {/* Divider */}
        <div className="mx-4" style={{ height: '1px', background: 'var(--sidebar-border)' }} />

        {/* User area */}
        <div className="px-3 py-4 space-y-1">
          <div
            className="flex items-center gap-3 px-3 py-2 rounded-md"
            style={{ background: 'var(--sidebar-accent)' }}
          >
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
              style={{ background: roleBadge.text + '22', color: roleBadge.text, border: `1px solid ${roleBadge.text}44` }}
            >
              {userName.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold truncate" style={{ color: 'var(--foreground)' }}>{userName}</p>
              <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{roleBadge.label}</p>
            </div>
          </div>

          <button
            onClick={() => signOut({ callbackUrl: `/${locale}/login` })}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-all duration-150"
            style={{ color: 'var(--muted-foreground)' }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.color = '#ef4444'
              ;(e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.08)'
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.color = 'var(--muted-foreground)'
              ;(e.currentTarget as HTMLElement).style.background = 'transparent'
            }}
          >
            <LogOut size={15} strokeWidth={1.5} />
            <span>{t('logout')}</span>
          </button>
        </div>
      </aside>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 md:hidden"
          style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(2px)' }}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Main area ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header
          className="h-14 flex items-center justify-between px-4 flex-shrink-0"
          style={{ background: '#080808', borderBottom: '1px solid var(--sidebar-border)' }}
        >
          {/* Mobile hamburger */}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 rounded-md md:hidden"
            style={{ color: 'var(--muted-foreground)' }}
            aria-label="Toggle menu"
          >
            {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
          </button>

          {/* Mobile: wordmark */}
          <div className="md:hidden flex items-center gap-2">
            <Image src="/logo.png" alt="" width={20} height={20} className="object-contain" />
            <span className="text-sm font-semibold" style={{ color: '#C9A96E' }}>Admin Console</span>
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-2">
            <button
              className="p-2 rounded-md transition-colors"
              style={{ color: 'var(--muted-foreground)' }}
              aria-label="Notifications"
            >
              <Bell size={16} />
            </button>
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
              style={{ background: roleBadge.text + '22', color: roleBadge.text }}
            >
              {userName.charAt(0).toUpperCase()}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto p-6" style={{ background: 'var(--background)' }}>
          {children}
        </main>
      </div>
    </div>
  )
}
