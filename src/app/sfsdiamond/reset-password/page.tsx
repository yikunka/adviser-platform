'use client'

import { Suspense, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'

const schema = z.object({
  password: z.string().min(8, 'At least 8 characters').max(100),
  confirmPassword: z.string(),
}).refine(d => d.password === d.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
})
type FormData = z.infer<typeof schema>

function ResetPasswordForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token') ?? ''
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const form = useForm<FormData>({ resolver: zodResolver(schema) })

  async function onSubmit(data: FormData) {
    if (!token) {
      setError('Invalid or missing reset token.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password: data.password }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(typeof json.error === 'string' ? json.error : 'Reset failed')
        return
      }
      router.push('/sfsdiamond/login')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form method="post" action="#" onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
      {([
        { id: 'password', label: 'New password', reg: 'password' as const },
        { id: 'confirmPassword', label: 'Confirm password', reg: 'confirmPassword' as const },
      ]).map(({ id, label, reg }) => (
        <div key={id} className="space-y-1.5">
          <label className="text-xs font-medium uppercase tracking-wider" style={{ color: '#9A8060' }}>
            {label}
          </label>
          <input
            id={id}
            type="password"
            {...form.register(reg)}
            autoComplete="new-password"
            className="w-full rounded-xl px-4 py-2.5 text-sm outline-none border"
            style={{ borderColor: '#EDE7D8', color: '#1A1A1A', background: '#FAFAF8' }}
          />
          {form.formState.errors[reg] && (
            <p className="text-xs" style={{ color: '#ef4444' }}>{form.formState.errors[reg]?.message}</p>
          )}
        </div>
      ))}
      {error && (
        <p className="text-sm px-3 py-2 rounded-lg" style={{ background: '#FEF2F2', color: '#B91C1C' }}>
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-full text-sm font-semibold"
        style={{ background: loading ? '#8A6E42' : '#C9A96E', color: '#0A0805' }}
      >
        {loading && <Loader2 size={14} className="animate-spin" />}
        {loading ? 'Resetting…' : 'Reset password'}
      </button>
      <p className="text-center text-sm" style={{ color: '#6B5E4A' }}>
        <Link href="/sfsdiamond/login" className="font-semibold" style={{ color: '#C9A96E' }}>
          Back to partner login
        </Link>
      </p>
    </form>
  )
}

export default function SfsResetPasswordPage() {
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
            Reset password
          </h1>
          <p className="text-sm mt-1" style={{ color: '#6B5E4A' }}>
            Choose a new password for your partner account.
          </p>
        </div>
        <div className="px-8 py-6">
          <Suspense fallback={<p className="text-sm" style={{ color: '#6B5E4A' }}>Loading…</p>}>
            <ResetPasswordForm />
          </Suspense>
        </div>
      </div>
    </div>
  )
}
