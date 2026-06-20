'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { signIn, signOut, useSession } from 'next-auth/react'
import { toast } from 'sonner'
import { Link } from '@/i18n/navigation'
import { Loader2 } from 'lucide-react'
import { normalizeLoginFailureCode } from '@/lib/auth/login-errors'

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

type LoginData = z.infer<typeof loginSchema>

const STAFF_ROLES = new Set(['STAFF', 'COMPLIANCE', 'SUPER_ADMIN'])

function loginErrorMessage(
  t: ReturnType<typeof useTranslations<'auth'>>,
  error: string | undefined,
  code: string | undefined,
) {
  switch (normalizeLoginFailureCode(error, code)) {
    case 'unverified':
      return t('loginEmailNotVerified')
    case 'inactive':
      return t('loginAccountInactive')
    case 'admin_only':
      return t('loginAdminOnly')
    case 'platform_mismatch':
      return t('loginWrongPortal')
    case 'system':
      return t('loginSystemError')
    case 'credentials':
    default:
      return t('loginFailed')
  }
}

export default function AdminLoginPage() {
  const t = useTranslations('auth')
  const params = useParams()
  const searchParams = useSearchParams()
  const router = useRouter()
  const locale = (params.locale as string) ?? 'zh'
  const [loading, setLoading] = useState(false)
  const { data: session, status } = useSession()

  const form = useForm<LoginData>({ resolver: zodResolver(loginSchema) })

  useEffect(() => {
    if (status !== 'authenticated' || !session?.user?.id || !session?.user?.role) return
    if (!STAFF_ROLES.has(session.user.role)) return

    let cancelled = false

    async function verifyAndRedirect() {
      const res = await fetch('/api/admin/session-verify')
      if (cancelled) return
      if (!res.ok) {
        await signOut({ callbackUrl: `/${locale}/admin-login` })
        return
      }

      const cb = searchParams.get('callbackUrl')
      if (cb) {
        const decoded = decodeURIComponent(cb)
        if (decoded.startsWith('http')) {
          window.location.replace(decoded)
          return
        }
        router.replace(decoded.startsWith('/') ? decoded : `/${locale}${decoded}`)
        return
      }
      router.replace(`/${locale}/admin/dashboard`)
    }

    void verifyAndRedirect()
    return () => { cancelled = true }
  }, [status, session?.user?.id, session?.user?.role, locale, router, searchParams])

  async function onSubmit(data: LoginData) {
    setLoading(true)
    try {
      const result = await signIn('credentials', {
        email: data.email,
        password: data.password,
        adminLogin: '1',
        redirect: false,
      })

      if (result?.error) {
        toast.error(loginErrorMessage(t, result.error, result.code))
        return
      }

      const go = (path: string) => {
        window.location.assign(path.startsWith('http') ? path : path)
      }

      const callbackUrl = searchParams.get('callbackUrl')
      if (callbackUrl) {
        const decoded = decodeURIComponent(callbackUrl)
        const path = decoded.startsWith('http')
          ? decoded
          : decoded.startsWith('/')
            ? decoded
            : `/${locale}${decoded}`
        go(path)
        return
      }

      try {
        const sessionRes = await fetch('/api/auth/session')
        const sessionData = await sessionRes.json()
        const role = sessionData?.user?.role as string | undefined
        const ADMIN_ROLES = ['STAFF', 'COMPLIANCE', 'SUPER_ADMIN']
        if (role && ADMIN_ROLES.includes(role)) {
          go(`/${locale}/admin/dashboard`)
          return
        }
        toast.error(t('loginAdminOnly'))
      } catch {
        toast.error(t('loginSystemError'))
      }
    } finally {
      setLoading(false)
    }
  }

  if (status === 'loading') {
    return (
      <div
        className="rounded-xl overflow-hidden flex items-center justify-center py-16"
        style={{ background: '#141414', border: '1px solid #2A2418' }}
      >
        <Loader2 className="animate-spin" size={22} style={{ color: '#C9A96E' }} />
      </div>
    )
  }

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        background: '#141414',
        border: '1px solid #2A2418',
        boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
      }}
    >
      <div style={{ height: '3px', background: 'linear-gradient(90deg, #8A6E42, #C9A96E, #F0D090, #C9A96E, #8A6E42)' }} />

      <div className="px-8 pt-8 pb-4">
        <h1 className="text-xl font-semibold" style={{ color: '#F0EAD8' }}>
          {t('adminLoginTitle')}
        </h1>
        <p className="text-sm mt-1" style={{ color: '#7A7060' }}>
          {t('adminLoginDesc')}
        </p>
      </div>

      <div className="px-8 pb-8">
        <form method="post" action="#" onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
          <div className="space-y-1.5">
            <label className="text-xs font-medium tracking-wide uppercase" style={{ color: '#9A8060' }} htmlFor="email">
              {t('email')}
            </label>
            <input
              id="email"
              type="email"
              {...form.register('email')}
              autoComplete="username"
              className="w-full rounded-md px-3 py-2.5 text-sm outline-none transition-all"
              style={{
                background: '#0C0C0C',
                border: '1px solid #2A2418',
                color: '#F0EAD8',
              }}
              onFocus={e => (e.currentTarget.style.borderColor = '#C9A96E')}
              onBlur={e => (e.currentTarget.style.borderColor = '#2A2418')}
            />
            {form.formState.errors.email && (
              <p className="text-xs" style={{ color: '#ef4444' }}>
                {form.formState.errors.email.message}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium tracking-wide uppercase" style={{ color: '#9A8060' }} htmlFor="password">
              {t('password')}
            </label>
            <input
              id="password"
              type="password"
              {...form.register('password')}
              autoComplete="current-password"
              className="w-full rounded-md px-3 py-2.5 text-sm outline-none transition-all"
              style={{
                background: '#0C0C0C',
                border: '1px solid #2A2418',
                color: '#F0EAD8',
              }}
              onFocus={e => (e.currentTarget.style.borderColor = '#C9A96E')}
              onBlur={e => (e.currentTarget.style.borderColor = '#2A2418')}
            />
            {form.formState.errors.password && (
              <p className="text-xs" style={{ color: '#ef4444' }}>
                {form.formState.errors.password.message}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-md text-sm font-semibold transition-all duration-150 mt-2"
            style={{
              background: loading ? '#8A6E42' : '#C9A96E',
              color: '#0C0C0C',
              opacity: loading ? 0.8 : 1,
            }}
          >
            {loading && <Loader2 size={14} className="animate-spin" />}
            {loading ? t('loggingIn') : t('login')}
          </button>

          <div className="flex items-center gap-3 my-2">
            <div style={{ flex: 1, height: '1px', background: '#2A2418' }} />
            <span className="text-xs" style={{ color: '#3A3020' }}>
              ·
            </span>
            <div style={{ flex: 1, height: '1px', background: '#2A2418' }} />
          </div>

          <p className="text-center text-sm" style={{ color: '#7A7060' }}>
            <Link href="/login" className="font-medium transition-colors" style={{ color: '#C9A96E' }}>
              {t('adminPortalLogin')}
            </Link>
          </p>
        </form>
      </div>
    </div>
  )
}
