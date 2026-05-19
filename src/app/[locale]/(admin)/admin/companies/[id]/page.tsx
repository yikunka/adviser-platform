'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { DatePickerPopover } from '@/components/ui/date-picker-popover'

// ── KYC Person type (for pre-fill picker) ────────────────────────────────────

type KycPerson = {
  id: string
  nameEn: string
  nameZh: string | null
  idType: string | null
  idNumber: string | null
  nationality: string | null
  dateOfBirth: string | null
  placeOfBirth: string | null
  placeOfIssue: string | null
  homeAddress: string | null
  contactAddress: string | null
  kycStatus: string
}

// ── Types ────────────────────────────────────────────────────────────────────

type Director = {
  id: string
  nameEn: string
  nameZh: string | null
  dateOfAppointment: string
  dateOfCessation: string | null
  addressForService: string
  nationality: string | null
  idType: string | null
  idNumber: string | null
  status: string
}

type Member = {
  id: string
  nameEn: string
  nameZh: string | null
  shareClass: string
  registeredAddress: string
  occupation: string | null
  status: string
}

type DesignatedRep = {
  id: string
  name: string
  entryDate: string
  becomingDate: string
  cessationDate: string | null
  address: string | null
  capacity: string | null
  telFax: string | null
  remarks: string | null
}

type Controller = {
  id: string
  nameEn: string
  nameZh: string | null
  entryDate: string
  becomingDate: string
  cessationDate: string | null
  natureOfControl: string | null
  correspondenceAddress: string | null
  idType: string | null
  idPassportNo: string | null
  issuingCountry: string | null
  isLegalEntity: boolean
  remarks: string | null
}

type CaseDocument = {
  id: string
  name: string
  documentType: string
  caseFileRole: string | null
  customDocumentType: string | null
  submissionDate: string | null
  notes: string | null
  createdAt: string
}

type FileCase = {
  id: string
  name: string
  caseDate: string | null
  remark: string | null
  createdAt: string
  documents: CaseDocument[]
}

type Company = {
  id: string
  nameEn: string
  nameZh: string | null
  companyNumber: string | null
  companyCode: string | null
  companyType: string | null
  dateOfIncorporation: string | null
  registeredAddress: string | null
  businessNature: string | null
  status: string
  annualReturnDate: string | null
  directors: Director[]
  members: Member[]
  significantControllers: Controller[]
  designatedReps: DesignatedRep[]
  documents: { id: string; name: string; documentType: string; createdAt: string; notes: string | null; effectiveDate: string | null }[]
  fileCases: FileCase[]
}

type ModalState =
  | { type: 'company'; mode: 'edit'; data: Company }
  | { type: 'director'; mode: 'add' }
  | { type: 'director'; mode: 'edit'; data: Director }
  | { type: 'member'; mode: 'add' }
  | { type: 'member'; mode: 'edit'; data: Member }
  | { type: 'controller'; mode: 'add' }
  | { type: 'controller'; mode: 'edit'; data: Controller }
  | { type: 'designatedRep'; mode: 'add' }
  | { type: 'designatedRep'; mode: 'edit'; data: DesignatedRep }
  | null

// ── Styles ───────────────────────────────────────────────────────────────────

const REGISTER_DOCS = {
  directors: { type: 'ROD', label: 'Register of Directors', ext: 'DOCX' },
  members: { type: 'ROM', label: 'Register of Members', ext: 'DOCX' },
  controllers: { type: 'ROSC', label: 'Register of Significant Controllers', ext: 'DOCX' },
} as const

const STATUS_COLOR: Record<string, string> = {
  ACTIVE:       'bg-[rgba(16,185,129,0.12)] text-[#10b981]',
  INACTIVE:     'bg-[rgba(120,113,108,0.15)] text-[#9A8060]',
  DEREGISTERED: 'bg-[rgba(239,68,68,0.12)] text-[#ef4444]',
}

const cardStyle: React.CSSProperties = { background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '0.5rem', overflow: 'hidden' }
const thStyle: React.CSSProperties = { textAlign: 'left', padding: '0.75rem 1rem', fontWeight: 500, fontSize: '0.875rem', color: 'var(--muted-foreground)', background: '#1A1A12', borderBottom: '1px solid #2A2418' }
const tdStyle: React.CSSProperties = { padding: '0.75rem 1rem', color: 'var(--muted-foreground)', fontSize: '0.875rem' }
const tdPrimaryStyle: React.CSSProperties = { ...tdStyle, color: 'var(--foreground)', fontWeight: 500 }
const fieldStyle: React.CSSProperties = { width: '100%', background: '#0A0A0A', border: '1px solid #2A2418', color: '#F0EAD8', borderRadius: '0.375rem', padding: '0.5rem 0.75rem', fontSize: '0.875rem', outline: 'none' }
const labelStyle: React.CSSProperties = { display: 'block', fontSize: '0.75rem', fontWeight: 500, color: '#7A7060', marginBottom: '0.375rem' }

// ── Helper ───────────────────────────────────────────────────────────────────

function fmt(d: string | null | undefined) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-HK')
}

function DateInput({ value, onChange, required, disabled }: {
  value: string
  onChange: (v: string) => void
  required?: boolean
  disabled?: boolean
}) {
  return (
    <DatePickerPopover
      value={value}
      onChange={onChange}
      required={required}
      disabled={disabled}
      style={{ ...fieldStyle, colorScheme: 'dark' }}
    />
  )
}

type DocEntry = { id: string; name: string; createdAt: string; notes: string | null; effectiveDate: string | null }

