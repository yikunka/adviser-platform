'use client'

import { useState } from 'react'
import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { usePathname, useParams } from 'next/navigation'
import { Link, useRouter } from '@/i18n/navigation'
import { Menu, X } from 'lucide-react'
import { useSession } from 'next-auth/react'

const NAV_LINKS = [
  { href: '/', key: 'home' },
  { href: '/services', key: 'services' },
  { href: '/about', key: 'about' },
  { href: '/contact', key: 'contact' },
  { href: '/faq', key: 'faq' },
] as const

export default function PublicHeader() {
  const t = useTranslations('nav')
  const params = useParams()
  const pathname = usePathname()
  const router = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)
  const locale = (params.locale as string) ?? 'zh'
  const otherLocale = locale === 'zh' ? 'en' : 'zh'
  const { data: session, status } = useSession()

  function switchLocale() {
    const pathWithoutLocale = pathname.replace(/^\/(zh|en)/, '') || '/'
    router.push(pathWithoutLocale, { locale: otherLocale })
  }

  // Determine active path for gold highlight
  const strippedPath = pathname.replace(/^\/(zh|en)/, '') || '/'

  return (
    <header
      style={{
        background: 'rgba(10,10,10,0.92)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderBottom: '1px solid #2A2418',
      }}
      className="sticky top-0 z-50 w-full"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <Image src="/logo.png" width={26} height={26} alt="6AM Advisory logo mark" />
            <Image
              src="/logo_text.avif"
              width={110}
              height={28}
              alt="6AM Advisory"
              style={{ objectFit: 'contain' }}
            />
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-6">
            {NAV_LINKS.map(({ href, key }) => {
              const isActive =
                href === '/' ? strippedPath === '/' : strippedPath.startsWith(href)
              return (
                <NavLink key={key} href={href} active={isActive}>
                  {t(key)}
                </NavLink>
              )
            })}
          </nav>

          {/* Desktop actions */}
          <div className="hidden md:flex items-center gap-3">
            <LocaleToggle label={otherLocale === 'zh' ? '中文' : 'EN'} onClick={switchLocale} />
            {status === 'authenticated' ? (
              <GetStartedButton href="/dashboard" label={t('dashboard', { defaultValue: 'My Dashboard' })} />
            ) : (
              <>
                <Link
                  href="/login"
                  style={{ color: '#C9A96E' }}
                  className="text-sm px-3 py-1.5 rounded transition-opacity hover:opacity-80"
                >
                  {t('login')}
                </Link>
                <GetStartedButton href="/register" label={t('getStarted')} />
              </>
            )}
          </div>

          {/* Mobile menu button */}
          <button
            className="md:hidden p-2"
            style={{ color: '#9A8060' }}
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Toggle menu"
          >
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div
            style={{ borderTop: '1px solid #2A2418' }}
            className="md:hidden pb-5 pt-3 space-y-1"
          >
            {NAV_LINKS.map(({ href, key }) => {
              const isActive =
                href === '/' ? strippedPath === '/' : strippedPath.startsWith(href)
              return (
                <Link
                  key={key}
                  href={href}
                  className="block px-2 py-2 text-sm rounded"
                  style={{ color: isActive ? '#C9A96E' : '#9A8060' }}
                  onClick={() => setMenuOpen(false)}
                >
                  {t(key)}
                </Link>
              )
            })}
            <div
              style={{ borderTop: '1px solid #2A2418' }}
              className="flex items-center gap-3 pt-3 mt-2"
            >
              <LocaleToggle label={otherLocale === 'zh' ? '中文' : 'EN'} onClick={switchLocale} />
              {status === 'authenticated' ? (
                <GetStartedButton
                  href="/dashboard"
                  label={t('dashboard', { defaultValue: 'My Dashboard' })}
                  onClick={() => setMenuOpen(false)}
                />
              ) : (
                <>
                  <Link
                    href="/login"
                    style={{ color: '#C9A96E' }}
                    className="text-sm"
                    onClick={() => setMenuOpen(false)}
                  >
                    {t('login')}
                  </Link>
                  <GetStartedButton
                    href="/register"
                    label={t('getStarted')}
                    onClick={() => setMenuOpen(false)}
                  />
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  )
}

/* ── Small sub-components ─────────────────────────────────────────────── */

function NavLink({
  href,
  active,
  children,
}: {
  href: string
  active: boolean
  children: React.ReactNode
}) {
  const [hovered, setHovered] = useState(false)
  return (
    <Link
      href={href}
      className="text-sm transition-colors"
      style={{ color: active || hovered ? '#C9A96E' : '#9A8060' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {children}
    </Link>
  )
}

function LocaleToggle({ label, onClick }: { label: string; onClick: () => void }) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      onClick={onClick}
      className="text-xs px-2 py-1 rounded transition-colors"
      style={{
        border: hovered ? '1px solid #C9A96E' : '1px solid #2A2418',
        color: hovered ? '#C9A96E' : '#7A7060',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {label}
    </button>
  )
}

function GetStartedButton({
  href,
  label,
  onClick,
}: {
  href: string
  label: string
  onClick?: () => void
}) {
  const [hovered, setHovered] = useState(false)
  return (
    <Link
      href={href}
      onClick={onClick}
      className="text-sm font-medium px-4 py-1.5 rounded transition-colors"
      style={{
        background: hovered ? '#D4B47A' : '#C9A96E',
        color: '#0C0C0C',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {label}
    </Link>
  )
}
