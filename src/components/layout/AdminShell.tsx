'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { usePathname, useParams, useRouter } from 'next/navigation'
import { Link } from '@/i18n/navigation'
import { signOut } from 'next-auth/react'
import Image from 'next/image'
import { FeedbackWidget } from '@/components/feedback/FeedbackWidget'
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
  ContactRound,
  Diamond,
  Package,
  UserCog,
  FlaskConical,
  Beaker,
  ClipboardList,
  BookOpen,
  Boxes,
  FolderTree,
  Layers,
  FileText,
  Palette,
  WalletCards,
  FileBarChart,
  MessageSquarePlus,
  SlidersHorizontal,
  UserRound,
  ReceiptText,
  HandCoins,
  Landmark,
  Contact,
  Truck,
} from 'lucide-react'
import type { AdminMenuKey } from '@/lib/auth/admin-access'
import { pathnameToAdminMenuKey, adminMenusAllow } from '@/lib/auth/admin-access'
import { isAdminNavHrefActive } from '@/lib/admin-navigation'

type MenuAccess = ReadonlySet<AdminMenuKey> | 'all'

type NavItem = {
  href: string
  key: AdminMenuKey
  labelKey?: string
  Icon: typeof LayoutDashboard
}

type NavGroup = {
  labelKey: string
  items: readonly NavItem[]
}

const NAV_GROUPS: NavGroup[] = [
  {
    labelKey: 'main',
    items: [{ href: '/admin/dashboard', key: 'dashboard', Icon: LayoutDashboard }],
  },
  {
    labelKey: 'adviser',
    items: [
      { href: '/admin/companies', key: 'companies', Icon: Building2 },
      { href: '/admin/kyc', key: 'kyc', Icon: ClipboardCheck },
      { href: '/admin/aml', key: 'aml', Icon: ShieldAlert },
      { href: '/admin/invoices', key: 'invoices', Icon: FileText },
    ],
  },
  {
    labelKey: 'financeManagement',
    items: [
      { href: '/admin/financial', key: 'financial', labelKey: 'financialCompanySelect', Icon: Building2 },
      { href: '/admin/financial/accounts', key: 'financial', labelKey: 'financialAccounts', Icon: WalletCards },
      { href: '/admin/financial/journal', key: 'financial', labelKey: 'financialJournal', Icon: FileText },
      { href: '/admin/financial/ledger', key: 'financial', labelKey: 'financialLedger', Icon: Layers },
      { href: '/admin/financial/reports', key: 'financial', labelKey: 'financialReports', Icon: FileBarChart },
      { href: '/admin/financial/[companyId]/receivables', key: 'financial', labelKey: 'financialReceivables', Icon: ReceiptText },
      { href: '/admin/financial/[companyId]/payables', key: 'financial', labelKey: 'financialPayables', Icon: HandCoins },
      { href: '/admin/financial/[companyId]/banking', key: 'financial', labelKey: 'financialBanking', Icon: Landmark },
      { href: '/admin/financial/[companyId]/parties', key: 'financial', labelKey: 'financialParties', Icon: Contact },
    ],
  },
  {
    labelKey: 'sfsDiamond',
    items: [
      { href: '/admin/sfs-customers', key: 'sfsCustomers', Icon: ContactRound },
      { href: '/admin/sfs-orders', key: 'sfsOrders', Icon: Diamond },
      { href: '/admin/sfs-diamond-specs', key: 'sfsDiamondSpecs', Icon: SlidersHorizontal },
      { href: '/admin/sfs-invoices', key: 'sfsInvoices', Icon: FileText },
    ],
  },
  {
    labelKey: 'cosmocoat',
    items: [
      { href: '/admin/cosmocoat-products', key: 'cosmocoatProducts', Icon: Package },
      { href: '/admin/cosmocoat-raw-materials', key: 'cosmocoatRawMaterials', Icon: FlaskConical },
      { href: '/admin/cosmocoat-recipes', key: 'cosmocoatRecipes', Icon: Beaker },
      { href: '/admin/cosmocoat-recipe-approvals', key: 'cosmocoatRecipes', labelKey: 'cosmocoatRecipeApprovals', Icon: ClipboardCheck },
      { href: '/admin/cosmocoat-product-categories', key: 'cosmocoatFactoryProducts', labelKey: 'cosmocoatFactoryProductCategories', Icon: FolderTree },
      { href: '/admin/cosmocoat-factory-products', key: 'cosmocoatFactoryProducts', Icon: Boxes },
      { href: '/admin/cosmocoat-color-formulas', key: 'cosmocoatColorFormulas', Icon: Palette },
      { href: '/admin/cosmocoat-production-orders', key: 'cosmocoatProductionOrders', Icon: ClipboardList },
      { href: '/admin/cosmocoat-process-kits', key: 'cosmocoatProcessKits', Icon: BookOpen },
      { href: '/admin/cosmocoat-sample-orders', key: 'cosmocoatSampleOrders', Icon: FlaskConical },
      { href: '/admin/cosmocoat-customers', key: 'cosmocoatCustomers', Icon: ContactRound },
      { href: '/admin/cosmocoat-suppliers', key: 'cosmocoatSuppliers', Icon: Truck },
      { href: '/admin/cosmocoat-employees', key: 'cosmocoatEmployees', Icon: UserRound },
    ],
  },
  {
    labelKey: 'system',
    items: [
      { href: '/admin/users', key: 'users', Icon: Users },
      { href: '/admin/team', key: 'adminTeam', Icon: UserCog },
      { href: '/admin/settings', key: 'settings', Icon: Settings },
    ],
  },
] as const

