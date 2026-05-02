'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Link } from '@/i18n/navigation'
import { Loader2, MailCheck } from 'lucide-react'

const schema = z.object({ email: z.string().email() })
type FormData = z.infer<typeof schema>

export default function ForgotPasswordPage() {
  const t = useTranslations('auth')
  const params = useParams()
  const locale = (params.locale as string) ?? 'zh'
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  const form = useForm<FormData>({ resolver: zodResolver(schema) })

  async function onSubmit(data: FormData) {
    setLoading(true)
    try {
      await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, locale }),
      })
      setSent(true)
    } catch {
      toast.error(t('errorGeneric'))
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
      <div style={{ height: '3px', background: 'linear-gradient(90deg, #8A6E42, #C9A96E, #F0D090, #C9A96E, #8A6E42)' }} />

      <div className="px-8 pt-8 pb-4">
        <h1 className="text-xl font-semibold" style={{ color: '#F0EAD8' }}>{t('forgotPasswordTitle')}</h1>
        <p className="text-sm mt-1" style={{ color: '#7A7060' }}>{t('forgotPasswordDesc')}</p>
      </div>

      <div className="px-8 pb-8">
        {sent ? (
          <div className="flex flex-col items-center gap-4 py-4">
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center"
              style={{ background: 'rgba(201,169,110,0.12)', border: '1px solid #C9A96E' }}
            >
              <MailCheck size={24} style={{ color: '#C9A96E' }} />
            </div>
            <p className="text-sm text-center" style={{ color: '#9A8060' }}>{t('resetEmailSent')}</p>
            <Link href="/login" className="text-sm font-medium" style={{ color: '#C9A96E' }}>
              {t('backToLogin')}
            </Link>
          </div>
        ) : (
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
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
                style={{ background: '#0C0C0C', border: '1px solid #2A2418', color: '#F0EAD8' }}
                onFocus={e => (e.currentTarget.style.borderColor = '#C9A96E')}
                onBlur={e => (e.currentTarget.style.borderColor = '#2A2418')}
              />
              {form.formState.errors.email && (
                <p className="text-xs" style={{ color: '#ef4444' }}>{form.formState.errors.email.message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-md text-sm font-semibold transition-all"
              style={{ background: loading ? '#8A6E42' : '#C9A96E', color: '#0C0C0C' }}
              onMouseEnter={e => !loading && ((e.currentTarget as HTMLElement).style.background = '#D4B87A')}
              onMouseLeave={e => !loading && ((e.currentTarget as HTMLElement).style.background = '#C9A96E')}
            >
              {loading && <Loader2 size={14} className="animate-spin" />}
              {loading ? t('sending') : t('sendResetLink')}
            </button>

            <p className="text-center text-sm" style={{ color: '#7A7060' }}>
              <Link href="/login" className="font-medium" style={{ color: '#C9A96E' }}>{t('backToLogin')}</Link>
            </p>
          </form>
        )}
      </div>
    </div>
  )
}
