'use client'

import { useState } from 'react'
import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { usePathname, useParams } from 'next/navigation'
import { Link, useRouter } from '@/i18n/navigation'
import { List, X } from '@phosphor-icons/react'
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
  const { status } = useSession()

  function switchLocale() {
    const pathWithoutLocale = pathname.replace(/^\/(zh|en)/, '') || '/'
    router.push(pathWithoutLocale, { locale: otherLocale })
  }

  const strippedPath = pathname.replace(/^\/(zh|en)/, '') || '/'

  return (
    <header className="sticky top-0 z-50 w-full px-3 pt-3 sm:px-4">
      <div
        className="mx-auto max-w-6xl rounded-xl border border-[#272727] bg-black/70 shadow-[0_8px_32px_rgba(0,0,0,0.45)] backdrop-blur-xl"
      >
        <div className="flex h-14 items-center justify-between px-4 sm:px-5">
          <Link href="/" className="flex items-center gap-2.5">
            <Image src="/logo.png" width={28} height={28} alt="6AM Advisory logo mark" />
            <Image
              src="/logo_text.avif"
              width={118}
              height={28}
              alt="6AM Advisory"
              style={{ objectFit: 'contain', filter: 'grayscale(1) brightness(1.35)' }}
            />
          </Link>

          <nav className="hidden md:flex items-center gap-1" aria-label="Primary">
            {NAV_LINKS.map(({ href, key }) => {
              const isActive =
                href === '/' ? strippedPath === '/' : strippedPath.startsWith(href)
              return (
                <Link
                  key={key}
                  href={href}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                    isActive
                      ? 'bg-[#1F1F1F] text-white'
                      : 'text-[#9B9B9B] hover:bg-[#181818] hover:text-white'
                  }`}
                  aria-current={isActive ? 'page' : undefined}
                >
                  {t(key)}
                </Link>
              )
            })}
          </nav>

          <div className="hidden md:flex items-center gap-3">
            <button
              type="button"
              onClick={switchLocale}
              className="rounded-md border border-[#272727] px-2.5 py-1 text-xs font-medium text-[#9B9B9B] transition-colors duration-300 hover:border-[#313131] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9B9B9B]"
            >
              {otherLocale === 'zh' ? '中文' : 'EN'}
            </button>
            {status === 'authenticated' ? (
              <Link
                href="/dashboard"
                className="tcsp-btn-primary rounded-md px-3 py-2 text-sm font-semibold"
              >
                {t('dashboard', { defaultValue: 'My Dashboard' })}
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="text-sm font-medium text-[#9B9B9B] transition-colors duration-300 hover:text-white"
                >
                  {t('login')}
                </Link>
                <Link
                  href="/contact"
                  className="tcsp-btn-primary rounded-md px-3 py-2 text-sm font-semibold"
                >
                  {t('getStarted')}
                </Link>
              </>
            )}
          </div>

          <button
            type="button"
            className="md:hidden rounded-md p-2 text-[#9B9B9B] transition-colors duration-300 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9B9B9B]"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
          >
            {menuOpen ? <X size={22} weight="bold" /> : <List size={22} weight="bold" />}
          </button>
        </div>

        {menuOpen && (
          <div className="space-y-1 border-t border-[#272727] px-4 pb-4 pt-3 md:hidden">
            {NAV_LINKS.map(({ href, key }, index) => {
              const isActive =
                href === '/' ? strippedPath === '/' : strippedPath.startsWith(href)
              return (
                <Link
                  key={key}
                  href={href}
                  className={`block rounded-md px-2 py-2.5 text-sm font-medium transition-colors duration-300 ${
                    isActive ? 'bg-[#1F1F1F] text-white' : 'text-[#9B9B9B] hover:text-white'
                  }`}
                  style={{ transitionDelay: `${index * 60}ms` }}
                  onClick={() => setMenuOpen(false)}
                >
                  {t(key)}
                </Link>
              )
            })}
            <div className="mt-2 flex items-center gap-3 border-t border-[#272727] pt-3">
              <button
                type="button"
                onClick={switchLocale}
                className="rounded-md border border-[#272727] px-2.5 py-1 text-xs font-medium text-[#9B9B9B]"
              >
                {otherLocale === 'zh' ? '中文' : 'EN'}
              </button>
              {status === 'authenticated' ? (
                <Link
                  href="/dashboard"
                  className="tcsp-btn-primary rounded-md px-3 py-2 text-sm font-semibold"
                  onClick={() => setMenuOpen(false)}
                >
                  {t('dashboard', { defaultValue: 'My Dashboard' })}
                </Link>
              ) : (
                <>
                  <Link
                    href="/login"
                    className="text-sm font-medium text-[#9B9B9B]"
                    onClick={() => setMenuOpen(false)}
                  >
                    {t('login')}
                  </Link>
                  <Link
                    href="/contact"
                    className="tcsp-btn-primary rounded-md px-3 py-2 text-sm font-semibold"
                    onClick={() => setMenuOpen(false)}
                  >
                    {t('getStarted')}
                  </Link>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  )
}
