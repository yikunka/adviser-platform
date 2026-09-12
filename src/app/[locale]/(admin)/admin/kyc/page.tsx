'use client'

import React, { useEffect, useState, useCallback, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { ChevronLeft, ChevronRight, Plus, Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { KycPersonEditForm } from '@/components/admin/KycPersonEditForm'
import { type KycPersonInput } from '@/lib/kyc/personZod'
import { useRouter } from '@/i18n/navigation'

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
  submittedByUser: { id: string; email: string; nameEn: string } | null
  companyLinks: Array<{
    company: { nameEn: string; clientUser: { id: string; email: string; nameEn: string } | null }
  }>
  relatedCompanies?: RelatedCompany[]
}

type RelatedCompanyRole =
  | 'CLIENT_ACCOUNT'
  | 'LINKED'
  | 'DIRECTOR'
  | 'MEMBER'
  | 'SIGNIFICANT_CONTROLLER'

type RelatedCompany = {
  id: string
  nameEn: string
  nameZh: string | null
  companyNumber: string | null
  status: string
  roles: RelatedCompanyRole[]
}

const KYC_STATUS_OPTIONS = ['DRAFT', 'SUBMITTED', 'PENDING_INFO', 'APPROVED', 'REJECTED'] as const
const ID_EXPIRY_FILTER = 'ID_EXPIRY'
const STATUS_OPTIONS = ['', ...KYC_STATUS_OPTIONS, ID_EXPIRY_FILTER] as const

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
  KYC_DECLARATION: 'KYC',
  KYC_OTHER: 'Other document',
  KYC_ADVERSE_MEDIA: 'Adverse media evidence',
}

const REQUIRED_KYC_DOCUMENT_TYPES = ['KYC_ID', 'KYC_ADDRESS', 'KYC_DECLARATION'] as const

function documentTypeLabel(type: string) {
  return DOCUMENT_TYPE_LABEL[type] ?? type.replace(/^KYC_/, '').replace(/_/g, ' ')
}

function missingDocumentTypes(record: KYCRecord) {
  return REQUIRED_KYC_DOCUMENT_TYPES.filter((type) => {
    const latest = record.kycDocuments.find(doc => doc.documentType === type)
    return !latest || latest.status === 'REJECTED'
  })
}

function filterLabel(filter: string, allLabel: string) {
  if (!filter) return allLabel
  if (filter === ID_EXPIRY_FILTER) return 'ID expiry'
  return filter
}

/** Portal client (submitter) or company-linked account holder. */
function clientPortalAccount(r: KYCRecord): { email: string | null; name: string | null } {
  const s = r.submittedByUser
  if (s?.email) return { email: s.email, name: s.nameEn }
  const u = r.companyLinks[0]?.company?.clientUser
  if (u?.email) return { email: u.email, name: u.nameEn }
  return { email: null, name: null }
}

function relatedCompanyRoleLabel(role: RelatedCompanyRole): string {
  switch (role) {
    case 'CLIENT_ACCOUNT':
      return 'Client account'
    case 'LINKED':
      return 'Linked'
    case 'DIRECTOR':
      return 'Director'
    case 'MEMBER':
      return 'Member'
    case 'SIGNIFICANT_CONTROLLER':
      return 'SC'
    default:
      return role
  }
}

function companyColumnLabel(r: KYCRecord): { text: string; title: string } {
  const companies = r.relatedCompanies ?? []
  if (companies.length === 0) {
    const fallback = r.companyLinks[0]?.company.nameEn
    return { text: fallback ?? '—', title: fallback ?? '' }
  }
  if (companies.length === 1) {
    const c = companies[0]!
    const title = `${c.nameEn}${c.roles.length ? ` (${c.roles.map(relatedCompanyRoleLabel).join(', ')})` : ''}`
    return { text: c.nameEn, title }
  }
  const names = companies.map(c => c.nameEn)
  const text = `${names[0]} +${companies.length - 1}`
  const title = companies
    .map(c => `${c.nameEn}${c.roles.length ? ` (${c.roles.map(relatedCompanyRoleLabel).join(', ')})` : ''}`)
    .join('\n')
  return { text, title }
}

