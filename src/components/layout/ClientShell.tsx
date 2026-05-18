'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { usePathname, useParams } from 'next/navigation'
import { Link } from '@/i18n/navigation'
import { signOut } from 'next-auth/react'
import Image from 'next/image'
import {
  LayoutDashboard,
  ClipboardList,
  ShoppingBag,
  Building2,
  LogOut,
  Menu,
  X,
  ChevronRight,
  Bell,
} from 'lucide-react'

const NAV_ITEMS = [
  { href: '/dashboard',  key: 'dashboard',  Icon: LayoutDashboard },
  { href: '/companies',  key: 'companies',  Icon: Building2       },
  { href: '/kyc',        key: 'kyc',        Icon: ClipboardList   },
  { href: '/orders',     key: 'orders',     Icon: ShoppingBag     },
] as const

export default function ClientShell({
  children,
  userName,
}: {
  children: React.ReactNode
  userName: string
}) {
  const t = useTranslations('nav')
  const pathname = usePathname()
  const params = useParams()
  const locale = (params.locale as string) ?? 'zh'
  const [sidebarOpen, setSidebarOpen] = useState(false)

  function isActive(href: string) {
    return pathname.includes(href)
  }

  return (
    <div className="theme-dark min-h-screen flex" style={{ background: 'var(--background)', color: 'var(--foreground)' }}>

      {/* ── Sidebar ───────────────────────────────────────────────── */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50 w-64 flex flex-col
          transform transition-transform duration-300 ease-in-out
          md:static md:translate-x-0
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
        style={{
          background: 'var(--sidebar)',
          borderRight: '1px solid var(--sidebar-border)',
        }}
      >
        {/* Logo */}
        <div className="flex items-center px-5 py-4" style={{ borderBottom: '1px solid var(--sidebar-border)' }}>
          <Link href="/" className="flex items-center gap-3" onClick={() => setSidebarOpen(false)}>
            <Image src="/logo.png" alt="" width={28} height={28} className="object-contain flex-shrink-0" />
            <Image src="/logo_text.avif" alt="6AM Advisory" width={110} height={28} className="object-contain" style={{ filter: 'brightness(1.08)' }} />
          </Link>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-5 space-y-0.5">
          {NAV_ITEMS.map(({ href, key, Icon }) => {
            const active = isActive(href)
            return (
              <Link
                key={key}
                href={href}
                onClick={() => setSidebarOpen(false)}
                className="group flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-all duration-150 relative"
                style={{
                  background: active ? 'var(--sidebar-accent)' : 'transparent',
                  color: active ? 'var(--gold)' : 'var(--sidebar-foreground)',
                  opacity: active ? 1 : 0.75,
                }}
              >
                {active && (
                  <span
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r-full"
                    style={{ background: 'var(--gold)' }}
                  />
                )}
                <Icon
                  size={16}
                  strokeWidth={active ? 2 : 1.5}
                  style={{ color: active ? 'var(--gold)' : 'inherit', flexShrink: 0 }}
                />
                <span className="flex-1">{t(key)}</span>
                {active && <ChevronRight size={12} style={{ color: 'var(--gold)', opacity: 0.6 }} />}
              </Link>
            )
          })}
        </nav>

        {/* Divider */}
        <div className="mx-4" style={{ height: '1px', background: 'var(--sidebar-border)' }} />

        {/* User area */}
        <div className="px-3 py-4 space-y-1">
          <div className="flex items-center gap-3 px-3 py-2 rounded-md" style={{ background: 'var(--sidebar-accent)' }}>
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
              style={{ background: 'var(--gold)', color: '#0C0C0C' }}
            >
              {userName.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold truncate" style={{ color: 'var(--foreground)' }}>{userName}</p>
              <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Client Portal</p>
            </div>
          </div>

          <button
            onClick={() => signOut({ callbackUrl: `/${locale}/login` })}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-all duration-150 group"
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
          style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(2px)' }}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Main area ────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Top bar */}
        <header
          className="h-14 flex items-center justify-between px-4 flex-shrink-0"
          style={{
            background: 'var(--sidebar)',
            borderBottom: '1px solid var(--sidebar-border)',
          }}
        >
          {/* Mobile: hamburger */}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 rounded-md md:hidden transition-colors"
            style={{ color: 'var(--muted-foreground)' }}
            aria-label="Toggle menu"
          >
            {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
          </button>

          <div />

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
              style={{ background: 'var(--gold)', color: '#0C0C0C' }}
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