const ROLE_BADGE: Record<string, { label: string; bg: string; text: string }> = {
  SUPER_ADMIN: { label: 'Super Admin', bg: 'rgba(201,169,110,0.18)', text: '#C9A96E' },
  COMPLIANCE: { label: 'Compliance', bg: 'rgba(99,102,241,0.18)', text: '#818cf8' },
  STAFF: { label: 'Staff', bg: 'rgba(16,185,129,0.15)', text: '#10b981' },
}

function canSeeMenu(access: MenuAccess, key: AdminMenuKey, userRole: string): boolean {
  if (key === 'adminTeam' && userRole !== 'SUPER_ADMIN') return false
  return adminMenusAllow(access, key)
}

function AdminRouteGuard({
  children,
  menuAccess,
  userRole,
  locale,
}: {
  children: React.ReactNode
  menuAccess: MenuAccess
  userRole: string
  locale: string
}) {
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    const key = pathnameToAdminMenuKey(pathname)
    if (!key) return
    if (!canSeeMenu(menuAccess, key, userRole)) {
      router.replace(`/${locale}/admin/dashboard`)
    }
  }, [pathname, menuAccess, userRole, locale, router])

  return <>{children}</>
}

export default function AdminShell({
  children,
  userName,
  userRole,
  menuAccess,
  locale,
}: {
  children: React.ReactNode
  userName: string
  userRole: string
  menuAccess: MenuAccess
  locale: string
}) {
  const t = useTranslations('nav')
  const tAdmin = useTranslations('admin')
  const pathname = usePathname()
  const params = useParams()
  const navLocale = (params.locale as string) ?? locale
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const financialCompanyId = pathname.match(/\/admin\/financial\/([^/]+)\//)?.[1] ?? null

  function resolveHref(item: NavItem) {
    if (!item.href.includes('[companyId]')) return item.href
    if (financialCompanyId) return item.href.replace('[companyId]', financialCompanyId)
    return '/admin/financial'
  }

  function isActive(item: NavItem) {
    return isAdminNavHrefActive(pathname, item.href)
  }

  function visibleItemsForGroup(group: NavGroup) {
    return group.items.filter(it => canSeeMenu(menuAccess, it.key, userRole))
  }

  function activeGroupKey() {
    for (const group of NAV_GROUPS) {
      const visibleItems = visibleItemsForGroup(group)
      if (visibleItems.some(item => isActive(item))) return group.labelKey
    }
    return null
  }

  function defaultExpandedGroup() {
    const active = activeGroupKey()
    if (active) return active
    return NAV_GROUPS.find(group => visibleItemsForGroup(group).length > 0)?.labelKey ?? null
  }

  const [expandedGroupState, setExpandedGroupState] = useState<{ pathname: string; group: string | null }>(() => ({
    pathname,
    group: defaultExpandedGroup(),
  }))
  const expandedGroup = expandedGroupState.pathname === pathname
    ? expandedGroupState.group
    : defaultExpandedGroup()

  const roleBadge = ROLE_BADGE[userRole] ?? { label: userRole, bg: 'rgba(120,113,108,0.15)', text: '#9A8060' }

  return (
    <div
      className="theme-dark admin-console h-screen overflow-hidden flex"
      style={{ background: 'var(--background)', color: 'var(--foreground)' }}
    >
      <aside
        className={`
          fixed inset-y-0 left-0 z-50 w-64 flex flex-col h-screen flex-shrink-0
          transform transition-transform duration-300 ease-in-out
          md:sticky md:top-0 md:translate-x-0
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
        style={{ background: '#080808', borderRight: '1px solid var(--sidebar-border)' }}
      >
        <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--sidebar-border)' }}>
          <Link href="/" className="flex items-center gap-3" onClick={() => setSidebarOpen(false)}>
            <Image src="/logo.png" alt="" width={26} height={26} className="object-contain flex-shrink-0" />
            <Image
              src="/logo_text.avif"
              alt="6AM Advisory"
              width={100}
              height={26}
              className="object-contain"
              style={{ filter: 'brightness(1.08)' }}
            />
          </Link>
          <div className="mt-3 flex items-center gap-2">
            <Lock size={10} style={{ color: '#A99A80' }} />
            <span className="text-xs font-medium" style={{ color: '#A99A80' }}>
              Admin Console
            </span>
          </div>
        </div>

        <div className="px-5 pt-4 pb-2">
          <span
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
            style={{ background: roleBadge.bg, color: roleBadge.text }}
          >
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: roleBadge.text }} />
            {roleBadge.label}
          </span>
        </div>

        <nav className="flex-1 px-3 py-3 space-y-5 overflow-y-auto">
          {NAV_GROUPS.map(group => {
            const visibleItems = visibleItemsForGroup(group)
            if (visibleItems.length === 0) return null
            const isExpanded = expandedGroup === group.labelKey
            const hasActiveItem = visibleItems.some(item => isActive(item))
            return (
              <div key={group.labelKey}>
                <button
                  type="button"
                  onClick={() => setExpandedGroupState({
                    pathname,
                    group: isExpanded ? null : group.labelKey,
                  })}
                  className="mb-1.5 flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-xs font-semibold uppercase tracking-widest transition-colors"
                  style={{
                    color: hasActiveItem || isExpanded ? '#C9A96E' : '#A99A80',
                    background: isExpanded ? 'rgba(201,169,110,0.08)' : 'transparent',
                  }}
                  aria-expanded={isExpanded}
                >
                  <span className="flex-1 text-left">{tAdmin(`nav.${group.labelKey}` as Parameters<typeof tAdmin>[0])}</span>
                  <ChevronRight
                    size={12}
                    className="transition-transform duration-150"
                    style={{
                      color: 'inherit',
                      transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                    }}
                  />
                </button>
                {isExpanded && visibleItems.map(item => {
                  const { key, labelKey, Icon } = item
                  const href = resolveHref(item)
                  const active = isActive(item)
                  const navLabelKey = (labelKey ?? key) as 'dashboard'
                  const itemKey = `${group.labelKey}-${labelKey ?? key}-${item.href}`
                  return (
                    <Link
                      key={itemKey}
                      href={href}
                      onClick={() => setSidebarOpen(false)}
                      className="group flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-semibold transition-all duration-150 relative mb-0.5"
                      style={{
                        background: active ? 'var(--sidebar-accent)' : 'transparent',
                        color: active ? '#C9A96E' : 'var(--sidebar-foreground)',
                        opacity: active ? 1 : 0.92,
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
                      <span className="flex-1">{t(navLabelKey)}</span>
                      {active && <ChevronRight size={12} style={{ color: '#C9A96E', opacity: 0.6 }} />}
                    </Link>
                  )
                })}
              </div>
            )
          })}
        </nav>

        {/* Feedback plugin — SUPER_ADMIN only */}
        {userRole === 'SUPER_ADMIN' && (
          <div className="px-3 pb-2">
            <Link
              href="/admin/feedback"
              onClick={() => setSidebarOpen(false)}
              className="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-semibold transition-all"
              style={{
                background: pathname.includes('/admin/feedback') ? 'var(--sidebar-accent)' : 'transparent',
                color: pathname.includes('/admin/feedback') ? '#C9A96E' : 'var(--sidebar-foreground)',
                opacity: 0.9,
              }}
            >
              <MessageSquarePlus size={15} strokeWidth={1.5} style={{ flexShrink: 0 }} />
              <span>需求迭代</span>
            </Link>
          </div>
        )}

        <div className="mx-4" style={{ height: '1px', background: 'var(--sidebar-border)' }} />

        <div className="px-3 py-4 space-y-1">
          <div
            className="flex items-center gap-3 px-3 py-2 rounded-md"
            style={{ background: 'var(--sidebar-accent)' }}
          >
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
              style={{
                background: roleBadge.text + '22',
                color: roleBadge.text,
                border: `1px solid ${roleBadge.text}44`,
              }}
            >
              {userName.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold truncate" style={{ color: 'var(--foreground)' }}>
                {userName}
              </p>
              <p className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>
                {roleBadge.label}
              </p>
            </div>
          </div>

          <button
            onClick={() => signOut({ callbackUrl: `/${navLocale}/admin-login` })}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-all duration-150"
            style={{ color: 'var(--muted-foreground)' }}
            onMouseEnter={e => {
              ;(e.currentTarget as HTMLElement).style.color = '#ef4444'
              ;(e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.08)'
            }}
            onMouseLeave={e => {
              ;(e.currentTarget as HTMLElement).style.color = 'var(--muted-foreground)'
              ;(e.currentTarget as HTMLElement).style.background = 'transparent'
            }}
          >
            <LogOut size={15} strokeWidth={1.5} />
            <span>{t('logout')}</span>
          </button>
        </div>
      </aside>

      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 md:hidden"
          style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(2px)' }}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        <header
          className="h-14 flex items-center justify-between px-4 flex-shrink-0"
          style={{ background: '#080808', borderBottom: '1px solid var(--sidebar-border)' }}
        >
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 rounded-md md:hidden"
            style={{ color: 'var(--muted-foreground)' }}
            aria-label="Toggle menu"
          >
            {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
          </button>

          <div className="md:hidden flex items-center gap-2">
            <Image src="/logo.png" alt="" width={20} height={20} className="object-contain" />
            <span className="text-sm font-semibold" style={{ color: '#C9A96E' }}>
              Admin Console
            </span>
          </div>

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

        <main className="flex-1 overflow-auto p-6" style={{ background: 'var(--background)' }}>
          <AdminRouteGuard menuAccess={menuAccess} userRole={userRole} locale={navLocale}>
            {children}
          </AdminRouteGuard>
        </main>
      </div>
      {/* Feedback / requirements widget — visible on all admin pages */}
      <FeedbackWidget />
    </div>
  )
}
