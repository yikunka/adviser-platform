'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const fieldStyle: React.CSSProperties = {
  width: '100%',
  background: '#0A0A0A',
  border: '1px solid #2A2418',
  color: '#F0EAD8',
  borderRadius: '0.375rem',
  padding: '0.5rem 0.75rem',
  fontSize: '0.875rem',
  outline: 'none',
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '0.75rem',
  fontWeight: 500,
  color: '#7A7060',
  marginBottom: '0.375rem',
}

type VerifiedClient = {
  id: string
  email: string
  nameEn: string
  nameZh: string | null
}

export default function NewCompanyPage() {
  const router = useRouter()
  const params = useParams()
  const locale = (params.locale as string) ?? 'en'
  const t = useTranslations('admin.companies')

  const [loading, setLoading] = useState(false)
  const [verifiedClients, setVerifiedClients] = useState<VerifiedClient[]>([])
  const [clientsLoading, setClientsLoading] = useState(true)
  const [clientMode, setClientMode] = useState<'verified' | 'email'>('verified')
  const [form, setForm] = useState({
    nameEn: '',
    nameZh: '',
    companyNumber: '',
    dateOfIncorporation: '',
    registeredAddress: '',
    businessNature: '',
    serviceTier: '' as '' | 'BASIC' | 'PROFESSIONAL' | 'PREMIUM',
    clientUserId: '',
    clientUserEmail: '',
  })

  const loadVerifiedClients = useCallback(async () => {
    setClientsLoading(true)
    try {
      const res = await fetch('/api/admin/clients?signedUpOnly=true')
      if (!res.ok) return
      const data = await res.json()
      setVerifiedClients(Array.isArray(data.clients) ? data.clients : [])
    } finally {
      setClientsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadVerifiedClients()
  }, [loadVerifiedClients])

  function set(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (clientMode === 'verified' && !form.clientUserId.trim()) {
      toast.error(t('clientRequired'))
      return
    }
    if (clientMode === 'email' && !form.clientUserEmail.trim()) {
      toast.error(t('clientRequired'))
      return
    }

    setLoading(true)
    try {
      const body: Record<string, string> = { nameEn: form.nameEn }
      if (form.nameZh) body.nameZh = form.nameZh
      if (form.companyNumber) body.companyNumber = form.companyNumber
      if (form.dateOfIncorporation) body.dateOfIncorporation = form.dateOfIncorporation
      if (form.registeredAddress) body.registeredAddress = form.registeredAddress
      if (form.businessNature) body.businessNature = form.businessNature
      if (form.serviceTier) body.serviceTier = form.serviceTier

      if (clientMode === 'verified') {
        body.clientUserId = form.clientUserId.trim()
      } else {
        body.clientUserEmail = form.clientUserEmail.trim()
      }

      const res = await fetch('/api/admin/companies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) {
        const code = typeof data?.error === 'string' ? data.error : ''
        const byCode: Record<string, string> = {
          clientRequired: t('clientRequired'),
          invalidClientUser: t('invalidClientUser'),
          invalidEmail: t('clientEmailInvalid'),
        }
        toast.error(byCode[code] ?? (typeof data?.error === 'string' ? data.error : 'Failed to create company'))
        return
      }
      if (data?.pendingClientEmail) {
        toast.success(t('createSuccessPending'))
      } else {
        toast.success(t('createSuccess'))
      }
      router.push(`/${locale}/admin/companies/${data.id}`)
    } catch {
      toast.error('Failed to create company')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <button
          type="button"
          onClick={() => router.back()}
          className="text-sm mb-2 block transition-colors"
          style={{ color: 'var(--muted-foreground)' }}
        >
          ← {t('back')}
        </button>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>{t('newTitle')}</h1>
      </div>

      <form
        onSubmit={submit}
        className="rounded-xl p-6 space-y-5"
        style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
      >
        <div
          className="rounded-lg p-4 space-y-3"
          style={{ background: '#0A0A0A', border: '1px solid #2A2418' }}
        >
          <div>
            <label style={{ ...labelStyle, color: '#C9A96E' }}>{t('clientOwner')} *</label>
            <p className="text-xs mb-3" style={{ color: 'var(--muted-foreground)' }}>{t('clientOwnerHint')}</p>
          </div>

          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2 cursor-pointer text-sm" style={{ color: 'var(--foreground)' }}>
              <input
                type="radio"
                name="clientMode"
                checked={clientMode === 'verified'}
                onChange={() => { setClientMode('verified'); setForm(f => ({ ...f, clientUserEmail: '' })) }}
              />
              {t('clientModeVerified')}
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-sm" style={{ color: 'var(--foreground)' }}>
              <input
                type="radio"
                name="clientMode"
                checked={clientMode === 'email'}
                onChange={() => { setClientMode('email'); setForm(f => ({ ...f, clientUserId: '' })) }}
              />
              {t('clientModeEmail')}
            </label>
          </div>

          {clientMode === 'verified' ? (
            <div>
              <label style={labelStyle}>{t('client')}</label>
              <select
                required
                value={form.clientUserId}
                onChange={e => set('clientUserId', e.target.value)}
                disabled={clientsLoading}
                style={fieldStyle}
              >
                <option value="" style={{ background: '#141414' }}>{t('clientSelectPlaceholder')}</option>
                {verifiedClients.map(c => (
                  <option key={c.id} value={c.id} style={{ background: '#141414' }}>
                    {c.email} — {c.nameEn}{c.nameZh ? ` (${c.nameZh})` : ''}
                  </option>
                ))}
              </select>
              {!clientsLoading && verifiedClients.length === 0 ? (
                <p className="text-xs mt-1" style={{ color: '#b45309' }}>{t('noVerifiedClients')}</p>
              ) : null}
            </div>
          ) : (
            <div>
              <label style={labelStyle}>{t('clientEmailLabel')} *</label>
              <Input
                style={fieldStyle}
                type="email"
                autoComplete="off"
                value={form.clientUserEmail}
                onChange={e => set('clientUserEmail', e.target.value)}
                placeholder={t('clientEmailPlaceholder')}
              />
            </div>
          )}
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label style={labelStyle}>Company Name (English) *</label>
            <Input style={fieldStyle} required value={form.nameEn} onChange={e => set('nameEn', e.target.value)} maxLength={200} />
          </div>
          <div>
            <label style={labelStyle}>Company Name (Chinese)</label>
            <Input style={fieldStyle} value={form.nameZh} onChange={e => set('nameZh', e.target.value)} maxLength={200} />
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label style={labelStyle}>Company Number</label>
            <Input style={fieldStyle} value={form.companyNumber} onChange={e => set('companyNumber', e.target.value)} maxLength={20} placeholder="e.g. 1234567" />
          </div>
          <div>
            <label style={labelStyle}>Date of Incorporation</label>
            <Input style={{ ...fieldStyle, colorScheme: 'dark' }} type="date" value={form.dateOfIncorporation} onChange={e => set('dateOfIncorporation', e.target.value)} />
          </div>
        </div>

        <div>
          <label style={labelStyle}>Registered Address</label>
          <textarea
            value={form.registeredAddress}
            onChange={e => set('registeredAddress', e.target.value)}
            maxLength={500}
            rows={3}
            style={fieldStyle}
          />
        </div>

        <div>
          <label style={labelStyle}>Business Nature</label>
          <Input style={fieldStyle} value={form.businessNature} onChange={e => set('businessNature', e.target.value)} maxLength={500} />
        </div>

        <div>
          <label style={labelStyle}>Service Tier</label>
          <select value={form.serviceTier} onChange={e => set('serviceTier', e.target.value)} style={fieldStyle}>
            <option value="" style={{ background: '#141414' }}>— None —</option>
            <option value="BASIC" style={{ background: '#141414' }}>Basic</option>
            <option value="PROFESSIONAL" style={{ background: '#141414' }}>Professional</option>
            <option value="PREMIUM" style={{ background: '#141414' }}>Premium</option>
          </select>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="outline" onClick={() => router.back()} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? 'Creating…' : 'Create Company'}
          </Button>
        </div>
      </form>
    </div>
  )
}
