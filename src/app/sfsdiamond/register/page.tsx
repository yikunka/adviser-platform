'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { Loader2 } from 'lucide-react'

const registerSchema = z.object({
  nameEn:          z.string().min(1, 'Name is required').max(100),
  email:           z.string().email('Invalid email').max(255),
  password:        z.string().min(8, 'Minimum 8 characters').max(100),
  confirmPassword: z.string(),
}).refine(d => d.password === d.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
})

const otpSchema = z.object({
  otp: z.string().length(6, 'Must be 6 digits'),
})

type RegisterData = z.infer<typeof registerSchema>
type OTPData     = z.infer<typeof otpSchema>

function SFSInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="w-full rounded-xl px-4 py-2.5 text-sm outline-none border transition-all"
      style={{ borderColor: '#EDE7D8', color: '#1A1A1A', background: '#FAFAF8' }}
      onFocus={e => (e.currentTarget.style.borderColor = '#C9A96E')}
      onBlur={e => (e.currentTarget.style.borderColor = '#EDE7D8')}
    />
  )
}

export default function SFSRegisterPage() {
  const router = useRouter()
  const [step, setStep]     = useState<'register' | 'verify'>('register')
  const [userId, setUserId] = useState('')
  const [loading, setLoading] = useState(false)
  const [serverError, setServerError] = useState('')

  const regForm = useForm<RegisterData>({ resolver: zodResolver(registerSchema) })
  const otpForm = useForm<OTPData>({ resolver: zodResolver(otpSchema) })

  async function onRegister(data: RegisterData) {
    setLoading(true)
    setServerError('')
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nameEn: data.nameEn, email: data.email, password: data.password, platform: 'SFS_DIAMOND' }),
      })
      const json = await res.json().catch(() => ({})) as Record<string, unknown>
      if (!res.ok) { setServerError(typeof json.error === 'string' ? json.error : 'Registration failed'); return }
      if (json.devAutoVerified) { router.push('/sfsdiamond/login?registered=1'); return }
      setUserId(json.userId as string)
      setStep('verify')
    } finally {
      setLoading(false)
    }
  }

  async function onVerify(data: OTPData) {
    setLoading(true)
    setServerError('')
    try {
      const res = await fetch('/api/auth/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, otp: data.otp }),
      })
      if (!res.ok) { const j = await res.json().catch(() => ({})) as Record<string, unknown>; setServerError(typeof j.error === 'string' ? j.error : 'Verification failed'); return }
      router.push('/sfsdiamond/login?registered=1')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 py-16"
      style={{ background: '#FAFAF8' }}
    >
      <Link href="/sfsdiamond" className="flex items-center gap-2 mb-10">
        <Image src="/sfsdiamond/logo.png" alt="SFS Diamond" width={36} height={36} quality={95} className="rounded-full" />
        <span className="font-semibold text-lg" style={{ fontFamily: 'Georgia, serif', color: '#1A1A1A' }}>
          SFS Diamond
        </span>
      </Link>

      <div
        className="w-full max-w-md rounded-2xl overflow-hidden"
        style={{ background: '#fff', border: '1px solid #EDE7D8', boxShadow: '0 8px 40px rgba(0,0,0,0.07)' }}
      >
        <div style={{ height: '3px', background: 'linear-gradient(90deg, #8A6E42, #C9A96E, #F0D090, #C9A96E, #8A6E42)' }} />

        <div className="px-8 pt-8 pb-2">
          <h1 className="text-2xl font-bold" style={{ fontFamily: 'Georgia, serif', color: '#1A1A1A' }}>
            {step === 'register' ? 'Create Account' : 'Verify Email'}
          </h1>
          <p className="text-sm mt-1" style={{ color: '#6B5E4A' }}>
            {step === 'register'
              ? 'Create a distributor account. Staff approval is required before you can view order details.'
              : 'Enter the 6-digit code sent to your email.'}
          </p>
        </div>

        <div className="px-8 py-6">
          {step === 'register' ? (
            <form onSubmit={regForm.handleSubmit(onRegister)} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium uppercase tracking-wider" style={{ color: '#9A8060' }}>Full Name</label>
                <SFSInput {...regForm.register('nameEn')} autoComplete="name" />
                {regForm.formState.errors.nameEn && <p className="text-xs" style={{ color: '#ef4444' }}>{regForm.formState.errors.nameEn.message}</p>}
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium uppercase tracking-wider" style={{ color: '#9A8060' }}>Email</label>
                <SFSInput type="email" {...regForm.register('email')} autoComplete="email" />
                {regForm.formState.errors.email && <p className="text-xs" style={{ color: '#ef4444' }}>{regForm.formState.errors.email.message}</p>}
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium uppercase tracking-wider" style={{ color: '#9A8060' }}>Password</label>
                <SFSInput type="password" {...regForm.register('password')} autoComplete="new-password" />
                {regForm.formState.errors.password && <p className="text-xs" style={{ color: '#ef4444' }}>{regForm.formState.errors.password.message}</p>}
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium uppercase tracking-wider" style={{ color: '#9A8060' }}>Confirm Password</label>
                <SFSInput type="password" {...regForm.register('confirmPassword')} autoComplete="new-password" />
                {regForm.formState.errors.confirmPassword && <p className="text-xs" style={{ color: '#ef4444' }}>{regForm.formState.errors.confirmPassword.message}</p>}
              </div>

              {serverError && (
                <p className="text-sm px-3 py-2 rounded-lg" style={{ background: '#FEF2F2', color: '#B91C1C' }}>{serverError}</p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-full text-sm font-semibold transition-all mt-2"
                style={{ background: loading ? '#8A6E42' : '#C9A96E', color: '#0A0805' }}
              >
                {loading && <Loader2 size={14} className="animate-spin" />}
                {loading ? 'Creating account…' : 'Create Account'}
              </button>

              <div className="flex items-center gap-3">
                <div className="flex-1 h-px" style={{ background: '#EDE7D8' }} />
                <span className="text-xs" style={{ color: '#C0B09A' }}>or</span>
                <div className="flex-1 h-px" style={{ background: '#EDE7D8' }} />
              </div>

              <p className="text-center text-sm" style={{ color: '#6B5E4A' }}>
                Already have an account?{' '}
                <Link href="/sfsdiamond/login" className="font-semibold" style={{ color: '#C9A96E' }}>Sign In</Link>
              </p>
            </form>
          ) : (
            <form onSubmit={otpForm.handleSubmit(onVerify)} className="space-y-5">
              <div className="space-y-1.5">
                <label className="text-xs font-medium uppercase tracking-wider" style={{ color: '#9A8060' }}>Verification Code</label>
                <input
                  {...otpForm.register('otp')}
                  maxLength={6}
                  placeholder="· · · · · ·"
                  className="w-full rounded-xl px-4 py-4 text-center text-3xl tracking-[0.5em] outline-none border transition-all"
                  style={{ borderColor: '#EDE7D8', color: '#1A1A1A', background: '#FAFAF8' }}
                  onFocus={e => (e.currentTarget.style.borderColor = '#C9A96E')}
                  onBlur={e => (e.currentTarget.style.borderColor = '#EDE7D8')}
                />
                {otpForm.formState.errors.otp && <p className="text-xs" style={{ color: '#ef4444' }}>{otpForm.formState.errors.otp.message}</p>}
              </div>
              {serverError && (
                <p className="text-sm px-3 py-2 rounded-lg" style={{ background: '#FEF2F2', color: '#B91C1C' }}>{serverError}</p>
              )}
              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-full text-sm font-semibold transition-all"
                style={{ background: loading ? '#8A6E42' : '#C9A96E', color: '#0A0805' }}
              >
                {loading && <Loader2 size={14} className="animate-spin" />}
                {loading ? 'Verifying…' : 'Verify Email'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
