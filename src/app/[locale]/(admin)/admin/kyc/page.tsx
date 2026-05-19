'use client'

import React, { useEffect, useState, useCallback, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Download, Eye, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

type KYCDocument = {
  id: string
  fileName: string
  documentType: string
  storageKey: string
  mimeType: string
  fileSize: number
  status: string
  uploadedAt: string
}

type AMLHitResult = 'STRONG_HIT' | 'POTENTIAL_HIT' | 'WEAK_HIT'

type AMLAlert = {
  id: string
  result: AMLHitResult
  matchScore: number | null
  resolution: string
  reviewNotes: string | null
  amlRecord: {
    primaryName: string
    aliases: string[]
    entityType: string
    nationality: string | null
    gender: string | null
    dateOfBirth: string | null
    placeOfBirth: string | null
    addresses: unknown
    idNumbers: unknown
    listingReason: string | null
    listingDate: string | null
    listVersionDate: string
    rawData: unknown
    source: { nameEn: string; sourceUrl: string }
  }
}

type AMLData = {
  lastCheck: { checkedAt: string; result: string } | null
  alerts: AMLAlert[]
}

type ClientAccount = {
  id: string
  email: string
  nameEn: string
  nameZh: string | null
}

type KYCRecord = {
  id: string
  kycCode: string | null
  titlePrefix: string | null
  firstName: string | null
  lastName: string | null
  otherName: string | null
  nameEn: string
  nameZh: string | null
  idType: string | null
  idNumber: string | null
  placeOfIssue: string | null
  placeOfBirth: string | null
  idExpiryDate: string | null
  dateOfBirth: string | null
  nationality: string | null
  homeAddress: string | null
  contactAddress: string | null
  homePhone: string | null
  workPhone: string | null
  mobile: string | null
  wechat: string | null
  email: string | null
  isUsCitizen: boolean | null
  isPep: boolean | null
  emergencyContact: string | null
  employmentStatus: string | null
  employerName: string | null
  employerAddress: string | null
  businessNatures: string[]
  position: string | null
  workingYears: number | null
  sourceOfFunds: string | null
  sourcesOfWealth: string[]
  annualIncome: string | null
  netAssetValue: string | null
  assetItems: string[]
  declarationSigned: boolean
  signatureName: string | null
  declarationDate: string | null
  kycStatus: string
  updatedAt: string
  kycDocuments: KYCDocument[]
  submittedByUser: { email: string; nameEn: string } | null
  companyLinks: Array<{
    company: { nameEn: string; clientUser: { email: string; nameEn: string } | null }
  }>
}

const STATUS_OPTIONS = ['', 'SUBMITTED', 'PENDING_INFO', 'APPROVED', 'REJECTED']

const AML_HIT_COLOR: Record<AMLHitResult, { bg: string; text: string; label: string }> = {
  STRONG_HIT:    { bg: 'rgba(239,68,68,0.12)',   text: '#ef4444', label: 'Strong Hit' },
  POTENTIAL_HIT: { bg: 'rgba(245,158,11,0.12)',  text: '#f59e0b', label: 'Potential Hit' },
  WEAK_HIT:      { bg: 'rgba(234,179,8,0.12)',   text: '#eab308', label: 'Weak Hit' },
}

const STATUS_COLOR: Record<string, string> = {
  DRAFT:        'bg-[rgba(120,113,108,0.15)] text-[#9A8060]',
  SUBMITTED:    'bg-[rgba(201,169,110,0.15)] text-[#C9A96E]',
  PENDING_INFO: 'bg-[rgba(245,158,11,0.12)] text-[#f59e0b]',
  APPROVED:     'bg-[rgba(16,185,129,0.12)] text-[#10b981]',
  REJECTED:     'bg-[rgba(239,68,68,0.12)] text-[#ef4444]',
}

const DOCUMENT_TYPE_LABEL: Record<string, string> = {
  KYC_ID: 'ID',
  KYC_ADDRESS: 'Address',
  KYC_FINANCIAL: 'Financial',
  KYC_OTHER: 'Other',
}

function documentTypeLabel(type: string) {
  return DOCUMENT_TYPE_LABEL[type] ?? type.replace(/^KYC_/, '').replace(/_/g, ' ')
}

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#C9A96E' }}>{title}</p>
      <div className="space-y-1">{children}</div>
    </div>
  )
}

function DetailRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null
  return (
    <div className="flex gap-2 text-sm">
      <span className="w-36 shrink-0" style={{ color: 'var(--muted-foreground)' }}>{label}</span>
      <span style={{ color: 'var(--foreground)' }}>{value}</span>
    </div>
  )
}

function JsonBlock({ label, value }: { label: string; value: unknown }) {
  if (value == null) return null
  const isEmptyObject = typeof value === 'object' && !Array.isArray(value) && Object.keys(value as Record<string, unknown>).length === 0
  const isEmptyArray = Array.isArray(value) && value.length === 0
  if (isEmptyObject || isEmptyArray) return null

  return (
    <div className="space-y-1 text-xs">
      <p className="font-medium" style={{ color: 'var(--muted-foreground)' }}>{label}</p>
      <pre className="max-h-44 overflow-auto rounded-md border border-[#2A2418] p-2 whitespace-pre-wrap" style={{ background: '#0A0A0A', color: 'var(--foreground)' }}>
        {typeof value === 'string' ? value : JSON.stringify(value, null, 2)}
      </pre>
    </div>
  )
}

function fileHref(doc: KYCDocument, download = false) {
  const params = new URLSearchParams({ key: doc.storageKey })
  if (download) {
    params.set('download', '1')
    params.set('filename', doc.fileName)
  }
  return `/api/files?${params.toString()}`
}

