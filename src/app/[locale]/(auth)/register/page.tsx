'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useParams, useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Link } from '@/i18n/navigation'
import { Loader2 } from 'lucide-react'

const registerSchema = z.object({
  nameEn: z.string().min(1).max(100),
  email: z.string().email().max(255),
  password: z.string().min(8).max(100),
  confirmPassword: z.string(),
}).refine((d) => d.password === d.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
})

const otpSchema = z.object({
  otp: z.string().length(6, 'OTP must be 6 digits'),
})

type RegisterData = z.infer<typeof registerSchema>
type OTPData = z.infer<typeof otpSchema>

async function readJsonBody(res: Response): Promise<Record<string, unknown>> {
  const text = await res.text()
  if (!text.trim()) return {}
  try { return JSON.parse(text) as Record<string, unknown> } catch { return {} }
}

const inputStyle = {
  background: '#0C0C0C',
  border: '1px solid #2A2418',
  color: '#F0EAD8',
}

function DarkInput({ onFocus, onBlur, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="w-full rounded-md px-3 py-2.5 text-sm outline-none transition-all"
      style={inputStyle}
      onFocus={e => { e.currentTarget.style.borderColor = '#C9A96E'; onFocus?.(e) }}
      onBlur={e => { e.currentTarget.style.borderColor = '#2A2418'; onBlur?.(e) }}
    />
  )
}

export default function RegisterPage() {
  const t = useTranslations('auth')
  const params = useParams()
  const router = useRouter()
  const locale = (params.locale as string) ?? 'zh'
  const [step, setStep] = useState<'register' | 'verify'>('register')
  const [userId, setUserId] = useState('')
  const [loading, setLoading] = useState(false)

  const registerForm = useForm<RegisterData>({ resolver: zodResolver(registerSchema) })
  const otpForm = useForm<OTPData>({ resolver: zodResolver(otpSchema) })

  async function onRegister(data: RegisterData) {
    setLoading(true)
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, locale }),
      })
      const json = await readJsonBody(res)
      if (!res.ok) {
        toast.error(typeof json.error === 'string' && json.error ? json.error : t('registerFailed'))
        return
      }
      if (typeof json.userId !== 'string') { toast.error(t('registerFailed')); return }
      if (json.devAutoVerified) {
        toast.success(t('emailVerified'))
        router.push(`/${locale}/login`)
        return
      }
      setUserId(json.userId)
      setStep('verify')
      toast.success(t('otpSent'))
    } finally {
      setLoading(false)
    }
  }

  async function onVerify(data: OTPData) {
    setLoading(true)
    try {
      const res = await fetch('/api/auth/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, otp: data.otp }),
      })
      const json = await readJsonBody(res)
      if (!res.ok) { toast.error(typeof json.error === 'string' && json.error ? json.error : t('verifyFailed')); return }
      toast.success(t('emailVerified'))
      router.push(`/${locale}/login`)
    } finally {
      setLoading(false)
    }
  }

  const labelStyle = { color: '#9A8060', fontSize: '0.75rem', fontWeight: 500, letterSpacing: '0.05em', textTransform: 'uppercase' as const }
  const errorStyle = { color: '#ef4444', fontSize: '0.75rem' }

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
        <h1 className="text-xl font-semibold" style={{ color: '#F0EAD8' }}>
          {t(step === 'register' ? 'registerTitle' : 'verifyTitle')}
        </h1>
        <p className="text-sm mt-1" style={{ color: '#7A7060' }}>
          {t(step === 'register' ? 'registerDesc' : 'verifyDesc')}
        </p>
      </div>

      <div className="px-8 pb-8">
        {step === 'register' ? (
          <form onSubmit={registerForm.handleSubmit(onRegister)} className="space-y-4">
            <div className="space-y-1.5">
              <label style={labelStyle}>{t('fullName')}</label>
              <DarkInput {...registerForm.register('nameEn')} autoComplete="name" />
              {registerForm.formState.errors.nameEn && <p style={errorStyle}>{registerForm.formState.errors.nameEn.message}</p>}
            </div>
            <div className="space-y-1.5">
              <label style={labelStyle}>{t('email')}</label>
              <DarkInput type="email" {...registerForm.register('email')} autoComplete="email" />
              {registerForm.formState.errors.email && <p style={errorStyle}>{registerForm.formState.errors.email.message}</p>}
            </div>
            <div className="space-y-1.5">
              <label style={labelStyle}>{t('password')}</label>
              <DarkInput type="password" {...registerForm.register('password')} autoComplete="new-password" />
              {registerForm.formState.errors.password && <p style={errorStyle}>{registerForm.formState.errors.password.message}</p>}
            </div>
            <div className="space-y-1.5">
              <label style={labelStyle}>{t('confirmPassword')}</label>
              <DarkInput type="password" {...registerForm.register('confirmPassword')} autoComplete="new-password" />
              {registerForm.formState.errors.confirmPassword && <p style={errorStyle}>{registerForm.formState.errors.confirmPassword.message}</p>}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-md text-sm font-semibold transition-all mt-2"
              style={{ background: loading ? '#8A6E42' : '#C9A96E', color: '#0C0C0C' }}
              onMouseEnter={e => !loading && ((e.currentTarget as HTMLElement).style.background = '#D4B87A')}
              onMouseLeave={e => !loading && ((e.currentTarget as HTMLElement).style.background = '#C9A96E')}
            >
              {loading && <Loader2 size={14} className="animate-spin" />}
              {loading ? t('sending') : t('register')}
            </button>

            <div className="flex items-center gap-3 my-2">
              <div style={{ flex: 1, height: '1px', background: '#2A2418' }} />
              <span className="text-xs" style={{ color: '#3A3020' }}>or</span>
              <div style={{ flex: 1, height: '1px', background: '#2A2418' }} />
            </div>

            <p className="text-center text-sm" style={{ color: '#7A7060' }}>
              {t('haveAccount')}{' '}
              <Link href="/login" className="font-medium" style={{ color: '#C9A96E' }}>{t('login')}</Link>
            </p>
          </form>
        ) : (
          <form onSubmit={otpForm.handleSubmit(onVerify)} className="space-y-5">
            <div className="space-y-1.5">
              <label style={labelStyle}>{t('otp')}</label>
              <input
                {...otpForm.register('otp')}
                maxLength={6}
                placeholder="· · · · · ·"
                className="w-full rounded-md px-3 py-4 text-center text-3xl tracking-[0.5em] outline-none transition-all"
                style={inputStyle}
                onFocus={e => (e.currentTarget.style.borderColor = '#C9A96E')}
                onBlur={e => (e.currentTarget.style.borderColor = '#2A2418')}
              />
              {otpForm.formState.errors.otp && <p style={errorStyle}>{otpForm.formState.errors.otp.message}</p>}
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-md text-sm font-semibold transition-all"
              style={{ background: loading ? '#8A6E42' : '#C9A96E', color: '#0C0C0C' }}
            >
              {loading && <Loader2 size={14} className="animate-spin" />}
              {loading ? t('verifying') : t('verify')}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
