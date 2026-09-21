'use client'

import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { signIn } from 'next-auth/react'
import Link from 'next/link'
import Image from 'next/image'
import { Loader2 } from 'lucide-react'
import { normalizeLoginFailureCode } from '@/lib/auth/login-errors'

const schema = z.object({
  email:    z.string().email('Invalid email'),
  password: z.string().min(1, 'Password is required'),
})
type FormData = z.infer<typeof schema>

function loginErrorMessage(error: string | undefined, code: string | undefined) {
  switch (normalizeLoginFailureCode(error, code)) {
    case 'unverified':
      return 'Your email is not verified yet.'
    case 'inactive':
      return 'This account is inactive.'
    case 'admin_only':
      return 'This account can only sign in through the admin portal.'
    case 'platform_mismatch':
      return 'Please sign in through the correct platform portal.'
    case 'system':
      return 'Sign-in is temporarily unavailable. Please try again later.'
    case 'credentials':
    default:
      return 'Invalid email or password.'
  }
}

export default function SFSLoginPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [justRegistered, setJustRegistered] = useState(false)

  const form = useForm<FormData>({ resolver: zodResolver(schema) })

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('registered') === '1') setJustRegistered(true)
  }, [])

  async function onSubmit(data: FormData) {
    setLoading(true)
    setError('')
    try {
      const result = await signIn('credentials', {
        email: data.email,
        password: data.password,
        platform: 'SFS_DIAMOND',
        redirect: false,
      })
      if (result?.error) {
        setError(loginErrorMessage(result.error, result.code))
        return
      }
      window.location.assign('/sfsdiamond/dashboard')
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
            Partner login
          </h1>
          <p className="text-sm mt-1" style={{ color: '#6B5E4A' }}>
            Sign in to the partner order portal.
          </p>
          {justRegistered && (
            <p
              className="mt-4 text-sm leading-relaxed rounded-xl px-3 py-2.5"
              style={{ background: 'rgba(201,169,110,0.12)', color: '#6B5E4A' }}
            >
              Account created. After sign-in, order details stay hidden until our team approves your
              distributor access.
            </p>
          )}
        </div>

        <form method="post" action="#" onSubmit={form.handleSubmit(onSubmit)} className="px-8 py-6 space-y-5">
          <div className="space-y-1.5">
            <label className="text-xs font-medium uppercase tracking-wider" style={{ color: '#9A8060' }}>
              Email
            </label>
            <input
              type="email"
              {...form.register('email')}
              autoComplete="username"
              className="w-full rounded-xl px-4 py-2.5 text-sm outline-none border transition-all"
              style={{ borderColor: '#EDE7D8', color: '#1A1A1A', background: '#FAFAF8' }}
              onFocus={e => (e.currentTarget.style.borderColor = '#C9A96E')}
              onBlur={e => (e.currentTarget.style.borderColor = '#EDE7D8')}
            />
            {form.formState.errors.email && (
              <p className="text-xs" style={{ color: '#ef4444' }}>{form.formState.errors.email.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium uppercase tracking-wider" style={{ color: '#9A8060' }}>
              Password
            </label>
            <input
              type="password"
              {...form.register('password')}
              autoComplete="current-password"
              className="w-full rounded-xl px-4 py-2.5 text-sm outline-none border transition-all"
              style={{ borderColor: '#EDE7D8', color: '#1A1A1A', background: '#FAFAF8' }}
              onFocus={e => (e.currentTarget.style.borderColor = '#C9A96E')}
              onBlur={e => (e.currentTarget.style.borderColor = '#EDE7D8')}
            />
            {form.formState.errors.password && (
              <p className="text-xs" style={{ color: '#ef4444' }}>{form.formState.errors.password.message}</p>
            )}
          </div>

          {error && (
            <p className="text-sm px-3 py-2 rounded-lg" style={{ background: '#FEF2F2', color: '#B91C1C' }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-full text-sm font-semibold transition-all"
            style={{ background: loading ? '#8A6E42' : '#C9A96E', color: '#0A0805' }}
          >
            {loading && <Loader2 size={14} className="animate-spin" />}
            {loading ? 'Signing in…' : 'Sign In'}
          </button>

          <div className="flex items-center gap-3">
            <div className="flex-1 h-px" style={{ background: '#EDE7D8' }} />
            <span className="text-xs" style={{ color: '#C0B09A' }}>or</span>
            <div className="flex-1 h-px" style={{ background: '#EDE7D8' }} />
          </div>

          <p className="text-center text-sm" style={{ color: '#6B5E4A' }}>
            Don&apos;t have an account?{' '}
            <Link href="/sfsdiamond/register" className="font-semibold" style={{ color: '#C9A96E' }}>
              Apply for access
            </Link>
          </p>
        </form>
      </div>
    </div>
  )
}
