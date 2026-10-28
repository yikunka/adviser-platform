'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import Link from 'next/link'
import Image from 'next/image'
import { Loader2, MailCheck } from 'lucide-react'

const schema = z.object({ email: z.string().email('Invalid email') })
type FormData = z.infer<typeof schema>

export default function SfsForgotPasswordPage() {
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const form = useForm<FormData>({ resolver: zodResolver(schema) })

  async function onSubmit(data: FormData) {
    setLoading(true)
    try {
      await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: data.email, locale: 'en', platform: 'SFS_DIAMOND' }),
      })
      setSent(true)
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
            Forgot password
          </h1>
          <p className="text-sm mt-1" style={{ color: '#6B5E4A' }}>
            Enter your partner email and we will send a reset link if an account exists.
          </p>
        </div>

        <div className="px-8 py-6">
          {sent ? (
            <div className="flex flex-col items-center gap-4 py-4">
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center"
                style={{ background: 'rgba(201,169,110,0.12)', border: '1px solid #C9A96E' }}
              >
                <MailCheck size={24} style={{ color: '#C9A96E' }} />
              </div>
              <p className="text-sm text-center" style={{ color: '#6B5E4A' }}>
                If that email is registered, a reset link has been sent.
              </p>
              <Link href="/sfsdiamond/login" className="text-sm font-semibold" style={{ color: '#C9A96E' }}>
                Back to partner login
              </Link>
            </div>
          ) : (
            <form method="post" action="#" onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
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
                />
                {form.formState.errors.email && (
                  <p className="text-xs" style={{ color: '#ef4444' }}>{form.formState.errors.email.message}</p>
                )}
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-full text-sm font-semibold"
                style={{ background: loading ? '#8A6E42' : '#C9A96E', color: '#0A0805' }}
              >
                {loading && <Loader2 size={14} className="animate-spin" />}
                {loading ? 'Sending…' : 'Send reset link'}
              </button>
              <p className="text-center text-sm" style={{ color: '#6B5E4A' }}>
                <Link href="/sfsdiamond/login" className="font-semibold" style={{ color: '#C9A96E' }}>
                  Back to partner login
                </Link>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