function emptyKycPerson(): KycPersonInput {
  return {
    kycCode: '',
    titlePrefix: '',
    firstName: '',
    lastName: '',
    otherName: '',
    nameEn: '',
    nameZh: '',
    idType: '',
    idNumber: '',
    placeOfIssue: '',
    placeOfBirth: '',
    idExpiry: '',
    idExpiryPermanent: false,
    dateOfBirth: '',
    nationality: '',
    homeAddress: '',
    contactAddress: '',
    homePhone: '',
    workPhone: '',
    mobile: '',
    wechat: '',
    email: '',
    isUsCitizen: false,
    isPep: false,
    emergencyContact: '',
    employmentStatus: '',
    employerName: '',
    employerAddress: '',
    businessNaturesText: '',
    position: '',
    workingYears: undefined,
    sourceOfFunds: '',
    sourcesOfWealthText: '',
    annualIncome: '',
    netAssetValue: '',
    assetItemsText: '',
    declarationSigned: false,
    signatureName: '',
    declarationDate: '',
  }
}

export default function KYCQueuePage() {
  const t = useTranslations('admin.kyc')
  const router = useRouter()
  const searchParams = useSearchParams()
  const [records, setRecords] = useState<KYCRecord[]>([])
  const [filterStatus, setFilterStatus] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [limit, setLimit] = useState(20)
  const [idExpiryCount, setIdExpiryCount] = useState(0)
  const [clients, setClients] = useState<ClientAccount[]>([])
  const [createClientId, setCreateClientId] = useState('')
  const [createImage, setCreateImage] = useState<File | null>(null)
  const [creating, setCreating] = useState(false)
  const [adding, setAdding] = useState(false)
  const [createValues, setCreateValues] = useState<KycPersonInput>(() => emptyKycPerson())
  const [manualClientId, setManualClientId] = useState('')
  const [savingCreate, setSavingCreate] = useState(false)
  const createImageInputRef = useRef<HTMLInputElement | null>(null)

  const fetchRecords = useCallback(async (statusOverride?: string, pageOverride?: number, searchOverride?: string) => {
    const status = statusOverride ?? filterStatus
    const pageNo = pageOverride ?? page
    const q = searchOverride ?? searchQuery
    const params = new URLSearchParams()
    if (status === ID_EXPIRY_FILTER) {
      params.set('category', ID_EXPIRY_FILTER)
    } else if (status) {
      params.set('status', status)
    }
    if (q.trim()) params.set('q', q.trim())
    params.set('page', String(pageNo))
    const query = params.toString()
    const res = await fetch(`/api/admin/kyc${query ? `?${query}` : ''}`)
    const json = await res.json()
    setRecords(json.records ?? [])
    setTotal(Number(json.total ?? 0))
    setPage(Number(json.page ?? pageNo))
    setLimit(Number(json.limit ?? 20))
    setIdExpiryCount(Number(json.counts?.idExpiry ?? 0))
  }, [filterStatus, page, searchQuery])

  // eslint-disable-next-line react-hooks/set-state-in-effect -- fetchRecords updates state after the async request resolves.
  useEffect(() => { fetchRecords() }, [fetchRecords])

  // Redirect ?personId=xxx to full-page detail (e.g. navigating from AML alerts)
  useEffect(() => {
    const personId = searchParams.get('personId')
    if (personId) router.replace(`/admin/kyc/${personId}`)
  }, [searchParams, router])

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
      setPage(1)
      fetchRecords('APPROVED', 1)
      if (json.record?.id) router.push(`/admin/kyc/${json.record.id}`)
    } finally {
      setCreating(false)
    }
  }

  function startAdd() {
    setCreateValues(emptyKycPerson())
    setManualClientId('')
    setAdding(true)
  }

  function cancelAdd() {
    setAdding(false)
    setCreateValues(emptyKycPerson())
    setManualClientId('')
  }

  async function saveCreate(action: 'SAVE_DRAFT' | 'SUBMIT') {
    if (!manualClientId) {
      toast.error('Select a client account')
      return
    }

    setSavingCreate(true)
    try {
      const res = await fetch('/api/admin/kyc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientUserId: manualClientId,
          action,
          person: createValues,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(typeof json?.error === 'string' ? json.error : 'Failed to create KYC')
        return
      }

      const created = json as KYCRecord
      setAdding(false)
      setCreateValues(emptyKycPerson())
      setManualClientId('')
      setFilterStatus('')
      setPage(1)
      setRecords(prev => [created, ...prev.filter(r => r.id !== created.id)])
      fetchRecords('', 1)
      router.push(`/admin/kyc/${created.id}`)
      toast.success(action === 'SUBMIT' ? 'KYC submitted' : 'KYC draft created')
    } finally {
      setSavingCreate(false)
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / limit))
  const startRow = total === 0 ? 0 : (page - 1) * limit + 1
  const endRow = Math.min(total, page * limit)

  return (
    <div className="p-6 space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>{t('title')}</h1>
        <Button type="button" className="gap-2" onClick={startAdd}>
          <Plus size={16} />
          Add KYC
        </Button>
      </div>

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
                style={{ background: 'var(--surface)', border: '1px solid var(--border-subtle)', color: 'var(--foreground)', outline: 'none' }}
              >
                <option value="" style={{ background: 'var(--surface-raised)' }}>Select client account</option>
                {clients.map(client => (
                  <option key={client.id} value={client.id} style={{ background: 'var(--surface-raised)' }}>
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

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex gap-2 flex-wrap">
          {STATUS_OPTIONS.map(s => (
            <button
              key={s}
              onClick={() => { setFilterStatus(s); setPage(1) }}
              className="relative px-3 py-1.5 rounded-full text-sm font-medium transition-colors"
              style={
                filterStatus === s
                  ? { background: 'rgba(201,169,110,0.2)', color: '#C9A96E', border: '1px solid #C9A96E' }
                  : { background: 'var(--surface-panel)', color: '#7A7060', border: '1px solid var(--border-subtle)' }
              }
            >
              {filterLabel(s, t('all'))}
              {s === ID_EXPIRY_FILTER ? (
                <span
                  className="absolute -right-2 -top-2 min-w-5 rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none"
                  style={{ background: '#ef4444', color: '#fff', boxShadow: '0 0 0 2px #050305' }}
                >
                  {idExpiryCount > 99 ? '99+' : idExpiryCount}
                </span>
              ) : null}
            </button>
          ))}
        </div>
        <form
          className="flex w-full gap-2 sm:max-w-md"
          onSubmit={e => {
            e.preventDefault()
            setSearchQuery(searchInput.trim())
            setPage(1)
          }}
        >
          <div className="relative flex-1">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#7A7060' }} />
            <input
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              placeholder="Search KYC, name, ID, email, company..."
              className="h-9 w-full rounded-md pl-9 pr-3 text-sm"
              style={{ background: 'var(--surface)', border: '1px solid var(--border-subtle)', color: 'var(--foreground)', outline: 'none' }}
            />
          </div>
          <Button type="submit" variant="outline" className="h-9" style={{ borderColor: 'var(--border-subtle)', color: '#C9A96E' }}>
            Search
          </Button>
          {searchQuery ? (
            <Button
              type="button"
              variant="outline"
              className="h-9"
              style={{ borderColor: 'var(--border-subtle)' }}
              onClick={() => { setSearchInput(''); setSearchQuery(''); setPage(1) }}
            >
              Clear
            </Button>
          ) : null}
        </form>
      </div>

      <div className="space-y-4">
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border-subtle)] text-left" style={{ color: 'var(--muted-foreground)' }}>
                    <th className="px-4 py-3 font-medium">KYC Code / Name</th>
                    <th className="px-4 py-3 font-medium">Client Account</th>
                    <th className="px-4 py-3 font-medium">Company</th>
                    <th className="px-4 py-3 font-medium">Files</th>
                    <th className="px-4 py-3 font-medium">Updated</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-subtle)]">
              {records.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center" style={{ color: 'var(--muted-foreground)' }}>{t('empty')}</td>
                </tr>
              ) : records.map((r) => {
                const client = clientPortalAccount(r)
                const missingDocs = missingDocumentTypes(r)
                return (
                <tr
                  key={r.id}
                  onClick={() => router.push(`/admin/kyc/${r.id}`)}
                  className="px-4 py-3 cursor-pointer transition-colors"
                  style={{ background: 'transparent' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--surface-panel)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
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
                    {(() => {
                      const col = companyColumnLabel(r)
                      return (
                        <p className="max-w-48 truncate" title={col.title || undefined}>
                          {col.text}
                        </p>
                      )
                    })()}
                  </td>
                  <td className="px-4 py-3" style={{ color: 'var(--muted-foreground)' }}>
                    {r.kycDocuments.length}
                  </td>
                  <td className="px-4 py-3" style={{ color: 'var(--muted-foreground)' }}>
                    {new Date(r.updatedAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1.5">
                      <span className={`w-fit px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOR[r.kycStatus] ?? ''}`}>
                        {r.kycStatus}
                      </span>
                      {missingDocs.length > 0 ? (
                        <span
                          className="w-fit rounded-full px-2 py-0.5 text-xs font-medium"
                          style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444' }}
                          title={`Missing or rejected: ${missingDocs.map(documentTypeLabel).join(', ')}`}
                        >
                          Missing: {missingDocs.map(documentTypeLabel).join(' / ')}
                        </span>
                      ) : null}
                    </div>
                  </td>
                </tr>
                )
              })}
                </tbody>
              </table>
            </div>
            <div className="flex flex-col gap-3 border-t border-[var(--border-subtle)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                Showing {startRow}-{endRow} of {total}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="h-8 gap-1.5 px-2.5 text-xs"
                  disabled={page <= 1}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  style={{ borderColor: 'var(--border-subtle)' }}
                >
                  <ChevronLeft size={14} />
                  Prev
                </Button>
                <span className="min-w-20 text-center text-xs" style={{ color: 'var(--muted-foreground)' }}>
                  Page {page} / {totalPages}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  className="h-8 gap-1.5 px-2.5 text-xs"
                  disabled={page >= totalPages}
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  style={{ borderColor: 'var(--border-subtle)' }}
                >
                  Next
                  <ChevronRight size={14} />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {adding && (
          <div className="fixed inset-0 z-50 flex justify-end bg-black/35" onClick={cancelAdd}>
            <Card
              className="h-full w-full max-w-2xl overflow-y-auto rounded-none border-y-0 border-r-0 shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <CardContent className="pt-6 space-y-5">
                <div className="flex items-center gap-3">
                  <h3 className="font-semibold text-lg" style={{ color: 'var(--foreground)' }}>
                    Add KYC
                  </h3>
                  <span className="rounded-full px-2 py-0.5 text-xs font-medium bg-[rgba(120,113,108,0.15)] text-[#9A8060]">
                    DRAFT
                  </span>
                  <button
                    type="button"
                    onClick={cancelAdd}
                    className="ml-auto inline-flex h-8 w-8 items-center justify-center rounded-md border border-[var(--border-subtle)]"
                    aria-label="Close add KYC"
                  >
                    <X size={16} />
                  </button>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>
                    Client Account <span style={{ color: '#ef4444', fontWeight: 700 }}>*</span>
                  </label>
                  <select
                    value={manualClientId}
                    onChange={e => setManualClientId(e.target.value)}
                    disabled={savingCreate}
                    className="w-full rounded-md px-3 py-2 text-sm"
                    style={{ background: 'var(--surface)', border: '1px solid var(--border-subtle)', color: 'var(--foreground)', outline: 'none' }}
                  >
                    <option value="" style={{ background: 'var(--surface-raised)' }}>Select client account</option>
                    {clients.map(client => (
                      <option key={client.id} value={client.id} style={{ background: 'var(--surface-raised)' }}>
                        {client.email} — {client.nameEn}{client.nameZh ? ` (${client.nameZh})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <KycPersonEditForm
                  values={createValues}
                  onChange={setCreateValues}
                  disabled={savingCreate}
                />

                <div className="flex flex-wrap gap-2 border-t pt-4" style={{ borderColor: 'var(--border-subtle)' }}>
                  <Button disabled={savingCreate} onClick={() => saveCreate('SAVE_DRAFT')}>
                    {savingCreate ? 'Saving…' : 'Save draft'}
                  </Button>
                  <Button
                    variant="outline"
                    disabled={savingCreate}
                    onClick={() => saveCreate('SUBMIT')}
                    style={{ borderColor: 'var(--border-subtle)', color: '#C9A96E' }}
                  >
                    Submit for review
                  </Button>
                  <Button variant="outline" disabled={savingCreate} onClick={cancelAdd}>
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}
