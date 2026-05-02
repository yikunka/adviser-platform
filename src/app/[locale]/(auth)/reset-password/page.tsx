'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useRouter, useSearchParams, useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Link } from '@/i18n/navigation'
import { Loader2 } from 'lucide-react'

const schema = z.object({
  password: z.string().min(8).max(100),
  confirmPassword: z.string(),
}).refine((d) => d.password === d.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
})
type FormData = z.infer<typeof schema>

const inputBase = { background: '#0C0C0C', border: '1px solid #2A2418', color: '#F0EAD8' }

export default function ResetPasswordPage() {
  const t = useTranslations('auth')
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()
  const locale = (params.locale as string) ?? 'zh'
  const token = searchParams.get('token') ?? ''
  const [loading, setLoading] = useState(false)

  const form = useForm<FormData>({ resolver: zodResolver(schema) })

  async function onSubmit(data: FormData) {
    if (!token) { toast.error(t('invalidToken')); return }
    setLoading(true)
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password: data.password }),
      })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error ?? t('resetFailed')); return }
      toast.success(t('passwordReset'))
      router.push(`/${locale}/login`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ background: '#141414', border: '1px solid #2A2418', boxShadow: '0 24px 64px rgba(0,0,0,0.6)' }}
    >
      <div style={{ height: '3px', background: 'linear-gradient(90deg, #8A6E42, #C9A96E, #F0D090, #C9A96E, #8A6E42)' }} />
      <div className="px-8 pt-8 pb-4">
        <h1 className="text-xl font-semibold" style={{ color: '#F0EAD8' }}>{t('resetPasswordTitle')}</h1>
        <p className="text-sm mt-1" style={{ color: '#7A7060' }}>{t('resetPasswordDesc')}</p>
      </div>
      <div className="px-8 pb-8">
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
          {[
            { id: 'password', label: t('newPassword'), reg: 'password' as const, err: form.formState.errors.password },
            { id: 'confirmPassword', label: t('confirmPassword'), reg: 'confirmPassword' as const, err: form.formState.errors.confirmPassword },
          ].map(({ id, label, reg, err }) => (
            <div key={id} className="space-y-1.5">
              <label className="text-xs font-medium tracking-wide uppercase" style={{ color: '#9A8060' }}>{label}</label>
              <input
                id={id}
                type="password"
                {...form.register(reg)}
                autoComplete="new-password"
                className="w-full rounded-md px-3 py-2.5 text-sm outline-none transition-all"
                style={inputBase}
                onFocus={e => (e.currentTarget.style.borderColor = '#C9A96E')}
                onBlur={e => (e.currentTarget.style.borderColor = '#2A2418')}
              />
              {err && <p className="text-xs" style={{ color: '#ef4444' }}>{err.message}</p>}
            </div>
          ))}

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-md text-sm font-semibold transition-all"
            style={{ background: loading ? '#8A6E42' : '#C9A96E', color: '#0C0C0C' }}
            onMouseEnter={e => !loading && ((e.currentTarget as HTMLElement).style.background = '#D4B87A')}
            onMouseLeave={e => !loading && ((e.currentTarget as HTMLElement).style.background = '#C9A96E')}
          >
            {loading && <Loader2 size={14} className="animate-spin" />}
            {loading ? t('resetting') : t('resetPassword')}
          </button>

          <p className="text-center text-sm" style={{ color: '#7A7060' }}>
            <Link href="/login" className="font-medium" style={{ color: '#C9A96E' }}>{t('backToLogin')}</Link>
          </p>
        </form>
      </div>
    </div>
  )
}
