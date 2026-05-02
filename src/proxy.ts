import { auth } from '@/lib/auth/auth'
import createMiddleware from 'next-intl/middleware'
import { routing } from '@/i18n/routing'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const intlMiddleware = createMiddleware(routing)

// Patterns that require authentication
const clientRoutePattern = /^\/(zh|en)\/(dashboard|kyc|documents|orders)/
const adminRoutePattern = /^\/(zh|en)\/(admin)/

const staffRoles = new Set(['STAFF', 'COMPLIANCE', 'SUPER_ADMIN'])

// ── Rate limiting (sliding window, in-memory) ──────────────────────
// Note: resets on cold start; use Redis for multi-instance production
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()

function isRateLimited(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(key)
  if (!entry || now >= entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + windowMs })
    return false
  }
  entry.count++
  return entry.count > limit
}

// Periodically clean up expired entries (every 5 min)
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now()
    for (const [k, v] of rateLimitMap) {
      if (now >= v.resetAt) rateLimitMap.delete(k)
    }
  }, 5 * 60 * 1000)
}

export default auth((req) => {
  const { pathname } = req.nextUrl
  const session = req.auth

  if (clientRoutePattern.test(pathname) && !session) {
    const locale = pathname.startsWith('/en') ? 'en' : 'zh'
    const loginUrl = new URL(`/${locale}/login`, req.url)
    loginUrl.searchParams.set('callbackUrl', pathname)
    return NextResponse.redirect(loginUrl)
  }

  if (adminRoutePattern.test(pathname)) {
    if (!session) {
      const locale = pathname.startsWith('/en') ? 'en' : 'zh'
      const loginUrl = new URL(`/${locale}/login`, req.url)
      loginUrl.searchParams.set('callbackUrl', pathname)
      return NextResponse.redirect(loginUrl)
    }
    if (!staffRoles.has(session.user?.role)) {
      const locale = pathname.startsWith('/en') ? 'en' : 'zh'
      return NextResponse.redirect(new URL(`/${locale}/dashboard`, req.url))
    }
  }

  return intlMiddleware(req as unknown as NextRequest)
})

export const config = {
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)', '/'],
}
