'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'

const NAV = [
  { label: 'Home',              href: '/sfsdiamond' },
  { label: 'Memorial Diamonds', href: '/sfsdiamond/memorial-diamonds' },
  { label: 'Technology',        href: '/sfsdiamond/technology' },
  { label: 'Q&A',               href: '/sfsdiamond/qa' },
  { label: 'About SFS',         href: '/sfsdiamond/about' },
]

export default function SFSHeader() {
  const [open, setOpen] = useState(false)
  const { data: session, status } = useSession()
  const pathname = usePathname()
  const isLoggedIn = status === 'authenticated' && session?.user?.platform === 'SFS_DIAMOND'

  const isDark = pathname === '/sfsdiamond'

  const headerBg    = isDark ? 'rgba(5,3,8,0.88)'      : 'rgba(250,250,248,0.95)'
  const borderColor = isDark ? 'rgba(201,169,110,0.18)' : '#E8E2D6'
  const navColor    = isDark ? '#E8DFC8'                : '#3D3D3D'
  const logoText    = isDark ? '#F0E8D8'                : '#1A1A1A'
  const hamburger   = isDark ? '#E8DFC8'                : '#3D3D3D'
  const mobileBg    = isDark ? 'rgba(5,3,8,0.97)'      : 'rgba(250,250,248,0.98)'

  return (
    <header
      className="sticky top-0 z-50"
      style={{
        background: headerBg,
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderBottom: `1px solid ${borderColor}`,
      }}
    >
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">

        {/* Logo */}
        <Link href="/sfsdiamond" className="flex items-center gap-2.5 shrink-0">
          <Image
            src="/sfsdiamond/logo.png"
            alt="SFS Diamond"
            width={112}
            height={112}
            className="rounded-full object-cover"
          />
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-7">
          {NAV.map(n => (
            <Link
              key={n.href}
              href={n.href}
              className="text-sm font-medium transition-opacity duration-150 hover:opacity-60"
              style={{ color: navColor }}
            >
              {n.label}
            </Link>
          ))}
        </nav>

        {/* Desktop actions */}
        <div className="hidden md:flex items-center gap-3">
          {isLoggedIn ? (
            <Link
              href="/sfsdiamond/dashboard"
              className="text-sm font-medium px-4 py-1.5 rounded-full border transition-opacity duration-150 hover:opacity-70"
              style={{ border: '1px solid rgba(201,169,110,0.60)', color: '#C9A96E' }}
            >
              {session?.user?.name ?? session?.user?.email}
            </Link>
          ) : (
            <>
              <Link
                href="/sfsdiamond/login"
                className="text-sm font-medium px-4 py-1.5 rounded-full border transition-all duration-150 hover:opacity-80"
                style={{ border: '1px solid rgba(201,169,110,0.60)', color: '#C9A96E' }}
              >
                Login
              </Link>
              <a
                href="mailto:sfsdiamonds@gmail.com"
                className="text-sm font-semibold px-5 py-1.5 rounded-full transition-opacity duration-150 hover:opacity-90"
                style={{ background: '#C9A96E', color: '#0A0805' }}
              >
                Contact Us
              </a>
            </>
          )}
        </div>

        {/* Mobile hamburger */}
        <button
          className="md:hidden flex flex-col gap-1.5 p-1"
          onClick={() => setOpen(o => !o)}
          aria-label="Toggle menu"
        >
          <span className={`block w-6 h-0.5 transition-all duration-300 ${open ? 'rotate-45 translate-y-2' : ''}`}
            style={{ background: hamburger }} />
          <span className={`block w-6 h-0.5 transition-all duration-300 ${open ? 'opacity-0' : ''}`}
            style={{ background: hamburger }} />
          <span className={`block w-6 h-0.5 transition-all duration-300 ${open ? '-rotate-45 -translate-y-2' : ''}`}
            style={{ background: hamburger }} />
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div
          className="md:hidden px-6 py-5 flex flex-col gap-4"
          style={{
            background: mobileBg,
            backdropFilter: 'blur(20px)',
            borderTop: `1px solid ${borderColor}`,
          }}
        >
          {NAV.map(n => (
            <Link
              key={n.href}
              href={n.href}
              className="text-sm font-medium py-1"
              style={{ color: navColor }}
              onClick={() => setOpen(false)}
            >
              {n.label}
            </Link>
          ))}
          <div className="pt-2 flex flex-col gap-3">
            {isLoggedIn ? (
              <Link href="/sfsdiamond/dashboard" className="text-sm" style={{ color: '#C9A96E' }} onClick={() => setOpen(false)}>
                {session?.user?.name ?? session?.user?.email}
              </Link>
            ) : (
              <>
                <Link
                  href="/sfsdiamond/login"
                  className="text-sm font-medium px-4 py-2 rounded-full border text-center"
                  style={{ border: '1px solid rgba(201,169,110,0.60)', color: '#C9A96E' }}
                  onClick={() => setOpen(false)}
                >
                  Login
                </Link>
                <a
                  href="mailto:sfsdiamonds@gmail.com"
                  className="text-sm font-semibold px-4 py-2 rounded-full text-center"
                  style={{ background: '#C9A96E', color: '#0A0805' }}
                >
                  Contact Us
                </a>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  )
}
