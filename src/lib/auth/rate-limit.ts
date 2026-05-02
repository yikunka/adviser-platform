import { NextRequest, NextResponse } from 'next/server'

// In-memory sliding window rate limiter
// For single-server deployment; swap for Redis in multi-instance setups
const store = new Map<string, { count: number; resetAt: number }>()

// Clean up stale entries every 10 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now()
    for (const [k, v] of store) {
      if (now >= v.resetAt) store.delete(k)
    }
  }, 10 * 60 * 1000)
}

export function checkRateLimit(
  req: NextRequest,
  limit: number,
  windowMs: number,
): NextResponse | null {
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    req.headers.get('x-real-ip') ??
    'unknown'
  const key = `${ip}:${req.nextUrl.pathname}`
  const now = Date.now()

  const entry = store.get(key)
  if (!entry || now >= entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs })
    return null
  }

  entry.count++
  if (entry.count > limit) {
    return NextResponse.json(
      { error: 'Too many requests' },
      {
        status: 429,
        headers: {
          'Retry-After': String(Math.ceil((entry.resetAt - now) / 1000)),
          'X-RateLimit-Limit': String(limit),
          'X-RateLimit-Remaining': '0',
        },
      },
    )
  }

  return null
}

/** Convenience: 60 req/min for general API routes */
export function rateLimitAPI(req: NextRequest) {
  return checkRateLimit(req, 60, 60_000)
}

/** Convenience: 10 req/min for auth endpoints */
export function rateLimitAuth(req: NextRequest) {
  return checkRateLimit(req, 10, 60_000)
}
