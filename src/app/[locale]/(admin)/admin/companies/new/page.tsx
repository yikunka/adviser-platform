'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DatePickerPopover } from '@/components/ui/date-picker-popover'
import { BUSINESS_NATURE_OPTIONS } from '@/lib/kyc/kycFieldOptions'
import { TCSP_REGISTERED_OFFICE_ADDRESS } from '@/lib/company/office-address'
import {
  COMPANY_JURISDICTIONS,
  COMPANY_JURISDICTION_LABELS,
  type CompanyJurisdiction,
} from '@/lib/company/jurisdiction'

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

type CompanyDocType = 'CI' | 'BR'

type CompanyUpload = {
  id: string
  file: File
  docType: CompanyDocType
}

export default function NewCompanyPage() {
  const router = useRouter()
  const params = useParams()
  const locale = (params.locale as string) ?? 'en'
  const t = useTranslations('admin.companies')

  const [loading, setLoading] = useState(false)
  const [verifiedClients, setVerifiedClients] = useState<VerifiedClient[]>([])
  const [clientsLoading, setClientsLoading] = useState(true)
  const [analyzing, setAnalyzing] = useState(false)
  const [companyUploads, setCompanyUploads] = useState<CompanyUpload[]>([])
  const [clientMode, setClientMode] = useState<'verified' | 'email' | 'later'>('verified')
  const [useOfficeAddress, setUseOfficeAddress] = useState(false)
  const [form, setForm] = useState({
    nameEn: '',
    nameZh: '',
    companyNumber: '',
    companyType: '' as '' | CompanyJurisdiction,
    dateOfIncorporation: '',
    registeredAddress: '',
    businessNature: '',
    financialYearEndMonth: '' as '' | '3' | '12',
    serviceTier: '' as '' | 'COMP_SET_UP' | 'CS' | 'CS_VO' | 'CS_BK' | 'CS_VO_BK',
    clientUserId: '',
    clientUserEmail: '',
  })

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const clientsRes = await fetch('/api/admin/clients?signedUpOnly=true')
        if (!clientsRes.ok) return
        const data = await clientsRes.json()
        if (!cancelled) setVerifiedClients(Array.isArray(data.clients) ? data.clients : [])
      } finally {
        if (!cancelled) setClientsLoading(false)
      }
    }

    void load()
    return () => { cancelled = true }
  }, [])

  function set(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }))
  }

  function addCompanyFiles(docType: CompanyDocType, fileList: FileList | null) {
    const files = Array.from(fileList ?? [])
    if (files.length === 0) return
    const ALLOWED = new Set(['image/jpeg', 'image/png', 'application/pdf'])
    const imageFiles = files.filter(file => ALLOWED.has(file.type))
    if (imageFiles.length !== files.length) {
      toast.error('Only JPG, PNG and PDF files are allowed here')
    }
    setCompanyUploads(current => [
      ...current,
      ...imageFiles.map(file => ({
        id: `${file.name}-${file.size}-${file.lastModified}-${crypto.randomUUID()}`,
        file,
        docType,
      })),
    ].slice(0, 6))
  }

  function removeUpload(id: string) {
    setCompanyUploads(current => current.filter(item => item.id !== id))
  }

  async function analyzeDocuments() {
    if (companyUploads.length === 0) {
      toast.error('Upload at least one CI or BR image first')
      return
    }

    setAnalyzing(true)
    try {
      const fd = new FormData()
      for (const item of companyUploads) fd.append('files', item.file)
      const res = await fetch('/api/admin/companies/analyze-documents', { method: 'POST', body: fd })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(typeof data?.error === 'string' ? data.error : 'Document analysis failed')
        return
      }

      const fields = data?.fields && typeof data.fields === 'object' ? data.fields as Record<string, unknown> : {}
      const nextAddress = typeof fields.registeredAddress === 'string' && fields.registeredAddress
        ? fields.registeredAddress
        : null
      setForm(current => ({
        ...current,
        nameEn: typeof fields.nameEn === 'string' && fields.nameEn ? fields.nameEn : current.nameEn,
        nameZh: typeof fields.nameZh === 'string' && fields.nameZh ? fields.nameZh : current.nameZh,
        companyNumber: typeof fields.companyNumber === 'string' && fields.companyNumber ? fields.companyNumber : current.companyNumber,
        dateOfIncorporation: typeof fields.dateOfIncorporation === 'string' && fields.dateOfIncorporation ? fields.dateOfIncorporation : current.dateOfIncorporation,
        registeredAddress: nextAddress ?? current.registeredAddress,
        businessNature: typeof fields.businessNature === 'string' && fields.businessNature ? fields.businessNature : current.businessNature,
      }))
      if (nextAddress != null) {
        setUseOfficeAddress(nextAddress.trim() === TCSP_REGISTERED_OFFICE_ADDRESS)
      }

      toast.success(data?.source === 'bailian' ? 'Documents analyzed by Bailian' : 'Document hints applied')
    } catch {
      toast.error('Document analysis failed')
    } finally {
      setAnalyzing(false)
    }
  }

  async function uploadCompanyDocuments(companyId: string) {
    for (const item of companyUploads) {
      const fd = new FormData()
      fd.append('file', item.file)
      fd.append('type', item.docType)
      fd.append('companyId', companyId)
      const res = await fetch('/api/documents/upload', { method: 'POST', body: fd })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(typeof data?.error === 'string' ? data.error : `Failed to upload ${item.file.name}`)
      }
    }
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
      const body: Record<string, string | number> = { nameEn: form.nameEn }
      if (form.nameZh) body.nameZh = form.nameZh
      if (form.companyNumber) body.companyNumber = form.companyNumber
      if (form.companyType) body.companyType = form.companyType
      if (form.dateOfIncorporation) body.dateOfIncorporation = form.dateOfIncorporation
      if (form.registeredAddress) body.registeredAddress = form.registeredAddress
      if (form.businessNature) body.businessNature = form.businessNature
      if (form.financialYearEndMonth) body.financialYearEndMonth = Number(form.financialYearEndMonth)
      if (form.serviceTier) body.serviceTier = form.serviceTier

      if (clientMode === 'verified') {
        body.clientUserId = form.clientUserId.trim()
      } else if (clientMode === 'email') {
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
      if (companyUploads.length > 0) {
        try {
          await uploadCompanyDocuments(data.id)
        } catch (uploadError) {
          toast.warning(uploadError instanceof Error ? uploadError.message : 'Company created, but document upload failed')
          router.push(`/${locale}/admin/companies/${data.id}`)
          return
        }
      }
      const suffix = companyUploads.length > 0 ? ` ${companyUploads.length} document${companyUploads.length === 1 ? '' : 's'} attached.` : ''
      const baseMsg = data?.pendingClientEmail
        ? t('createSuccessPending')
        : clientMode === 'later'
          ? t('createSuccessLater')
          : t('createSuccess')
      toast.success(`${baseMsg}${suffix}`)
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
            <label style={{ ...labelStyle, color: '#C9A96E' }}>{t('clientOwner')}</label>
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
            <label className="flex items-center gap-2 cursor-pointer text-sm" style={{ color: 'var(--foreground)' }}>
              <input
                type="radio"
                name="clientMode"
                checked={clientMode === 'later'}
                onChange={() => {
                  setClientMode('later')
                  setForm(f => ({ ...f, clientUserId: '', clientUserEmail: '' }))
                }}
              />
              {t('clientModeLater')}
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
          ) : clientMode === 'email' ? (
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
          ) : (
            <p className="text-xs" style={{ color: '#7A7060' }}>{t('clientModeLaterHint')}</p>
          )}
        </div>

        <div
          className="rounded-lg p-4 space-y-3"
          style={{ background: '#0A0A0A', border: '1px solid #2A2418' }}
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <label style={{ ...labelStyle, color: '#C9A96E' }}>Company documents</label>
              <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Upload CI and BR documents (images or PDF) to pre-fill this company and attach them after creation.</p>
            </div>
            <div className="flex items-center gap-2">
              {(['CI', 'BR'] as const).map(docType => (
                <label key={docType} style={{ cursor: loading || analyzing ? 'not-allowed' : 'pointer' }}>
                  <input
                    type="file"
                    multiple
                    accept="image/jpeg,image/png,application/pdf"
                    className="hidden"
                    disabled={loading || analyzing}
                    onChange={e => { addCompanyFiles(docType, e.target.files); e.target.value = '' }}
                  />
                  <span
                    className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors"
                    style={{ borderColor: '#2A2418', color: 'var(--foreground)', background: 'transparent', cursor: 'inherit' }}
                  >
                    Upload {docType}
                  </span>
                </label>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={analyzeDocuments} disabled={loading || analyzing || companyUploads.length === 0}>
                {analyzing ? 'Analyzing…' : 'Analyze'}
              </Button>
            </div>
          </div>

          {companyUploads.length === 0 ? (
            <p className="text-sm" style={{ color: '#5A5040' }}>No company documents selected.</p>
          ) : (
            <ul className="divide-y divide-[#2A2418] rounded-md" style={{ border: '1px solid #2A2418' }}>
              {companyUploads.map(item => (
                <li key={item.id} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="truncate text-sm" style={{ color: 'var(--foreground)' }}>{item.file.name}</p>
                    <p className="text-xs" style={{ color: '#5A5040' }}>{item.docType} · {Math.ceil(item.file.size / 1024)} KB</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => removeUpload(item.id)} disabled={loading || analyzing}>
                      Remove
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
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

        <div>
          <label style={labelStyle}>Jurisdiction</label>
          <select
            value={form.companyType}
            onChange={e => set('companyType', e.target.value)}
            style={fieldStyle}
          >
            <option value="" style={{ background: '#141414' }}>— Select jurisdiction —</option>
            {COMPANY_JURISDICTIONS.map(j => (
              <option key={j} value={j} style={{ background: '#141414' }}>
                {COMPANY_JURISDICTION_LABELS[j]}
              </option>
            ))}
          </select>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label style={labelStyle}>Company Number</label>
            <Input style={fieldStyle} value={form.companyNumber} onChange={e => set('companyNumber', e.target.value)} maxLength={20} placeholder="e.g. 1234567" />
          </div>
          <div>
            <label style={labelStyle}>Date of Incorporation</label>
            <DatePickerPopover
              value={form.dateOfIncorporation}
              onChange={(v) => set('dateOfIncorporation', v)}
              style={{ ...fieldStyle, colorScheme: 'dark' }}
            />
          </div>
        </div>

        <div>
          <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
            <label style={{ ...labelStyle, marginBottom: 0 }}>Registered Address</label>
            <label className="flex items-center gap-2 cursor-pointer text-xs" style={{ color: '#C9A96E' }}>
              <input
                type="checkbox"
                checked={useOfficeAddress}
                onChange={e => {
                  const checked = e.target.checked
                  setUseOfficeAddress(checked)
                  setForm(f => ({
                    ...f,
                    registeredAddress: checked
                      ? TCSP_REGISTERED_OFFICE_ADDRESS
                      : f.registeredAddress === TCSP_REGISTERED_OFFICE_ADDRESS
                        ? ''
                        : f.registeredAddress,
                  }))
                }}
              />
              使用本公司地址
            </label>
          </div>
          <textarea
            value={form.registeredAddress}
            onChange={e => {
              setUseOfficeAddress(false)
              set('registeredAddress', e.target.value)
            }}
            maxLength={500}
            rows={3}
            style={fieldStyle}
          />
        </div>

        <div>
          <label style={labelStyle}>Financial Year End</label>
          <div className="flex flex-wrap gap-4 pt-1">
            <label className="flex items-center gap-2 cursor-pointer text-sm" style={{ color: 'var(--foreground)' }}>
              <input
                type="checkbox"
                checked={form.financialYearEndMonth === '3'}
                onChange={e => set('financialYearEndMonth', e.target.checked ? '3' : '')}
              />
              March 31st
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-sm" style={{ color: 'var(--foreground)' }}>
              <input
                type="checkbox"
                checked={form.financialYearEndMonth === '12'}
                onChange={e => set('financialYearEndMonth', e.target.checked ? '12' : '')}
              />
              December 31st
            </label>
          </div>
        </div>

        <div>
          <label style={labelStyle}>Business Nature</label>
          <select
            value={form.businessNature}
            onChange={e => set('businessNature', e.target.value)}
            style={fieldStyle}
          >
            <option value="" style={{ background: '#141414' }}>— Select business nature —</option>
            {form.businessNature && !BUSINESS_NATURE_OPTIONS.some(opt => opt.value === form.businessNature) ? (
              <option value={form.businessNature} style={{ background: '#141414' }}>{form.businessNature}</option>
            ) : null}
            {BUSINESS_NATURE_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value} style={{ background: '#141414' }}>{opt.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label style={labelStyle}>Service Tier</label>
          <select value={form.serviceTier} onChange={e => set('serviceTier', e.target.value)} style={fieldStyle}>
            <option value="" style={{ background: '#141414' }}>— None —</option>
            <option value="COMP_SET_UP" style={{ background: '#141414' }}>Comp Set Up</option>
            <option value="CS" style={{ background: '#141414' }}>CS</option>
            <option value="CS_VO" style={{ background: '#141414' }}>CS+VO</option>
            <option value="CS_BK" style={{ background: '#141414' }}>CS+BK</option>
            <option value="CS_VO_BK" style={{ background: '#141414' }}>CS+VO+BK</option>
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
