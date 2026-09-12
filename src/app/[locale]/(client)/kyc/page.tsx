'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useForm, useFieldArray, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { useDropzone } from 'react-dropzone'
import {
  User, Briefcase, BarChart2, FileCheck, CheckCircle2, XCircle, Clock, Upload, Loader2, ChevronRight,
  Plus, Trash2, Download, Users,
} from 'lucide-react'
import type { KeyPerson } from '@prisma/client'
import { kycPersonDraftZod, kycPersonZod, type KycPersonInput, keyPersonToFormValues } from '@/lib/kyc/personZod'
import { hasUnfilledOther } from '@/lib/kyc/locationData'
import {
  KycTitleSelect,
  KycIdTypeSelect,
  KycCountrySelectField,
  KycProvinceSelectField,
  KycEmploymentStatusSelect,
  KycUsCitizenRadios,
  KycBusinessNaturesField,
  KycSourcesOfWealthField,
  KycAnnualIncomeRadios,
  KycNetAssetRadios,
  KycAssetItemsField,
} from '@/components/kyc/KycFormFields'
import { DatePickerPopover } from '@/components/ui/date-picker-popover'

const formZod = z.object({ persons: z.array(kycPersonDraftZod).min(1) })
type FormValues = z.infer<typeof formZod> & { persons: (KycPersonInput & { kycStatus?: string })[] }

function emptyPerson(): KycPersonInput & { kycStatus?: string } {
  return {
    kycCode: '',
    nameEn: '',
    firstName: '',
    lastName: '',
    otherName: '',
    nameZh: '',
    titlePrefix: '',
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
    kycStatus: 'DRAFT',
  }
}

const KYC_STATUS: Record<string, { bg: string; text: string; icon: React.ElementType; label: string }> = {
  DRAFT:    { bg: 'rgba(120,113,108,0.15)', text: '#9A8060', icon: Clock,        label: 'Draft' },
  APPROVED: { bg: 'rgba(16,185,129,0.12)',  text: '#10b981', icon: CheckCircle2, label: 'Approved' },
  REJECTED: { bg: 'rgba(239,68,68,0.12)',   text: '#ef4444', icon: XCircle,      label: 'Rejected' },
  INACTIVE: { bg: 'rgba(120,113,108,0.12)', text: '#78716c', icon: Clock,        label: 'Inactive' },
}

const STEPS = [
  { key: 'sectionA', icon: User },
  { key: 'sectionB', icon: Briefcase },
  { key: 'sectionC', icon: BarChart2 },
  { key: 'sectionD', icon: FileCheck },
] as const

const fieldStyle: React.CSSProperties = {
  width: '100%',
  background: 'var(--surface)',
  border: '1px solid var(--border-subtle)',
  color: 'var(--text-cream)',
  borderRadius: '0.375rem',
  padding: '0.5rem 0.75rem',
  fontSize: '0.875rem',
  outline: 'none',
  transition: 'border-color 150ms',
}
const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '0.75rem',
  fontWeight: 500,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  color: '#7A7060',
  marginBottom: '0.375rem',
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  const required = label.trimEnd().endsWith('*')
  const visibleLabel = required ? label.trimEnd().slice(0, -1).trimEnd() : label

  return (
    <div
      style={
        error
          ? { borderLeft: '3px solid #ef4444', paddingLeft: '0.5rem', borderRadius: '0.25rem' }
          : undefined
      }
    >
      <label style={{ ...labelStyle, color: error ? '#ef4444' : labelStyle.color }}>
        {visibleLabel}
        {required ? <span style={{ color: '#ef4444', fontWeight: 700 }}> *</span> : null}
      </label>
      {children}
      {error && <p style={{ color: '#ef4444', fontSize: '0.75rem', marginTop: '0.25rem' }}>{error}</p>}
    </div>
  )
}

function DatePickerField(props: React.ComponentProps<typeof DatePickerPopover>) {
  return <DatePickerPopover {...props} style={{ ...fieldStyle, ...props.style }} />
}

const KYC_PENDING_FILE_CATEGORIES = ['id', 'address', 'declaration'] as const
type KycPendingCategory = (typeof KYC_PENDING_FILE_CATEGORIES)[number]

const DOC_TYPE_FOR_CATEGORY: Record<KycPendingCategory, string> = {
  id: 'KYC_ID',
  address: 'KYC_ADDRESS',
  declaration: 'KYC_DECLARATION',
}

