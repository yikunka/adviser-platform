/* eslint-disable @next/next/no-img-element */
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV = [
  { label: '首页', href: '/cosmocoat' },
  { label: '关于我们', href: '/cosmocoat/about' },
  { label: '产品中心', href: '/cosmocoat/products' },
  { label: '配套产品', href: '/cosmocoat/supporting' },
]

const MONO = "'Courier New', Courier, monospace"
const RED = '#ff2200'
const CYAN = '#00d4ff'

export default function CosmoHeader() {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  return (
    <header
      className="sticky top-0 z-50"
      style={{
        background: 'rgba(6,6,6,0.97)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: `1px solid rgba(255,34,0,0.3)`,
        boxShadow: '0 0 0 1px rgba(255,34,0,0.08), 0 4px 32px rgba(0,0,0,0.7)',
      }}
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-[4.5rem] flex items-center justify-between gap-4">

        {/* Logo */}
        <Link href="/cosmocoat" className="flex items-center gap-3 shrink-0 group">
          <img
            src="/cosmocoat/logo.png"
            alt="COSMOCOAT 威栩"
            className="h-9 w-auto object-contain"
            style={{ filter: 'drop-shadow(0 0 6px rgba(255,34,0,0.45)) brightness(1.1)' }}
          />
          <div className="hidden sm:flex flex-col leading-none">
            <span
              className="text-[11px] font-bold tracking-[0.35em] uppercase"
              style={{ color: RED, fontFamily: MONO }}
            >
              COSMO.COAT
            </span>
            <span
              className="text-[9px] tracking-[0.2em] uppercase mt-0.5"
              style={{ color: '#3a3a3a', fontFamily: MONO }}
            >
              INDUSTRIAL COATINGS
            </span>
          </div>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-8 flex-1 justify-center">
          {NAV.map(n => {
            const active = n.href === '/cosmocoat' ? pathname === '/cosmocoat' : pathname.startsWith(n.href)
            return (
              <Link
                key={n.href}
                href={n.href}
                className="relative text-[11px] tracking-[0.18em] uppercase transition-colors duration-150"
                style={{
                  color: active ? RED : '#777',
                  fontFamily: MONO,
                }}
                onMouseEnter={e => { if (!active) (e.target as HTMLElement).style.color = '#eee' }}
                onMouseLeave={e => { if (!active) (e.target as HTMLElement).style.color = '#777' }}
              >
                {n.label}
                {active && (
                  <span
                    className="absolute -bottom-px left-0 right-0 h-px"
                    style={{
                      background: `linear-gradient(90deg, ${RED}, transparent)`,
                      boxShadow: `0 0 6px ${RED}`,
                    }}
                  />
                )}
              </Link>
            )
          })}
        </nav>

        {/* Desktop CTA */}
        <div className="hidden md:flex items-center gap-4 shrink-0">
          <a
            href="tel:+8615546868835"
            className="text-[10px] tracking-widest whitespace-nowrap transition-colors"
            style={{ color: '#444', fontFamily: MONO }}
            onMouseEnter={e => ((e.target as HTMLElement).style.color = CYAN)}
            onMouseLeave={e => ((e.target as HTMLElement).style.color = '#444')}
          >
            +86 155 4686 8835
          </a>
          <a
            href="mailto:skaiwong@gmail.com"
            className="text-[10px] font-bold px-5 py-2.5 tracking-[0.2em] uppercase transition-all"
            style={{
              background: RED,
              color: '#fff',
              fontFamily: MONO,
              boxShadow: `0 0 16px rgba(255,34,0,0.45), inset 0 1px 0 rgba(255,255,255,0.1)`,
            }}
            onMouseEnter={e => ((e.currentTarget as HTMLElement).style.boxShadow = `0 0 28px rgba(255,34,0,0.7), inset 0 1px 0 rgba(255,255,255,0.15)`)}
            onMouseLeave={e => ((e.currentTarget as HTMLElement).style.boxShadow = `0 0 16px rgba(255,34,0,0.45), inset 0 1px 0 rgba(255,255,255,0.1)`)}
          >
            联系我们
          </a>
        </div>

        {/* Mobile hamburger */}
        <button
          type="button"
          className="md:hidden flex flex-col gap-[5px] p-2"
          aria-label="打开菜单"
          onClick={() => setOpen(o => !o)}
        >
          <span
            className={`block w-5 h-px transition-all duration-300 ${open ? 'rotate-45 translate-y-[6px]' : ''}`}
            style={{ background: open ? RED : '#777' }}
          />
          <span
            className={`block w-5 h-px transition-all duration-300 ${open ? 'opacity-0' : ''}`}
            style={{ background: '#777' }}
          />
          <span
            className={`block w-5 h-px transition-all duration-300 ${open ? '-rotate-45 -translate-y-[6px]' : ''}`}
            style={{ background: open ? RED : '#777' }}
          />
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div
          className="md:hidden px-4 pb-6 pt-1 flex flex-col"
          style={{
            background: '#060606',
            borderTop: `1px solid rgba(255,34,0,0.15)`,
          }}
        >
          {NAV.map((n, i) => {
            const active = n.href === '/cosmocoat' ? pathname === '/cosmocoat' : pathname.startsWith(n.href)
            return (
              <Link
                key={n.href}
                href={n.href}
                className="py-3.5 text-[11px] tracking-[0.2em] uppercase flex items-center gap-2"
                style={{
                  color: active ? RED : '#888',
                  fontFamily: MONO,
                  borderBottom: i < NAV.length - 1 ? '1px solid #141414' : 'none',
                }}
                onClick={() => setOpen(false)}
              >
                <span style={{ color: active ? RED : '#2a2a2a' }}>{'>'}</span>
                {n.label}
              </Link>
            )
          })}
          <div className="pt-5 flex flex-col gap-3">
            <a
              href="tel:+8615546868835"
              className="text-[10px] tracking-widest text-center py-2"
              style={{ color: '#444', fontFamily: MONO }}
            >
              +86 155 4686 8835
            </a>
            <a
              href="mailto:skaiwong@gmail.com"
              className="text-[10px] font-bold py-3 text-center tracking-[0.2em] uppercase"
              style={{
                background: RED,
                color: '#fff',
                fontFamily: MONO,
                boxShadow: `0 0 16px rgba(255,34,0,0.4)`,
              }}
            >
              联系我们
            </a>
          </div>
        </div>
      )}
    </header>
  )
}
