'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
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
  const isLoggedIn = status === 'authenticated' && session?.user?.platform === 'SFS_DIAMOND'

  return (
    <header
      className="sticky top-0 z-50 backdrop-blur-md border-b"
      style={{ background: 'rgba(250,250,248,0.92)', borderColor: '#E8E2D6' }}
    >
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/sfsdiamond" className="flex items-center gap-2">
          <Image
            src="/sfsdiamond/logo.png"
            alt="SFS Diamond"
            width={80}
            height={80}
            className="rounded-full object-cover"
          />
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-7">
          {NAV.map(n => (
            <Link
              key={n.href}
              href={n.href}
              className="text-sm font-medium transition-colors duration-150 hover:opacity-70"
              style={{ color: '#3D3D3D' }}
            >
              {n.label}
            </Link>
          ))}

          {isLoggedIn ? (
            <div className="flex items-center gap-4">
              <Link href="/sfsdiamond/dashboard" className="text-sm hover:opacity-70 transition-opacity" style={{ color: '#6B5E4A' }}>
                {session?.user?.name ?? session?.user?.email}
              </Link>
            </div>
          ) : (
            <>
              <Link
                href="/sfsdiamond/login"
                className="text-sm font-medium px-4 py-2 rounded-full border transition-all duration-150 hover:bg-black/5"
                style={{ border: '1px solid #C9A96E', color: '#C9A96E' }}
              >
                Login
              </Link>
              <a
                href="mailto:sfsdiamonds@gmail.com"
                className="text-sm font-medium px-4 py-2 rounded-full transition-all duration-150 hover:opacity-90"
                style={{ background: '#1A1A1A', color: '#F5F0E8' }}
              >
                Contact Us
              </a>
            </>
          )}
        </nav>

        {/* Mobile hamburger */}
        <button
          className="md:hidden flex flex-col gap-1.5 p-1"
          onClick={() => setOpen(o => !o)}
          aria-label="Toggle menu"
        >
          <span className={`block w-6 h-0.5 bg-gray-700 transition-all ${open ? 'rotate-45 translate-y-2' : ''}`} />
          <span className={`block w-6 h-0.5 bg-gray-700 transition-all ${open ? 'opacity-0' : ''}`} />
          <span className={`block w-6 h-0.5 bg-gray-700 transition-all ${open ? '-rotate-45 -translate-y-2' : ''}`} />
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden border-t px-6 py-4 flex flex-col gap-4" style={{ borderColor: '#E8E2D6', background: '#FAFAF8' }}>
          {NAV.map(n => (
            <Link
              key={n.href}
              href={n.href}
              className="text-sm font-medium"
              style={{ color: '#3D3D3D' }}
              onClick={() => setOpen(false)}
            >
              {n.label}
            </Link>
          ))}
          {isLoggedIn ? (
            <>
              <Link href="/sfsdiamond/dashboard" className="text-sm hover:opacity-70 transition-opacity" style={{ color: '#6B5E4A' }} onClick={() => setOpen(false)}>
                {session?.user?.name ?? session?.user?.email}
              </Link>
            </>
          ) : (
            <>
              <Link
                href="/sfsdiamond/login"
                className="text-sm font-medium px-4 py-2 rounded-full border text-center"
                style={{ border: '1px solid #C9A96E', color: '#C9A96E' }}
                onClick={() => setOpen(false)}
              >
                Login
              </Link>
              <a
                href="mailto:sfsdiamonds@gmail.com"
                className="text-sm font-medium px-4 py-2 rounded-full text-center"
                style={{ background: '#1A1A1A', color: '#F5F0E8' }}
              >
                Contact Us
              </a>
            </>
          )}
        </div>
      )}
    </header>
  )
}