function formatFileSize(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

/** Portal client (submitter) or company-linked account holder. */
function clientPortalAccount(r: KYCRecord): { email: string | null; name: string | null } {
  const s = r.submittedByUser
  if (s?.email) return { email: s.email, name: s.nameEn }
  const u = r.companyLinks[0]?.company?.clientUser
  if (u?.email) return { email: u.email, name: u.nameEn }
  return { email: null, name: null }
}

export default function KYCQueuePage() {
  const t = useTranslations('admin.kyc')
  const [records, setRecords] = useState<KYCRecord[]>([])
  const [filterStatus, setFilterStatus] = useState('')
  const [selected, setSelected] = useState<KYCRecord | null>(null)
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [amlData, setAmlData] = useState<AMLData | null>(null)
  const [amlLoading, setAmlLoading] = useState(false)
  const [clients, setClients] = useState<ClientAccount[]>([])
  const [createClientId, setCreateClientId] = useState('')
  const [createImage, setCreateImage] = useState<File | null>(null)
  const [creating, setCreating] = useState(false)
  const [generatingDdr, setGeneratingDdr] = useState(false)
  const [lastDdrKey, setLastDdrKey] = useState<{ personId: string; key: string } | null>(null)
  const createImageInputRef = useRef<HTMLInputElement | null>(null)

  const fetchRecords = useCallback(async (statusOverride?: string) => {
    const status = statusOverride ?? filterStatus
    const res = await fetch(`/api/admin/kyc?status=${status}`)
    const json = await res.json()
    setRecords(json.records ?? [])
  }, [filterStatus])

  // eslint-disable-next-line react-hooks/set-state-in-effect -- fetchRecords updates state after the async request resolves.
  useEffect(() => { fetchRecords() }, [fetchRecords])

  useEffect(() => {
    let cancelled = false

    async function loadClients() {
      const res = await fetch('/api/admin/kyc/clients')
      if (!res.ok) return
      const json = await res.json()
      if (!cancelled) setClients(Array.isArray(json.clients) ? json.clients : [])
    }

    void loadClients()
    return () => { cancelled = true }
  }, [])

  function chooseCreateImage(file: File | undefined) {
    if (!file) return
    if (file.type !== 'image/jpeg' && file.type !== 'image/png' && file.type !== 'application/pdf') {
      toast.error('Only JPG, PNG, and PDF files are allowed')
      return
    }
    setCreateImage(file)
  }

  async function createApprovedKyc() {
    if (!createClientId) {
      toast.error('Select a client account')
      return
    }
    if (!createImage) {
      toast.error('Upload a KYC image')
      return
    }

    setCreating(true)
    try {
      const fd = new FormData()
      fd.append('clientUserId', createClientId)
      fd.append('file', createImage)
      const res = await fetch('/api/admin/kyc/image-create', { method: 'POST', body: fd })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(typeof json?.error === 'string' ? json.error : 'Failed to create KYC person')
        return
      }

      toast.success('Approved KYC person created')
      setCreateImage(null)
      setCreateClientId('')
      setFilterStatus('APPROVED')
      setSelected(json.record ?? null)
      fetchRecords('APPROVED')
    } finally {
      setCreating(false)
    }
  }

  async function fetchAML(id: string) {
    setAmlData(null)
    setAmlLoading(true)
    try {
      const res = await fetch(`/api/admin/kyc/${id}/aml`)
      if (res.ok) setAmlData(await res.json())
    } finally {
      setAmlLoading(false)
    }
  }

  async function runAMLScreen() {
    if (!selected) return
    setAmlLoading(true)
    try {
      const res = await fetch(`/api/admin/kyc/${selected.id}/aml`, { method: 'POST' })
      if (res.ok) setAmlData(await res.json())
      else toast.error('AML screening failed')
    } finally {
      setAmlLoading(false)
    }
  }

  async function doAction(action: 'APPROVE' | 'REJECT' | 'REQUEST_INFO' | 'CANCEL_APPROVAL') {
    if (!selected) return
    if (action === 'REJECT' && !reason.trim()) {
      toast.error(t('reasonRequired'))
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/kyc/${selected.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, reason }),
      })
      if (!res.ok) { toast.error(t('actionFailed')); return }
      toast.success(t('actionSuccess'))
      setSelected(null)
      setReason('')
      fetchRecords()
    } finally {
      setLoading(false)
    }
  }

  async function generatePersonDdr() {
    if (!selected) return
    setGeneratingDdr(true)
    try {
      const res = await fetch('/api/docgen/person', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyPersonId: selected.id }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(typeof data?.error === 'string' ? data.error : 'DDR generation failed')
        return
      }
      if (data.storageKey) {
        setLastDdrKey({ personId: selected.id, key: data.storageKey })
        // Trigger download via a temporary anchor (avoids popup blocker)
        const filename = `DDR_${selected.nameEn.replace(/\s+/g, '_')}.pdf`
        const href = `/api/files?key=${encodeURIComponent(data.storageKey)}&download=1&filename=${encodeURIComponent(filename)}`
        const a = document.createElement('a')
        a.href = href
        a.download = filename
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        toast.success('DDR generated — downloading now')
      }
    } finally {
      setGeneratingDdr(false)
    }
  }

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>{t('title')}</h1>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
            <div className="flex-1">
              <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#C9A96E' }}>
                Add approved KYC by image
              </label>
              <select
                value={createClientId}
                onChange={e => setCreateClientId(e.target.value)}
                disabled={creating}
                className="mt-2 w-full rounded-md px-3 py-2 text-sm"
                style={{ background: '#0A0A0A', border: '1px solid #2A2418', color: 'var(--foreground)', outline: 'none' }}
              >
                <option value="" style={{ background: '#141414' }}>Select client account</option>
                {clients.map(client => (
                  <option key={client.id} value={client.id} style={{ background: '#141414' }}>
                    {client.email} — {client.nameEn}{client.nameZh ? ` (${client.nameZh})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <input
                ref={createImageInputRef}
                type="file"
                accept="image/jpeg,image/png,application/pdf"
                className="sr-only"
                disabled={creating}
                onChange={e => { chooseCreateImage(e.target.files?.[0]); e.target.value = '' }}
              />
              <Button
                type="button"
                variant="outline"
                disabled={creating}
                onClick={() => createImageInputRef.current?.click()}
                title={createImage?.name}
              >
                {createImage ? 'Change file' : 'Upload image / PDF'}
              </Button>
              {createImage ? (
                <span className="max-w-56 truncate text-sm" style={{ color: 'var(--muted-foreground)' }}>
                  {createImage.name}
                </span>
              ) : null}
              <Button type="button" disabled={creating || !createClientId || !createImage} onClick={createApprovedKyc}>
                {creating ? 'Analyzing…' : 'Create Approved KYC'}
              </Button>
            </div>
          </div>
          <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
            JPG, PNG, or PDF (including image-based scans). Bailian extracts identity fields, assigns the KYC to the selected account, and marks it approved.
          </p>
        </CardContent>
      </Card>

      <div className="flex gap-2 flex-wrap">
        {STATUS_OPTIONS.map(s => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            className="px-3 py-1.5 rounded-full text-sm font-medium transition-colors"
            style={
              filterStatus === s
                ? { background: 'rgba(201,169,110,0.2)', color: '#C9A96E', border: '1px solid #C9A96E' }
                : { background: '#1E1A12', color: '#7A7060', border: '1px solid #2A2418' }
            }
          >
            {s || t('all')}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#2A2418] text-left" style={{ color: 'var(--muted-foreground)' }}>
                    <th className="px-4 py-3 font-medium">KYC Code / Name</th>
                    <th className="px-4 py-3 font-medium">Client Account</th>
                    <th className="px-4 py-3 font-medium">Company</th>
                    <th className="px-4 py-3 font-medium">Files</th>
                    <th className="px-4 py-3 font-medium">Updated</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2A2418]">
              {records.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center" style={{ color: 'var(--muted-foreground)' }}>{t('empty')}</td>
                </tr>
              ) : records.map((r) => {
                const client = clientPortalAccount(r)
                return (
                <tr
                  key={r.id}
                  onClick={() => { setSelected(r); setReason(''); fetchAML(r.id) }}
                  className="px-4 py-3 cursor-pointer transition-colors"
                  style={{
                    background: selected?.id === r.id ? 'rgba(201,169,110,0.08)' : 'transparent',
                  }}
                  onMouseEnter={e => { if (selected?.id !== r.id) (e.currentTarget as HTMLElement).style.background = '#1A1A12' }}
                  onMouseLeave={e => { if (selected?.id !== r.id) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                >
                  <td className="px-4 py-3">
                    {r.kycCode ? <p className="text-xs font-semibold" style={{ color: '#C9A96E' }}>{r.kycCode}</p> : null}
                    <p className="font-medium" style={{ color: 'var(--foreground)' }}>
                      {r.titlePrefix ? `${r.titlePrefix} ` : ''}{r.nameEn}
                    </p>
                    {r.nameZh ? <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{r.nameZh}</p> : null}
                  </td>
                  <td className="px-4 py-3">
                    <p className="max-w-56 truncate" style={{ color: '#C9A96E' }} title={client.email ?? undefined}>{client.email ?? '—'}</p>
                    {client.name ? <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{client.name}</p> : null}
                  </td>
                  <td className="px-4 py-3" style={{ color: 'var(--muted-foreground)' }}>
                    {r.companyLinks[0]?.company.nameEn ?? '—'}
                  </td>
                  <td className="px-4 py-3" style={{ color: 'var(--muted-foreground)' }}>
                    {r.kycDocuments.length}
                  </td>
                  <td className="px-4 py-3" style={{ color: 'var(--muted-foreground)' }}>
                    {new Date(r.updatedAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOR[r.kycStatus] ?? ''}`}>
                      {r.kycStatus}
                    </span>
                  </td>
                </tr>
                )
              })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Right: collapsible detail + action panel */}
        {selected && (
          <div className="fixed inset-0 z-50 flex justify-end bg-black/35" onClick={() => setSelected(null)}>
            <Card
              className="h-full w-full max-w-2xl overflow-y-auto rounded-none border-y-0 border-r-0 shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
            <CardContent className="pt-6 space-y-5">
              <div className="flex items-center gap-3 flex-wrap">
                <h3 className="font-semibold text-lg" style={{ color: 'var(--foreground)' }}>
                  {selected.titlePrefix ? `${selected.titlePrefix} ` : ''}{selected.nameEn}
                  {selected.nameZh ? ` (${selected.nameZh})` : ''}
                </h3>
                {selected.kycCode ? (
                  <span className="rounded-md border border-[#2A2418] px-2 py-0.5 text-xs font-semibold" style={{ color: '#C9A96E' }}>
                    {selected.kycCode}
                  </span>
                ) : null}
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOR[selected.kycStatus] ?? ''}`}>
                  {selected.kycStatus}
                </span>
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  className="ml-auto inline-flex h-8 w-8 items-center justify-center rounded-md border border-[#2A2418]"
                  aria-label="Close KYC details"
                >
                  <X size={16} />
                </button>
              </div>

              {(() => {
                const c = clientPortalAccount(selected)
                if (!c.email) {
                  return (
                    <p className="text-xs rounded-lg px-3 py-2" style={{ background: 'rgba(120,113,108,0.12)', color: 'var(--muted-foreground)' }}>
                      {t('clientEmail')}: —
                    </p>
                  )
                }
                return (
                  <div
                    className="rounded-lg px-3 py-2 text-sm"
                    style={{ background: 'rgba(201,169,110,0.1)', border: '1px solid #2A2418' }}
                  >
                    <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--muted-foreground)' }}>
                      {t('clientAccount')}
                    </span>
                    <p className="mt-0.5 break-all" style={{ color: '#C9A96E' }}>{c.email}</p>
                    {c.name ? <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>{c.name}</p> : null}
                  </div>
                )
              })()}

              {/* Identity */}
              <DetailSection title="Identity">
                <DetailRow label="KYC Code" value={selected.kycCode} />
                <DetailRow label="First Name" value={selected.firstName} />
                <DetailRow label="Last Name" value={selected.lastName} />
                <DetailRow label="Other Name" value={selected.otherName} />
                <DetailRow label="Chinese Name" value={selected.nameZh} />
                <DetailRow label="ID Type" value={selected.idType} />
                <DetailRow label="ID Number" value={selected.idNumber} />
                <DetailRow label="Place of Issue" value={selected.placeOfIssue} />
                <DetailRow label="ID Expiry" value={selected.idExpiryDate ? new Date(selected.idExpiryDate).toLocaleDateString() : null} />
                <DetailRow label="Date of Birth" value={selected.dateOfBirth ? new Date(selected.dateOfBirth).toLocaleDateString() : null} />
                <DetailRow label="Place of Birth" value={selected.placeOfBirth} />
                <DetailRow label="Nationality" value={selected.nationality} />
                <DetailRow label="US Citizen" value={selected.isUsCitizen == null ? null : selected.isUsCitizen ? 'Yes' : 'No'} />
                <DetailRow label="PEP" value={selected.isPep == null ? null : selected.isPep ? 'Yes' : 'No'} />
              </DetailSection>

              {/* Contact */}
              <DetailSection title="Contact">
                <DetailRow label="Email" value={selected.email} />
                <DetailRow label="Mobile" value={selected.mobile} />
                <DetailRow label="Home Phone" value={selected.homePhone} />
                <DetailRow label="Work Phone" value={selected.workPhone} />
                <DetailRow label="WeChat" value={selected.wechat} />
                <DetailRow label="Home Address" value={selected.homeAddress} />
                <DetailRow label="Contact Address" value={selected.contactAddress} />
                <DetailRow label="Emergency Contact" value={selected.emergencyContact} />
              </DetailSection>

              {/* Employment */}
              <DetailSection title="Employment">
                <DetailRow label="Status" value={selected.employmentStatus} />
                <DetailRow label="Employer" value={selected.employerName} />
                <DetailRow label="Employer Address" value={selected.employerAddress} />
                <DetailRow label="Position" value={selected.position} />
                <DetailRow label="Working Years" value={selected.workingYears != null ? String(selected.workingYears) : null} />
                <DetailRow label="Business Natures" value={selected.businessNatures?.join(', ') || null} />
              </DetailSection>

              {/* Finance */}
              <DetailSection title="Financial">
                <DetailRow label="Source of Funds" value={selected.sourceOfFunds} />
                <DetailRow label="Sources of Wealth" value={selected.sourcesOfWealth?.join(', ') || null} />
                <DetailRow label="Annual Income" value={selected.annualIncome} />
                <DetailRow label="Net Asset Value" value={selected.netAssetValue} />
                <DetailRow label="Assets" value={selected.assetItems?.join(', ') || null} />
              </DetailSection>

              {/* Documents */}
              {selected.kycDocuments?.length > 0 && (
                <DetailSection title="Documents">
                  <ul className="space-y-2">
                    {selected.kycDocuments.map(doc => (
                      <li
                        key={doc.id}
                        className="flex flex-col gap-2 rounded-md border border-[#2A2418] px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium" style={{ color: 'var(--foreground)' }} title={doc.fileName}>
                            {documentTypeLabel(doc.documentType)}
                          </p>
                          <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                            {[doc.fileName, doc.status, formatFileSize(doc.fileSize)].filter(Boolean).join(' · ')}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <a
                            href={fileHref(doc)}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[#2A2418] px-2.5 text-xs"
                            style={{ color: '#C9A96E' }}
                          >
                            <Eye size={14} />
                            Preview
                          </a>
                          <a
                            href={fileHref(doc, true)}
                            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[#2A2418] px-2.5 text-xs"
                            style={{ color: '#C9A96E' }}
                          >
                            <Download size={14} />
                            Download
                          </a>
                        </div>
                      </li>
                    ))}
                  </ul>
                </DetailSection>
              )}

              {/* Due Diligence Report */}
              <div className="border-t pt-4" style={{ borderColor: '#2A2418' }}>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#C9A96E' }}>Due Diligence Report</p>
                  <Button
                    variant="outline"
                    disabled={generatingDdr}
                    onClick={generatePersonDdr}
                    className="text-xs h-7 px-3"
                    style={{ borderColor: '#2A2418', color: generatingDdr ? 'var(--muted-foreground)' : '#C9A96E' }}
                  >
                    {generatingDdr ? 'Generating…' : 'Generate DDR'}
                  </Button>
                </div>
                {lastDdrKey?.personId === selected.id ? (
                  <a
                    href={`/api/files?key=${encodeURIComponent(lastDdrKey.key)}&download=1&filename=${encodeURIComponent(`DDR_${selected.nameEn.replace(/\s+/g, '_')}.pdf`)}`}
                    className="inline-flex items-center gap-1.5 text-xs"
                    style={{ color: '#10b981' }}
                  >
                    <Download size={12} />
                    Download last generated report
                  </a>
                ) : (
                  <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                    Generate an Individual Due Diligence Report (PDF) for this person.
                  </p>
                )}
              </div>

              {/* AML Screening */}
              <div className="border-t pt-4" style={{ borderColor: '#2A2418' }}>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#C9A96E' }}>AML Screening</p>
                  <Button
                    variant="outline"
                    disabled={amlLoading}
                    onClick={runAMLScreen}
                    className="text-xs h-7 px-3"
                    style={{ borderColor: '#2A2418', color: amlLoading ? 'var(--muted-foreground)' : '#C9A96E' }}
                  >
                    {amlLoading ? 'Screening…' : 'Run Screen'}
                  </Button>
                </div>

                {amlData && (
                  <div className="space-y-2">
                    {amlData.lastCheck && (
                      <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                        Last screened: {new Date(amlData.lastCheck.checkedAt).toLocaleString()}
                        {' · '}
                        <span style={{
                          color: amlData.lastCheck.result === 'CLEAR' ? '#10b981'
                            : amlData.lastCheck.result === 'STRONG_HIT' ? '#ef4444'
                            : amlData.lastCheck.result === 'POTENTIAL_HIT' ? '#f59e0b'
                            : '#eab308',
                          fontWeight: 600,
                        }}>
                          {amlData.lastCheck.result.replace('_', ' ')}
                        </span>
                      </p>
                    )}

                    {amlData.alerts.length === 0 ? (
                      <p className="text-xs rounded-lg px-3 py-2" style={{ background: 'rgba(16,185,129,0.08)', color: '#10b981' }}>
                        No sanctions hits found
                      </p>
                    ) : (
                      <ul className="space-y-2">
                        {amlData.alerts.map(alert => {
                          const color = AML_HIT_COLOR[alert.result]
                          return (
                            <li
                              key={alert.id}
                              className="rounded-lg px-3 py-2.5 text-sm space-y-1.5"
                              style={{ background: color.bg, border: `1px solid ${color.text}33` }}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <span className="font-semibold" style={{ color: 'var(--foreground)' }}>
                                    {alert.amlRecord.primaryName}
                                  </span>
                                  <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                                    {alert.amlRecord.entityType.replace('_', ' ')} · {alert.amlRecord.source.nameEn}
                                  </p>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <span
                                    className="px-1.5 py-0.5 rounded text-xs font-semibold"
                                    style={{ background: color.bg, color: color.text, border: `1px solid ${color.text}66` }}
                                  >
                                    {color.label}
                                  </span>
                                  {alert.matchScore != null && (
                                    <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                                      {(alert.matchScore * 100).toFixed(0)}%
                                    </span>
                                  )}
                                </div>
                              </div>

                              {alert.amlRecord.aliases.length > 0 && (
                                <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                                  <span className="font-medium">Aliases:</span> {alert.amlRecord.aliases.join(', ')}
                                </p>
                              )}

                              <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs" style={{ color: 'var(--muted-foreground)' }}>
                                {alert.amlRecord.nationality && <span>Nationality: {alert.amlRecord.nationality}</span>}
                                {alert.amlRecord.gender && <span>Gender: {alert.amlRecord.gender}</span>}
                                {alert.amlRecord.dateOfBirth && (
                                  <span>DOB: {new Date(alert.amlRecord.dateOfBirth).toLocaleDateString()}</span>
                                )}
                                {alert.amlRecord.placeOfBirth && <span>Place of birth: {alert.amlRecord.placeOfBirth}</span>}
                                {alert.amlRecord.listingDate && (
                                  <span>Listed: {new Date(alert.amlRecord.listingDate).toLocaleDateString()}</span>
                                )}
                                <span>List version: {new Date(alert.amlRecord.listVersionDate).toLocaleDateString()}</span>
                              </div>

                              {alert.amlRecord.listingReason && (
                                <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                                  <span className="font-medium">Reason:</span> {alert.amlRecord.listingReason}
                                </p>
                              )}

                              <JsonBlock label="ID numbers" value={alert.amlRecord.idNumbers} />
                              <JsonBlock label="Addresses" value={alert.amlRecord.addresses} />
                              <JsonBlock label="Raw source record" value={alert.amlRecord.rawData} />

                              <div className="flex items-center justify-between">
                                <a
                                  href={alert.amlRecord.source.sourceUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-xs hover:underline"
                                  style={{ color: '#C9A96E' }}
                                >
                                  Source list
                                </a>
                                <span
                                  className="text-xs px-1.5 py-0.5 rounded"
                                  style={{
                                    background: alert.resolution === 'PENDING' ? 'rgba(120,113,108,0.15)' : 'rgba(16,185,129,0.1)',
                                    color: alert.resolution === 'PENDING' ? '#9A8060' : '#10b981',
                                  }}
                                >
                                  {alert.resolution}
                                </span>
                              </div>
                            </li>
                          )
                        })}
                      </ul>
                    )}
                  </div>
                )}

                {!amlData && !amlLoading && (
                  <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                    Click &quot;Run Screen&quot; to check sanctions lists
                  </p>
                )}
              </div>

              {/* Actions */}
              <div className="border-t pt-4" style={{ borderColor: '#2A2418' }}>
                {selected.kycStatus === 'SUBMITTED' || selected.kycStatus === 'PENDING_INFO' ? (
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <label className="text-sm font-medium" style={{ color: 'var(--muted-foreground)' }}>{t('rejectReason')}</label>
                      <textarea
                        className="w-full rounded-md px-3 py-2 text-sm"
                        style={{ background: '#0A0A0A', border: '1px solid #2A2418', color: 'var(--foreground)', outline: 'none' }}
                        rows={3}
                        placeholder={t('reasonPlaceholder')}
                        value={reason}
                        onChange={e => setReason(e.target.value)}
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button disabled={loading} onClick={() => doAction('APPROVE')} className="bg-green-600 hover:bg-green-700">
                        {t('approve')}
                      </Button>
                      <Button variant="outline" disabled={loading} onClick={() => doAction('REQUEST_INFO')}>
                        {t('requestInfo')}
                      </Button>
                      <Button
                        variant="outline"
                        disabled={loading}
                        onClick={() => doAction('REJECT')}
                        style={{ color: '#ef4444', borderColor: 'rgba(239,68,68,0.3)' }}
                      >
                        {t('reject')}
                      </Button>
                    </div>
                  </div>
                ) : selected.kycStatus === 'APPROVED' ? (
                  <div className="space-y-3">
                    <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                      {t('approvedCanCancel', { defaultValue: 'This KYC is approved. You can cancel the approval and return it to the submitted queue.' })}
                    </p>
                    <Button
                      variant="outline"
                      disabled={loading}
                      onClick={() => doAction('CANCEL_APPROVAL')}
                      style={{ color: '#f59e0b', borderColor: 'rgba(245,158,11,0.35)' }}
                    >
                      {t('cancelApproval', { defaultValue: 'Cancel Approved' })}
                    </Button>
                  </div>
                ) : (
                  <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>{t('alreadyProcessed')}</p>
                )}
              </div>
            </CardContent>
          </Card>
          </div>
        )}
      </div>
    </div>
  )
}
