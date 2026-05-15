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

/** Proxy 中 `NextResponse.redirect` 须为绝对 URL；用 `nextUrl.clone()` 避免依赖 `req.url`。 */
function redirectToPath(req: NextRequest, pathname: string, searchParams?: Record<string, string>) {
  const u = req.nextUrl.clone()
  u.pathname = pathname
  u.search = ''
  if (searchParams) {
    for (const [k, v] of Object.entries(searchParams)) {
      u.searchParams.set(k, v)
    }
  }
  return NextResponse.redirect(u)
}

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
    return redirectToPath(req, `/${locale}/login`, { callbackUrl: pathname })
  }

  if (adminRoutePattern.test(pathname)) {
    if (!session) {
      const locale = pathname.startsWith('/en') ? 'en' : 'zh'
      return redirectToPath(req, `/${locale}/login`, { callbackUrl: pathname })
    }
    if (!staffRoles.has(session.user?.role)) {
      const locale = pathname.startsWith('/en') ? 'en' : 'zh'
      return redirectToPath(req, `/${locale}/dashboard`)
    }
  }

  return intlMiddleware(req as unknown as NextRequest)
})

export const config = {
  matcher: ['/((?!api|_next|_vercel|sfsdiamond|cosmocoat|.*\\..*).*)', '/'],
}