function YearGroupedDocs({
  docs,
  onPreview,
  onDelete,
}: {
  docs: DocEntry[]
  onPreview: (id: string) => void
  onDelete: (id: string) => void
}) {
  const currentYear = String(new Date().getFullYear())
  const [openYears, setOpenYears] = useState<Set<string>>(() => new Set([currentYear]))

  const groups = docs.reduce<Record<string, DocEntry[]>>((acc, doc) => {
    const year = doc.effectiveDate
      ? String(new Date(doc.effectiveDate).getFullYear())
      : doc.notes?.match(/\d{4}/)?.[0] ?? 'Unknown'
    ;(acc[year] ??= []).push(doc)
    return acc
  }, {})

  const years = Object.keys(groups).sort((a, b) => Number(b) - Number(a))

  if (years.length === 0)
    return <p className="px-4 py-3 text-sm" style={{ color: '#5A5040' }}>No files uploaded yet.</p>

  return (
    <>
      {years.map(year => {
        const open = openYears.has(year)
        return (
          <div key={year} style={{ borderTop: '1px solid #2A2418' }}>
            <button
              type="button"
              className="flex w-full items-center justify-between px-4 py-2.5 text-sm"
              style={{ color: 'var(--foreground)', background: 'transparent' }}
              onClick={() => setOpenYears(prev => {
                const next = new Set(prev)
                open ? next.delete(year) : next.add(year)
                return next
              })}
            >
              <span className="font-medium">{year}</span>
              <span style={{ color: '#5A5040', fontSize: '0.75rem' }}>{open ? '▲' : '▼'} {groups[year].length} file{groups[year].length !== 1 ? 's' : ''}</span>
            </button>
            {open && (
              <ul className="divide-y divide-[#2A2418]">
                {groups[year].map(doc => (
                  <li key={doc.id} className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-sm truncate max-w-xs" style={{ color: 'var(--foreground)' }}>{doc.name}</span>
                    <div className="flex items-center gap-2 shrink-0 ml-3">
                      <span className="text-xs" style={{ color: '#5A5040' }}>{new Date(doc.createdAt).toLocaleDateString('en-HK')}</span>
                      <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => onPreview(doc.id)}>Preview</Button>
                      <Button size="sm" variant="outline" className="h-7 px-2 text-xs" style={{ color: '#ef4444', borderColor: '#ef4444' }} onClick={() => onDelete(doc.id)}>Delete</Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )
      })}
    </>
  )
}

// ── Company Edit Form ─────────────────────────────────────────────────────────

function CompanyEditForm({ company, onDone }: { company: Company; onDone: () => void }) {
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    nameEn: company.nameEn,
    nameZh: company.nameZh ?? '',
    companyNumber: company.companyNumber ?? '',
    dateOfIncorporation: company.dateOfIncorporation ? company.dateOfIncorporation.slice(0, 10) : '',
    registeredAddress: company.registeredAddress ?? '',
    businessNature: company.businessNature ?? '',
    status: company.status,
    serviceTier: '',
  })

  function set(k: string, v: string) { setForm(f => ({ ...f, [k]: v })) }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const body: Record<string, unknown> = { nameEn: form.nameEn, status: form.status }
      if (form.nameZh) body.nameZh = form.nameZh
      if (form.companyNumber) body.companyNumber = form.companyNumber
      if (form.dateOfIncorporation) body.dateOfIncorporation = new Date(form.dateOfIncorporation).toISOString()
      if (form.registeredAddress) body.registeredAddress = form.registeredAddress
      if (form.businessNature) body.businessNature = form.businessNature
      if (form.serviceTier) body.serviceTier = form.serviceTier

      const res = await fetch(`/api/admin/companies/${company.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) { toast.error('Failed to save'); return }
      toast.success('Company updated')
      onDone()
    } finally { setSaving(false) }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label style={labelStyle}>Company Name (English) *</label>
          <Input style={fieldStyle} required value={form.nameEn} onChange={e => set('nameEn', e.target.value)} />
        </div>
        <div>
          <label style={labelStyle}>Company Name (Chinese)</label>
          <Input style={fieldStyle} value={form.nameZh} onChange={e => set('nameZh', e.target.value)} />
        </div>
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label style={labelStyle}>Company Number</label>
          <Input style={fieldStyle} value={form.companyNumber} onChange={e => set('companyNumber', e.target.value)} placeholder="e.g. 1234567" />
        </div>
        <div>
          <label style={labelStyle}>Date of Incorporation</label>
          <DateInput value={form.dateOfIncorporation} onChange={v => set('dateOfIncorporation', v)} />
        </div>
      </div>
      <div>
        <label style={labelStyle}>Registered Address</label>
        <textarea value={form.registeredAddress} onChange={e => set('registeredAddress', e.target.value)} rows={2} maxLength={500} style={fieldStyle} />
      </div>
      <div>
        <label style={labelStyle}>Business Nature</label>
        <Input style={fieldStyle} value={form.businessNature} onChange={e => set('businessNature', e.target.value)} />
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label style={labelStyle}>Status</label>
          <select value={form.status} onChange={e => set('status', e.target.value)} style={fieldStyle}>
            <option value="ACTIVE" style={{ background: '#141414' }}>Active</option>
            <option value="DORMANT" style={{ background: '#141414' }}>Dormant</option>
            <option value="STRUCK_OFF" style={{ background: '#141414' }}>Struck Off</option>
            <option value="DEREGISTERED" style={{ background: '#141414' }}>Deregistered</option>
          </select>
        </div>
        <div>
          <label style={labelStyle}>Service Tier</label>
          <select value={form.serviceTier} onChange={e => set('serviceTier', e.target.value)} style={fieldStyle}>
            <option value="" style={{ background: '#141414' }}>— Unchanged —</option>
            <option value="BASIC" style={{ background: '#141414' }}>Basic</option>
            <option value="PROFESSIONAL" style={{ background: '#141414' }}>Professional</option>
            <option value="PREMIUM" style={{ background: '#141414' }}>Premium</option>
          </select>
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="outline" size="sm" onClick={onDone} disabled={saving}>Cancel</Button>
        <Button type="submit" size="sm" disabled={saving}>{saving ? 'Saving…' : 'Save Changes'}</Button>
      </div>
    </form>
  )
}

// ── KYC Picker ────────────────────────────────────────────────────────────────

function KycPicker({ persons, onSelect }: { persons: KycPerson[]; onSelect: (p: KycPerson) => void }) {
  const [value, setValue] = useState('')

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const id = e.target.value
    setValue(id)
    const person = persons.find(p => p.id === id)
    if (person) onSelect(person)
  }

  if (persons.length === 0) return null

  return (
    <div className="rounded-lg p-3 mb-1" style={{ background: '#0D0D08', border: '1px solid #2A2418' }}>
      <label style={{ ...labelStyle, color: '#C9A96E' }}>Pre-fill from KYC person</label>
      <select value={value} onChange={handleChange} style={fieldStyle}>
        <option value="" style={{ background: '#141414' }}>— Select a KYC person —</option>
        {persons.map(p => (
          <option key={p.id} value={p.id} style={{ background: '#141414' }}>
            {p.nameEn}{p.nameZh ? ` (${p.nameZh})` : ''} · {p.kycStatus}
          </option>
        ))}
      </select>
    </div>
  )
}

// ── Director Form ─────────────────────────────────────────────────────────────

function DirectorForm({ companyId, initial, kycPersons, onDone }: {
  companyId: string
  initial?: Director
  kycPersons: KycPerson[]
  onDone: () => void
}) {
  const isEdit = !!initial
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [form, setForm] = useState({
    nameEn: initial?.nameEn ?? '',
    nameZh: initial?.nameZh ?? '',
    dateOfAppointment: initial?.dateOfAppointment ? initial.dateOfAppointment.slice(0, 10) : '',
    dateOfCessation: initial?.dateOfCessation ? initial.dateOfCessation.slice(0, 10) : '',
    addressForService: initial?.addressForService ?? '',
    nationality: initial?.nationality ?? '',
    idType: initial?.idType ?? '',
    idNumber: initial?.idNumber ?? '',
    status: initial?.status ?? 'ACTIVE',
  })

  function set(k: string, v: string) {
    setForm(f => ({ ...f, [k]: v }))
    setErrors(prev => {
      if (!prev[k]) return prev
      const next = { ...prev }
      delete next[k]
      return next
    })
  }

  function validateRequiredFields() {
    const nextErrors: Record<string, string> = {}
    if (!form.nameEn.trim()) nextErrors.nameEn = 'Please enter the director English name.'
    if (!form.dateOfAppointment.trim()) nextErrors.dateOfAppointment = 'Please select the appointment date.'
    if (!form.addressForService.trim()) nextErrors.addressForService = 'Please enter the address for service.'
    setErrors(nextErrors)
    return nextErrors
  }

  function prefillFromKyc(p: KycPerson) {
    setForm(f => ({
      ...f,
      nameEn: p.nameEn,
      nameZh: p.nameZh ?? f.nameZh,
      nationality: p.nationality ?? f.nationality,
      idType: p.idType ?? f.idType,
      idNumber: p.idNumber ?? f.idNumber,
      addressForService: p.contactAddress ?? p.homeAddress ?? f.addressForService,
    }))
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const nextErrors = validateRequiredFields()
    if (Object.keys(nextErrors).length > 0) {
      toast.error(Object.values(nextErrors)[0])
      return
    }

    setSaving(true)
    try {
      const body: Record<string, unknown> = {
        nameEn: form.nameEn,
        addressForService: form.addressForService,
        status: form.status,
      }
      if (form.nameZh) body.nameZh = form.nameZh
      if (form.dateOfAppointment) body.dateOfAppointment = new Date(form.dateOfAppointment).toISOString()
      if (form.dateOfCessation) body.dateOfCessation = new Date(form.dateOfCessation).toISOString()
      else if (isEdit) body.dateOfCessation = null
      if (form.nationality) body.nationality = form.nationality
      if (form.idType) body.idType = form.idType
      if (form.idNumber) body.idNumber = form.idNumber

      const url = isEdit
        ? `/api/admin/companies/${companyId}/directors/${initial!.id}`
        : `/api/admin/companies/${companyId}/directors`
      const method = isEdit ? 'PATCH' : 'POST'
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast.error(typeof data?.error === 'string' && data.error !== 'Invalid input' ? data.error : 'Please check the required director fields.')
        return
      }
      toast.success(isEdit ? 'Director updated' : 'Director added')
      onDone()
    } finally { setSaving(false) }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {!isEdit && <KycPicker persons={kycPersons} onSelect={prefillFromKyc} />}
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label style={labelStyle}>Name (English) *</label>
          <Input style={fieldStyle} required value={form.nameEn} onChange={e => set('nameEn', e.target.value)} />
          {errors.nameEn ? <p className="text-xs mt-1" style={{ color: '#f59e0b' }}>{errors.nameEn}</p> : null}
        </div>
        <div>
          <label style={labelStyle}>Name (Chinese)</label>
          <Input style={fieldStyle} value={form.nameZh} onChange={e => set('nameZh', e.target.value)} />
        </div>
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label style={labelStyle}>Date of Appointment *</label>
          <DateInput value={form.dateOfAppointment} onChange={v => set('dateOfAppointment', v)} required />
          {errors.dateOfAppointment ? <p className="text-xs mt-1" style={{ color: '#f59e0b' }}>{errors.dateOfAppointment}</p> : null}
        </div>
        <div>
          <label style={labelStyle}>Date of Cessation</label>
          <DateInput value={form.dateOfCessation} onChange={v => set('dateOfCessation', v)} />
        </div>
      </div>
      <div>
        <label style={labelStyle}>Address for Service *</label>
        <Input style={fieldStyle} required value={form.addressForService} onChange={e => set('addressForService', e.target.value)} />
        {errors.addressForService ? <p className="text-xs mt-1" style={{ color: '#f59e0b' }}>{errors.addressForService}</p> : null}
      </div>
      <div className="grid sm:grid-cols-3 gap-4">
        <div>
          <label style={labelStyle}>Nationality</label>
          <Input style={fieldStyle} value={form.nationality} onChange={e => set('nationality', e.target.value)} placeholder="e.g. Chinese" />
        </div>
        <div>
          <label style={labelStyle}>ID Type</label>
          <select value={form.idType} onChange={e => set('idType', e.target.value)} style={fieldStyle}>
            <option value="" style={{ background: '#141414' }}>— None —</option>
            <option value="HKID" style={{ background: '#141414' }}>HKID</option>
            <option value="PASSPORT" style={{ background: '#141414' }}>Passport</option>
            <option value="OTHER" style={{ background: '#141414' }}>Other</option>
          </select>
        </div>
        <div>
          <label style={labelStyle}>ID / Passport No.</label>
          <Input style={fieldStyle} value={form.idNumber} onChange={e => set('idNumber', e.target.value)} />
        </div>
      </div>
      <div>
        <label style={labelStyle}>Status</label>
        <select value={form.status} onChange={e => set('status', e.target.value)} style={fieldStyle}>
          <option value="ACTIVE" style={{ background: '#141414' }}>Active</option>
          <option value="CEASED" style={{ background: '#141414' }}>Ceased</option>
        </select>
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="outline" size="sm" onClick={onDone} disabled={saving}>Cancel</Button>
        <Button type="submit" size="sm" disabled={saving}>{saving ? 'Saving…' : isEdit ? 'Update' : 'Add Director'}</Button>
      </div>
    </form>
  )
}

// ── Member Form ───────────────────────────────────────────────────────────────

const TX_EMPTY = {
  transactionType: 'ALLOTMENT',
  transactionDate: new Date().toISOString().slice(0, 10),
  allotmentTransferNo: '',
  certificateNo: '',
  sharesAcquired: '',
  distinctiveNosFrom: '',
  distinctiveNosTo: '',
  amountPaid: '',
  sharesTransferred: '',
  certificateSurrendered: '',
  certificateSurrenderedShares: '',
  balanceCertificateNo: '',
  balanceCertificateShares: '',
  balanceDistinctiveNosFrom: '',
  balanceDistinctiveNosTo: '',
  sharesHeld: '',
}

function MemberForm({ companyId, initial, kycPersons, onDone }: {
  companyId: string
  initial?: Member
  kycPersons: KycPerson[]
  onDone: () => void
}) {
  const isEdit = !!initial
  const [saving, setSaving] = useState(false)
  const [addTx, setAddTx] = useState(!isEdit)
  const [form, setForm] = useState({
    nameEn: initial?.nameEn ?? '',
    nameZh: initial?.nameZh ?? '',
    shareClass: initial?.shareClass ?? 'ORDINARY',
    registeredAddress: initial?.registeredAddress ?? '',
    occupation: initial?.occupation ?? '',
    status: initial?.status ?? 'ACTIVE',
  })
  const [tx, setTx] = useState(TX_EMPTY)

  function set(k: string, v: string) { setForm(f => ({ ...f, [k]: v })) }
  function setT(k: string, v: string) { setTx(t => ({ ...t, [k]: v })) }

  function prefillFromKyc(p: KycPerson) {
    setForm(f => ({
      ...f,
      nameEn: p.nameEn,
      nameZh: p.nameZh ?? f.nameZh,
      registeredAddress: p.homeAddress ?? p.contactAddress ?? f.registeredAddress,
    }))
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const body: Record<string, unknown> = {
        nameEn: form.nameEn,
        shareClass: form.shareClass,
        registeredAddress: form.registeredAddress,
        status: form.status,
      }
      if (form.nameZh) body.nameZh = form.nameZh
      if (form.occupation) body.occupation = form.occupation

      if (!isEdit && addTx && tx.sharesHeld !== '') {
        const t: Record<string, unknown> = {
          transactionType: tx.transactionType,
          transactionDate: tx.transactionDate,
          sharesHeld: Number(tx.sharesHeld),
        }
        if (tx.allotmentTransferNo) t.allotmentTransferNo = tx.allotmentTransferNo
        if (tx.certificateNo) t.certificateNo = tx.certificateNo
        if (tx.sharesAcquired !== '') t.sharesAcquired = Number(tx.sharesAcquired)
        if (tx.distinctiveNosFrom !== '') t.distinctiveNosFrom = Number(tx.distinctiveNosFrom)
        if (tx.distinctiveNosTo !== '') t.distinctiveNosTo = Number(tx.distinctiveNosTo)
        if (tx.amountPaid) t.amountPaid = tx.amountPaid
        if (tx.sharesTransferred !== '') t.sharesTransferred = Number(tx.sharesTransferred)
        if (tx.certificateSurrendered) t.certificateSurrendered = tx.certificateSurrendered
        if (tx.certificateSurrenderedShares !== '') t.certificateSurrenderedShares = Number(tx.certificateSurrenderedShares)
        if (tx.balanceCertificateNo) t.balanceCertificateNo = tx.balanceCertificateNo
        if (tx.balanceCertificateShares !== '') t.balanceCertificateShares = Number(tx.balanceCertificateShares)
        if (tx.balanceDistinctiveNosFrom !== '') t.balanceDistinctiveNosFrom = Number(tx.balanceDistinctiveNosFrom)
        if (tx.balanceDistinctiveNosTo !== '') t.balanceDistinctiveNosTo = Number(tx.balanceDistinctiveNosTo)
        body.transaction = t
      }

      const url = isEdit
        ? `/api/admin/companies/${companyId}/members/${initial!.id}`
        : `/api/admin/companies/${companyId}/members`
      const method = isEdit ? 'PATCH' : 'POST'
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      if (!res.ok) { toast.error('Failed to save member'); return }
      toast.success(isEdit ? 'Member updated' : 'Member added')
      onDone()
    } finally { setSaving(false) }
  }

  const divider = <div style={{ borderTop: '1px solid #2A2418', margin: '4px 0' }} />
  const sectionLabel = (t: string) => (
    <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#C9A96E', margin: '4px 0 8px' }}>{t}</p>
  )

  return (
    <form onSubmit={submit} className="space-y-4">
      {!isEdit && <KycPicker persons={kycPersons} onSelect={prefillFromKyc} />}

      {/* Member details */}
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label style={labelStyle}>Name (English) *</label>
          <Input style={fieldStyle} required value={form.nameEn} onChange={e => set('nameEn', e.target.value)} />
        </div>
        <div>
          <label style={labelStyle}>Name (Chinese)</label>
          <Input style={fieldStyle} value={form.nameZh} onChange={e => set('nameZh', e.target.value)} />
        </div>
      </div>
      <div>
        <label style={labelStyle}>Registered Address *</label>
        <textarea required rows={2} maxLength={500} value={form.registeredAddress} onChange={e => set('registeredAddress', e.target.value)} style={fieldStyle} />
      </div>
      <div className="grid sm:grid-cols-3 gap-4">
        <div>
          <label style={labelStyle}>Share Class *</label>
          <select value={form.shareClass} onChange={e => set('shareClass', e.target.value)} style={fieldStyle}>
            <option value="ORDINARY" style={{ background: '#141414' }}>Ordinary</option>
            <option value="PREFERENCE" style={{ background: '#141414' }}>Preference</option>
            <option value="OTHER" style={{ background: '#141414' }}>Other</option>
          </select>
        </div>
        <div>
          <label style={labelStyle}>Occupation</label>
          <Input style={fieldStyle} value={form.occupation} onChange={e => set('occupation', e.target.value)} />
        </div>
        <div>
          <label style={labelStyle}>Status</label>
          <select value={form.status} onChange={e => set('status', e.target.value)} style={fieldStyle}>
            <option value="ACTIVE" style={{ background: '#141414' }}>Active</option>
            <option value="TRANSFERRED_OUT" style={{ background: '#141414' }}>Transferred Out</option>
          </select>
        </div>
      </div>

      {/* Share transaction (add mode only) */}
      {!isEdit && (
        <>
          {divider}
          <div className="flex items-center gap-3">
            <input type="checkbox" id="addTx" checked={addTx} onChange={e => setAddTx(e.target.checked)}
              style={{ accentColor: '#C9A96E', width: 14, height: 14 }} />
            <label htmlFor="addTx" style={{ ...labelStyle, marginBottom: 0, cursor: 'pointer' }}>Add initial share transaction</label>
          </div>
        </>
      )}

      {!isEdit && addTx && (
        <div className="rounded-lg p-4 space-y-3" style={{ background: '#0A0A06', border: '1px solid #2A2418' }}>
          {sectionLabel('Transaction details')}
          <div className="grid sm:grid-cols-3 gap-3">
            <div>
              <label style={labelStyle}>Transaction Type *</label>
              <select value={tx.transactionType} onChange={e => setT('transactionType', e.target.value)} style={fieldStyle}>
                <option value="ALLOTMENT" style={{ background: '#141414' }}>Allotment</option>
                <option value="TRANSFER_IN" style={{ background: '#141414' }}>Transfer In</option>
                <option value="TRANSFER_OUT" style={{ background: '#141414' }}>Transfer Out</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Date *</label>
              <DateInput value={tx.transactionDate} onChange={v => setT('transactionDate', v)} />
            </div>
            <div>
              <label style={labelStyle}>Allotment / Transfer No.</label>
              <Input style={fieldStyle} value={tx.allotmentTransferNo} onChange={e => setT('allotmentTransferNo', e.target.value)} placeholder="e.g. 1" />
            </div>
          </div>

          {sectionLabel('Shares acquired')}
          <div className="grid sm:grid-cols-3 gap-3">
            <div>
              <label style={labelStyle}>Share Certificate No.</label>
              <Input style={fieldStyle} value={tx.certificateNo} onChange={e => setT('certificateNo', e.target.value)} placeholder="e.g. 1" />
            </div>
            <div>
              <label style={labelStyle}>No. of Shares Acquired</label>
              <Input type="number" min="0" style={fieldStyle} value={tx.sharesAcquired} onChange={e => setT('sharesAcquired', e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Amount Paid (HK$)</label>
              <Input type="number" min="0" step="0.01" style={fieldStyle} value={tx.amountPaid} onChange={e => setT('amountPaid', e.target.value)} placeholder="e.g. 10000" />
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label style={labelStyle}>Distinctive Nos. From</label>
              <Input type="number" min="0" style={fieldStyle} value={tx.distinctiveNosFrom} onChange={e => setT('distinctiveNosFrom', e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Distinctive Nos. To</label>
              <Input type="number" min="0" style={fieldStyle} value={tx.distinctiveNosTo} onChange={e => setT('distinctiveNosTo', e.target.value)} />
            </div>
          </div>

          {sectionLabel('Shares transferred (if applicable)')}
          <div className="grid sm:grid-cols-3 gap-3">
            <div>
              <label style={labelStyle}>No. of Shares Transferred</label>
              <Input type="number" min="0" style={fieldStyle} value={tx.sharesTransferred} onChange={e => setT('sharesTransferred', e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Cert. Surrendered — Cert No.</label>
              <Input style={fieldStyle} value={tx.certificateSurrendered} onChange={e => setT('certificateSurrendered', e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Cert. Surrendered — No. of Shares</label>
              <Input type="number" min="0" style={fieldStyle} value={tx.certificateSurrenderedShares} onChange={e => setT('certificateSurrenderedShares', e.target.value)} />
            </div>
          </div>

          {sectionLabel('Balance certificate')}
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label style={labelStyle}>Balance Cert. No.</label>
              <Input style={fieldStyle} value={tx.balanceCertificateNo} onChange={e => setT('balanceCertificateNo', e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Balance Cert. No. of Shares</label>
              <Input type="number" min="0" style={fieldStyle} value={tx.balanceCertificateShares} onChange={e => setT('balanceCertificateShares', e.target.value)} />
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label style={labelStyle}>Balance Distinctive Nos. From</label>
              <Input type="number" min="0" style={fieldStyle} value={tx.balanceDistinctiveNosFrom} onChange={e => setT('balanceDistinctiveNosFrom', e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Balance Distinctive Nos. To</label>
              <Input type="number" min="0" style={fieldStyle} value={tx.balanceDistinctiveNosTo} onChange={e => setT('balanceDistinctiveNosTo', e.target.value)} />
            </div>
          </div>

          {divider}
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label style={{ ...labelStyle, color: '#C9A96E' }}>Shares Held (Net Balance) *</label>
              <Input type="number" min="0" required={addTx} style={{ ...fieldStyle, borderColor: '#C9A96E' }}
                value={tx.sharesHeld} onChange={e => setT('sharesHeld', e.target.value)} placeholder="e.g. 10000" />
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="outline" size="sm" onClick={onDone} disabled={saving}>Cancel</Button>
        <Button type="submit" size="sm" disabled={saving}>{saving ? 'Saving…' : isEdit ? 'Update' : 'Add Member'}</Button>
      </div>
    </form>
  )
}

// ── Controller Form ───────────────────────────────────────────────────────────

function ControllerForm({ companyId, initial, kycPersons, onDone }: {
  companyId: string
  initial?: Controller
  kycPersons: KycPerson[]
  onDone: () => void
}) {
  const isEdit = !!initial
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    nameEn: initial?.nameEn ?? '',
    nameZh: initial?.nameZh ?? '',
    entryDate: initial?.entryDate ? initial.entryDate.slice(0, 10) : new Date().toISOString().slice(0, 10),
    becomingDate: initial?.becomingDate ? initial.becomingDate.slice(0, 10) : new Date().toISOString().slice(0, 10),
    cessationDate: initial?.cessationDate ? initial.cessationDate.slice(0, 10) : '',
    natureOfControl: initial?.natureOfControl ?? '',
    correspondenceAddress: initial?.correspondenceAddress ?? '',
    isLegalEntity: initial?.isLegalEntity ? 'true' : 'false',
    idType: initial?.idType ?? 'PASSPORT',
    idPassportNo: initial?.idPassportNo ?? '',
    issuingCountry: initial?.issuingCountry ?? '',
    legalEntityRegNo: '',
    legalEntityGovLaw: '',
    remarks: initial?.remarks ?? '',
  })

  function set(k: string, v: string) { setForm(f => ({ ...f, [k]: v })) }

  function prefillFromKyc(p: KycPerson) {
    setForm(f => ({
      ...f,
      nameEn: p.nameEn,
      nameZh: p.nameZh ?? f.nameZh,
      idType: p.idType ? (p.idType === 'HKID' ? 'HKID' : p.idType === 'PASSPORT' ? 'PASSPORT' : 'OTHER') : f.idType,
      idPassportNo: p.idNumber ?? f.idPassportNo,
      issuingCountry: p.placeOfIssue ?? p.nationality ?? f.issuingCountry,
      correspondenceAddress: p.contactAddress ?? p.homeAddress ?? f.correspondenceAddress,
    }))
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const isLegal = form.isLegalEntity === 'true'
      const body: Record<string, unknown> = {
        nameEn: form.nameEn,
        entryDate: new Date(form.entryDate).toISOString(),
        becomingDate: new Date(form.becomingDate).toISOString(),
        isLegalEntity: isLegal,
      }
      if (form.nameZh) body.nameZh = form.nameZh
      if (form.cessationDate) body.cessationDate = new Date(form.cessationDate).toISOString()
      else if (isEdit) body.cessationDate = null
      if (form.natureOfControl) body.natureOfControl = form.natureOfControl
      if (form.correspondenceAddress) body.correspondenceAddress = form.correspondenceAddress
      if (form.remarks) body.remarks = form.remarks
      if (isLegal) {
        if (form.legalEntityRegNo) body.legalEntityRegNo = form.legalEntityRegNo
        if (form.legalEntityGovLaw) body.legalEntityGovLaw = form.legalEntityGovLaw
      } else {
        body.idType = form.idType || null
        if (form.idPassportNo) body.idPassportNo = form.idPassportNo
        if (form.idType !== 'HKID' && form.issuingCountry) body.issuingCountry = form.issuingCountry
      }

      const url = isEdit
        ? `/api/admin/companies/${companyId}/controllers/${initial!.id}`
        : `/api/admin/companies/${companyId}/controllers`
      const method = isEdit ? 'PATCH' : 'POST'
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      if (!res.ok) { toast.error('Failed to save controller'); return }
      toast.success(isEdit ? 'Controller updated' : 'Controller added')
      onDone()
    } finally { setSaving(false) }
  }

  const isLegal = form.isLegalEntity === 'true'

  return (
    <form onSubmit={submit} className="space-y-4">
      {!isEdit && <KycPicker persons={kycPersons} onSelect={prefillFromKyc} />}

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label style={labelStyle}>Name (English) *</label>
          <Input style={fieldStyle} required value={form.nameEn} onChange={e => set('nameEn', e.target.value)} />
        </div>
        <div>
          <label style={labelStyle}>Name (Chinese)</label>
          <Input style={fieldStyle} value={form.nameZh} onChange={e => set('nameZh', e.target.value)} />
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label style={labelStyle}>Entry Date *</label>
          <DateInput value={form.entryDate} onChange={v => set('entryDate', v)} required />
        </div>
        <div>
          <label style={labelStyle}>Becoming Date *</label>
          <DateInput value={form.becomingDate} onChange={v => set('becomingDate', v)} required />
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label style={labelStyle}>Cessation Date</label>
          <DateInput value={form.cessationDate} onChange={v => set('cessationDate', v)} />
        </div>
        <div>
          <label style={labelStyle}>Nature of Control</label>
          <Input style={fieldStyle} value={form.natureOfControl} onChange={e => set('natureOfControl', e.target.value)} placeholder="e.g. 100% holding" />
        </div>
      </div>

      <div>
        <label style={labelStyle}>Correspondence Address</label>
        <textarea rows={2} maxLength={500} value={form.correspondenceAddress} onChange={e => set('correspondenceAddress', e.target.value)} style={fieldStyle} />
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label style={labelStyle}>Entity Type</label>
          <select value={form.isLegalEntity} onChange={e => set('isLegalEntity', e.target.value)} style={fieldStyle}>
            <option value="false" style={{ background: '#141414' }}>Individual (Natural Person)</option>
            <option value="true" style={{ background: '#141414' }}>Legal Entity</option>
          </select>
        </div>
        {!isLegal && (
          <div>
            <label style={labelStyle}>ID Type</label>
            <select value={form.idType} onChange={e => set('idType', e.target.value)} style={fieldStyle}>
              <option value="HKID" style={{ background: '#141414' }}>HKID</option>
              <option value="PASSPORT" style={{ background: '#141414' }}>Passport</option>
              <option value="OTHER" style={{ background: '#141414' }}>Other</option>
            </select>
          </div>
        )}
      </div>

      {!isLegal && (
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label style={labelStyle}>{form.idType === 'HKID' ? 'HKID Number' : form.idType === 'PASSPORT' ? 'Passport Number' : 'ID Number'}</label>
            <Input style={fieldStyle} value={form.idPassportNo} onChange={e => set('idPassportNo', e.target.value)} placeholder={form.idType === 'HKID' ? 'e.g. A123456(7)' : 'e.g. EM4226151'} />
          </div>
          {form.idType !== 'HKID' && (
            <div>
              <label style={labelStyle}>Issuing Country</label>
              <Input style={fieldStyle} value={form.issuingCountry} onChange={e => set('issuingCountry', e.target.value)} placeholder="e.g. China" />
            </div>
          )}
        </div>
      )}

      {isLegal && (
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label style={labelStyle}>Registration No.</label>
            <Input style={fieldStyle} value={form.legalEntityRegNo} onChange={e => set('legalEntityRegNo', e.target.value)} />
          </div>
          <div>
            <label style={labelStyle}>Place of Incorporation / Governing Law</label>
            <Input style={fieldStyle} value={form.legalEntityGovLaw} onChange={e => set('legalEntityGovLaw', e.target.value)} />
          </div>
        </div>
      )}

      <div>
        <label style={labelStyle}>Remarks</label>
        <Input style={fieldStyle} value={form.remarks} onChange={e => set('remarks', e.target.value)} />
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="outline" size="sm" onClick={onDone} disabled={saving}>Cancel</Button>
        <Button type="submit" size="sm" disabled={saving}>{saving ? 'Saving…' : isEdit ? 'Update' : 'Add Controller'}</Button>
      </div>
    </form>
  )
}

// ── Designated Rep Form ───────────────────────────────────────────────────────

function DesignatedRepForm({ companyId, initial, kycPersons, onDone }: {
  companyId: string
  initial?: DesignatedRep
  kycPersons: KycPerson[]
  onDone: () => void
}) {
  const isEdit = !!initial
  const [saving, setSaving] = useState(false)
  const today = new Date().toISOString().slice(0, 10)
  const [form, setForm] = useState({
    name: initial?.name ?? '',
    entryDate: initial?.entryDate ? initial.entryDate.slice(0, 10) : today,
    becomingDate: initial?.becomingDate ? initial.becomingDate.slice(0, 10) : today,
    cessationDate: initial?.cessationDate ? initial.cessationDate.slice(0, 10) : '',
    address: initial?.address ?? '',
    capacity: initial?.capacity ?? '',
    telFax: initial?.telFax ?? '',
    remarks: initial?.remarks ?? '',
  })

  function set(k: string, v: string) { setForm(f => ({ ...f, [k]: v })) }

  function prefillFromKyc(p: KycPerson) {
    const fullName = p.nameEn + (p.nameZh ? ' ' + p.nameZh : '')
    setForm(f => ({
      ...f,
      name: fullName,
      address: p.contactAddress ?? p.homeAddress ?? f.address,
    }))
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const body: Record<string, unknown> = {
        name: form.name,
        entryDate: new Date(form.entryDate).toISOString(),
        becomingDate: new Date(form.becomingDate).toISOString(),
      }
      if (form.cessationDate) body.cessationDate = new Date(form.cessationDate).toISOString()
      else if (isEdit) body.cessationDate = null
      if (form.address) body.address = form.address
      if (form.capacity) body.capacity = form.capacity
      if (form.telFax) body.telFax = form.telFax
      if (form.remarks) body.remarks = form.remarks

      const url = isEdit
        ? `/api/admin/companies/${companyId}/designated-reps/${initial!.id}`
        : `/api/admin/companies/${companyId}/designated-reps`
      const method = isEdit ? 'PATCH' : 'POST'
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      if (!res.ok) { toast.error('Failed to save designated representative'); return }
      toast.success(isEdit ? 'Updated' : 'Designated representative added')
      onDone()
    } finally { setSaving(false) }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {!isEdit && <KycPicker persons={kycPersons} onSelect={prefillFromKyc} />}
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label style={labelStyle}>Name *</label>
          <Input style={fieldStyle} required value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. LI Kaiwen 李楷文" />
        </div>
        <div>
          <label style={labelStyle}>Capacity</label>
          <Input style={fieldStyle} value={form.capacity} onChange={e => set('capacity', e.target.value)} placeholder="e.g. Director" />
        </div>
      </div>
      <div>
        <label style={labelStyle}>Address</label>
        <textarea rows={2} maxLength={500} value={form.address} onChange={e => set('address', e.target.value)} style={fieldStyle} />
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label style={labelStyle}>Entry Date *</label>
          <DateInput value={form.entryDate} onChange={v => set('entryDate', v)} required />
        </div>
        <div>
          <label style={labelStyle}>Becoming Date *</label>
          <DateInput value={form.becomingDate} onChange={v => set('becomingDate', v)} required />
        </div>
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label style={labelStyle}>Cessation Date</label>
          <DateInput value={form.cessationDate} onChange={v => set('cessationDate', v)} />
        </div>
        <div>
          <label style={labelStyle}>Tel / Fax No.</label>
          <Input style={fieldStyle} value={form.telFax} onChange={e => set('telFax', e.target.value)} placeholder="e.g. +852 2345 6789" />
        </div>
      </div>
      <div>
        <label style={labelStyle}>Remarks</label>
        <Input style={fieldStyle} value={form.remarks} onChange={e => set('remarks', e.target.value)} />
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="outline" size="sm" onClick={onDone} disabled={saving}>Cancel</Button>
        <Button type="submit" size="sm" disabled={saving}>{saving ? 'Saving…' : isEdit ? 'Update' : 'Add Rep'}</Button>
      </div>
    </form>
  )
}

// ── Modal overlay ─────────────────────────────────────────────────────────────

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }}>
      <div className="w-full max-w-2xl rounded-xl p-6 space-y-4 overflow-y-auto max-h-[90vh]" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold" style={{ color: 'var(--foreground)' }}>{title}</h2>
          <button onClick={onClose} className="text-xl leading-none" style={{ color: 'var(--muted-foreground)' }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function CompanyDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [company, setCompany] = useState<Company | null>(null)
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<ModalState>(null)
  const [kycPersons, setKycPersons] = useState<KycPerson[]>([])
  const [uploading, setUploading] = useState<string | null>(null)
  const [nar1Year, setNar1Year] = useState(String(new Date().getFullYear()))
  const [brYear, setBrYear] = useState(String(new Date().getFullYear()))
  const [generatingDdr, setGeneratingDdr] = useState(false)
  const [showOlderDdr, setShowOlderDdr] = useState(false)
  const ensuredDocsForRef = useRef<string | null>(null)

  // ── File Cases state ──────────────────────────────────────────────────────
  const [newCaseName, setNewCaseName] = useState('')
  const [creatingCase, setCreatingCase] = useState(false)
  const [caseEdits, setCaseEdits] = useState<Record<string, { name: string; caseDate: string; remark: string }>>({})
  const [docEdits, setDocEdits] = useState<Record<string, { customDocumentType: string; submissionDate: string; notes: string }>>({})
  const [uploadingCase, setUploadingCase] = useState<string | null>(null)
  // Per-case form for adding a supporting file (before upload)
  const [newSupForm, setNewSupForm] = useState<Record<string, {
    customDocumentType: string; isCustomType: boolean; notes: string; submissionDate: string
  }>>({})
  function getSupForm(caseId: string, pastDocTypes: string[]) {
    return newSupForm[caseId] ?? {
      customDocumentType: pastDocTypes[0] ?? '',
      isCustomType: pastDocTypes.length === 0,
      notes: '',
      submissionDate: '',
    }
  }

  const reload = useCallback(() => {
    fetch(`/api/admin/companies/${id}`)
      .then(r => r.json())
      .then(data => { setCompany(data?.error ? null : data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [id])

  useEffect(() => { reload() }, [reload])

  useEffect(() => {
    fetch('/api/admin/key-persons')
      .then(r => r.ok ? r.json() : [])
      .then(data => setKycPersons(Array.isArray(data) ? data : []))
      .catch(() => {})
  }, [])

  async function regenerateRegister(type: 'ROD' | 'ROM' | 'ROSC') {
    const res = await fetch('/api/docgen', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, companyId: id }),
    })
    if (res.ok) {
      toast.success(`${type} generated`)
      reload()
    } else {
      const err = await res.json().catch(() => ({}))
      toast.error(err.error ?? `${type} generation failed`)
    }
  }

  async function downloadDoc(docId: string) {
    const res = await fetch(`/api/documents/${docId}/download`)
    if (res.ok) { const { url } = await res.json(); window.open(url, '_blank') }
  }

  async function generateDdrNow() {
    setGeneratingDdr(true)
    try {
      const res = await fetch('/api/docgen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'DDR', companyId: id }),
      })
      if (res.ok) {
        toast.success('Due diligence report generated')
        reload()
      } else {
        const err = await res.json().catch(() => ({}))
        toast.error(err.error ?? 'Due diligence report generation failed')
      }
    } finally {
      setGeneratingDdr(false)
    }
  }

  async function deleteItem(type: 'directors' | 'members' | 'controllers' | 'designated-reps', itemId: string) {
    if (!window.confirm('Delete this record? This cannot be undone.')) return
    const res = await fetch(`/api/admin/companies/${id}/${type}/${itemId}`, { method: 'DELETE' })
    if (res.ok) {
      toast.success('Deleted')
      if (type === 'directors') await regenerateRegister('ROD')
      else if (type === 'members') await regenerateRegister('ROM')
      else await regenerateRegister('ROSC')
    }
    else toast.error('Failed to delete')
  }

  async function deleteCompany() {
    if (!window.confirm(`Permanently delete "${company?.nameEn}" and its company records? This cannot be undone.`)) return
    const res = await fetch(`/api/admin/companies/${id}`, { method: 'DELETE' })
    if (res.ok) { toast.success('Company deleted'); router.push('../../companies') }
    else {
      const data = await res.json().catch(() => ({}))
      toast.error(res.status === 403 ? 'Only Super Admins can delete companies' : (data?.error ?? 'Failed to delete'))
    }
  }

  async function uploadDoc(docType: string, file: File, opts: { year?: string; notes?: string } = {}) {
    setUploading(docType)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('type', docType)
      fd.append('companyId', id)
      if (opts.year) {
        fd.append('notes', `Year: ${opts.year}`)
        fd.append('effectiveDate', `${opts.year}-01-01`)
      } else if (opts.notes) {
        fd.append('notes', opts.notes)
      }
      const res = await fetch('/api/documents/upload', { method: 'POST', body: fd })
      if (res.ok) { toast.success('Uploaded'); reload() }
      else { const d = await res.json(); toast.error(d.error ?? 'Upload failed') }
    } finally { setUploading(null) }
  }

  async function deleteDoc(docId: string) {
    if (!window.confirm('Delete this document? This cannot be undone.')) return
    const res = await fetch(`/api/documents/${docId}`, { method: 'DELETE' })
    if (res.ok) { toast.success('Deleted'); reload() }
    else toast.error('Failed to delete')
  }

  function closeModal() {
    const completed = modal
    setModal(null)
    if (completed?.type === 'director') regenerateRegister('ROD')
    else if (completed?.type === 'member') regenerateRegister('ROM')
    else if (completed?.type === 'controller' || completed?.type === 'designatedRep') regenerateRegister('ROSC')
    else {
      ensuredDocsForRef.current = null
      reload()
    }
  }

  useEffect(() => {
    if (!company || ensuredDocsForRef.current === company.id) return
    ensuredDocsForRef.current = company.id
    fetch(`/api/admin/companies/${company.id}/documents/ensure`, { method: 'POST' })
      .then(r => {
        if (r.ok) reload()
      })
      .catch(() => {})
  }, [company, reload])

  const modalTitle = modal
    ? modal.type === 'company' ? 'Edit Company'
    : modal.type === 'designatedRep' ? `${modal.mode === 'add' ? 'Add' : 'Edit'} Designated Representative`
    : `${modal.mode === 'add' ? 'Add' : 'Edit'} ${modal.type === 'director' ? 'Director' : modal.type === 'member' ? 'Member' : 'Controller'}`
    : ''

  if (loading) return <div className="p-8" style={{ color: 'var(--muted-foreground)' }}>Loading...</div>
  if (!company) return <div className="p-8" style={{ color: '#ef4444' }}>Company not found</div>

  const isGeneratedDoc = (doc: Company['documents'][number]) => doc.name.startsWith(`${doc.documentType} —`)
  const latestDoc = (docType: string) => company.documents.find(d => d.documentType === docType && isGeneratedDoc(d))
  const annualReturnPrefill = latestDoc('NAR1')
  const ddrDocs = company.documents
    .filter(d => d.documentType === 'DDR' && isGeneratedDoc(d))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <button onClick={() => router.back()} className="text-sm mb-2 block transition-colors" style={{ color: 'var(--muted-foreground)' }}>
            ← Back
          </button>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>{company.nameEn}</h1>
          {company.nameZh && <p className="mt-0.5" style={{ color: 'var(--muted-foreground)' }}>{company.nameZh}</p>}
          <div className="flex flex-wrap items-center gap-3 mt-1">
            {company.companyCode && <span className="text-sm font-medium" style={{ color: '#C9A96E' }}>{company.companyCode}</span>}
            {company.companyNumber && <span className="text-sm" style={{ color: '#5A5040' }}>Co. No. {company.companyNumber}</span>}
            {company.companyType && (
              <span className="text-xs px-2 py-0.5 rounded" style={{ background: 'rgba(201,169,110,0.1)', color: '#C9A96E', border: '1px solid rgba(201,169,110,0.2)' }}>
                {company.companyType === 'HONG_KONG' ? 'Hong Kong' : company.companyType === 'BVI' ? 'BVI' : company.companyType === 'CAYMAN' ? 'Cayman' : company.companyType === 'MARSHALL' ? 'Marshall' : company.companyType}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${STATUS_COLOR[company.status] ?? 'bg-[rgba(120,113,108,0.15)] text-[#9A8060]'}`}>
            {company.status}
          </span>
          <Button size="sm" variant="outline" onClick={() => setModal({ type: 'company', mode: 'edit', data: company })}>
            Edit
          </Button>
          <Button size="sm" variant="outline" onClick={deleteCompany} style={{ color: '#ef4444', borderColor: '#ef4444' }}>
            Delete
          </Button>
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="people">
            People ({company.directors.length + company.members.length + company.significantControllers.length + company.designatedReps.length})
          </TabsTrigger>
          <TabsTrigger value="files">Other Case Files</TabsTrigger>
        </TabsList>

        {/* Overview */}
        <TabsContent value="overview" className="mt-4 space-y-4">
          <div style={{ ...cardStyle, overflow: 'visible' }} className="divide-y divide-[#2A2418]">
            {[
              ['Registered Address', company.registeredAddress ?? '—'],
              ['Date of Incorporation', company.dateOfIncorporation ? new Date(company.dateOfIncorporation).toLocaleDateString('en-HK') : '—'],
              ['Business Nature', company.businessNature ?? '—'],
              ['Annual Return Date', company.annualReturnDate ? new Date(company.annualReturnDate).toLocaleDateString('en-HK') : '—'],
            ].map(([label, value]) => (
              <div key={label} className="flex px-4 py-3">
                <span className="w-52 shrink-0 text-sm font-medium" style={{ color: 'var(--muted-foreground)' }}>{label}</span>
                <span className="text-sm" style={{ color: 'var(--foreground)' }}>{value}</span>
              </div>
            ))}
          </div>

          {/* Company statutory uploads */}
          {(['CI', 'AA'] as const).map(docType => {
            const labels = { CI: 'Certificate of Incorporation (CI)', AA: 'Articles of Association (AA)' }
            const label = labels[docType]
            const docs = company.documents.filter(d => d.documentType === docType && !isGeneratedDoc(d))
            return (
              <div key={docType} style={cardStyle}>
                <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid #2A2418' }}>
                  <span className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>{label}</span>
                  <label style={{ cursor: uploading === docType ? 'not-allowed' : 'pointer' }}>
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      className="hidden"
                      disabled={uploading === docType}
                      onChange={e => {
                        const file = e.target.files?.[0]
                        if (file) { uploadDoc(docType, file); e.target.value = '' }
                      }}
                    />
                    <span
                      className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1 text-xs font-medium transition-colors"
                      style={{ borderColor: '#2A2418', color: uploading === docType ? '#5A5040' : 'var(--foreground)', background: 'transparent', cursor: 'inherit' }}
                    >
                      {uploading === docType ? 'Uploading…' : `Upload ${docType}`}
                    </span>
                  </label>
                </div>
                {docs.length === 0 ? (
                  <p className="px-4 py-3 text-sm" style={{ color: '#5A5040' }}>No files uploaded yet.</p>
                ) : (
                  <ul className="divide-y divide-[#2A2418]">
                    {docs.map(doc => (
                      <li key={doc.id} className="flex items-center justify-between px-4 py-2.5">
                        <span className="text-sm truncate max-w-xs" style={{ color: 'var(--foreground)' }}>{doc.name}</span>
                        <div className="flex items-center gap-2 shrink-0 ml-3">
                          <span className="text-xs" style={{ color: '#5A5040' }}>{new Date(doc.createdAt).toLocaleDateString('en-HK')}</span>
                          <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => downloadDoc(doc.id)}>Preview</Button>
                          <Button size="sm" variant="outline" className="h-7 px-2 text-xs" style={{ color: '#ef4444', borderColor: '#ef4444' }} onClick={() => deleteDoc(doc.id)}>Delete</Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )
          })}

          {/* BR — year-tagged upload */}
          <div style={cardStyle}>
            <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between" style={{ borderBottom: '1px solid #2A2418' }}>
              <div>
                <span className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Business Registration Certificate (BR)</span>
                <p className="text-xs mt-1" style={{ color: '#5A5040' }}>Choose the year before uploading the yearly BR document.</p>
              </div>
              <div className="flex items-center gap-2">
                <select value={brYear} onChange={e => setBrYear(e.target.value)} style={{ ...fieldStyle, width: 120 }}>
                  {Array.from({ length: 12 }, (_, i) => String(new Date().getFullYear() + 2 - i)).map(year => (
                    <option key={year} value={year} style={{ background: '#141414' }}>{year}</option>
                  ))}
                </select>
                <label style={{ cursor: uploading === 'BR' ? 'not-allowed' : 'pointer' }}>
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    className="hidden"
                    disabled={uploading === 'BR'}
                    onChange={e => {
                      const file = e.target.files?.[0]
                      if (file) { uploadDoc('BR', file, { year: brYear }); e.target.value = '' }
                    }}
                  />
                  <span
                    className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1 text-xs font-medium transition-colors"
                    style={{ borderColor: '#2A2418', color: uploading === 'BR' ? '#5A5040' : 'var(--foreground)', background: 'transparent', cursor: 'inherit' }}
                  >
                    {uploading === 'BR' ? 'Uploading…' : `Upload BR ${brYear}`}
                  </span>
                </label>
              </div>
            </div>
            <YearGroupedDocs
              docs={company.documents.filter(d => d.documentType === 'BR' && !isGeneratedDoc(d))}
              onPreview={downloadDoc}
              onDelete={deleteDoc}
            />
          </div>

          {/* NAR1 — year-tagged upload */}
          <div style={cardStyle}>
            <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between" style={{ borderBottom: '1px solid #2A2418' }}>
              <div>
                <span className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Annual Return (NAR1)</span>
                <p className="text-xs mt-1" style={{ color: '#5A5040' }}>Choose the filing year before uploading the yearly NAR1 document.</p>
              </div>
              <div className="flex items-center gap-2">
                <select value={nar1Year} onChange={e => setNar1Year(e.target.value)} style={{ ...fieldStyle, width: 120 }}>
                  {Array.from({ length: 12 }, (_, i) => String(new Date().getFullYear() + 2 - i)).map(year => (
                    <option key={year} value={year} style={{ background: '#141414' }}>{year}</option>
                  ))}
                </select>
                <label style={{ cursor: uploading === 'NAR1' ? 'not-allowed' : 'pointer' }}>
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    className="hidden"
                    disabled={uploading === 'NAR1'}
                    onChange={e => {
                      const file = e.target.files?.[0]
                      if (file) { uploadDoc('NAR1', file, { year: nar1Year }); e.target.value = '' }
                    }}
                  />
                  <span
                    className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1 text-xs font-medium transition-colors"
                    style={{ borderColor: '#2A2418', color: uploading === 'NAR1' ? '#5A5040' : 'var(--foreground)', background: 'transparent', cursor: 'inherit' }}
                  >
                    {uploading === 'NAR1' ? 'Uploading…' : `Upload NAR1 ${nar1Year}`}
                  </span>
                </label>
              </div>
            </div>
            <YearGroupedDocs
              docs={company.documents.filter(d => d.documentType === 'NAR1' && !isGeneratedDoc(d))}
              onPreview={downloadDoc}
              onDelete={deleteDoc}
            />
          </div>

          <div style={cardStyle} className="p-4 space-y-3">
            <div>
              <h3 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Annual Return Pre-fill</h3>
              <p className="text-xs mt-1" style={{ color: '#5A5040' }}>
                {annualReturnPrefill ? `Latest prepared ${new Date(annualReturnPrefill.createdAt).toLocaleDateString('en-HK')}` : 'The pre-fill document will appear automatically when the annual return date is ready.'}
              </p>
            </div>
            {annualReturnPrefill ? (
              <Button size="sm" variant="outline" onClick={() => downloadDoc(annualReturnPrefill.id)}>
                Download
              </Button>
            ) : (
              <p className="text-sm" style={{ color: '#5A5040' }}>Not ready yet.</p>
            )}
          </div>

          <div style={cardStyle}>
            <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid #2A2418' }}>
              <div>
                <h3 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Due Diligence Report</h3>
                <p className="text-xs mt-1" style={{ color: '#5A5040' }}>Monthly reports are generated automatically on the first day of each month.</p>
              </div>
              <Button size="sm" variant="outline" disabled={generatingDdr} onClick={generateDdrNow}>
                {generatingDdr ? 'Generating...' : 'Generate now'}
              </Button>
            </div>
            {ddrDocs.length === 0 ? (
              <p className="px-4 py-3 text-sm" style={{ color: '#5A5040' }}>No due diligence reports yet.</p>
            ) : (
              <ul className="divide-y divide-[#2A2418]">
                {(showOlderDdr ? ddrDocs : ddrDocs.slice(0, 1)).map(doc => (
                  <li key={doc.id} className="flex items-center justify-between px-4 py-2.5">
                    <div className="min-w-0">
                      <span className="block text-sm truncate max-w-xs" style={{ color: 'var(--foreground)' }}>{doc.notes ?? 'Monthly report'}</span>
                      <span className="text-xs" style={{ color: '#5A5040' }}>{new Date(doc.createdAt).toLocaleDateString('en-HK')}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => downloadDoc(doc.id)}>Download</Button>
                      <button onClick={() => deleteDoc(doc.id)} className="text-xs hover:underline" style={{ color: '#ef4444' }}>Delete</button>
                    </div>
                  </li>
                ))}
                {ddrDocs.length > 1 && (
                  <li>
                    <button
                      type="button"
                      className="w-full px-4 py-2 text-xs text-left transition-colors hover:bg-[#1A1A12]"
                      style={{ color: '#5A5040' }}
                      onClick={() => setShowOlderDdr(v => !v)}
                    >
                      {showOlderDdr ? '▲ Hide older reports' : `▼ Show ${ddrDocs.length - 1} older report${ddrDocs.length - 1 !== 1 ? 's' : ''}`}
                    </button>
                  </li>
                )}
              </ul>
            )}
          </div>
        </TabsContent>

        {/* ── Files Tab ───────────────────────────────────────────────────── */}
        <TabsContent value="files" className="mt-4 space-y-4">
          {(() => {
            // All past case types and doc types for selects
            const pastCaseTypes = [...new Set((company.fileCases ?? []).map(c => c.name))]
            const pastDocTypes  = [...new Set(
              (company.fileCases ?? []).flatMap(c => c.documents.map(d => d.customDocumentType)).filter(Boolean) as string[]
            )]

            return (
              <>
                {/* ── Create new case ─────────────────────────────────────── */}
                <div style={cardStyle}>
                  <div className="px-4 py-3" style={{ borderBottom: '1px solid #2A2418' }}>
                    <span className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>New Case</span>
                    <p className="text-xs mt-0.5" style={{ color: '#5A5040' }}>Select an existing case type or enter a new one.</p>
                  </div>
                  <div className="px-4 py-3 flex flex-wrap items-end gap-3">
                    <div>
                      <label className="text-xs block mb-1" style={{ color: '#5A5040' }}>Case Type *</label>
                      <select
                        value={pastCaseTypes.includes(newCaseName) ? newCaseName : (newCaseName ? '__new__' : '')}
                        onChange={e => {
                          if (e.target.value === '__new__') setNewCaseName('')
                          else setNewCaseName(e.target.value)
                        }}
                        style={{ ...fieldStyle, width: 240 }}
                      >
                        <option value="" style={{ background: '#141414' }}>— Select case type —</option>
                        {pastCaseTypes.map(n => (
                          <option key={n} value={n} style={{ background: '#141414' }}>{n}</option>
                        ))}
                        <option value="__new__" style={{ background: '#141414' }}>— Enter new type… —</option>
                      </select>
                    </div>
                    {/* Show text input when "new type" chosen or no past types */}
                    {(pastCaseTypes.length === 0 || !pastCaseTypes.includes(newCaseName)) && (
                      <div>
                        <label className="text-xs block mb-1" style={{ color: '#5A5040' }}>New Case Type</label>
                        <input
                          value={pastCaseTypes.includes(newCaseName) ? '' : newCaseName}
                          onChange={e => setNewCaseName(e.target.value)}
                          placeholder="Type case type…"
                          maxLength={200}
                          style={{ ...fieldStyle, width: 220 }}
                        />
                      </div>
                    )}
                    <Button
                      size="sm"
                      disabled={creatingCase || !newCaseName.trim()}
                      onClick={async () => {
                        setCreatingCase(true)
                        try {
                          const res = await fetch(`/api/admin/companies/${id}/file-cases`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ name: newCaseName.trim() }),
                          })
                          if (!res.ok) { toast.error('Failed to create case'); return }
                          setNewCaseName('')
                          reload()
                        } finally {
                          setCreatingCase(false)
                        }
                      }}
                    >
                      {creatingCase ? 'Creating…' : '+ Create Case'}
                    </Button>
                  </div>
                </div>

                {/* ── Case list ────────────────────────────────────────────── */}
                {(company.fileCases ?? []).length === 0 ? (
                  <p className="px-1 text-sm" style={{ color: '#5A5040' }}>No file cases yet. Create one above.</p>
                ) : (
                  (company.fileCases ?? []).map(fc => {
                    const edit = caseEdits[fc.id] ?? {
                      name: fc.name,
                      caseDate: fc.caseDate ? fc.caseDate.slice(0, 10) : '',
                      remark: fc.remark ?? '',
                    }
                    const mainFile  = fc.documents.find(d => d.caseFileRole === 'main')
                    const supporting = fc.documents.filter(d => d.caseFileRole !== 'main')
                    const sf = getSupForm(fc.id, pastDocTypes)

                    async function saveCase() {
                      const res = await fetch(`/api/admin/companies/${id}/file-cases/${fc.id}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ name: edit.name, caseDate: edit.caseDate || null, remark: edit.remark || null }),
                      })
                      if (!res.ok) { toast.error('Failed to save'); return }
                      toast.success('Case updated')
                      setCaseEdits(p => { const n = { ...p }; delete n[fc.id]; return n })
                      reload()
                    }

                    async function deleteCase() {
                      if (!confirm(`Delete case "${fc.name}" and all its files?`)) return
                      const res = await fetch(`/api/admin/companies/${id}/file-cases/${fc.id}`, { method: 'DELETE' })
                      if (!res.ok) { toast.error('Failed to delete'); return }
                      toast.success('Case deleted')
                      reload()
                    }

                    async function uploadMainFile(file: File) {
                      setUploadingCase(fc.id + ':main')
                      try {
                        const fd = new FormData()
                        fd.append('file', file)
                        fd.append('type', 'OTHER')
                        fd.append('companyId', id)
                        fd.append('fileCaseId', fc.id)
                        fd.append('caseFileRole', 'main')
                        const res = await fetch('/api/documents/upload', { method: 'POST', body: fd })
                        if (!res.ok) { toast.error('Upload failed'); return }
                        toast.success('Uploaded')
                        reload()
                      } finally { setUploadingCase(null) }
                    }

                    async function uploadSupportingFile(file: File) {
                      if (!sf.customDocumentType.trim()) {
                        toast.error('Please enter a document type before uploading.')
                        return
                      }
                      setUploadingCase(fc.id + ':sup')
                      try {
                        const fd = new FormData()
                        fd.append('file', file)
                        fd.append('type', 'OTHER')
                        fd.append('companyId', id)
                        fd.append('fileCaseId', fc.id)
                        fd.append('caseFileRole', 'supporting')
                        fd.append('customDocumentType', sf.customDocumentType.trim())
                        if (sf.submissionDate) fd.append('submissionDate', sf.submissionDate)
                        if (sf.notes.trim()) fd.append('notes', sf.notes.trim())
                        const res = await fetch('/api/documents/upload', { method: 'POST', body: fd })
                        if (!res.ok) { toast.error('Upload failed'); return }
                        toast.success('Uploaded')
                        // Reset only the notes/date but keep doc type for convenience
                        setNewSupForm(p => ({ ...p, [fc.id]: { ...sf, notes: '', submissionDate: '' } }))
                        reload()
                      } finally { setUploadingCase(null) }
                    }

                    const isDirty = !!caseEdits[fc.id]

                    return (
                      <div key={fc.id} style={cardStyle}>
                        {/* Case header */}
                        <div className="px-4 py-3 flex flex-wrap items-start gap-3" style={{ borderBottom: '1px solid #2A2418' }}>
                          <div className="flex-1 min-w-0 space-y-3">
                            <div className="flex flex-wrap items-end gap-3">
                              {/* Case type select */}
                              <div>
                                <label className="text-xs block mb-1" style={{ color: '#5A5040' }}>Case Type</label>
                                <select
                                  value={pastCaseTypes.includes(edit.name) ? edit.name : '__new__'}
                                  onChange={e => {
                                    const v = e.target.value === '__new__' ? '' : e.target.value
                                    setCaseEdits(p => ({ ...p, [fc.id]: { ...edit, name: v } }))
                                  }}
                                  style={{ ...fieldStyle, width: 200 }}
                                >
                                  {pastCaseTypes.map(n => (
                                    <option key={n} value={n} style={{ background: '#141414' }}>{n}</option>
                                  ))}
                                  <option value="__new__" style={{ background: '#141414' }}>— Enter new type… —</option>
                                </select>
                              </div>
                              {(!pastCaseTypes.includes(edit.name)) && (
                                <div>
                                  <label className="text-xs block mb-1" style={{ color: '#5A5040' }}>New Case Type</label>
                                  <input
                                    value={edit.name}
                                    onChange={e => setCaseEdits(p => ({ ...p, [fc.id]: { ...edit, name: e.target.value } }))}
                                    placeholder="Enter case type…"
                                    maxLength={200}
                                    style={{ ...fieldStyle, width: 200 }}
                                  />
                                </div>
                              )}
                              {/* Case date */}
                              <div className="w-44">
                                <label className="text-xs block mb-1" style={{ color: '#5A5040' }}>Date</label>
                                <DatePickerPopover
                                  value={edit.caseDate}
                                  onChange={v => setCaseEdits(p => ({ ...p, [fc.id]: { ...edit, caseDate: v } }))}
                                  style={{ ...fieldStyle }}
                                />
                              </div>
                            </div>
                            {/* Remark */}
                            <div>
                              <label className="text-xs block mb-1" style={{ color: '#5A5040' }}>Remark (optional)</label>
                              <input
                                value={edit.remark}
                                onChange={e => setCaseEdits(p => ({ ...p, [fc.id]: { ...edit, remark: e.target.value } }))}
                                placeholder="Remark…"
                                maxLength={500}
                                style={{ ...fieldStyle, width: '100%' }}
                              />
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0 pt-6">
                            {isDirty && <Button size="sm" onClick={saveCase}>Save</Button>}
                            <button onClick={deleteCase} className="text-xs hover:underline" style={{ color: '#ef4444' }}>Delete</button>
                          </div>
                        </div>

                        {/* Main file */}
                        <div className="px-4 py-3" style={{ borderBottom: '1px solid #2A2418' }}>
                          <p className="text-xs font-semibold mb-2 uppercase tracking-wider" style={{ color: '#7A7060' }}>Main File</p>
                          {mainFile ? (
                            <div className="flex items-center gap-3">
                              <span className="text-sm truncate max-w-xs" style={{ color: 'var(--foreground)' }}>{mainFile.name}</span>
                              <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => downloadDoc(mainFile.id)}>Download</Button>
                              <button onClick={() => deleteDoc(mainFile.id)} className="text-xs hover:underline" style={{ color: '#ef4444' }}>Remove</button>
                            </div>
                          ) : (
                            <label style={{ cursor: uploadingCase === fc.id + ':main' ? 'not-allowed' : 'pointer' }}>
                              <input type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx" className="hidden" disabled={!!uploadingCase}
                                onChange={e => { const f = e.target.files?.[0]; if (f) { uploadMainFile(f); e.target.value = '' } }} />
                              <span className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1 text-xs font-medium"
                                style={{ borderColor: '#2A2418', color: uploadingCase === fc.id + ':main' ? '#5A5040' : 'var(--foreground)', cursor: 'inherit' }}>
                                {uploadingCase === fc.id + ':main' ? 'Uploading…' : '↑ Upload Main File'}
                              </span>
                            </label>
                          )}
                        </div>

                        {/* Supporting files */}
                        <div className="px-4 py-3">
                          <p className="text-xs font-semibold mb-3 uppercase tracking-wider" style={{ color: '#7A7060' }}>Supporting Files</p>

                          {/* Add supporting file form */}
                          <div className="rounded-md p-3 mb-4 space-y-3" style={{ border: '1px solid #2A2418', background: '#0D0D0D' }}>
                            <p className="text-xs font-medium" style={{ color: '#C9A96E' }}>Add Supporting File</p>
                            <div className="flex flex-wrap items-end gap-3">
                              {/* Document type */}
                              <div>
                                <label className="text-xs block mb-1" style={{ color: '#5A5040' }}>Document Type *</label>
                                <select
                                  value={pastDocTypes.includes(sf.customDocumentType) ? sf.customDocumentType : (sf.isCustomType ? '__new__' : '')}
                                  onChange={e => {
                                    if (e.target.value === '__new__') {
                                      setNewSupForm(p => ({ ...p, [fc.id]: { ...sf, customDocumentType: '', isCustomType: true } }))
                                    } else {
                                      setNewSupForm(p => ({ ...p, [fc.id]: { ...sf, customDocumentType: e.target.value, isCustomType: false } }))
                                    }
                                  }}
                                  style={{ ...fieldStyle, width: 200 }}
                                >
                                  <option value="" style={{ background: '#141414' }}>— Select type —</option>
                                  {pastDocTypes.map(t => (
                                    <option key={t} value={t} style={{ background: '#141414' }}>{t}</option>
                                  ))}
                                  <option value="__new__" style={{ background: '#141414' }}>— Enter new type… —</option>
                                </select>
                              </div>
                              {(sf.isCustomType || !pastDocTypes.includes(sf.customDocumentType)) && (
                                <div>
                                  <label className="text-xs block mb-1" style={{ color: '#5A5040' }}>New Doc Type</label>
                                  <input
                                    value={sf.isCustomType ? sf.customDocumentType : ''}
                                    onChange={e => setNewSupForm(p => ({ ...p, [fc.id]: { ...sf, customDocumentType: e.target.value, isCustomType: true } }))}
                                    placeholder="Enter document type…"
                                    maxLength={100}
                                    style={{ ...fieldStyle, width: 180 }}
                                  />
                                </div>
                              )}
                              {/* Submission date */}
                              <div className="w-44">
                                <label className="text-xs block mb-1" style={{ color: '#5A5040' }}>Submission Date</label>
                                <DatePickerPopover
                                  value={sf.submissionDate}
                                  onChange={v => setNewSupForm(p => ({ ...p, [fc.id]: { ...sf, submissionDate: v } }))}
                                  style={{ ...fieldStyle }}
                                />
                              </div>
                              {/* Remarks */}
                              <div className="flex-1 min-w-[180px]">
                                <label className="text-xs block mb-1" style={{ color: '#5A5040' }}>Remarks (optional)</label>
                                <input
                                  value={sf.notes}
                                  onChange={e => setNewSupForm(p => ({ ...p, [fc.id]: { ...sf, notes: e.target.value } }))}
                                  placeholder="Remarks…"
                                  maxLength={300}
                                  style={{ ...fieldStyle }}
                                />
                              </div>
                            </div>
                            {/* Upload trigger */}
                            <label style={{ cursor: uploadingCase === fc.id + ':sup' ? 'not-allowed' : 'pointer', display: 'inline-block' }}>
                              <input type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx" className="hidden" disabled={!!uploadingCase}
                                onChange={e => { const f = e.target.files?.[0]; if (f) { uploadSupportingFile(f); e.target.value = '' } }} />
                              <span className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium"
                                style={{ borderColor: '#C9A96E', color: uploadingCase === fc.id + ':sup' ? '#5A5040' : '#C9A96E', cursor: 'inherit' }}>
                                {uploadingCase === fc.id + ':sup' ? 'Uploading…' : '↑ Choose File & Upload'}
                              </span>
                            </label>
                          </div>

                          {/* Existing supporting files */}
                          {supporting.length === 0 ? (
                            <p className="text-xs" style={{ color: '#5A5040' }}>No supporting files yet.</p>
                          ) : (
                            <ul className="divide-y divide-[#2A2418]">
                              {supporting.map(doc => (
                                <li key={doc.id} className="py-3">
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0 flex-1 space-y-0.5">
                                      <p className="text-sm font-medium truncate" style={{ color: 'var(--foreground)' }}>{doc.name}</p>
                                      <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs" style={{ color: '#7A7060' }}>
                                        {doc.customDocumentType && <span>Type: <span style={{ color: '#C9A96E' }}>{doc.customDocumentType}</span></span>}
                                        {doc.submissionDate && <span>Submitted: {new Date(doc.submissionDate).toLocaleDateString('en-HK')}</span>}
                                        {doc.notes && <span>— {doc.notes}</span>}
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                      <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => downloadDoc(doc.id)}>Download</Button>
                                      <button onClick={() => deleteDoc(doc.id)} className="text-xs hover:underline" style={{ color: '#ef4444' }}>Delete</button>
                                    </div>
                                  </div>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </div>
                    )
                  })
                )}
              </>
            )
          })()}
        </TabsContent>

        {/* People — Directors, Members, Controllers */}
        <TabsContent value="people" className="mt-4 space-y-8">

          {/* Directors group */}
          <div className="space-y-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <h3 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>Directors</h3>
                {latestDoc('ROD') && (
                  <Button size="sm" variant="outline" onClick={() => downloadDoc(latestDoc('ROD')!.id)}>Download ROD</Button>
                )}
                {!latestDoc('ROD') && (
                  <span className="text-xs" style={{ color: '#5A5040' }}>ROD generated after next change</span>
                )}
              </div>
              <Button size="sm" onClick={() => setModal({ type: 'director', mode: 'add' })}>+ Add Director</Button>
            </div>
            <div style={cardStyle}>
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th style={thStyle}>Name</th>
                    <th style={thStyle}>Appointed</th>
                    <th style={thStyle}>Ceased</th>
                    <th style={thStyle}>Status</th>
                    <th style={{ ...thStyle, width: '6rem' }} />
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2A2418]">
                  {company.directors.map(d => (
                    <tr key={d.id} className="hover:bg-[#1A1A12] transition-colors">
                      <td style={tdPrimaryStyle}>{d.nameEn}{d.nameZh ? ` (${d.nameZh})` : ''}</td>
                      <td style={tdStyle}>{fmt(d.dateOfAppointment)}</td>
                      <td style={tdStyle}>{fmt(d.dateOfCessation)}</td>
                      <td style={tdStyle}><Badge variant={d.status === 'ACTIVE' ? 'default' : 'secondary'}>{d.status}</Badge></td>
                      <td style={tdStyle}>
                        <div className="flex gap-2">
                          <button onClick={() => setModal({ type: 'director', mode: 'edit', data: d })} className="text-xs hover:underline" style={{ color: '#C9A96E' }}>Edit</button>
                          <button onClick={() => deleteItem('directors', d.id)} className="text-xs hover:underline" style={{ color: '#ef4444' }}>Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {company.directors.length === 0 && (
                    <tr><td colSpan={5} className="px-4 py-6 text-center" style={{ color: '#5A5040' }}>No directors — click Add Director to get started</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Members group */}
          <div className="space-y-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <h3 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>Members</h3>
                {latestDoc('ROM') && (
                  <Button size="sm" variant="outline" onClick={() => downloadDoc(latestDoc('ROM')!.id)}>Download ROM</Button>
                )}
                {!latestDoc('ROM') && (
                  <span className="text-xs" style={{ color: '#5A5040' }}>ROM generated after next change</span>
                )}
              </div>
              <Button size="sm" onClick={() => setModal({ type: 'member', mode: 'add' })}>+ Add Member</Button>
            </div>
            <div style={cardStyle}>
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th style={thStyle}>Name</th>
                    <th style={thStyle}>Share Class</th>
                    <th style={thStyle}>Occupation</th>
                    <th style={thStyle}>Status</th>
                    <th style={{ ...thStyle, width: '6rem' }} />
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2A2418]">
                  {company.members.map(m => (
                    <tr key={m.id} className="hover:bg-[#1A1A12] transition-colors">
                      <td style={tdPrimaryStyle}>{m.nameEn}{m.nameZh ? ` (${m.nameZh})` : ''}</td>
                      <td style={tdStyle}>{m.shareClass}</td>
                      <td style={tdStyle}>{m.occupation ?? '—'}</td>
                      <td style={tdStyle}><Badge variant={m.status === 'ACTIVE' ? 'default' : 'secondary'}>{m.status}</Badge></td>
                      <td style={tdStyle}>
                        <div className="flex gap-2">
                          <button onClick={() => setModal({ type: 'member', mode: 'edit', data: m })} className="text-xs hover:underline" style={{ color: '#C9A96E' }}>Edit</button>
                          <button onClick={() => deleteItem('members', m.id)} className="text-xs hover:underline" style={{ color: '#ef4444' }}>Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {company.members.length === 0 && (
                    <tr><td colSpan={5} className="px-4 py-6 text-center" style={{ color: '#5A5040' }}>No members — click Add Member to get started</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Controllers group */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <h3 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>Controllers</h3>
              {latestDoc('ROSC') && (
                <Button size="sm" variant="outline" onClick={() => downloadDoc(latestDoc('ROSC')!.id)}>Download ROSC</Button>
              )}
              {!latestDoc('ROSC') && (
                <span className="text-xs" style={{ color: '#5A5040' }}>ROSC generated after next change</span>
              )}
            </div>

            {/* Significant Controllers */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium" style={{ color: 'var(--muted-foreground)' }}>Significant Controllers</h4>
                <Button size="sm" onClick={() => setModal({ type: 'controller', mode: 'add' })}>+ Add Controller</Button>
              </div>
              <div style={cardStyle}>
                <table className="w-full text-sm">
                  <thead>
                    <tr>
                      <th style={thStyle}>Name</th>
                      <th style={thStyle}>Nature of Control</th>
                      <th style={thStyle}>Becoming</th>
                      <th style={thStyle}>Ceased</th>
                      <th style={{ ...thStyle, width: '6rem' }} />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#2A2418]">
                    {company.significantControllers.map(sc => (
                      <tr key={sc.id} className="hover:bg-[#1A1A12] transition-colors">
                        <td style={tdPrimaryStyle}>{sc.nameEn}{sc.nameZh ? ` (${sc.nameZh})` : ''}</td>
                        <td style={tdStyle}>{sc.natureOfControl ?? '—'}</td>
                        <td style={tdStyle}>{fmt(sc.becomingDate)}</td>
                        <td style={tdStyle}>{fmt(sc.cessationDate)}</td>
                        <td style={tdStyle}>
                          <div className="flex gap-2">
                            <button onClick={() => setModal({ type: 'controller', mode: 'edit', data: sc })} className="text-xs hover:underline" style={{ color: '#C9A96E' }}>Edit</button>
                            <button onClick={() => deleteItem('controllers', sc.id)} className="text-xs hover:underline" style={{ color: '#ef4444' }}>Delete</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {company.significantControllers.length === 0 && (
                      <tr><td colSpan={5} className="px-4 py-6 text-center" style={{ color: '#5A5040' }}>No significant controllers — click Add Controller to get started</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Designated Representatives */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium" style={{ color: 'var(--muted-foreground)' }}>Designated Representatives</h4>
                <Button size="sm" onClick={() => setModal({ type: 'designatedRep', mode: 'add' })}>+ Add Rep</Button>
              </div>
              <div style={cardStyle}>
                <table className="w-full text-sm">
                  <thead>
                    <tr>
                      <th style={thStyle}>Name</th>
                      <th style={thStyle}>Capacity</th>
                      <th style={thStyle}>Tel / Fax</th>
                      <th style={thStyle}>Becoming</th>
                      <th style={thStyle}>Ceased</th>
                      <th style={{ ...thStyle, width: '6rem' }} />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#2A2418]">
                    {company.designatedReps.map(dr => (
                      <tr key={dr.id} className="hover:bg-[#1A1A12] transition-colors">
                        <td style={tdPrimaryStyle}>{dr.name}</td>
                        <td style={tdStyle}>{dr.capacity ?? '—'}</td>
                        <td style={tdStyle}>{dr.telFax ?? '—'}</td>
                        <td style={tdStyle}>{fmt(dr.becomingDate)}</td>
                        <td style={tdStyle}>{fmt(dr.cessationDate)}</td>
                        <td style={tdStyle}>
                          <div className="flex gap-2">
                            <button onClick={() => setModal({ type: 'designatedRep', mode: 'edit', data: dr })} className="text-xs hover:underline" style={{ color: '#C9A96E' }}>Edit</button>
                            <button onClick={() => deleteItem('designated-reps', dr.id)} className="text-xs hover:underline" style={{ color: '#ef4444' }}>Delete</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {company.designatedReps.length === 0 && (
                      <tr><td colSpan={6} className="px-4 py-6 text-center" style={{ color: '#5A5040' }}>No designated representatives — click Add Rep to get started</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

        </TabsContent>

      </Tabs>

      {/* Modal */}
      {modal && (
        <Modal title={modalTitle} onClose={() => setModal(null)}>
          {modal.type === 'company' && (
            <CompanyEditForm company={modal.data} onDone={closeModal} />
          )}
          {modal.type === 'director' && (
            <DirectorForm
              companyId={id}
              initial={modal.mode === 'edit' ? modal.data : undefined}
              kycPersons={kycPersons}
              onDone={closeModal}
            />
          )}
          {modal.type === 'member' && (
            <MemberForm
              companyId={id}
              initial={modal.mode === 'edit' ? modal.data : undefined}
              kycPersons={kycPersons}
              onDone={closeModal}
            />
          )}
          {modal.type === 'controller' && (
            <ControllerForm
              companyId={id}
              initial={modal.mode === 'edit' ? modal.data : undefined}
              kycPersons={kycPersons}
              onDone={closeModal}
            />
          )}
          {modal.type === 'designatedRep' && (
            <DesignatedRepForm
              companyId={id}
              initial={modal.mode === 'edit' ? modal.data : undefined}
              kycPersons={kycPersons}
              onDone={closeModal}
            />
          )}
        </Modal>
      )}
    </div>
  )
}
