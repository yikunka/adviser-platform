'use client'

import React, { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { ChevronLeft, Download, Eye, Pencil, Sparkles, Trash2, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { KycPersonEditForm } from '@/components/admin/KycPersonEditForm'
import { keyPersonToFormValues, type KycPersonInput } from '@/lib/kyc/personZod'
import { KYC_STATUS_LABELS, KYC_STATUS_VALUES, kycStatusLabel } from '@/lib/kyc/kyc-status'
import { Link, useRouter } from '@/i18n/navigation'

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
  isActive?: boolean
  reviewedAt?: string | null
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
    source: { nameEn: string; sourceUrl: string; seqNo?: number }
  }
}

type ScreenGateStep = {
  result: string | null
  checkedAt: string | null
  passed: boolean
  skipped: boolean
  manualPass?: boolean
}

type ScreenGate = {
  sanctions: ScreenGateStep
  fatf: ScreenGateStep
  pep: ScreenGateStep
  adverseMedia: ScreenGateStep
  canRunFatf: boolean
  canRunPep: boolean
  canRunAdverseMedia: boolean
  canGenerateDdr: boolean
}

type AMLData = {
  lastCheck: { checkedAt: string; result: string; scope?: string } | null
  alerts: AMLAlert[]
  pepAlerts?: AMLAlert[]
  otherAlerts?: AMLAlert[]
  gate?: ScreenGate
  adverseMedia?: Array<{
    id: string
    title: string
    snippet: string | null
    url: string
    publisher: string | null
    categories: string[]
    relevanceScore: number | null
    resolution: string
    source: string
    createdAt: string
  }>
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
  adminNotes: string | null
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

const KYC_STATUS_OPTIONS = KYC_STATUS_VALUES

const AML_HIT_COLOR: Record<AMLHitResult, { bg: string; text: string; label: string }> = {
  STRONG_HIT:    { bg: 'rgba(239,68,68,0.12)',   text: '#ef4444', label: 'Strong Hit' },
  POTENTIAL_HIT: { bg: 'rgba(245,158,11,0.12)',  text: '#f59e0b', label: 'Potential Hit' },
  WEAK_HIT:      { bg: 'rgba(234,179,8,0.12)',   text: '#eab308', label: 'Weak Hit' },
}

const ALERT_RESOLUTION_COLOR: Record<string, string> = {
  PENDING: 'text-[#f59e0b]',
  FALSE_POSITIVE: 'text-[#10b981]',
  ESCALATED: 'text-[#ef4444]',
  REJECTED: 'text-[#ef4444]',
  CONFIRMED: 'text-[#ef4444]',
}

function ScreeningAlertCard({ alert }: { alert: AMLAlert }) {
  const color = AML_HIT_COLOR[alert.result]
  return (
    <li
      className="rounded-lg px-3 py-2.5 text-sm space-y-1.5"
      style={{ background: color?.bg ?? 'rgba(120,113,108,0.1)', border: `1px solid ${(color?.text ?? '#9A8060')}33` }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium truncate" style={{ color: 'var(--foreground)' }}>
            {alert.amlRecord.primaryName}
          </p>
          <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
            {alert.amlRecord.entityType.replace('_', ' ')} · {alert.amlRecord.source.nameEn}
          </p>
        </div>
        <div className="shrink-0 text-right space-y-0.5">
          <span className="block text-xs font-semibold" style={{ color: color?.text ?? '#9A8060' }}>
            {alert.result.replace('_', ' ')}
            {alert.matchScore != null ? ` · ${(alert.matchScore * 100).toFixed(0)}%` : ''}
          </span>
          <span className={`block text-[11px] font-medium ${ALERT_RESOLUTION_COLOR[alert.resolution] ?? 'text-[var(--muted-foreground)]'}`}>
            {alert.resolution.replace('_', ' ')}
          </span>
        </div>
      </div>
      {alert.amlRecord.aliases.length > 0 && (
        <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
          <span className="font-medium">Aliases:</span> {alert.amlRecord.aliases.join(', ')}
        </p>
      )}
      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs" style={{ color: 'var(--muted-foreground)' }}>
        {alert.amlRecord.nationality && <span>Nationality: {alert.amlRecord.nationality}</span>}
        {alert.amlRecord.listingReason && <span>Reason: {alert.amlRecord.listingReason}</span>}
      </div>
      {alert.reviewNotes && (
        <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
          <span className="font-medium">Notes:</span> {alert.reviewNotes}
        </p>
      )}
      <Link
        href={`/admin/aml/${alert.id}`}
        className="inline-flex text-xs font-medium hover:underline"
        style={{ color: '#C9A96E' }}
      >
        Review alert →
      </Link>
    </li>
  )
}

const STATUS_COLOR: Record<string, string> = {
  DRAFT:    'bg-[rgba(120,113,108,0.15)] text-[#9A8060]',
  APPROVED: 'bg-[rgba(16,185,129,0.12)] text-[#10b981]',
  REJECTED: 'bg-[rgba(239,68,68,0.12)] text-[#ef4444]',
  INACTIVE: 'bg-[rgba(120,113,108,0.12)] text-[#78716c]',
}

const DOCUMENT_TYPE_LABEL: Record<string, string> = {
  KYC_ID: 'ID',
  KYC_ADDRESS: 'Address',
  KYC_DECLARATION: 'KYC',
  KYC_OTHER: 'Other document',
  KYC_ADVERSE_MEDIA: 'Adverse media evidence',
}

const REQUIRED_KYC_DOCUMENT_TYPES = ['KYC_ID', 'KYC_ADDRESS', 'KYC_DECLARATION'] as const
/** Identity / declaration uploads only — adverse media evidence lives under Screening step 4 */
const VISIBLE_KYC_DOCUMENT_TYPES = ['KYC_ID', 'KYC_ADDRESS', 'KYC_DECLARATION', 'KYC_OTHER'] as const

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




export default function KYCDetailPage() {
  const t = useTranslations('admin.kyc')
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [selected, setSelected] = useState<KYCRecord | null>(null)
  const [pageLoading, setPageLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [amlData, setAmlData] = useState<AMLData | null>(null)
  const [amlLoading, setAmlLoading] = useState(false)
  const [screenStepLoading, setScreenStepLoading] = useState<'SANCTIONS' | 'FATF' | 'PEP' | 'ADVERSE_MEDIA' | null>(null)
  const [adverseMediaNotes, setAdverseMediaNotes] = useState('')
  const [pepPassNotes, setPepPassNotes] = useState('')
  const [clients, setClients] = useState<ClientAccount[]>([])
  const [generatingDdr, setGeneratingDdr] = useState(false)
  const [uploadingDocType, setUploadingDocType] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [analysisDraft, setAnalysisDraft] = useState(false)
  const [analyzingDocs, setAnalyzingDocs] = useState(false)
  const [editValues, setEditValues] = useState<KycPersonInput | null>(null)
  const [editStatus, setEditStatus] = useState<KYCRecord['kycStatus']>('DRAFT')
  const [editClientId, setEditClientId] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)
  const [adminNotesDraft, setAdminNotesDraft] = useState('')
  const [savingNotes, setSavingNotes] = useState(false)

  async function fetchAML(personId: string) {
    setAmlData(null)
    setAmlLoading(true)
    try {
      const res = await fetch(`/api/admin/kyc/${personId}/aml`)
      if (res.ok) setAmlData(await res.json())
    } finally {
      setAmlLoading(false)
    }
  }

  async function loadRecord(personId: string) {
    setPageLoading(true)
    setNotFound(false)
    setEditing(false)
    setAnalysisDraft(false)
    setEditValues(null)
    setReason('')
    try {
      const res = await fetch(`/api/admin/kyc/${personId}`)
      if (!res.ok) {
        setSelected(null)
        setNotFound(true)
        return
      }
      const data = (await res.json()) as KYCRecord
      setSelected(data)
      setAdminNotesDraft(data.adminNotes ?? '')
      void fetchAML(personId)
    } catch {
      setSelected(null)
      setNotFound(true)
    } finally {
      setPageLoading(false)
    }
  }

  useEffect(() => {
    if (!id) return
    void loadRecord(id)
  }, [id])

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

  async function runScreenStep(step: 'SANCTIONS' | 'FATF' | 'PEP') {
    if (!selected) return
    setScreenStepLoading(step)
    setAmlLoading(true)
    try {
      const res = await fetch(`/api/admin/kyc/${selected.id}/aml`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(typeof json?.error === 'string' ? json.error : `${step} screening failed`)
        return
      }
      setAmlData(json)
      const result = typeof json?.result === 'string' ? json.result : '—'
      if (result === 'CLEAR') toast.success(`${step} CLEAR`)
      else toast.message(`${step}: ${result.replace('_', ' ')}`)
    } finally {
      setScreenStepLoading(null)
      setAmlLoading(false)
    }
  }

  async function submitAdverseMedia(outcome: 'CLEAR' | 'HIT') {
    if (!selected) return
    setScreenStepLoading('ADVERSE_MEDIA')
    setAmlLoading(true)
    try {
      const res = await fetch(`/api/admin/kyc/${selected.id}/aml`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          step: 'ADVERSE_MEDIA',
          outcome,
          notes: adverseMediaNotes.trim() || null,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(typeof json?.error === 'string' ? json.error : 'Adverse media review failed')
        return
      }
      setAmlData(json)
      if (outcome === 'CLEAR') toast.success('Adverse media CLEAR')
      else toast.message('Adverse media marked as HIT')
    } finally {
      setScreenStepLoading(null)
      setAmlLoading(false)
    }
  }

  async function submitManualPepPass() {
    if (!selected) return
    const notes = pepPassNotes.trim()
    if (!notes) {
      toast.error('Explain why this PEP hit can be passed before continuing')
      return
    }
    setScreenStepLoading('PEP')
    setAmlLoading(true)
    try {
      const res = await fetch(`/api/admin/kyc/${selected.id}/aml`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          step: 'PEP',
          action: 'manual_pass',
          notes,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(typeof json?.error === 'string' ? json.error : 'Manual PEP pass failed')
        return
      }
      setAmlData(json)
      setPepPassNotes('')
      toast.success('PEP manually passed — Adverse media unlocked')
    } finally {
      setScreenStepLoading(null)
      setAmlLoading(false)
    }
  }

  function startEdit() {
    if (!selected) return
    setAnalysisDraft(false)
    setEditValues(keyPersonToFormValues(selected))
    setEditStatus(selected.kycStatus)
    setEditClientId(selected.submittedByUser?.id ?? selected.companyLinks[0]?.company.clientUser?.id ?? '')
    setEditing(true)
  }

  function cancelEdit() {
    setEditing(false)
    setAnalysisDraft(false)
    setEditValues(null)
    setEditStatus('DRAFT')
    setEditClientId('')
  }

  async function saveAdminNotes() {
    if (!selected) return
    setSavingNotes(true)
    try {
      const res = await fetch(`/api/admin/kyc/${selected.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminNotes: adminNotesDraft }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(typeof json?.error === 'string' ? json.error : '保存备注失败')
        return
      }
      const updated = json as KYCRecord
      setSelected(prev => (prev ? { ...prev, ...updated, adminNotes: updated.adminNotes ?? null } : prev))
      setAdminNotesDraft(updated.adminNotes ?? '')
      toast.success('备注已保存')
    } finally {
      setSavingNotes(false)
    }
  }

  async function analyzeUploadedDocs() {
    if (!selected) return
    const hasAny = selected.kycDocuments.some(d =>
      REQUIRED_KYC_DOCUMENT_TYPES.includes(d.documentType as (typeof REQUIRED_KYC_DOCUMENT_TYPES)[number])
      && d.status !== 'REJECTED',
    )
    if (!hasAny) {
      toast.error('Upload ID, address proof, and/or KYC declaration first')
      return
    }
    setAnalyzingDocs(true)
    try {
      const res = await fetch(`/api/admin/kyc/${selected.id}/analyze`, { method: 'POST' })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(typeof json?.error === 'string' ? json.error : 'Document analysis failed')
        return
      }
      const draft = json.draft as KycPersonInput | undefined
      if (!draft) {
        toast.error('No draft returned from analysis')
        return
      }
      setEditValues(draft)
      setEditStatus(selected.kycStatus)
      setEditClientId(selected.submittedByUser?.id ?? selected.companyLinks[0]?.company.clientUser?.id ?? '')
      setAnalysisDraft(true)
      setEditing(true)
      const missing = REQUIRED_KYC_DOCUMENT_TYPES.filter(type => !json.sources?.[type])
      if (missing.length) {
        toast.message(`Draft ready — missing uploads: ${missing.map(documentTypeLabel).join(', ')}. Review and save.`)
      } else {
        toast.success('Draft filled from documents — review and save to apply')
      }
    } finally {
      setAnalyzingDocs(false)
    }
  }

  async function saveEdit() {
    if (!selected || !editValues) return
    setSavingEdit(true)
    try {
      const res = await fetch(`/api/admin/kyc/${selected.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...editValues, kycStatus: editStatus, clientUserId: editClientId || null }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(typeof json?.error === 'string' ? json.error : 'Failed to save changes')
        return
      }
      const updated = json as KYCRecord
      setSelected(updated)
      setEditing(false)
      setAnalysisDraft(false)
      setEditValues(null)
      setEditStatus('DRAFT')
      setEditClientId('')
      toast.success('KYC updated')
    } finally {
      setSavingEdit(false)
    }
  }

  async function deleteKyc() {
    if (!selected) return
    const label = selected.kycCode ? `${selected.kycCode} / ${selected.nameEn}` : selected.nameEn
    if (!window.confirm(`Delete KYC "${label}"? This cannot be undone.`)) return

    setLoading(true)
    try {
      const res = await fetch(`/api/admin/kyc/${selected.id}`, { method: 'DELETE' })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(typeof json?.error === 'string' ? json.error : 'Failed to delete KYC')
        return
      }
      toast.success('KYC deleted')
      router.push('/admin/kyc')
    } finally {
      setLoading(false)
    }
  }

  async function doAction(action: 'APPROVE' | 'REJECT' | 'CANCEL_APPROVAL' | 'SET_INACTIVE') {
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
      setReason('')
      router.push('/admin/kyc')
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
      if (data.document) {
        const doc = data.document as KYCDocument
        setSelected(prev => prev
          ? { ...prev, kycDocuments: [doc, ...prev.kycDocuments] }
          : prev
        )
        toast.success('DDR generated')
      }
    } finally {
      setGeneratingDdr(false)
    }
  }

  async function deleteKycDocument(doc: KYCDocument) {
    const label = documentTypeLabel(doc.documentType)
    if (!window.confirm(`Delete ${label} document "${doc.fileName}"? This cannot be undone.`)) return

    const res = await fetch(`/api/admin/kyc/documents/${doc.id}`, { method: 'DELETE' })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      toast.error(typeof json?.error === 'string' ? json.error : 'Failed to delete document')
      return
    }
    setSelected(prev => prev
      ? { ...prev, kycDocuments: prev.kycDocuments.filter(d => d.id !== doc.id) }
      : prev
    )
    toast.success('Document deleted')
  }

  async function uploadKycDocument(docType: string, file: File | null) {
    if (!selected || !file) return
    setUploadingDocType(docType)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('type', docType)
      fd.append('keyPersonId', selected.id)
      const res = await fetch('/api/documents/upload', { method: 'POST', body: fd })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(typeof json?.error === 'string' ? json.error : 'Failed to upload document')
        return
      }
      const uploaded = json.document as KYCDocument | undefined
      if (uploaded) {
        setSelected(prev => prev
          ? { ...prev, kycDocuments: [uploaded, ...prev.kycDocuments] }
          : prev
        )
      }
      toast.success('Document uploaded')
    } finally {
      setUploadingDocType(null)
    }
  }

  function downloadKycDoc(doc: KYCDocument) {
    const href = `/api/files?key=${encodeURIComponent(doc.storageKey)}&download=1&filename=${encodeURIComponent(doc.fileName)}`
    const a = document.createElement('a')
    a.href = href
    a.download = doc.fileName
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  if (pageLoading) {
    return <div className="p-8" style={{ color: 'var(--muted-foreground)' }}>Loading...</div>
  }

  if (notFound || !selected) {
    return (
      <div className="p-6 space-y-4 max-w-4xl">
        <Link
          href="/admin/kyc"
          className="inline-flex items-center gap-1.5 text-sm hover:underline"
          style={{ color: '#C9A96E' }}
        >
          <ChevronLeft size={16} />
          Back to KYC queue
        </Link>
        <p style={{ color: '#ef4444' }}>KYC record not found</p>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-5 max-w-4xl">
      <div className="flex items-start gap-3 flex-wrap">
        <Link
          href="/admin/kyc"
          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[var(--border-subtle)] shrink-0 mt-0.5"
          aria-label="Back to KYC queue"
        >
          <ChevronLeft size={16} style={{ color: '#C9A96E' }} />
        </Link>
        <div className="flex items-center gap-3 flex-wrap min-w-0 flex-1">
          <h1 className="font-semibold text-xl" style={{ color: 'var(--foreground)' }}>
            {selected.titlePrefix ? `${selected.titlePrefix} ` : ''}{selected.nameEn}
            {selected.nameZh ? ` (${selected.nameZh})` : ''}
          </h1>
          {selected.kycCode ? (
            <span className="rounded-md border border-[var(--border-subtle)] px-2 py-0.5 text-xs font-semibold" style={{ color: '#C9A96E' }}>
              {selected.kycCode}
            </span>
          ) : null}
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOR[selected.kycStatus] ?? ''}`}>
            {kycStatusLabel(selected.kycStatus)}
          </span>
          <div className="ml-auto flex items-center gap-2">
            {!editing ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  className="h-8 gap-1.5 px-2.5 text-xs"
                  style={{ borderColor: 'var(--border-subtle)', color: '#C9A96E' }}
                  disabled={analyzingDocs}
                  onClick={() => void analyzeUploadedDocs()}
                >
                  <Sparkles size={14} />
                  {analyzingDocs ? 'Analyzing…' : 'Analyze docs'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-8 gap-1.5 px-2.5 text-xs"
                  style={{ borderColor: 'var(--border-subtle)', color: '#C9A96E' }}
                  onClick={startEdit}
                >
                  <Pencil size={14} />
                  Edit
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={loading}
                  className="h-8 gap-1.5 px-2.5 text-xs"
                  style={{ borderColor: 'rgba(239,68,68,0.3)', color: '#ef4444' }}
                  onClick={deleteKyc}
                >
                  <Trash2 size={14} />
                  Delete
                </Button>
              </>
            ) : null}
          </div>
        </div>
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
            style={{ background: 'rgba(201,169,110,0.1)', border: '1px solid var(--border-subtle)' }}
          >
            <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--muted-foreground)' }}>
              {t('clientAccount')}
            </span>
            <p className="mt-0.5 break-all" style={{ color: '#C9A96E' }}>{c.email}</p>
            {c.name ? <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>{c.name}</p> : null}
          </div>
        )
      })()}

      <div
        className="rounded-lg px-3 py-3 space-y-2"
        style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
      >
        <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--muted-foreground)' }}>
          Related companies
        </p>
        {(selected.relatedCompanies ?? []).length === 0 ? (
          <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
            No companies linked via client account, director / member / SC, or company–KYC link.
          </p>
        ) : (
          <ul className="space-y-2">
            {(selected.relatedCompanies ?? []).map(co => (
              <li key={co.id} className="flex items-start justify-between gap-3 text-sm">
                <div className="min-w-0">
                  <Link
                    href={`/admin/companies/${co.id}`}
                    className="font-medium hover:underline"
                    style={{ color: '#C9A96E' }}
                  >
                    {co.nameEn}
                  </Link>
                  {co.nameZh ? (
                    <p className="text-xs truncate" style={{ color: 'var(--muted-foreground)' }}>{co.nameZh}</p>
                  ) : null}
                  {co.companyNumber ? (
                    <p className="text-xs font-mono" style={{ color: 'var(--muted-foreground)' }}>{co.companyNumber}</p>
                  ) : null}
                </div>
                <div className="shrink-0 flex flex-wrap justify-end gap-1">
                  {co.roles.map(role => (
                    <span
                      key={role}
                      className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                      style={{ background: 'rgba(201,169,110,0.12)', color: '#C9A96E' }}
                    >
                      {relatedCompanyRoleLabel(role)}
                    </span>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <DetailSection title="备注 / Admin Notes">
        <p className="mb-2 text-xs" style={{ color: 'var(--muted-foreground)' }}>
          填写文件上没有的客户信息，仅后台可见。
        </p>
        <Textarea
          value={adminNotesDraft}
          onChange={e => setAdminNotesDraft(e.target.value)}
          rows={5}
          maxLength={5000}
          placeholder="例如：补充联系方式、亲属关系说明、面谈记录、特殊合规关注点等…"
          className="border-[var(--border-subtle)] bg-[#141410] text-[var(--foreground)] placeholder:text-[#5C5448]"
        />
        <div className="mt-2 flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            disabled={savingNotes || adminNotesDraft === (selected.adminNotes ?? '')}
            onClick={() => void saveAdminNotes()}
          >
            {savingNotes ? '保存中…' : '保存备注'}
          </Button>
          {adminNotesDraft !== (selected.adminNotes ?? '') && (
            <span className="text-xs" style={{ color: '#f59e0b' }}>未保存</span>
          )}
        </div>
      </DetailSection>

      {editing && editValues ? (
        <>
          {analysisDraft ? (
            <div
              className="rounded-lg px-3 py-2 text-sm"
              style={{ background: 'rgba(201,169,110,0.12)', border: '1px solid rgba(201,169,110,0.35)', color: '#C9A96E' }}
            >
              Analysis draft from ID / address / KYC declaration — review and edit below, then Save to apply. Nothing is written until you save.
            </div>
          ) : null}
          <div className="rounded-lg border border-[var(--border-subtle)] p-3">
            <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>
              Client Account (Advise 客戶帳號)
            </label>
            <select
              value={editClientId}
              onChange={e => setEditClientId(e.target.value)}
              disabled={savingEdit}
              className="mb-3 w-full rounded-md px-3 py-2 text-sm"
              style={{ background: 'var(--surface)', border: '1px solid var(--border-subtle)', color: 'var(--foreground)', outline: 'none' }}
            >
              <option value="" style={{ background: 'var(--surface-raised)' }}>No client account (blank)</option>
              {editClientId
                && selected?.submittedByUser
                && !clients.some(c => c.id === editClientId)
                ? (
                  <option value={editClientId} style={{ background: 'var(--surface-raised)' }}>
                    {selected.submittedByUser.email} — {selected.submittedByUser.nameEn} (current)
                  </option>
                )
                : null}
              {clients.map(client => (
                <option key={client.id} value={client.id} style={{ background: 'var(--surface-raised)' }}>
                  {client.email} — {client.nameEn}{client.nameZh ? ` (${client.nameZh})` : ''}
                </option>
              ))}
            </select>
            <p className="mb-3 text-[11px]" style={{ color: '#7A7060' }}>
              Advise 客戶帳號 only — or leave blank. Saving a non-Advise account is blocked.
            </p>
            <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>
              KYC Status
            </label>
            <select
              value={editStatus}
              onChange={e => setEditStatus(e.target.value)}
              disabled={savingEdit}
              className="w-full rounded-md px-3 py-2 text-sm"
              style={{ background: 'var(--surface)', border: '1px solid var(--border-subtle)', color: 'var(--foreground)', outline: 'none' }}
            >
              {KYC_STATUS_OPTIONS.map(status => (
                <option key={status} value={status} style={{ background: 'var(--surface-raised)' }}>
                  {KYC_STATUS_LABELS[status]}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs" style={{ color: 'var(--muted-foreground)' }}>
              If a draft or approved KYC has no code, the next CL code will be generated automatically.
            </p>
          </div>
          <KycPersonEditForm
            values={editValues}
            onChange={setEditValues}
            disabled={savingEdit}
          />
          <div className="flex gap-2 border-t pt-4" style={{ borderColor: 'var(--border-subtle)' }}>
            <Button disabled={savingEdit} onClick={saveEdit}>
              {savingEdit ? 'Saving…' : analysisDraft ? 'Confirm & save draft' : 'Save changes'}
            </Button>
            <Button variant="outline" disabled={savingEdit} onClick={cancelEdit}>
              Cancel
            </Button>
          </div>
        </>
      ) : (
        <>
          <DetailSection title="A. Client Identity / 客戶身分">
            <DetailRow label="KYC Code" value={selected.kycCode} />
            <DetailRow label="Title" value={selected.titlePrefix} />
            <DetailRow label="First Name" value={selected.firstName} />
            <DetailRow label="Last Name" value={selected.lastName} />
            <DetailRow label="Other Name" value={selected.otherName} />
            <DetailRow label="Chinese Name" value={selected.nameZh} />
            <DetailRow label="Nationality" value={selected.nationality} />
            <DetailRow label="Date of Birth" value={selected.dateOfBirth ? new Date(selected.dateOfBirth).toLocaleDateString() : null} />
            <DetailRow label="Place of Birth" value={selected.placeOfBirth} />
            <DetailRow label="Residential Address" value={selected.homeAddress} />
            <DetailRow label="Correspondence Address" value={selected.contactAddress} />
            <DetailRow label="Home Phone" value={selected.homePhone} />
            <DetailRow label="Work Phone" value={selected.workPhone} />
            <DetailRow label="Mobile" value={selected.mobile} />
            <DetailRow label="Email" value={selected.email} />
            <DetailRow label="WeChat" value={selected.wechat} />
            <DetailRow label="Emergency Contact" value={selected.emergencyContact} />
          </DetailSection>

          <DetailSection title="B. Identity Document / 身分證明文件">
            <DetailRow label="Document Type" value={selected.idType} />
            <DetailRow label="Document Number" value={selected.idNumber} />
            <DetailRow label="Place of Issue" value={selected.placeOfIssue} />
            <DetailRow label="Expiry Date" value={selected.idExpiryDate ? new Date(selected.idExpiryDate).toLocaleDateString() : 'Long-term'} />
          </DetailSection>

          <DetailSection title="C. Occupation / 職業">
            <DetailRow label="Employment Status" value={selected.employmentStatus} />
            <DetailRow label="Employer / Company" value={selected.employerName} />
            <DetailRow label="Company Address" value={selected.employerAddress} />
            <DetailRow label="Position" value={selected.position} />
            <DetailRow label="Years in Role" value={selected.workingYears != null ? String(selected.workingYears) : null} />
            <DetailRow label="Nature of Business" value={selected.businessNatures?.join(', ') || null} />
          </DetailSection>

          <DetailSection title="D. Financial Profile / 財務狀況">
            <DetailRow label="Source of Wealth" value={selected.sourcesOfWealth?.join(', ') || null} />
            <DetailRow label="Source of Funds" value={selected.sourceOfFunds} />
            <DetailRow label="Annual Income (USD)" value={selected.annualIncome} />
            <DetailRow label="Net Assets (USD)" value={selected.netAssetValue} />
            <DetailRow label="Main Asset Types" value={selected.assetItems?.join(', ') || null} />
          </DetailSection>

          <DetailSection title="F. PEP / 政治人物">
            <DetailRow label="PEP" value={selected.isPep == null ? null : selected.isPep ? 'Yes' : 'No'} />
          </DetailSection>

          <DetailSection title="G. Declaration / 聲明">
            <DetailRow label="US Citizen / Tax Resident" value={selected.isUsCitizen == null ? null : selected.isUsCitizen ? 'Yes' : 'No'} />
            <DetailRow label="Full Name (signature)" value={selected.signatureName} />
            <DetailRow
              label="Date"
              value={selected.declarationDate ? new Date(selected.declarationDate).toLocaleDateString() : null}
            />
            <DetailRow
              label="Declaration Signed"
              value={selected.declarationSigned ? 'Yes' : 'No'}
            />
          </DetailSection>
        </>
      )}

      {/* Documents */}
      <DetailSection title="Documents">
        <p className="mb-2 text-xs" style={{ color: 'var(--muted-foreground)' }}>
          Upload ID, address proof, and KYC declaration, then use Analyze docs to auto-fill a review draft.
        </p>
        <div className="mb-3">
          <Button
            type="button"
            variant="outline"
            className="h-8 gap-1.5 px-2.5 text-xs"
            style={{ borderColor: 'var(--border-subtle)', color: '#C9A96E' }}
            disabled={analyzingDocs || editing}
            onClick={() => void analyzeUploadedDocs()}
          >
            <Sparkles size={14} />
            {analyzingDocs ? 'Analyzing…' : 'Analyze ID + Address + KYC'}
          </Button>
        </div>
        <div className="grid gap-2 sm:grid-cols-4">
          {VISIBLE_KYC_DOCUMENT_TYPES.map(docType => (
            <label
              key={docType}
              className="inline-flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-md border border-[var(--border-subtle)] px-2.5 text-xs"
              style={{ color: uploadingDocType === docType ? 'var(--muted-foreground)' : '#C9A96E' }}
            >
              <Upload size={14} />
              {uploadingDocType === docType ? 'Uploading...' : `Upload ${documentTypeLabel(docType)}`}
              <input
                type="file"
                accept="application/pdf,image/jpeg,image/png"
                className="hidden"
                disabled={Boolean(uploadingDocType)}
                onChange={(event) => {
                  const file = event.target.files?.[0] ?? null
                  void uploadKycDocument(docType, file)
                  event.currentTarget.value = ''
                }}
              />
            </label>
          ))}
        </div>
        {(() => {
          const visibleDocs = selected.kycDocuments.filter(doc => (
            VISIBLE_KYC_DOCUMENT_TYPES.includes(doc.documentType as (typeof VISIBLE_KYC_DOCUMENT_TYPES)[number])
          ))
          if (visibleDocs.length === 0) {
            return (
              <p className="pt-2 text-xs" style={{ color: 'var(--muted-foreground)' }}>
                No ID, address, declaration, or other documents uploaded yet.
              </p>
            )
          }
          return (
            <ul className="space-y-2 pt-2">
              {visibleDocs.map(doc => (
                <li
                  key={doc.id}
                  className="flex flex-col gap-2 rounded-md border border-[var(--border-subtle)] px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
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
                      className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[var(--border-subtle)] px-2.5 text-xs"
                      style={{ color: '#C9A96E' }}
                    >
                      <Eye size={14} />
                      Preview
                    </a>
                    <a
                      href={fileHref(doc, true)}
                      className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[var(--border-subtle)] px-2.5 text-xs"
                      style={{ color: '#C9A96E' }}
                    >
                      <Download size={14} />
                      Download
                    </a>
                    <button
                      type="button"
                      onClick={() => deleteKycDocument(doc)}
                      className="inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs"
                      style={{ color: '#ef4444', borderColor: 'rgba(239,68,68,0.3)' }}
                    >
                      <Trash2 size={14} />
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )
        })()}
      </DetailSection>

      {/* Four-step screening: AML → FATF → PEP → Adverse media */}
      <div className="border-t pt-4 space-y-3" style={{ borderColor: 'var(--border-subtle)' }}>
        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#C9A96E' }}>
          Screening (AML → FATF → PEP → Adverse media)
        </p>
        <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
          1 AML (sanctions) → 2 FATF → 3 PEP →{' '}
          <span style={{ color: 'var(--foreground)', fontWeight: 600 }}>4 Adverse media (manual)</span>.
          All four must be CLEAR before generating DDR.
        </p>
        {(() => {
          const gate = amlData?.gate
          const steps: Array<{
            key: 'SANCTIONS' | 'FATF' | 'PEP'
            title: string
            hint: string
            enabled: boolean
            status: ScreenGateStep | undefined
          }> = [
            {
              key: 'SANCTIONS',
              title: '1. AML · Sanctions lists',
              hint: 'OFAC / UN / HK / EU and other sanctions (excl. FATF)',
              enabled: true,
              status: gate?.sanctions,
            },
            {
              key: 'FATF',
              title: '2. FATF · Black / Grey lists',
              hint: 'Uses AML page FATF JSON: nationality, passport/ID issue place, birth place',
              enabled: Boolean(gate?.canRunFatf),
              status: gate?.fatf,
            },
            {
              key: 'PEP',
              title: '3. PEP · OpenSanctions',
              hint: 'Enabled after AML and FATF are CLEAR',
              enabled: Boolean(gate?.canRunPep),
              status: gate?.pep,
            },
          ]
          return (
            <div className="space-y-2">
              {steps.map(step => {
                const loading = screenStepLoading === step.key
                const result = step.status?.result
                const resultColor =
                  result === 'CLEAR' ? '#10b981'
                    : result === 'STRONG_HIT' ? '#ef4444'
                      : result === 'POTENTIAL_HIT' ? '#f59e0b'
                        : result === 'WEAK_HIT' ? '#eab308'
                          : 'var(--muted-foreground)'
                return (
                  <div
                    key={step.key}
                    className="rounded-lg border px-3 py-2.5 space-y-3"
                    style={{ borderColor: 'var(--border-subtle)', background: 'rgba(201,169,110,0.04)' }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>{step.title}</p>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>{step.hint}</p>
                        {step.status?.checkedAt ? (
                          <p className="text-xs mt-1" style={{ color: 'var(--muted-foreground)' }}>
                            Last: {new Date(step.status.checkedAt).toLocaleString()}
                            {' · '}
                            <span style={{ color: resultColor, fontWeight: 600 }}>
                              {result ? result.replace('_', ' ') : '—'}
                              {step.status.skipped ? ' (API key skipped)' : ''}
                              {step.key === 'PEP' && step.status.manualPass ? ' · Manual pass' : ''}
                            </span>
                          </p>
                        ) : (
                          <p className="text-xs mt-1" style={{ color: 'var(--muted-foreground)' }}>Not run yet</p>
                        )}
                      </div>
                      <Button
                        variant="outline"
                        disabled={!step.enabled || amlLoading}
                        onClick={() => void runScreenStep(step.key)}
                        className="text-xs h-7 px-3 shrink-0"
                        style={{
                          borderColor: 'var(--border-subtle)',
                          color: !step.enabled || amlLoading ? 'var(--muted-foreground)' : '#C9A96E',
                        }}
                      >
                        {loading ? 'Screening…' : `Run ${step.key === 'SANCTIONS' ? 'AML' : step.key}`}
                      </Button>
                    </div>

                    {step.key === 'PEP' && (() => {
                      const pepAlerts = amlData?.pepAlerts ?? []
                      const canManualPass = Boolean(
                        step.enabled
                        && step.status?.result
                        && !step.status.passed
                        && !step.status.skipped,
                      )
                      return (
                        <div className="space-y-3 border-t pt-3" style={{ borderColor: 'var(--border-subtle)' }}>
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>
                              PEP alerts (AML&PEP screening)
                            </p>
                            <Link
                              href="/admin/aml"
                              className="text-xs font-medium hover:underline"
                              style={{ color: '#C9A96E' }}
                            >
                              Open AML&PEP screening →
                            </Link>
                          </div>
                          {pepAlerts.length === 0 ? (
                            <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                              No OpenSanctions PEP alerts for this person yet. Run PEP to create matches.
                            </p>
                          ) : (
                            <ul className="space-y-2">
                              {pepAlerts.map(alert => (
                                <ScreeningAlertCard key={alert.id} alert={alert} />
                              ))}
                            </ul>
                          )}

                          {canManualPass && (
                            <div className="space-y-2 rounded-md border px-3 py-2.5" style={{ borderColor: 'rgba(245,158,11,0.35)', background: 'rgba(245,158,11,0.06)' }}>
                              <p className="text-xs font-medium" style={{ color: '#f59e0b' }}>
                                手动通过 PEP · Manual pass PEP
                              </p>
                              <p className="text-xs leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>
                                After reviewing alerts and explaining why the hit is acceptable, mark PEP CLEAR to unlock Adverse media.
                                Pending PEP alerts are recorded as false positive with your notes.
                              </p>
                              <textarea
                                className="w-full rounded-md px-3 py-2 text-xs"
                                style={{ background: 'var(--surface)', border: '1px solid var(--border-subtle)', color: 'var(--foreground)', outline: 'none' }}
                                rows={2}
                                placeholder="Explain the PEP match disposition (required)…"
                                value={pepPassNotes}
                                onChange={e => setPepPassNotes(e.target.value)}
                                disabled={amlLoading}
                              />
                              <Button
                                variant="outline"
                                disabled={amlLoading || !pepPassNotes.trim()}
                                onClick={() => void submitManualPepPass()}
                                className="text-xs h-8 px-3"
                                style={{
                                  borderColor: 'var(--border-subtle)',
                                  color: amlLoading || !pepPassNotes.trim() ? 'var(--muted-foreground)' : '#C9A96E',
                                }}
                              >
                                {loading ? 'Saving…' : '手动通过 PEP'}
                              </Button>
                            </div>
                          )}
                        </div>
                      )
                    })()}
                  </div>
                )
              })}

              {/* Step 4 — manual adverse media (not Google API) */}
              {(() => {
                const canMark = Boolean(gate?.canRunAdverseMedia)
                const status = gate?.adverseMedia
                const result = status?.result
                const resultColor =
                  result === 'CLEAR' ? '#10b981'
                    : result === 'STRONG_HIT' ? '#ef4444'
                      : 'var(--muted-foreground)'
                const loading = screenStepLoading === 'ADVERSE_MEDIA'
                const evidence = selected?.kycDocuments.filter(d => d.documentType === 'KYC_ADVERSE_MEDIA') ?? []
                return (
                  <div
                    className="rounded-lg border px-3 py-3 space-y-3"
                    style={{ borderColor: 'var(--border-subtle)', background: 'rgba(201,169,110,0.06)' }}
                  >
                    <div>
                      <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                        4. Adverse media · Manual screening
                      </p>
                      <p className="text-xs mt-0.5 leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>
                        Done manually (search news yourself — no Google API). Upload supporting documents if needed, then mark{' '}
                        <span style={{ color: '#10b981' }}>CLEAR</span>
                        {' '}or{' '}
                        <span style={{ color: '#ef4444' }}>HIT</span>
                        . Marking unlocks after steps 1–3 are CLEAR.
                      </p>
                      {status?.checkedAt ? (
                        <p className="text-xs mt-1" style={{ color: 'var(--muted-foreground)' }}>
                          Last: {new Date(status.checkedAt).toLocaleString()}
                          {' · '}
                          <span style={{ color: resultColor, fontWeight: 600 }}>
                            {result === 'STRONG_HIT' ? 'HIT' : (result ? result.replace('_', ' ') : '—')}
                          </span>
                        </p>
                      ) : (
                        <p className="text-xs mt-1" style={{ color: 'var(--muted-foreground)' }}>Not completed yet</p>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <p className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>
                        Supporting document (optional)
                      </p>
                      <label
                        className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md border px-3 text-xs"
                        style={{
                          borderColor: 'var(--border-subtle)',
                          color: uploadingDocType ? 'var(--muted-foreground)' : '#C9A96E',
                        }}
                      >
                        <Upload size={14} />
                        {uploadingDocType === 'KYC_ADVERSE_MEDIA' ? 'Uploading…' : 'Upload PDF / JPG / PNG'}
                        <input
                          type="file"
                          accept=".pdf,image/jpeg,image/png"
                          className="hidden"
                          disabled={Boolean(uploadingDocType)}
                          onChange={e => {
                            const file = e.target.files?.[0] ?? null
                            e.target.value = ''
                            if (file) void uploadKycDocument('KYC_ADVERSE_MEDIA', file)
                          }}
                        />
                      </label>
                      {evidence.length > 0 ? (
                        <ul className="space-y-1">
                          {evidence.map(doc => (
                            <li key={doc.id} className="flex items-center justify-between gap-2 text-xs" style={{ color: 'var(--muted-foreground)' }}>
                              <span className="truncate">{doc.fileName}</span>
                              <button
                                type="button"
                                className="shrink-0 hover:underline"
                                style={{ color: '#C9A96E' }}
                                onClick={() => downloadKycDoc(doc)}
                              >
                                Download
                              </button>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>No supporting file uploaded</p>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <p className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>
                        Review notes (optional)
                      </p>
                      <textarea
                        className="w-full rounded-md px-3 py-2 text-xs"
                        style={{ background: 'var(--surface)', border: '1px solid var(--border-subtle)', color: 'var(--foreground)', outline: 'none' }}
                        rows={2}
                        placeholder="Sources checked, findings, rationale…"
                        value={adverseMediaNotes}
                        onChange={e => setAdverseMediaNotes(e.target.value)}
                        disabled={amlLoading}
                      />
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        variant="outline"
                        disabled={!canMark || amlLoading}
                        onClick={() => void submitAdverseMedia('CLEAR')}
                        className="text-xs h-8 px-3"
                        style={{
                          borderColor: 'rgba(16,185,129,0.35)',
                          color: !canMark || amlLoading ? 'var(--muted-foreground)' : '#10b981',
                        }}
                      >
                        {loading ? 'Saving…' : 'Mark CLEAR'}
                      </Button>
                      <Button
                        variant="outline"
                        disabled={!canMark || amlLoading}
                        onClick={() => void submitAdverseMedia('HIT')}
                        className="text-xs h-8 px-3"
                        style={{
                          borderColor: 'rgba(239,68,68,0.35)',
                          color: !canMark || amlLoading ? 'var(--muted-foreground)' : '#ef4444',
                        }}
                      >
                        Mark HIT
                      </Button>
                      {!canMark ? (
                        <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                          Complete AML → FATF → PEP (all CLEAR) first
                        </span>
                      ) : null}
                    </div>
                  </div>
                )
              })()}
            </div>
          )
        })()}

        {amlData && (
          <div className="space-y-2 pt-1">
            {(() => {
              const otherAlerts = amlData.otherAlerts
                ?? amlData.alerts.filter(a => (a.amlRecord.source.seqNo ?? -1) !== 16)
              if (otherAlerts.length === 0) {
                return (
                  <p className="text-xs rounded-lg px-3 py-2" style={{ background: 'rgba(16,185,129,0.08)', color: '#10b981' }}>
                    No active sanctions / FATF screening hits
                  </p>
                )
              }
              return (
                <div className="space-y-2">
                  <p className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>
                    Other active screening hits (sanctions / FATF)
                  </p>
                  <ul className="space-y-2">
                    {otherAlerts.map(alert => (
                      <ScreeningAlertCard key={alert.id} alert={alert} />
                    ))}
                  </ul>
                </div>
              )
            })()}
          </div>
        )}
      </div>

      {/* Due Diligence Reports */}
      <div className="border-t pt-4" style={{ borderColor: 'var(--border-subtle)' }}>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#C9A96E' }}>Due Diligence Reports</p>
            <p className="mt-1 text-xs" style={{ color: 'var(--muted-foreground)' }}>
              Generate Word (.docx) → print &amp; sign → upload signed scan (PDF/JPG/PNG).
            </p>
          </div>
          <div className="flex items-center gap-2">
            <label style={{ cursor: uploadingDocType === 'PERSON_DDR' ? 'not-allowed' : 'pointer' }}>
              <input
                type="file"
                accept=".pdf,image/jpeg,image/png"
                className="hidden"
                disabled={uploadingDocType === 'PERSON_DDR'}
                onChange={e => {
                  const file = e.target.files?.[0] ?? null
                  void uploadKycDocument('PERSON_DDR', file)
                  e.target.value = ''
                }}
              />
              <span
                className="inline-flex h-7 items-center rounded-md border border-[var(--border-subtle)] px-3 text-xs"
                style={{ color: uploadingDocType === 'PERSON_DDR' ? 'var(--muted-foreground)' : 'var(--foreground)' }}
              >
                {uploadingDocType === 'PERSON_DDR' ? 'Uploading…' : 'Upload signed'}
              </span>
            </label>
            <Button
              variant="outline"
              disabled={generatingDdr || !amlData?.gate?.canGenerateDdr}
              onClick={generatePersonDdr}
              className="text-xs h-7 px-3"
              style={{
                borderColor: 'var(--border-subtle)',
                color: generatingDdr || !amlData?.gate?.canGenerateDdr ? 'var(--muted-foreground)' : '#C9A96E',
              }}
              title={!amlData?.gate?.canGenerateDdr ? 'Complete AML → FATF → PEP → Adverse media (all CLEAR) first' : undefined}
            >
              {generatingDdr ? 'Generating…' : 'Generate DOCX'}
            </Button>
          </div>
        </div>
        {!amlData?.gate?.canGenerateDdr ? (
          <p className="mb-2 text-xs" style={{ color: 'var(--muted-foreground)' }}>
            Unlock by running AML, FATF, PEP, and Adverse media — each must return CLEAR.
          </p>
        ) : null}
        {(() => {
          const ddrDocs = selected.kycDocuments.filter(d => d.documentType === 'PERSON_DDR')
          if (ddrDocs.length === 0) {
            return (
              <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                No reports generated yet.
              </p>
            )
          }
          return (
            <ul className="space-y-2">
              {ddrDocs.map(doc => (
                <li
                  key={doc.id}
                  className="flex items-center justify-between gap-2 rounded-md border border-[var(--border-subtle)] px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium" style={{ color: 'var(--foreground)' }} title={doc.fileName}>
                      {doc.fileName}
                    </p>
                    <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                      {new Date(doc.uploadedAt).toLocaleString()} · {formatFileSize(doc.fileSize)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => downloadKycDoc(doc)}
                      className="inline-flex h-7 items-center gap-1 rounded-md border border-[var(--border-subtle)] px-2 text-xs"
                      style={{ color: '#C9A96E' }}
                    >
                      <Download size={12} />
                      Download
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteKycDocument(doc)}
                      className="inline-flex h-7 items-center gap-1 rounded-md border px-2 text-xs"
                      style={{ color: '#ef4444', borderColor: 'rgba(239,68,68,0.3)' }}
                    >
                      <Trash2 size={12} />
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )
        })()}
      </div>

      {/* Actions */}
      {!editing ? (
      <div className="border-t pt-4" style={{ borderColor: 'var(--border-subtle)' }}>
        {selected.kycStatus === 'DRAFT' || selected.kycStatus === 'REJECTED' ? (
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-sm font-medium" style={{ color: 'var(--muted-foreground)' }}>{t('rejectReason')}</label>
              <textarea
                className="w-full rounded-md px-3 py-2 text-sm"
                style={{ background: 'var(--surface)', border: '1px solid var(--border-subtle)', color: 'var(--foreground)', outline: 'none' }}
                rows={3}
                placeholder={t('reasonPlaceholder')}
                value={reason}
                onChange={e => setReason(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button disabled={loading} onClick={() => doAction('APPROVE')} className="bg-green-600 hover:bg-green-700">
                {t('approve')}
              </Button>
              <Button
                variant="outline"
                disabled={loading}
                onClick={() => doAction('REJECT')}
                style={{ color: '#ef4444', borderColor: 'rgba(239,68,68,0.3)' }}
              >
                {t('reject')}
              </Button>
              <Button
                variant="outline"
                disabled={loading}
                onClick={() => doAction('SET_INACTIVE')}
                style={{ color: '#78716c', borderColor: 'rgba(120,113,108,0.35)' }}
              >
                Mark Inactive
              </Button>
            </div>
          </div>
        ) : selected.kycStatus === 'APPROVED' ? (
          <div className="space-y-3">
            <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
              {t('approvedCanCancel', { defaultValue: 'This KYC is approved. You can cancel the approval (back to Draft) or mark it Inactive.' })}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                disabled={loading}
                onClick={() => doAction('CANCEL_APPROVAL')}
                style={{ color: '#f59e0b', borderColor: 'rgba(245,158,11,0.35)' }}
              >
                {t('cancelApproval', { defaultValue: 'Cancel Approved' })}
              </Button>
              <Button
                variant="outline"
                disabled={loading}
                onClick={() => doAction('SET_INACTIVE')}
                style={{ color: '#78716c', borderColor: 'rgba(120,113,108,0.35)' }}
              >
                Mark Inactive
              </Button>
            </div>
          </div>
        ) : selected.kycStatus === 'INACTIVE' ? (
          <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
            This KYC is inactive. Change status in Edit to reactivate (Draft / Approved / Rejected).
          </p>
        ) : (
          <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>{t('alreadyProcessed')}</p>
        )}
      </div>
      ) : null}
    </div>
  )
}
