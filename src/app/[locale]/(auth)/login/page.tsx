'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { signIn } from 'next-auth/react'
import { toast } from 'sonner'
import { Link } from '@/i18n/navigation'
import { Loader2 } from 'lucide-react'

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

type LoginData = z.infer<typeof loginSchema>

export default function LoginPage() {
  const t = useTranslations('auth')
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const locale = (params.locale as string) ?? 'zh'
  const [loading, setLoading] = useState(false)

  const form = useForm<LoginData>({ resolver: zodResolver(loginSchema) })

  async function onSubmit(data: LoginData) {
    setLoading(true)
    try {
      const result = await signIn('credentials', {
        email: data.email,
        password: data.password,
        redirect: false,
      })

      if (result?.error) {
        toast.error(t('loginFailed'))
        return
      }

      // If a callbackUrl was specified (e.g. from middleware redirect), honour it
      const callbackUrl = searchParams.get('callbackUrl')
      if (callbackUrl) {
        router.push(callbackUrl)
        router.refresh()
        return
      }

      // Otherwise detect role and send to the right portal
      try {
        const sessionRes = await fetch('/api/auth/session')
        const sessionData = await sessionRes.json()
        const role = sessionData?.user?.role as string | undefined
        const ADMIN_ROLES = ['STAFF', 'COMPLIANCE', 'SUPER_ADMIN']
        if (role && ADMIN_ROLES.includes(role)) {
          router.push(`/${locale}/admin/dashboard`)
        } else {
          router.push(`/${locale}/dashboard`)
        }
      } catch {
        router.push(`/${locale}/dashboard`)
      }

      router.refresh()
    } finally {
      setLoading(false)
    }
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
      {/* Gold top accent */}
      <div style={{ height: '3px', background: 'linear-gradient(90deg, #8A6E42, #C9A96E, #F0D090, #C9A96E, #8A6E42)' }} />

      <div className="px-8 pt-8 pb-4">
        <h1 className="text-xl font-semibold" style={{ color: '#F0EAD8' }}>{t('loginTitle')}</h1>
        <p className="text-sm mt-1" style={{ color: '#7A7060' }}>{t('loginDesc')}</p>
      </div>

      <div className="px-8 pb-8">
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
          {/* Email */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium tracking-wide uppercase" style={{ color: '#9A8060' }}>
              {t('email')}
            </label>
            <input
              id="email"
              type="email"
              {...form.register('email')}
              autoComplete="email"
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
              <p className="text-xs" style={{ color: '#ef4444' }}>{form.formState.errors.email.message}</p>
            )}
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium tracking-wide uppercase" style={{ color: '#9A8060' }}>
                {t('password')}
              </label>
              <Link
                href="/forgot-password"
                className="text-xs transition-colors"
                style={{ color: '#C9A96E' }}
              >
                {t('forgotPassword')}
              </Link>
            </div>
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
              <p className="text-xs" style={{ color: '#ef4444' }}>{form.formState.errors.password.message}</p>
            )}
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-md text-sm font-semibold transition-all duration-150 mt-2"
            style={{
              background: loading ? '#8A6E42' : '#C9A96E',
              color: '#0C0C0C',
              opacity: loading ? 0.8 : 1,
            }}
            onMouseEnter={e => !loading && ((e.currentTarget as HTMLElement).style.background = '#D4B87A')}
            onMouseLeave={e => !loading && ((e.currentTarget as HTMLElement).style.background = '#C9A96E')}
          >
            {loading && <Loader2 size={14} className="animate-spin" />}
            {loading ? t('loggingIn') : t('login')}
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3 my-2">
            <div style={{ flex: 1, height: '1px', background: '#2A2418' }} />
            <span className="text-xs" style={{ color: '#3A3020' }}>or</span>
            <div style={{ flex: 1, height: '1px', background: '#2A2418' }} />
          </div>

          <p className="text-center text-sm" style={{ color: '#7A7060' }}>
            {t('noAccount')}{' '}
            <Link href="/register" className="font-medium transition-colors" style={{ color: '#C9A96E' }}>
              {t('register')}
            </Link>
          </p>
        </form>
      </div>
    </div>
  )
}