function UploadZone({
  slotId,
  personId,
  category,
  docType,
  isLocked,
  uploads,
  setUploads,
  pendingFiles,
  setPendingFiles,
  existingDocs,
  hint,
  required = false,
  error,
  onAcceptedFiles,
}: {
  slotId: string
  personId: string | undefined
  category: KycPendingCategory
  docType: string
  isLocked: boolean
  uploads: Record<string, { name: string; status: string }[]>
  setUploads: React.Dispatch<React.SetStateAction<Record<string, { name: string; status: string }[]>>>
  pendingFiles: Record<string, { uid: string; file: File }[]>
  setPendingFiles: React.Dispatch<
    React.SetStateAction<Record<string, { uid: string; file: File }[]>>
  >
  existingDocs?: { id: string; documentType: string; fileName: string }[]
  hint: string
  required?: boolean
  error?: string
  onAcceptedFiles?: () => void
}) {
  const t = useTranslations('kyc')
  const serverUploadKey = personId ? `${personId}:${category}` : ''
  const pendingKey = `${slotId}:${category}`

  const onDrop = useCallback(
    async (files: File[]) => {
      if (!slotId) return
      if (personId) {
        const uploadKey = serverUploadKey
        for (const file of files) {
          setUploads((u) => ({
            ...u,
            [uploadKey]: [...(u[uploadKey] ?? []), { name: file.name, status: 'uploading' }],
          }))
          try {
            const fd = new FormData()
            fd.append('file', file)
            fd.append('type', docType)
            fd.append('keyPersonId', personId)
            const res = await fetch('/api/documents/upload', { method: 'POST', body: fd })
            if (!res.ok) throw new Error()
            setUploads((u) => ({
              ...u,
              [uploadKey]: (u[uploadKey] ?? []).map((x) =>
                x.name === file.name ? { ...x, status: 'done' } : x
              ),
            }))
            onAcceptedFiles?.()
            toast.success(t('uploaded', { defaultValue: 'Uploaded' }))
          } catch {
            setUploads((u) => ({
              ...u,
              [uploadKey]: (u[uploadKey] ?? []).map((x) =>
                x.name === file.name ? { ...x, status: 'error' } : x
              ),
            }))
          }
        }
        return
      }

      for (const file of files) {
        const uid =
          typeof crypto !== 'undefined' && crypto.randomUUID
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random()}`
        setPendingFiles((p) => ({
          ...p,
          [pendingKey]: [...(p[pendingKey] ?? []), { uid, file }],
        }))
      }
      if (files.length > 0) onAcceptedFiles?.()
      toast.message(
        t('pendingUploadQueued', {
          defaultValue:
            files.length === 1
              ? 'File stored locally — it will upload when you save draft or submit.'
              : 'Files stored locally — they will upload when you save draft or submit.',
        })
      )
    },
    [
      slotId,
      personId,
      serverUploadKey,
      pendingKey,
      docType,
      setUploads,
      setPendingFiles,
      onAcceptedFiles,
      t,
    ]
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { 'application/pdf': [], 'image/jpeg': [], 'image/png': [] },
    maxSize: 10 * 1024 * 1024,
    onDrop,
    disabled: isLocked || !slotId,
  })

  const pendingList = pendingFiles[pendingKey] ?? []
  const serverList = serverUploadKey ? uploads[serverUploadKey] ?? [] : []

  function removePending(uid: string) {
    setPendingFiles((p) => {
      const next = { ...p }
      const list = next[pendingKey]?.filter((x) => x.uid !== uid) ?? []
      if (list.length) next[pendingKey] = list
      else delete next[pendingKey]
      return next
    })
  }

  // Existing docs from previous sessions — filter to this category's docType
  const alreadySaved = (existingDocs ?? []).filter(d => d.documentType === docType)

  return (
    <div className="space-y-2 pt-3">
      {alreadySaved.length > 0 && (
        <ul className="space-y-1 text-xs mb-1">
          {alreadySaved.map((d) => (
            <li key={d.id} className="flex items-center gap-2" style={{ color: '#10b981' }}>
              <CheckCircle2 size={12} />
              <span className="truncate">{d.fileName}</span>
              <span style={{ opacity: 0.7 }}>— {t('alreadyUploaded', { defaultValue: 'already uploaded' })}</span>
            </li>
          ))}
        </ul>
      )}
      <div
        {...getRootProps()}
        className="rounded-lg p-4 flex flex-col items-center gap-2 text-center cursor-pointer transition-all"
        style={{
          border: `2px dashed ${isDragActive ? '#C9A96E' : 'var(--border-subtle)'}`,
          borderColor: error ? '#ef4444' : isDragActive ? '#C9A96E' : 'var(--border-subtle)',
          background: isDragActive ? 'rgba(201,169,110,0.06)' : 'var(--background)',
          opacity: isLocked || !slotId ? 0.5 : 1,
          pointerEvents: isLocked || !slotId ? 'none' : 'auto',
        }}
      >
        <input {...getInputProps()} />
        <Upload size={16} style={{ color: '#C9A96E' }} />
        <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
          {required ? <span style={{ color: '#ef4444', fontWeight: 700 }}>* </span> : null}
          {hint}
        </p>
        {required ? (
          <p className="text-[10px] font-medium uppercase tracking-wide" style={{ color: '#C9A96E' }}>
            Required upload
          </p>
        ) : null}
      </div>
      {error ? <p className="text-xs" style={{ color: '#ef4444' }}>{error}</p> : null}
      {pendingList.length > 0 ? (
        <ul className="space-y-1 text-xs">
          {pendingList.map((row) => (
            <li
              key={row.uid}
              className="flex items-center justify-between gap-2"
              style={{ color: 'var(--muted-foreground)' }}
            >
              <span>
                {row.file.name}{' '}
                <span style={{ opacity: 0.75 }}>
                  — {t('pendingLocal', { defaultValue: 'pending (saved after draft)' })}
                </span>
              </span>
              {!isLocked && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    removePending(row.uid)
                  }}
                  className="text-[10px] uppercase shrink-0"
                  style={{ color: '#f59e0b' }}
                >
                  {t('removePending', { defaultValue: 'Remove' })}
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : null}
      {serverList.length > 0 ? (
        <ul className="space-y-1 text-xs">
          {serverList.map((f, i) => (
            <li
              key={i}
              style={{
                color: f.status === 'error' ? '#ef4444' : f.status === 'done' ? '#10b981' : 'var(--muted-foreground)',
              }}
            >
              {f.name} — {f.status}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

export default function KYCPage() {
  const t = useTranslations('kyc')
  const [step, setStep] = useState(0)
  const [ap, setAp] = useState(0)
  const [loading, setLoading] = useState(false)
  const [uploads, setUploads] = useState<Record<string, { name: string; status: string }[]>>({})
  const [pendingKycUploads, setPendingKycUploads] = useState<
    Record<string, { uid: string; file: File }[]>
  >({})
  const [existingKycDocs, setExistingKycDocs] = useState<Record<string, { id: string; documentType: string; fileName: string }[]>>({})
  const [uploadErrors, setUploadErrors] = useState<Record<string, string>>({})
  const fieldSlotIdsRef = useRef<string[]>([])
  const pendingUploadsRef = useRef(pendingKycUploads)

  const form = useForm<FormValues>({
    resolver: zodResolver(formZod) as never,
    defaultValues: { persons: [emptyPerson()] },
  })
  const { reset } = form
  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'persons' })
  const watchedPersons = useWatch({ control: form.control, name: 'persons' }) as FormValues['persons']

  useEffect(() => {
    fieldSlotIdsRef.current = fields.map((f) => f.id)
  }, [fields])

  useEffect(() => {
    pendingUploadsRef.current = pendingKycUploads
  }, [pendingKycUploads])
  const employmentStatus = watchedPersons?.[ap]?.employmentStatus
  const personId = watchedPersons?.[ap]?.id
  const kycStatus = watchedPersons?.[ap]?.kycStatus
  const activePerson = watchedPersons?.[ap]
  const slotIdForAp = fields[ap]?.id ?? ''
  const uploadErrorKeyForActive = (category: KycPendingCategory) => `${slotIdForAp || `person-${ap}`}:${category}`

  const load = useCallback(() => {
    fetch('/api/kyc', { credentials: 'include' })
      .then(async (r) => {
        const data = await r.json()
        if (!r.ok) {
          toast.error(data?.error === 'Unauthorized' ? 'Please sign in to load KYC.' : (data?.error ?? 'Could not load KYC'))
          return
        }
        const list = data?.persons
        if (Array.isArray(list) && list.length > 0) {
          reset({
            persons: list.map((p: KeyPerson) => ({
              ...keyPersonToFormValues(p),
              kycStatus: p.kycStatus,
            })),
          })
          const docsByPerson: Record<string, { id: string; documentType: string; fileName: string }[]> = {}
          for (const p of list as Array<KeyPerson & { kycDocuments?: { id: string; documentType: string; fileName: string }[] }>) {
            docsByPerson[p.id] = p.kycDocuments ?? []
          }
          setExistingKycDocs(docsByPerson)
          setUploads({})
          setPendingKycUploads({})
        }
      })
      .catch(() => {
        toast.error('Could not load KYC')
      })
  }, [reset])

  useEffect(() => {
    load()
  }, [load])

  const isLocked = kycStatus === 'APPROVED' || kycStatus === 'INACTIVE'

  function stripForApi(persons: FormValues['persons'], action: 'SAVE_DRAFT' | 'SUBMIT'): KycPersonInput[] {
    return persons.map((p) => {
      const rest = { ...(p as KycPersonInput & { kycStatus?: string }) }
      delete rest.kycStatus
      return (action === 'SUBMIT' ? kycPersonZod : kycPersonDraftZod).parse(rest)
    })
  }

  function hasRequiredUpload(personIndex: number, category: KycPendingCategory) {
    const slotId = fieldSlotIdsRef.current[personIndex]
    const person = form.getValues(`persons.${personIndex}` as 'persons.0')
    const docType = DOC_TYPE_FOR_CATEGORY[category]
    if (slotId && (pendingUploadsRef.current[`${slotId}:${category}`]?.length ?? 0) > 0) return true
    if (person?.id && existingKycDocs[person.id]?.some(d => d.documentType === docType)) return true
    if (person?.id && (uploads[`${person.id}:${category}`] ?? []).some((doc) => doc.status === 'done')) return true
    return false
  }

  function uploadErrorKey(personIndex: number, category: KycPendingCategory) {
    return `${fieldSlotIdsRef.current[personIndex] || `person-${personIndex}`}:${category}`
  }

  function clearUploadError(personIndex: number, category: KycPendingCategory) {
    const key = uploadErrorKey(personIndex, category)
    setUploadErrors((current) => {
      if (!current[key]) return current
      const next = { ...current }
      delete next[key]
      return next
    })
  }

  function composeNameForPerson(personIndex: number) {
    const p = form.getValues(`persons.${personIndex}` as 'persons.0')
    return [p.firstName, p.otherName, p.lastName].map((part) => part?.trim()).filter(Boolean).join(' ')
  }

  /** Validates one person for final SUBMIT (current tab only — does not submit other persons). */
  function validateSubmitRequirements(personIndex: number) {
    form.clearErrors(`persons.${personIndex}` as 'persons.0')
    setUploadErrors((current) => {
      const next = { ...current }
      delete next[uploadErrorKey(personIndex, 'id')]
      delete next[uploadErrorKey(personIndex, 'address')]
      return next
    })
    const persons = form.getValues('persons')
    const p = persons[personIndex]
    if (!p) return false

    const missing = [
      ['English first name', 'firstName', p.firstName],
      ['En last name / surname', 'lastName', p.lastName],
      ['ID type', 'idType', p.idType],
      ['ID/passport number', 'idNumber', p.idNumber],
      ['Place of issue', 'placeOfIssue', p.placeOfIssue],
      ['Date of birth', 'dateOfBirth', p.dateOfBirth],
      ['Place of birth', 'placeOfBirth', p.placeOfBirth],
      ['Nationality', 'nationality', p.nationality],
      ['Contact address', 'contactAddress', p.contactAddress],
      ['Mobile phone', 'mobile', p.mobile],
      ['Email', 'email', p.email],
    ].filter(([, , value]) => !String(value ?? '').trim())

    if (!p.idExpiryPermanent && !String(p.idExpiry ?? '').trim()) {
      missing.push(['ID/passport expiry date or long-term', 'idExpiry', ''])
    }

    if (missing.length > 0) {
      missing.forEach(([label, field]) => {
        form.setError(`persons.${personIndex}.${field}` as 'persons.0.nameEn', {
          type: 'manual',
          message: `${label} is required`,
        })
      })
      setAp(personIndex)
      setStep(0)
      toast.error(`Please fill required KYC fields: ${missing.map(([label]) => label).join(', ')}`)
      return false
    }
    const unfilledOther = [
      ['Place of issue', 'placeOfIssue', p.placeOfIssue],
      ['Place of birth', 'placeOfBirth', p.placeOfBirth],
      ['Nationality', 'nationality', p.nationality],
    ].find(([, , value]) => hasUnfilledOther(value))
    if (unfilledOther) {
      form.setError(`persons.${personIndex}.${unfilledOther[1]}` as 'persons.0.nameEn', {
        type: 'manual',
        message: 'Please fill the custom Other value',
      })
      setAp(personIndex)
      setStep(0)
      toast.error(`Please fill the custom Other value for ${unfilledOther[0]}.`)
      return false
    }
    if (!hasRequiredUpload(personIndex, 'id')) {
      setUploadErrors((current) => ({
        ...current,
        [uploadErrorKey(personIndex, 'id')]: 'ID / passport upload is required',
      }))
      setAp(personIndex)
      setStep(0)
      toast.error('ID / passport upload is required. Please upload the file marked with *.')
      return false
    }
    if (!hasRequiredUpload(personIndex, 'address')) {
      setUploadErrors((current) => ({
        ...current,
        [uploadErrorKey(personIndex, 'address')]: 'Proof of address upload is required',
      }))
      setAp(personIndex)
      setStep(0)
      toast.error('Proof of address upload is required. Please upload the file marked with *.')
      return false
    }
    // Section D — 聲明：簽署人、日期、勾選聲明皆必填
    if (!String(p.signatureName ?? '').trim()) {
      form.setError(`persons.${personIndex}.signatureName` as 'persons.0.nameEn', {
        type: 'manual',
        message: 'Signatory name is required',
      })
      setAp(personIndex)
      setStep(3)
      toast.error(t('declarationFieldMissingSignature', { defaultValue: 'Please enter signatory name (Declaration).' }))
      return false
    }
    if (!String(p.declarationDate ?? '').trim()) {
      form.setError(`persons.${personIndex}.declarationDate` as 'persons.0.nameEn', {
        type: 'manual',
        message: 'Declaration date is required',
      })
      setAp(personIndex)
      setStep(3)
      toast.error(t('declarationFieldMissingDate', { defaultValue: 'Please select declaration date.' }))
      return false
    }
    if (p.declarationSigned !== true) {
      form.setError(`persons.${personIndex}.declarationSigned` as 'persons.0.nameEn', {
        type: 'manual',
        message: 'Please check the declaration',
      })
      setAp(personIndex)
      setStep(3)
      toast.error(t('declarationFieldMissingCheckbox', { defaultValue: 'Please check the declaration to confirm.' }))
      return false
    }
    return true
  }

  async function flushPendingAfterSave(slotIdsSnapshot: string[], backPersons: { id: string }[]) {
    const remaining = { ...pendingUploadsRef.current }
    let failed = 0

    for (let i = 0; i < backPersons.length; i++) {
      const sid = slotIdsSnapshot[i]
      const kpId = backPersons[i]?.id
      if (!sid || !kpId) continue

      for (const cat of KYC_PENDING_FILE_CATEGORIES) {
        const key = `${sid}:${cat}`
        const rows = remaining[key]
        if (!rows?.length) continue
        const stillPending: { uid: string; file: File }[] = []
        const docType = DOC_TYPE_FOR_CATEGORY[cat]

        for (const row of rows) {
          try {
            const fd = new FormData()
            fd.append('file', row.file)
            fd.append('type', docType)
            fd.append('keyPersonId', kpId)
            const res = await fetch('/api/documents/upload', { method: 'POST', body: fd })
            if (!res.ok) {
              const errJson = (await res.json().catch(() => ({}))) as { error?: string }
              throw new Error(errJson?.error ?? res.status.toString())
            }
            const serverKey = `${kpId}:${cat}`
            setUploads((u) => ({
              ...u,
              [serverKey]: [...(u[serverKey] ?? []), { name: row.file.name, status: 'done' }],
            }))
          } catch {
            stillPending.push(row)
            failed++
          }
        }
        if (stillPending.length) remaining[key] = stillPending
        else delete remaining[key]
      }
    }
    setPendingKycUploads(remaining)
    if (failed > 0) {
      toast.error(
        t('pendingUploadPartialFail', {
          defaultValue: `${failed} file(s) could not upload. Save again after checking your connection.`,
        })
      )
    }
  }

  async function saveAll(action: 'SAVE_DRAFT' | 'SUBMIT', opts: { advance?: boolean } = {}) {
    const currentPerson = form.getValues(`persons.${ap}` as 'persons.0')
    if ((opts.advance || action === 'SUBMIT') && currentPerson?.isPep) {
      toast.error(t('pepBlocked', { defaultValue: 'PEP selected as Yes. This KYC cannot continue online. Please contact our team.' }))
      return
    }
    if (action === 'SUBMIT') {
      if (!validateSubmitRequirements(ap)) return
    }

    // Compose English display name: full form on draft saves; current person only on submit
    if (action === 'SUBMIT') {
      form.setValue(`persons.${ap}.nameEn` as 'persons.0.nameEn', composeNameForPerson(ap), { shouldDirty: true })
    } else {
      form.getValues('persons').forEach((_p, i) => {
        form.setValue(`persons.${i}.nameEn` as 'persons.0.nameEn', composeNameForPerson(i), { shouldDirty: true })
      })
    }
    if (action === 'SUBMIT') {
      const ok = await form.trigger(`persons.${ap}` as `persons.${number}`)
      if (!ok) return
    }
    const slotIdsSnapshot = [...fieldSlotIdsRef.current]
    setLoading(true)
    try {
      const personsPayload =
        action === 'SUBMIT'
          ? stripForApi([form.getValues(`persons.${ap}` as 'persons.0')], action)
          : stripForApi(form.getValues('persons'), action)

      const res = await fetch('/api/kyc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ persons: personsPayload, action }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(json.error ?? 'Save failed')
        return
      }
      const back = json.persons as { id: string; kycStatus: string; kycCode?: string | null }[]
      if (Array.isArray(back)) {
        if (action === 'SUBMIT') {
          const b = back[0]
          if (b) {
            form.setValue(`persons.${ap}.id` as 'persons.0.id', b.id)
            form.setValue(`persons.${ap}.kycStatus` as 'persons.0.kycStatus', b.kycStatus)
            form.setValue(`persons.${ap}.kycCode` as 'persons.0.kycCode', b.kycCode ?? '')
          }
          await flushPendingAfterSave([slotIdsSnapshot[ap] ?? ''], back)
        } else {
          back.forEach((b, i) => {
            form.setValue(`persons.${i}.id` as 'persons.0.id', b.id)
            form.setValue(`persons.${i}.kycStatus` as 'persons.0.kycStatus', b.kycStatus)
            form.setValue(`persons.${i}.kycCode` as 'persons.0.kycCode', b.kycCode ?? '')
          })
          await flushPendingAfterSave(slotIdsSnapshot, back)
        }
      }
      if (action === 'SUBMIT') toast.success(t('submitSuccess'))
      else if (opts.advance && step < 3) setStep((s) => s + 1)
      else toast.success(t('draftSaved'))
    } finally {
      setLoading(false)
    }
  }

  async function removePerson(i: number) {
    if (fields.length <= 1) {
      toast.error(t('minOnePerson', { defaultValue: 'At least one person is required.' }))
      return
    }
    const slotId = fields[i]?.id
    const id = form.getValues(`persons.${i}.id` as 'persons.0.id')
    if (id) {
      setLoading(true)
      try {
        const res = await fetch(`/api/kyc/persons/${id}`, { method: 'DELETE' })
        if (!res.ok) {
          toast.error('Delete failed')
          return
        }
      } finally {
        setLoading(false)
      }
    }
    remove(i)
    if (ap >= fields.length - 1) setAp(Math.max(0, fields.length - 2))
    else if (i < ap) setAp((a) => a - 1)
    if (slotId) {
      setPendingKycUploads((p) => {
        const n = { ...p }
        for (const k of Object.keys(n)) {
          if (k.startsWith(`${slotId}:`)) delete n[k]
        }
        return n
      })
    }
    if (id) {
      setUploads((u) => {
        const n = { ...u }
        for (const k of Object.keys(n)) {
          if (k.startsWith(`${id}:`)) delete n[k]
        }
        return n
      })
    }
  }

  function addPerson() {
    append(emptyPerson())
    setAp(fields.length)
    setStep(0)
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: 'var(--foreground)' }}>{t('title')}</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
            {t('multiSubtitle', { defaultValue: 'Add every individual who must complete KYC. Fields match the official KYC form.' })}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => {
              window.location.href = '/api/kyc/export'
            }}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border"
            style={{ borderColor: 'var(--border-subtle)', color: '#C9A96E' }}
          >
            <Download size={14} />
            {t('downloadKycDoc', { defaultValue: 'Download Word' })}
          </button>
        </div>
      </div>

      {/* Person tabs */}
      <div
        className="rounded-xl p-3 flex flex-wrap items-center gap-2"
        style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
      >
        <Users size={16} style={{ color: '#C9A96E' }} className="ml-1" />
        {fields.map((f, i) => {
          const watched = watchedPersons?.[i]
          const st = watched?.kycStatus ?? 'DRAFT'
          const nameEn = watched?.nameEn
          const code = watched?.kycCode
          const info = KYC_STATUS[st] ?? KYC_STATUS.DRAFT
          const label = nameEn?.trim() || `${t('personIndex', { defaultValue: 'Person' })} ${i + 1}`
          const personLocked = st === 'APPROVED'
          return (
            <div key={f.id} className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setAp(i)}
                className="px-3 py-1.5 rounded-lg text-sm font-medium transition-all"
                style={{
                  background: i === ap ? 'rgba(201,169,110,0.2)' : 'var(--background)',
                  border: `1px solid ${i === ap ? '#C9A96E' : 'var(--border)'}`,
                  color: i === ap ? '#C9A96E' : 'var(--muted-foreground)',
                }}
              >
                {label}
                {code ? (
                  <span className="ml-1.5 text-[10px] opacity-90" style={{ color: 'var(--text-cream)' }}>
                    {code}
                  </span>
                ) : null}
                <span className="ml-1.5 text-[10px] opacity-80" style={{ color: info.text }}>
                  ({info.label})
                </span>
              </button>
              {!personLocked && (
                <button
                  type="button"
                  onClick={() => removePerson(i)}
                  className="p-1 rounded"
                  style={{ color: '#ef4444' }}
                  aria-label="Remove"
                >
                  <Trash2 size={14} />
                </button>
        )}
              </div>
          )
        })}
        <button
          type="button"
          onClick={addPerson}
          className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-sm"
          style={{ color: '#C9A96E', border: '1px dashed var(--border-subtle)' }}
        >
          <Plus size={16} />
          {t('addPerson', { defaultValue: 'Add person' })}
        </button>
      </div>

      <div key={ap} className="space-y-6">
      <div
        className="rounded-xl p-4"
        style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
      >
        <div className="flex items-center gap-0">
          {STEPS.map(({ key, icon: StepIcon }, i) => {
            const active = i === step
            const done = i < step
            return (
              <div key={key} className="flex items-center flex-1 last:flex-none">
                <button
                  type="button"
                  onClick={() => setStep(i)}
                  className="flex flex-col items-center gap-1.5 flex-shrink-0"
                >
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center transition-all"
                    style={{
                      background: done
                        ? 'rgba(16,185,129,0.15)'
                        : active
                          ? 'rgba(201,169,110,0.2)'
                          : 'var(--background)',
                      border: `1.5px solid ${done ? '#10b981' : active ? '#C9A96E' : 'var(--border)'}`,
                    }}
                  >
                    {done ? (
                      <CheckCircle2 size={16} style={{ color: '#10b981' }} />
                    ) : (
                      <StepIcon size={15} style={{ color: active ? '#C9A96E' : 'var(--muted-foreground)' }} />
                    )}
                  </div>
                  <span
                    className="text-xs font-medium hidden sm:block"
                    style={{ color: active ? '#C9A96E' : done ? '#10b981' : 'var(--muted-foreground)' }}
                  >
                    {t(key)}
                  </span>
                </button>
                {i < STEPS.length - 1 && (
                  <div
                    className="flex-1 h-px mx-2"
                    style={{ background: done ? '#10b981' : 'var(--border)' }}
                  />
                )}
              </div>
            )
          })}
        </div>
      </div>

      {step === 0 && (
        <div className="rounded-xl p-6 space-y-6" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          <h2 className="text-sm font-semibold uppercase tracking-wider" style={{ color: '#C9A96E' }}>{t('sectionA')}</h2>

          {/* Group 1: Title + Names */}
          <fieldset className="rounded-lg p-4 space-y-4" style={{ border: '1px solid var(--border)' }}>
            <legend className="text-xs px-1" style={{ color: 'var(--muted-foreground)' }}>Name 姓名</legend>
            <div className="grid sm:grid-cols-3 gap-4">
              <Field label={t('fields.title')} error={form.formState.errors.persons?.[ap]?.titlePrefix?.message}>
                <KycTitleSelect
                  value={activePerson?.titlePrefix}
                  disabled={isLocked}
                  fieldStyle={fieldStyle}
                  onChange={(value) => form.setValue(`persons.${ap}.titlePrefix` as const, value, { shouldDirty: true, shouldValidate: true })}
                />
              </Field>
              <Field label="English first name *" error={form.formState.errors.persons?.[ap]?.firstName?.message}>
                <input style={fieldStyle} disabled={isLocked} {...form.register(`persons.${ap}.firstName` as const)} />
              </Field>
              <Field label="En last name / surname *" error={form.formState.errors.persons?.[ap]?.lastName?.message}>
                <input style={fieldStyle} disabled={isLocked} {...form.register(`persons.${ap}.lastName` as const)} />
              </Field>
              <Field label={t('fields.nameZh')} error={form.formState.errors.persons?.[ap]?.nameZh?.message}>
                <input style={fieldStyle} disabled={isLocked} {...form.register(`persons.${ap}.nameZh` as const)} />
              </Field>
              <Field label="Other name">
                <input style={fieldStyle} disabled={isLocked} {...form.register(`persons.${ap}.otherName` as const)} />
              </Field>
            </div>
          </fieldset>

          {/* Group 2: ID */}
          <fieldset className="rounded-lg p-4 space-y-4" style={{ border: '1px solid var(--border)' }}>
            <legend className="text-xs px-1" style={{ color: 'var(--muted-foreground)' }}>{t('fields.idType')} &amp; {t('fields.idNumber')}</legend>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label={`${t('fields.idType')} *`} error={form.formState.errors.persons?.[ap]?.idType?.message}>
                <KycIdTypeSelect
                  value={activePerson?.idType}
                  disabled={isLocked}
                  fieldStyle={fieldStyle}
                  onChange={(value) => form.setValue(`persons.${ap}.idType` as const, value, { shouldDirty: true, shouldValidate: true })}
                />
              </Field>
              <Field label={`${t('fields.idNumber')} *`} error={form.formState.errors.persons?.[ap]?.idNumber?.message}>
                <input style={fieldStyle} disabled={isLocked} {...form.register(`persons.${ap}.idNumber` as const)} />
              </Field>
            </div>
            <Field label={`${t('fields.placeOfIssue')} *`} error={form.formState.errors.persons?.[ap]?.placeOfIssue?.message}>
              <KycProvinceSelectField
                value={activePerson?.placeOfIssue}
                disabled={isLocked}
                fieldStyle={fieldStyle}
                onChange={(value) => form.setValue(`persons.${ap}.placeOfIssue` as const, value, { shouldDirty: true, shouldValidate: true })}
              />
            </Field>
            <Field label={`${t('fields.expiryDate')} *`} error={form.formState.errors.persons?.[ap]?.idExpiry?.message}>
              <div className="space-y-2">
                <DatePickerField
                  value={activePerson?.idExpiry}
                  disabled={isLocked || Boolean(activePerson?.idExpiryPermanent)}
                  onChange={(value) => form.setValue(`persons.${ap}.idExpiry` as const, value, { shouldDirty: true, shouldValidate: true })}
                />
                <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--foreground)' }}>
                  <input
                    type="checkbox"
                    disabled={isLocked}
                    checked={Boolean(activePerson?.idExpiryPermanent)}
                    onChange={(event) => {
                      form.setValue(`persons.${ap}.idExpiryPermanent` as const, event.target.checked, { shouldDirty: true, shouldValidate: true })
                      if (event.target.checked) {
                        form.setValue(`persons.${ap}.idExpiry` as const, '', { shouldDirty: true, shouldValidate: true })
                      }
                    }}
                  />
                  Long-term 長期
                </label>
              </div>
            </Field>
            <UploadZone
              slotId={slotIdForAp}
              personId={personId}
              category="id"
              docType="KYC_ID"
              isLocked={isLocked}
              uploads={uploads}
              setUploads={setUploads}
              pendingFiles={pendingKycUploads}
              setPendingFiles={setPendingKycUploads}
              existingDocs={personId ? existingKycDocs[personId] : undefined}
              hint={t('uploadIdHint', { defaultValue: 'Upload ID / Passport copy — PDF, JPG, PNG, max 10 MB' })}
              required
              error={uploadErrors[uploadErrorKeyForActive('id')]}
              onAcceptedFiles={() => clearUploadError(ap, 'id')}
            />
          </fieldset>

          <fieldset className="rounded-lg p-4 space-y-4" style={{ border: '1px solid var(--border)' }}>
            <legend className="text-xs px-1" style={{ color: 'var(--muted-foreground)' }}>Birth and Nationality 出生及國籍</legend>
            <Field label={`${t('fields.dob')} *`} error={form.formState.errors.persons?.[ap]?.dateOfBirth?.message}>
              <DatePickerField
                value={activePerson?.dateOfBirth}
                disabled={isLocked}
                onChange={(value) => form.setValue(`persons.${ap}.dateOfBirth` as const, value, { shouldDirty: true, shouldValidate: true })}
              />
            </Field>
            <Field label={`${t('fields.placeOfBirth')} *`} error={form.formState.errors.persons?.[ap]?.placeOfBirth?.message}>
              <KycProvinceSelectField
                value={activePerson?.placeOfBirth}
                disabled={isLocked}
                fieldStyle={fieldStyle}
                onChange={(value) => form.setValue(`persons.${ap}.placeOfBirth` as const, value, { shouldDirty: true, shouldValidate: true })}
              />
            </Field>
            <Field label={`${t('fields.nationality')} *`} error={form.formState.errors.persons?.[ap]?.nationality?.message}>
              <KycCountrySelectField
                value={activePerson?.nationality}
                disabled={isLocked}
                fieldStyle={fieldStyle}
                onChange={(value) => form.setValue(`persons.${ap}.nationality` as const, value, { shouldDirty: true, shouldValidate: true })}
              />
            </Field>
          </fieldset>
          {/* Address group */}
          <fieldset className="rounded-lg p-4 space-y-4" style={{ border: '1px solid var(--border)' }}>
            <legend className="text-xs px-1" style={{ color: 'var(--muted-foreground)' }}>{t('fields.contactAddress')}</legend>
            <Field label={`${t('fields.contactAddress')} *`} error={form.formState.errors.persons?.[ap]?.contactAddress?.message}>
              <textarea
                style={{ ...fieldStyle, minHeight: '6rem', resize: 'vertical' }}
                disabled={isLocked}
                {...form.register(`persons.${ap}.contactAddress` as const)}
              />
            </Field>
            <UploadZone
              slotId={slotIdForAp}
              personId={personId}
              category="address"
              docType="KYC_ADDRESS"
              isLocked={isLocked}
              uploads={uploads}
              setUploads={setUploads}
              pendingFiles={pendingKycUploads}
              setPendingFiles={setPendingKycUploads}
              existingDocs={personId ? existingKycDocs[personId] : undefined}
              hint={t('uploadAddressHint', { defaultValue: 'Upload proof of address — PDF, JPG, PNG, max 10 MB' })}
              required
              error={uploadErrors[uploadErrorKeyForActive('address')]}
              onAcceptedFiles={() => clearUploadError(ap, 'address')}
            />
          </fieldset>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label={`${t('fields.email')} *`} error={form.formState.errors.persons?.[ap]?.email?.message}>
              <input type="email" style={fieldStyle} disabled={isLocked} {...form.register(`persons.${ap}.email` as const)} />
            </Field>
            <Field label={`${t('fields.mobile')} *`} error={form.formState.errors.persons?.[ap]?.mobile?.message}>
              <input style={fieldStyle} disabled={isLocked} {...form.register(`persons.${ap}.mobile` as const)} />
            </Field>
            <Field label={t('fields.homePhone')}>
              <input style={fieldStyle} disabled={isLocked} {...form.register(`persons.${ap}.homePhone` as const)} />
            </Field>
            <Field label={t('fields.workPhone')}>
              <input style={fieldStyle} disabled={isLocked} {...form.register(`persons.${ap}.workPhone` as const)} />
            </Field>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label={t('fields.wechat')}>
              <input style={fieldStyle} disabled={isLocked} {...form.register(`persons.${ap}.wechat` as const)} />
            </Field>
            <Field label={t('fields.emergencyContact')}>
              <input style={fieldStyle} disabled={isLocked} {...form.register(`persons.${ap}.emergencyContact` as const)} />
            </Field>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>{t('fields.usCitizen')}</p>
            <KycUsCitizenRadios
              value={activePerson?.isUsCitizen}
              disabled={isLocked}
              onChange={(val) => form.setValue(`persons.${ap}.isUsCitizen` as const, val, { shouldDirty: true })}
            />
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="rounded-xl p-6 space-y-5" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          <h2 className="text-sm font-semibold uppercase tracking-wider" style={{ color: '#C9A96E' }}>{t('sectionB')}</h2>
          <Field label={t('fields.employmentStatus')}>
            <KycEmploymentStatusSelect
              value={activePerson?.employmentStatus}
              disabled={isLocked}
              fieldStyle={fieldStyle}
              labels={{
                employed: t('employment.employed'),
                selfEmployed: t('employment.selfEmployed'),
                retired: t('employment.retired'),
                unemployed: t('employment.unemployed'),
              }}
              onChange={(value) => form.setValue(`persons.${ap}.employmentStatus` as const, value as FormValues['persons'][0]['employmentStatus'], { shouldDirty: true, shouldValidate: true })}
            />
          </Field>
          {(employmentStatus === 'EMPLOYED' || employmentStatus === 'SELF_EMPLOYED') && (
            <div className="space-y-4">
              <Field label={t('fields.employerName')}>
                <input style={fieldStyle} disabled={isLocked} {...form.register(`persons.${ap}.employerName` as const)} />
              </Field>
              <Field label={t('fields.companyAddress')}>
                <textarea
                  style={{ ...fieldStyle, minHeight: '5rem', resize: 'vertical' }}
                  disabled={isLocked}
                  {...form.register(`persons.${ap}.employerAddress` as const)}
                />
              </Field>

              <div className="space-y-2">
                <p className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>{t('fields.businessNature')}</p>
                <KycBusinessNaturesField
                  value={activePerson?.businessNaturesText}
                  disabled={isLocked}
                  fieldStyle={fieldStyle}
                  onChange={(value) => form.setValue(`persons.${ap}.businessNaturesText` as const, value, { shouldDirty: true })}
                />
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <Field label={t('fields.position')}>
                  <input style={fieldStyle} disabled={isLocked} {...form.register(`persons.${ap}.position` as const)} />
                </Field>
                <Field label={t('fields.workingYears')}>
                  <input type="number" min={0} max={80} style={fieldStyle} disabled={isLocked} {...form.register(`persons.${ap}.workingYears` as const, { valueAsNumber: true })} />
                </Field>
              </div>
            </div>
          )}
        </div>
      )}

      {step === 2 && (
        <div className="rounded-xl p-6 space-y-6" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          <h2 className="text-sm font-semibold uppercase tracking-wider" style={{ color: '#C9A96E' }}>{t('sectionC')}</h2>

          <div className="space-y-2">
            <p className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>{t('fields.sourceOfWealth')} 財富來源</p>
            <KycSourcesOfWealthField
              value={activePerson?.sourcesOfWealthText}
              disabled={isLocked}
              fieldStyle={fieldStyle}
              onChange={(value) => form.setValue(`persons.${ap}.sourcesOfWealthText` as const, value, { shouldDirty: true })}
            />
          </div>

          <div className="space-y-2">
            <p className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>{t('fields.annualIncome')} 年收入 (USD)</p>
            <KycAnnualIncomeRadios
              value={activePerson?.annualIncome}
              disabled={isLocked}
              onChange={(value) => form.setValue(`persons.${ap}.annualIncome` as const, value, { shouldDirty: true, shouldValidate: true })}
            />
          </div>

          <div className="space-y-2">
            <p className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>{t('fields.netAssets')} 總資產 (USD)</p>
            <KycNetAssetRadios
              value={activePerson?.netAssetValue}
              disabled={isLocked}
              onChange={(value) => form.setValue(`persons.${ap}.netAssetValue` as const, value, { shouldDirty: true, shouldValidate: true })}
            />
          </div>

          <div className="space-y-2">
            <p className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>{t('fields.assetItems')} 資產項目</p>
            <KycAssetItemsField
              value={activePerson?.assetItemsText}
              disabled={isLocked}
              onChange={(value) => form.setValue(`persons.${ap}.assetItemsText` as const, value, { shouldDirty: true })}
            />
          </div>

          {/* PEP */}
          <label className="flex items-start gap-3 cursor-pointer">
            <input type="checkbox" disabled={isLocked} {...form.register(`persons.${ap}.isPep` as const)} className="mt-0.5" />
            <span className="text-sm" style={{ color: 'var(--foreground)' }}>{t('fields.isPep')}</span>
          </label>

        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <div className="rounded-xl p-6 space-y-4" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
            <h2 className="text-sm font-semibold uppercase tracking-wider" style={{ color: '#C9A96E' }}>{t('sectionD')}</h2>
            <Field label={`${t('signatureName')} *`} error={form.formState.errors.persons?.[ap]?.signatureName?.message}>
              <input style={fieldStyle} disabled={isLocked} {...form.register(`persons.${ap}.signatureName` as const)} />
            </Field>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label={`${t('declarationDate')} *`} error={form.formState.errors.persons?.[ap]?.declarationDate?.message}>
                <DatePickerField
                  value={activePerson?.declarationDate}
                  disabled={isLocked}
                  onChange={(value) => form.setValue(`persons.${ap}.declarationDate` as const, value, { shouldDirty: true, shouldValidate: true })}
                />
              </Field>
            </div>
            <label
              className="flex items-start gap-2 cursor-pointer"
              style={form.formState.errors.persons?.[ap]?.declarationSigned ? { borderLeft: '3px solid #ef4444', paddingLeft: '0.5rem' } : undefined}
            >
              <input type="checkbox" disabled={isLocked} {...form.register(`persons.${ap}.declarationSigned` as const)} className="mt-1 shrink-0" />
              <span className="text-sm" style={{ color: 'var(--foreground)' }}>
                <span className="font-semibold text-red-500 mr-1">*</span>
                {t('declaration')}
              </span>
            </label>
            {form.formState.errors.persons?.[ap]?.declarationSigned ? (
              <p className="text-xs" style={{ color: '#ef4444' }}>
                {form.formState.errors.persons[ap]?.declarationSigned?.message}
              </p>
            ) : null}
            <UploadZone
              slotId={slotIdForAp}
              personId={personId}
              category="declaration"
              docType="KYC_DECLARATION"
              isLocked={isLocked}
              uploads={uploads}
              setUploads={setUploads}
              pendingFiles={pendingKycUploads}
              setPendingFiles={setPendingKycUploads}
              existingDocs={personId ? existingKycDocs[personId] : undefined}
              hint={t('uploadDeclarationHint', { defaultValue: 'Upload signed declaration — PDF, JPG, PNG, max 10 MB' })}
            />
            {!isLocked && (
              <button
                type="button"
                className="w-full flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-semibold"
                style={{ background: loading ? '#8A6E42' : '#C9A96E', color: '#0C0C0C' }}
              disabled={loading}
              onClick={() => saveAll('SUBMIT')}
              >
                {loading ? <Loader2 size={14} className="animate-spin" /> : null}
                {loading ? t('submitting') : t('submit')}
              </button>
            )}
          </div>
        </div>
      )}

      {step < 3 && !isLocked && (
        <div className="flex items-center justify-between pt-1">
          <button
            type="button"
            disabled={step === 0 || loading}
            onClick={() => setStep((s) => s - 1)}
            className="px-5 py-2 rounded-lg text-sm font-medium"
            style={{ border: '1px solid var(--border)', color: 'var(--muted-foreground)' }}
          >
            {t('back')}
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={loading}
              onClick={() => saveAll('SAVE_DRAFT')}
              className="px-5 py-2 rounded-lg text-sm font-medium"
              style={{ border: '1px solid var(--border)' }}
            >
              {loading ? t('saving') : t('saveDraft')}
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => saveAll('SAVE_DRAFT', { advance: true })}
              className="flex items-center gap-1.5 px-5 py-2 rounded-lg text-sm font-semibold"
              style={{ background: '#C9A96E', color: '#0C0C0C' }}
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : null}
              {t('next')}
              {!loading && <ChevronRight size={14} />}
            </button>
          </div>
        </div>
      )}

      {step === 3 && !isLocked && (
        <div className="flex justify-end">
          <button
            type="button"
            disabled={loading}
            onClick={() => saveAll('SAVE_DRAFT')}
            className="px-5 py-2 rounded-lg text-sm"
            style={{ border: '1px solid var(--border)' }}
          >
            {t('saveDraft')}
          </button>
        </div>
      )}
      </div>
    </div>
  )
}
