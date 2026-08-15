'use client'

import React, { useEffect, useState, useCallback, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { ChevronLeft, ChevronRight, Download, Eye, Pencil, Plus, Search, Sparkles, Trash2, Upload, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { KycPersonEditForm } from '@/components/admin/KycPersonEditForm'
import { keyPersonToFormValues, type KycPersonInput } from '@/lib/kyc/personZod'
import { Link } from '@/i18n/navigation'

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

type ScreenGateStep = {
  result: string | null
  checkedAt: string | null
  passed: boolean
  skipped: boolean
}

type ScreenGate = {
  sanctions: ScreenGateStep
  fatf: ScreenGateStep
  pep: ScreenGateStep
  canRunFatf: boolean
  canRunPep: boolean
  canGenerateDdr: boolean
}

type AMLData = {
  lastCheck: { checkedAt: string; result: string; scope?: string } | null
  alerts: AMLAlert[]
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
  kycDocuments: KYCDocument[]
  submittedByUser: { id: string; email: string; nameEn: string } | null
  companyLinks: Array<{
    company: { nameEn: string; clientUser: { id: string; email: string; nameEn: string } | null }
  }>
}

const KYC_STATUS_OPTIONS = ['DRAFT', 'SUBMITTED', 'PENDING_INFO', 'APPROVED', 'REJECTED'] as const
const ID_EXPIRY_FILTER = 'ID_EXPIRY'
const STATUS_OPTIONS = ['', ...KYC_STATUS_OPTIONS, ID_EXPIRY_FILTER] as const

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
  KYC_DECLARATION: 'KYC',
  KYC_OTHER: 'Other document',
}

const REQUIRED_KYC_DOCUMENT_TYPES = ['KYC_ID', 'KYC_ADDRESS', 'KYC_DECLARATION'] as const
const VISIBLE_KYC_DOCUMENT_TYPES = ['KYC_ID', 'KYC_ADDRESS', 'KYC_DECLARATION', 'KYC_OTHER'] as const

function documentTypeLabel(type: string) {
  return DOCUMENT_TYPE_LABEL[type] ?? type.replace(/^KYC_/, '').replace(/_/g, ' ')
}

function missingDocumentTypes(record: KYCRecord) {
  return REQUIRED_KYC_DOCUMENT_TYPES.filter((type) => {
    const latest = record.kycDocuments.find(doc => doc.documentType === type)
    return !latest || latest.status === 'REJECTED'
  })
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
  const searchParams = useSearchParams()
  const [records, setRecords] = useState<KYCRecord[]>([])
  const [filterStatus, setFilterStatus] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [limit, setLimit] = useState(20)
  const [idExpiryCount, setIdExpiryCount] = useState(0)
  const [selected, setSelected] = useState<KYCRecord | null>(null)
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [amlData, setAmlData] = useState<AMLData | null>(null)
  const [amlLoading, setAmlLoading] = useState(false)
  const [screenStepLoading, setScreenStepLoading] = useState<'SANCTIONS' | 'FATF' | 'PEP' | null>(null)
  const [clients, setClients] = useState<ClientAccount[]>([])
  const [createClientId, setCreateClientId] = useState('')
  const [createImage, setCreateImage] = useState<File | null>(null)
  const [creating, setCreating] = useState(false)
  const [generatingDdr, setGeneratingDdr] = useState(false)
  const [uploadingDocType, setUploadingDocType] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [analysisDraft, setAnalysisDraft] = useState(false)
  const [analyzingDocs, setAnalyzingDocs] = useState(false)
  const [editValues, setEditValues] = useState<KycPersonInput | null>(null)
  const [editStatus, setEditStatus] = useState<KYCRecord['kycStatus']>('DRAFT')
  const [editClientId, setEditClientId] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)
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

  // Auto-open a specific person when ?personId=xxx is in the URL (e.g. navigating from AML alerts)
  useEffect(() => {
    const personId = searchParams.get('personId')
    if (!personId) return
    let cancelled = false
    fetch(`/api/admin/kyc/${personId}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (cancelled || !data) return
        setSelected(data)
        // Also load AML data so the alerts section is populated (same as selectRecord)
        void fetchAML(personId)
      })
    return () => { cancelled = true }
  }, [searchParams])

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
      setSelected(json.record ?? null)
      fetchRecords('APPROVED', 1)
    } finally {
      setCreating(false)
    }
  }

  async function selectRecord(r: KYCRecord) {
    setReason('')
    setEditing(false)
    setAnalysisDraft(false)
    setEditValues(null)
    setSelected(r)
    void fetchAML(r.id)
    try {
      const res = await fetch(`/api/admin/kyc/${r.id}`)
      if (!res.ok) return
      const fresh = await res.json() as KYCRecord
      setSelected(fresh)
      setRecords(prev => prev.map(rec => (rec.id === fresh.id ? fresh : rec)))
    } catch {
      // keep list snapshot if refresh fails
    }
  }

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

  function startAdd() {
    setSelected(null)
    setReason('')
    setEditing(false)
    setEditValues(null)
    setEditStatus('DRAFT')
    setEditClientId('')
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
      setSelected(created)
      setRecords(prev => [created, ...prev.filter(r => r.id !== created.id)])
      fetchRecords('', 1)
      if (action === 'SUBMIT') void fetchAML(created.id)
      toast.success(action === 'SUBMIT' ? 'KYC submitted' : 'KYC draft created')
    } finally {
      setSavingCreate(false)
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
      setRecords(prev => prev.map(r => (r.id === updated.id ? updated : r)))
      fetchRecords()
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
      setRecords(prev => prev.filter(r => r.id !== selected.id))
      setSelected(null)
      setEditing(false)
      setAnalysisDraft(false)
      setEditValues(null)
      setEditStatus('DRAFT')
      setEditClientId('')
      toast.success('KYC deleted')
      fetchRecords()
    } finally {
      setLoading(false)
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
      if (data.document) {
        const doc = data.document as KYCDocument
        setSelected(prev => prev
          ? { ...prev, kycDocuments: [doc, ...prev.kycDocuments] }
          : prev
        )
        setRecords(prev => prev.map(r => (
          r.id === selected.id
            ? { ...r, kycDocuments: [doc, ...r.kycDocuments] }
            : r
        )))
        toast.success('DDR generated')
      }
    } finally {
      setGeneratingDdr(false)
    }
  }

  async function deleteKycDocument(doc: KYCDocument) {
    const label = documentTypeLabel(doc.documentType)
    const selectedId = selected?.id
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
    if (selectedId) {
      setRecords(prev => prev.map(r => (
        r.id === selectedId
          ? { ...r, kycDocuments: r.kycDocuments.filter(d => d.id !== doc.id) }
          : r
      )))
    }
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
        setRecords(prev => prev.map(r => (
          r.id === selected.id
            ? { ...r, kycDocuments: [uploaded, ...r.kycDocuments] }
            : r
        )))
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
                  : { background: '#1E1A12', color: '#7A7060', border: '1px solid #2A2418' }
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
              style={{ background: '#0A0A0A', border: '1px solid #2A2418', color: 'var(--foreground)', outline: 'none' }}
            />
          </div>
          <Button type="submit" variant="outline" className="h-9" style={{ borderColor: '#2A2418', color: '#C9A96E' }}>
            Search
          </Button>
          {searchQuery ? (
            <Button
              type="button"
              variant="outline"
              className="h-9"
              style={{ borderColor: '#2A2418' }}
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
                const missingDocs = missingDocumentTypes(r)
                return (
                <tr
                  key={r.id}
                  onClick={() => { void selectRecord(r) }}
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
            <div className="flex flex-col gap-3 border-t border-[#2A2418] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
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
                  style={{ borderColor: '#2A2418' }}
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
                  style={{ borderColor: '#2A2418' }}
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
                    className="ml-auto inline-flex h-8 w-8 items-center justify-center rounded-md border border-[#2A2418]"
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

                <KycPersonEditForm
                  values={createValues}
                  onChange={setCreateValues}
                  disabled={savingCreate}
                />

                <div className="flex flex-wrap gap-2 border-t pt-4" style={{ borderColor: '#2A2418' }}>
                  <Button disabled={savingCreate} onClick={() => saveCreate('SAVE_DRAFT')}>
                    {savingCreate ? 'Saving…' : 'Save draft'}
                  </Button>
                  <Button
                    variant="outline"
                    disabled={savingCreate}
                    onClick={() => saveCreate('SUBMIT')}
                    style={{ borderColor: '#2A2418', color: '#C9A96E' }}
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

        {/* Right: collapsible detail + action panel */}
        {selected && (
          <div className="fixed inset-0 z-50 flex justify-end bg-black/35" onClick={() => { setSelected(null); setEditing(false); setAnalysisDraft(false); setEditValues(null); setEditStatus('DRAFT'); setEditClientId('') }}>
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
                <div className="ml-auto flex items-center gap-2">
                  {!editing ? (
                    <>
                      <Button
                        type="button"
                        variant="outline"
                        className="h-8 gap-1.5 px-2.5 text-xs"
                        style={{ borderColor: '#2A2418', color: '#C9A96E' }}
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
                        style={{ borderColor: '#2A2418', color: '#C9A96E' }}
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
                  <button
                    type="button"
                    onClick={() => { setSelected(null); setEditing(false); setAnalysisDraft(false); setEditValues(null); setEditStatus('DRAFT'); setEditClientId('') }}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[#2A2418]"
                    aria-label="Close KYC details"
                  >
                    <X size={16} />
                  </button>
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
                  <div className="rounded-lg border border-[#2A2418] p-3">
                    <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>
                      Client Account
                    </label>
                    <select
                      value={editClientId}
                      onChange={e => setEditClientId(e.target.value)}
                      disabled={savingEdit}
                      className="mb-3 w-full rounded-md px-3 py-2 text-sm"
                      style={{ background: '#0A0A0A', border: '1px solid #2A2418', color: 'var(--foreground)', outline: 'none' }}
                    >
                      <option value="" style={{ background: '#141414' }}>No client account</option>
                      {clients.map(client => (
                        <option key={client.id} value={client.id} style={{ background: '#141414' }}>
                          {client.email} — {client.nameEn}{client.nameZh ? ` (${client.nameZh})` : ''}
                        </option>
                      ))}
                    </select>
                    <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>
                      KYC Status
                    </label>
                    <select
                      value={editStatus}
                      onChange={e => setEditStatus(e.target.value)}
                      disabled={savingEdit}
                      className="w-full rounded-md px-3 py-2 text-sm"
                      style={{ background: '#0A0A0A', border: '1px solid #2A2418', color: 'var(--foreground)', outline: 'none' }}
                    >
                      {KYC_STATUS_OPTIONS.map(status => (
                        <option key={status} value={status} style={{ background: '#141414' }}>{status}</option>
                      ))}
                    </select>
                    <p className="mt-1 text-xs" style={{ color: 'var(--muted-foreground)' }}>
                      If a submitted or approved KYC has no code, the next CL code will be generated automatically.
                    </p>
                  </div>
                  <KycPersonEditForm
                    values={editValues}
                    onChange={setEditValues}
                    disabled={savingEdit}
                  />
                  <div className="flex gap-2 border-t pt-4" style={{ borderColor: '#2A2418' }}>
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
                    style={{ borderColor: '#2A2418', color: '#C9A96E' }}
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
                      className="inline-flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-md border border-[#2A2418] px-2.5 text-xs"
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

              {/* Three-step screening: AML → FATF → PEP */}
              <div className="border-t pt-4 space-y-3" style={{ borderColor: '#2A2418' }}>
                <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#C9A96E' }}>
                  Screening (AML → FATF → PEP)
                </p>
                <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                  Run each step in order. All three must be CLEAR before generating DDR.
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
                      hint: 'Screens nationality, passport/ID place of issue, and place of birth (after AML CLEAR)',
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
                            className="rounded-lg border px-3 py-2.5"
                            style={{ borderColor: '#2A2418', background: 'rgba(201,169,110,0.04)' }}
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
                                  borderColor: '#2A2418',
                                  color: !step.enabled || amlLoading ? 'var(--muted-foreground)' : '#C9A96E',
                                }}
                              >
                                {loading ? 'Screening…' : `Run ${step.key === 'SANCTIONS' ? 'AML' : step.key}`}
                              </Button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )
                })()}

                {amlData && (
                  <div className="space-y-2 pt-1">
                    {amlData.alerts.length === 0 ? (
                      <p className="text-xs rounded-lg px-3 py-2" style={{ background: 'rgba(16,185,129,0.08)', color: '#10b981' }}>
                        No active screening hits
                      </p>
                    ) : (
                      <ul className="space-y-2">
                        {amlData.alerts.map(alert => {
                          const color = AML_HIT_COLOR[alert.result]
                          return (
                            <li
                              key={alert.id}
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
                                <span className="text-xs font-semibold shrink-0" style={{ color: color?.text ?? '#9A8060' }}>
                                  {alert.result.replace('_', ' ')}
                                  {alert.matchScore != null ? ` · ${(alert.matchScore * 100).toFixed(0)}%` : ''}
                                </span>
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
                              <Link
                                href={`/admin/aml/${alert.id}`}
                                className="inline-flex text-xs font-medium hover:underline"
                                style={{ color: '#C9A96E' }}
                              >
                                Review alert →
                              </Link>
                            </li>
                          )
                        })}
                      </ul>
                    )}
                  </div>
                )}
              </div>

              {/* Due Diligence Reports */}
              <div className="border-t pt-4" style={{ borderColor: '#2A2418' }}>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#C9A96E' }}>Due Diligence Reports</p>
                  <Button
                    variant="outline"
                    disabled={generatingDdr || !amlData?.gate?.canGenerateDdr}
                    onClick={generatePersonDdr}
                    className="text-xs h-7 px-3"
                    style={{
                      borderColor: '#2A2418',
                      color: generatingDdr || !amlData?.gate?.canGenerateDdr ? 'var(--muted-foreground)' : '#C9A96E',
                    }}
                    title={!amlData?.gate?.canGenerateDdr ? 'Complete AML → FATF → PEP (all CLEAR) first' : undefined}
                  >
                    {generatingDdr ? 'Generating…' : 'Generate DDR'}
                  </Button>
                </div>
                {!amlData?.gate?.canGenerateDdr ? (
                  <p className="mb-2 text-xs" style={{ color: 'var(--muted-foreground)' }}>
                    Unlock by running AML, FATF, and PEP — each must return CLEAR.
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
                          className="flex items-center justify-between gap-2 rounded-md border border-[#2A2418] px-3 py-2"
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
                              className="inline-flex h-7 items-center gap-1 rounded-md border border-[#2A2418] px-2 text-xs"
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

              {/* Adverse media */}
              <div className="border-t pt-4 space-y-2" style={{ borderColor: '#2A2418' }}>
                <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#C9A96E' }}>
                  Adverse media / 負面新聞
                </p>
                {!amlData?.adverseMedia || amlData.adverseMedia.length === 0 ? (
                  <p className="text-xs rounded-lg px-3 py-2" style={{ background: 'rgba(16,185,129,0.08)', color: '#10b981' }}>
                    No crime / PEP / financial-fraud news hits
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {amlData.adverseMedia.map(hit => (
                      <li
                        key={hit.id}
                        className="rounded-lg px-3 py-2.5 text-sm space-y-1"
                        style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)' }}
                      >
                        <p className="font-semibold" style={{ color: 'var(--foreground)' }}>{hit.title}</p>
                        <p className="text-xs" style={{ color: '#ef4444' }}>
                          {hit.categories.join(' · ')}
                          {hit.publisher ? ` · ${hit.publisher}` : ''}
                        </p>
                        {hit.snippet && (
                          <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{hit.snippet}</p>
                        )}
                        <a
                          href={hit.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs hover:underline break-all"
                          style={{ color: '#C9A96E' }}
                        >
                          {hit.url}
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Actions */}
              {!editing ? (
              <div className="border-t pt-4" style={{ borderColor: '#2A2418' }}>
                {selected.kycStatus === 'DRAFT' || selected.kycStatus === 'SUBMITTED' || selected.kycStatus === 'PENDING_INFO' ? (
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
              ) : null}
            </CardContent>
          </Card>
          </div>
        )}
      </div>
    </div>
  )
}
