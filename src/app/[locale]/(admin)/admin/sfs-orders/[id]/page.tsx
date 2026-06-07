'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { ArrowLeft, CheckCircle, RotateCcw, Upload, X, Download } from 'lucide-react'
import Link from 'next/link'
import DiamondCards from '@/app/sfsdiamond/components/DiamondCards'
import { DatetimeLocalPicker } from '@/components/ui/date-picker-popover'
import { sfsDiamondLabel, sfsStepFileDiamondLabel, sfsStepRequiresDiamondImages } from '@/lib/sfs/order-step-display'
import {
  SFS_PREDEFINED_STEPS,
  SFS_PHASE_LABELS,
  sfsChemTransformWeightStepIndex,
  sfsCvdSinglePhotoStepIndex,
} from '@/lib/sfs/order-predefined-steps'

// ─── Types ────────────────────────────────────────────────────────────────────

type Step = {
  id: string
  phase: string
  stepNumber: number
  recordedAt: string
  particular: string
  notes?: string | null
  fileKeys: string[]
}

type DiamondItem = {
  code?: string; carat?: string; shape?: string; type?: string; size?: string; cut?: string
}

type Order = {
  id: string
  status: string
  sampleCode?: string | null
  memorialName: string
  clientName: string
  email: string
  phone: string
  sourceType: string
  color: string
  mailingAddress: string
  diamonds: DiamondItem[]
  adminNotes?: string | null
  customerRemark?: string | null
  sampleReceivedAt?: string | null
  chemTransformStartAt?: string | null
  chemTransformEndAt?: string | null
  cvdStartAt?: string | null
  cvdExpectedEndAt?: string | null
  cvdEndAt?: string | null
  craftingStartAt?: string | null
  craftingEndAt?: string | null
  igiCertificationAt?: string | null
  jewelrySettingStartAt?: string | null
  jewelrySettingEndAt?: string | null
  packagingAt?: string | null
  deliveryAt?: string | null
  deliveryDetails?: string | null
  createdAt: string
  steps: Step[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  PENDING:   { bg: 'rgba(201,169,110,0.12)', color: '#C9A96E' },
  QUOTED:    { bg: 'rgba(59,130,246,0.12)',  color: '#3b82f6' },
  CONFIRMED: { bg: 'rgba(16,185,129,0.12)',  color: '#10b981' },
  COMPLETED: { bg: 'rgba(120,113,108,0.15)', color: '#7A7060' },
  CANCELLED: { bg: 'rgba(239,68,68,0.12)',   color: '#ef4444' },
}

function toDatetimeLocal(iso?: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function fileUrl(key: string) {
  return `/api/files?key=${encodeURIComponent(key)}`
}

function fileName(key: string) {
  return key.split('/').pop() ?? key
}

function diamondLabel(diamond: DiamondItem, index: number) {
  return sfsDiamondLabel(diamond, index)
}

function fileDiamondLabel(key: string) {
  return sfsStepFileDiamondLabel(key)
}

function requiresDiamondImages(phase: string, stepIndex: number) {
  return sfsStepRequiresDiamondImages(phase, stepIndex + 1)
}

function requiresSinglePhoto(phase: string, stepIndex: number) {
  return phase === 'CVD' && stepIndex === sfsCvdSinglePhotoStepIndex()
}

type PendingUploadFile = {
  file: File
  diamondLabel?: string
}

// ─── Single predefined step row ───────────────────────────────────────────────

function StepRow({
  orderId,
  phase,
  stepIndex,    // 0-based
  description,
  doneStep,     // the saved Step record if completed, else undefined
  diamonds,
  onRefresh,
}: {
  orderId: string
  phase: string
  stepIndex: number
  description: string
  doneStep?: Step
  diamonds: DiamondItem[]
  onRefresh: () => void
}) {
  const [uploading, setUploading] = useState(false)
  const [undoing, setUndoing] = useState(false)
  const [files, setFiles] = useState<PendingUploadFile[]>([])
  const [uploadTarget, setUploadTarget] = useState<string | null>(null)
  const [weight, setWeight] = useState('')
  const [customTime, setCustomTime] = useState('')
  const [showTimeEdit, setShowTimeEdit] = useState(false)
  const [remarks, setRemarks] = useState('')
  const [showRemarks, setShowRemarks] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const isDone = !!doneStep
  const isWeightStep = phase === 'CHEM_TRANSFORM' && stepIndex === sfsChemTransformWeightStepIndex()
  const isDiamondImageStep = requiresDiamondImages(phase, stepIndex)
  const isSinglePhotoStep = requiresSinglePhoto(phase, stepIndex)

  function chooseGeneralFiles(fileList: FileList | null) {
    const selectedFiles = Array.from(fileList ?? [])
    setFiles(selectedFiles.slice(0, isSinglePhotoStep ? 1 : selectedFiles.length).map(file => ({ file })))
  }

  function chooseDiamondFile(label: string, fileList: FileList | null) {
    const file = fileList?.[0]
    if (!file) return
    setFiles(prev => [...prev.filter(item => item.diamondLabel !== label), { file, diamondLabel: label }])
  }

  function pendingDiamondFile(label: string) {
    return files.find(file => file.diamondLabel === label)
  }

  const markDone = async () => {
    setUploading(true)
    const fd = new FormData()
    fd.append('phase', phase)
    fd.append('stepNumber', String(stepIndex + 1))
    fd.append('recordedAt', customTime ? new Date(customTime).toISOString() : new Date().toISOString())
    fd.append('particular', description)
    const noteParts = [
      isWeightStep && weight.trim() ? `Weight: ${weight.trim()} g` : '',
      remarks.trim(),
    ].filter(Boolean)
    if (noteParts.length > 0) fd.append('notes', noteParts.join('\n'))
    for (const item of files) {
      fd.append('files', item.file)
      fd.append('fileLabels', item.diamondLabel ?? '')
    }

    await fetch(`/api/sfsdiamond/admin/orders/${orderId}/steps`, { method: 'POST', body: fd })
    setFiles([])
    setWeight('')
    setCustomTime('')
    setShowTimeEdit(false)
    setRemarks('')
    setShowRemarks(false)
    setUploading(false)
    onRefresh()
  }

  const undo = async () => {
    if (!doneStep) return
    setUndoing(true)
    await fetch(`/api/sfsdiamond/admin/orders/${orderId}/steps/${doneStep.id}`, { method: 'DELETE' })
    setUndoing(false)
    onRefresh()
  }

  return (
    <div
      className="flex items-start gap-4 px-4 py-3 rounded-xl transition-all"
      style={{
        background: isDone ? 'rgba(16,185,129,0.04)' : 'rgba(201,169,110,0.03)',
        border: `1px solid ${isDone ? 'rgba(16,185,129,0.2)' : 'rgba(201,169,110,0.12)'}`,
      }}
    >
      {/* Step number bubble */}
      <div
        className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5"
        style={{
          background: isDone ? 'rgba(16,185,129,0.15)' : 'rgba(201,169,110,0.1)',
          color: isDone ? '#10b981' : '#C9A96E',
          border: `1px solid ${isDone ? 'rgba(16,185,129,0.3)' : 'rgba(201,169,110,0.2)'}`,
        }}
      >
        {isDone ? '✓' : stepIndex + 1}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>{description}</p>

        {isDone ? (
          /* Completed state */
          <div className="mt-1 space-y-1.5">
            <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
              Recorded: {new Date(doneStep.recordedAt).toLocaleString('en-HK', {
                day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
              })}
            </p>
            {doneStep.notes && (
              <p className="text-xs italic" style={{ color: 'var(--muted-foreground)' }}>
                {doneStep.notes}
              </p>
            )}
            {doneStep.fileKeys.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-1">
                {doneStep.fileKeys.map((key, i) => {
                  const name = fileName(key)
                  const isImage = /\.(jpg|jpeg|png|webp)$/i.test(name)
                  return isImage ? (
                    <a key={i} href={fileUrl(key)} target="_blank" rel="noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={fileUrl(key)}
                        alt={fileDiamondLabel(key) ? `${fileDiamondLabel(key)} ${name}` : name}
                        className="w-14 h-14 object-cover rounded-lg"
                        style={{ border: '1px solid rgba(16,185,129,0.2)' }}
                      />
                      {fileDiamondLabel(key) && (
                        <span className="mt-0.5 block max-w-14 truncate text-[10px] font-mono text-center" style={{ color: '#10b981' }}>
                          {fileDiamondLabel(key)}
                        </span>
                      )}
                    </a>
                  ) : (
                    <a
                      key={i}
                      href={fileUrl(key)}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs px-2 py-1 rounded flex items-center gap-1 hover:opacity-80"
                      style={{ background: 'rgba(16,185,129,0.08)', color: '#10b981' }}
                    >
                      📄 {name}
                    </a>
                  )
                })}
              </div>
            )}
          </div>
        ) : (
          /* Pending state — file upload */
          <div className="mt-2 space-y-2">
            {isDiamondImageStep ? (
              <div className="flex gap-2">
                {diamonds.map((diamond, index) => {
                  const label = diamondLabel(diamond, index)
                  const selected = pendingDiamondFile(label)
                  return (
                    <button
                      key={label}
                      type="button"
                      onClick={() => { setUploadTarget(label); fileRef.current?.click() }}
                      className="min-w-0 flex-1 rounded-lg px-2 py-2 text-xs font-semibold transition-all hover:opacity-80"
                      title={selected ? selected.file.name : label}
                      style={{
                        border: selected ? '1px solid rgba(16,185,129,0.35)' : '1px dashed rgba(201,169,110,0.35)',
                        background: selected ? 'rgba(16,185,129,0.08)' : 'var(--card)',
                        color: selected ? '#10b981' : '#C9A96E',
                      }}
                    >
                      <span className="block truncate">{label}</span>
                      {selected && <span className="block truncate text-[10px] font-normal">{selected.file.name}</span>}
                    </button>
                  )
                })}
              </div>
            ) : (
              <div className={isWeightStep ? 'flex flex-col gap-2 sm:flex-row sm:items-center' : ''}>
                {isWeightStep && (
                  <label className="flex items-center gap-2 text-xs sm:w-48" style={{ color: 'var(--muted-foreground)' }}>
                    <span className="shrink-0">Weight</span>
                    <input
                      value={weight}
                      onChange={e => setWeight(e.target.value)}
                      inputMode="decimal"
                      placeholder="g"
                      className="min-w-0 flex-1 rounded-lg px-2 py-2 text-xs"
                      style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--foreground)' }}
                    />
                  </label>
                )}
                {/* File area */}
                <div
                  className="rounded-lg p-2 flex flex-1 items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
                  style={{ border: '1px dashed rgba(201,169,110,0.3)', background: 'var(--card)' }}
                  onClick={() => { setUploadTarget(null); fileRef.current?.click() }}
                >
                  <Upload size={13} style={{ color: '#C9A96E', flexShrink: 0 }} />
                  <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                    {files.length > 0
                      ? isSinglePhotoStep ? files[0].file.name : `${files.length} file(s)`
                      : isSinglePhotoStep
                        ? 'Upload one photo (optional)'
                        : 'Upload photo or document (optional)'}
                  </span>
                  {files.length > 0 && (
                    <button
                      onClick={e => { e.stopPropagation(); setFiles([]) }}
                      className="ml-auto"
                    >
                      <X size={12} style={{ color: 'var(--muted-foreground)' }} />
                    </button>
                  )}
                </div>
              </div>
              )}
            <input
              ref={fileRef}
              type="file"
              multiple={!uploadTarget && !isSinglePhotoStep}
              accept={uploadTarget || isSinglePhotoStep ? 'image/jpeg,image/png,image/webp' : 'image/jpeg,image/png,image/webp,application/pdf'}
              className="hidden"
              onChange={e => {
                if (uploadTarget) chooseDiamondFile(uploadTarget, e.target.files)
                else chooseGeneralFiles(e.target.files)
                e.target.value = ''
              }}
            />

            {/* Time picker */}
            {showTimeEdit ? (
              <div className="flex items-center gap-2">
                <DatetimeLocalPicker
                  value={customTime}
                  onChange={setCustomTime}
                  dateTriggerStyle={{
                    flex: 1,
                    background: 'var(--card)',
                    border: '1px solid var(--border)',
                    color: 'var(--foreground)',
                    borderRadius: '0.375rem',
                    fontSize: '0.75rem',
                  }}
                  timeInputStyle={{
                    background: 'var(--card)',
                    border: '1px solid var(--border)',
                    color: 'var(--foreground)',
                    borderRadius: '0.375rem',
                  }}
                />
                <button
                  onClick={() => setShowTimeEdit(false)}
                  className="text-xs px-2 py-1 rounded-lg font-medium"
                  style={{ background: '#C9A96E', color: '#0A0805' }}
                >
                  OK
                </button>
                <button onClick={() => { setShowTimeEdit(false); setCustomTime('') }} className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                  Cancel
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                {customTime ? (
                  <>
                    <span className="text-xs" style={{ color: 'var(--foreground)' }}>
                      🕐 {new Date(customTime).toLocaleString('en-HK', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <button onClick={() => setShowTimeEdit(true)} className="text-xs underline" style={{ color: 'var(--muted-foreground)' }}>edit</button>
                    <button onClick={() => setCustomTime('')} className="text-xs underline" style={{ color: 'var(--muted-foreground)' }}>clear</button>
                  </>
                ) : (
                  <button
                    onClick={() => { setShowTimeEdit(true); setCustomTime(toDatetimeLocal(new Date().toISOString())) }}
                    className="text-xs"
                    style={{ color: 'var(--muted-foreground)' }}
                  >
                    Edit time (default: now)
                  </button>
                )}
              </div>
            )}

            {/* Remarks */}
            {showRemarks ? (
              <div className="flex items-start gap-2">
                <textarea
                  value={remarks}
                  onChange={e => setRemarks(e.target.value)}
                  rows={2}
                  placeholder="Enter remarks…"
                  className="flex-1 rounded-lg px-2 py-1.5 text-xs resize-none"
                  style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--foreground)' }}
                />
                <div className="flex flex-col gap-1 mt-1">
                  <button
                    onClick={() => setShowRemarks(false)}
                    className="text-xs px-2 py-1 rounded-lg font-medium"
                    style={{ background: '#C9A96E', color: '#0A0805' }}
                  >
                    OK
                  </button>
                  <button onClick={() => { setShowRemarks(false); setRemarks('') }} className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                {remarks.trim() ? (
                  <>
                    <span className="text-xs italic truncate max-w-[180px]" style={{ color: 'var(--foreground)' }}>📝 {remarks}</span>
                    <button onClick={() => setShowRemarks(true)} className="text-xs underline flex-shrink-0" style={{ color: 'var(--muted-foreground)' }}>edit</button>
                    <button onClick={() => setRemarks('')} className="text-xs underline flex-shrink-0" style={{ color: 'var(--muted-foreground)' }}>clear</button>
                  </>
                ) : (
                  <button
                    onClick={() => setShowRemarks(true)}
                    className="text-xs"
                    style={{ color: 'var(--muted-foreground)' }}
                  >
                    Add remarks (optional)
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Action button */}
      {isDone ? (
        <button
          onClick={undo}
          disabled={undoing}
          title="Undo"
          className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs transition-all hover:opacity-70 disabled:opacity-40"
          style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.15)' }}
        >
          <RotateCcw size={12} />
          Undo
        </button>
      ) : (
        <button
          onClick={markDone}
          disabled={uploading}
          className="flex-shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:opacity-90 disabled:opacity-50"
          style={{ background: '#C9A96E', color: '#0A0805' }}
        >
          <CheckCircle size={12} />
          {uploading ? 'Saving…' : 'Done'}
        </button>
      )}
    </div>
  )
}

// ─── Phase panel ──────────────────────────────────────────────────────────────

function PhasePanel({
  orderId,
  phase,
  steps,
  diamonds,
  onRefresh,
}: {
  orderId: string
  phase: string
  steps: Step[]
  diamonds: DiamondItem[]
  onRefresh: () => void
}) {
  const descriptions = SFS_PREDEFINED_STEPS[phase]
  const doneMap = new Map(steps.map(s => [s.stepNumber, s]))
  const doneCount = steps.length
  const total = descriptions.length

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
      <div
        className="px-4 py-3 flex items-center justify-between"
        style={{ background: 'rgba(201,169,110,0.04)', borderBottom: '1px solid var(--border)' }}
      >
        <h3 className="font-semibold text-sm" style={{ color: 'var(--foreground)' }}>
          {SFS_PHASE_LABELS[phase]}
        </h3>
        <div className="flex items-center gap-3">
          {/* Progress bar */}
          <div className="w-32 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(201,169,110,0.15)' }}>
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${(doneCount / total) * 100}%`, background: doneCount === total ? '#10b981' : '#C9A96E' }}
            />
          </div>
          <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
            {doneCount}/{total}
          </span>
        </div>
      </div>
      <div className="p-4 space-y-2">
        {descriptions.map((desc, i) => (
          <StepRow
            key={i}
            orderId={orderId}
            phase={phase}
            stepIndex={i}
            description={desc}
            doneStep={doneMap.get(i + 1)}
            diamonds={diamonds}
            onRefresh={onRefresh}
          />
        ))}
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AdminSfsOrderDetailPage() {
  const params = useParams()
  const id = params.id as string

  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveOk, setSaveOk] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [loadError, setLoadError] = useState('')
  const [form, setForm] = useState<Record<string, string>>({})

  // keepForm=true when called from a step refresh — preserves unsaved edits to
  // status/notes/remark while still updating the order's step list.
  const load = useCallback(async (keepForm = false) => {
    const res = await fetch(`/api/sfsdiamond/admin/orders/${id}`)
    if (!res.ok) { setLoadError('Order not found'); setLoading(false); return }
    const data: Order = await res.json()
    setOrder(data)
    if (!keepForm) {
      setForm({
        status:               data.status,
        adminNotes:           data.adminNotes ?? '',
        customerRemark:       data.customerRemark ?? '',
        sampleReceivedAt:     toDatetimeLocal(data.sampleReceivedAt),
        chemTransformStartAt: toDatetimeLocal(data.chemTransformStartAt),
        chemTransformEndAt:   toDatetimeLocal(data.chemTransformEndAt),
        cvdStartAt:           toDatetimeLocal(data.cvdStartAt),
        cvdExpectedEndAt:     toDatetimeLocal(data.cvdExpectedEndAt),
        cvdEndAt:             toDatetimeLocal(data.cvdEndAt),
        craftingStartAt:      toDatetimeLocal(data.craftingStartAt),
        craftingEndAt:        toDatetimeLocal(data.craftingEndAt),
        igiCertificationAt:   toDatetimeLocal(data.igiCertificationAt),
        jewelrySettingStartAt:toDatetimeLocal(data.jewelrySettingStartAt),
        jewelrySettingEndAt:  toDatetimeLocal(data.jewelrySettingEndAt),
        packagingAt:          toDatetimeLocal(data.packagingAt),
        deliveryAt:           toDatetimeLocal(data.deliveryAt),
        deliveryDetails:      data.deliveryDetails ?? '',
      })
    }
    setLoading(false)
  }, [id])

  // eslint-disable-next-line react-hooks/set-state-in-effect -- load fetches external order data, then updates local page state asynchronously.
  useEffect(() => { load() }, [load])

  const set = (key: string, value: string) => setForm(prev => ({ ...prev, [key]: value }))
  const toIsoOrNull = (v: string) => v ? new Date(v).toISOString() : null

  const saveOrder = async () => {
    setSaving(true)
    setSaveOk(false)
    setSaveError('')
    try {
      const res = await fetch(`/api/sfsdiamond/admin/orders/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status:               form.status,
          adminNotes:           form.adminNotes || null,
          customerRemark:       form.customerRemark || null,
          sampleReceivedAt:     toIsoOrNull(form.sampleReceivedAt),
          chemTransformStartAt: toIsoOrNull(form.chemTransformStartAt),
          chemTransformEndAt:   toIsoOrNull(form.chemTransformEndAt),
          cvdStartAt:           toIsoOrNull(form.cvdStartAt),
          cvdExpectedEndAt:     toIsoOrNull(form.cvdExpectedEndAt),
          cvdEndAt:             toIsoOrNull(form.cvdEndAt),
          craftingStartAt:      toIsoOrNull(form.craftingStartAt),
          craftingEndAt:        toIsoOrNull(form.craftingEndAt),
          igiCertificationAt:   toIsoOrNull(form.igiCertificationAt),
          jewelrySettingStartAt:toIsoOrNull(form.jewelrySettingStartAt),
          jewelrySettingEndAt:  toIsoOrNull(form.jewelrySettingEndAt),
          packagingAt:          toIsoOrNull(form.packagingAt),
          deliveryAt:           toIsoOrNull(form.deliveryAt),
          deliveryDetails:      form.deliveryDetails || null,
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setSaveError(body.error ?? `Save failed (${res.status})`)
        setSaving(false)
        return
      }
      await load()
      setSaving(false)
      setSaveOk(true)
      setTimeout(() => setSaveOk(false), 2500)
    } catch {
      setSaveError('Network error — please try again')
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center py-24" style={{ color: 'var(--muted-foreground)' }}>Loading…</div>
  }
  if (loadError || !order) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <p style={{ color: '#ef4444' }}>{loadError || 'Order not found'}</p>
        <Link href="/admin/sfs-orders" className="text-sm" style={{ color: '#C9A96E' }}>← Back to orders</Link>
      </div>
    )
  }

  const s = STATUS_STYLE[order.status] ?? STATUS_STYLE.PENDING
  const diamonds = order.diamonds as DiamondItem[]
  const LABEL = 'block text-xs mb-1'
  const INPUT = 'w-full rounded-lg px-3 py-2 text-sm'
  const IS = { background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--foreground)' }

  return (
    <div className="max-w-4xl mx-auto space-y-6">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/sfs-orders"
            className="p-2 rounded-lg hover:opacity-70"
            style={{ background: 'var(--muted)', color: 'var(--muted-foreground)' }}
          >
            <ArrowLeft size={16} />
          </Link>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold" style={{ color: 'var(--foreground)' }}>{order.memorialName}</h1>
              <span className="px-2.5 py-1 rounded-full text-xs font-semibold" style={{ background: s.bg, color: s.color }}>
                {order.status}
              </span>
            </div>
            <p className="text-sm mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
              {order.sampleCode && <span className="font-mono mr-2" style={{ color: '#C9A96E' }}>{order.sampleCode}</span>}
              {order.clientName} · {order.email}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
            {new Date(order.createdAt).toLocaleDateString('en-HK', { day: 'numeric', month: 'short', year: 'numeric' })}
          </p>
          {order.status === 'COMPLETED' && (
            <a
              href={`/api/sfsdiamond/orders/${order.id}/report`}
              download
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:opacity-80"
              style={{ background: 'rgba(201,169,110,0.12)', color: '#C9A96E', border: '1px solid rgba(201,169,110,0.3)' }}
            >
              <Download size={12} />
              Download Report
            </a>
          )}
        </div>
      </div>

      {/* ── Client + Diamonds ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl p-4 space-y-2" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          <h2 className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#C9A96E' }}>Client</h2>
          {[
            ['Name', order.clientName],
            ['Email', order.email],
            ['Phone', order.phone || '—'],
            ['Source', order.sourceType],
            ['Address', order.mailingAddress || '—'],
          ].map(([k, v]) => (
            <div key={k} className="flex gap-2 text-sm">
              <span style={{ color: 'var(--muted-foreground)', minWidth: 60 }}>{k}</span>
              <span style={{ color: 'var(--foreground)' }}>{v}</span>
            </div>
          ))}
        </div>
        <div className="rounded-xl p-4 space-y-2" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#C9A96E' }}>Diamonds ({diamonds.length})</h2>
            {order.color && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-medium" style={{ background: 'rgba(201,169,110,0.1)', color: '#C9A96E', border: '1px solid rgba(201,169,110,0.2)' }}>
                {order.color}
              </span>
            )}
          </div>
          <DiamondCards
            diamonds={diamonds}
            cardBg="var(--muted)"
            textColor="var(--foreground)"
            mutedColor="var(--muted-foreground)"
            borderColor="var(--border)"
          />
        </div>
      </div>

      {/* ── Order Management (status + milestone dates) ── */}
      <div className="rounded-xl p-5 space-y-5" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#C9A96E' }}>Order Details</h2>
          <div className="flex items-center gap-3">
            {saveError && (
              <span className="text-xs font-medium" style={{ color: '#ef4444' }}>{saveError}</span>
            )}
            <button
              onClick={saveOrder}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all hover:opacity-90 disabled:opacity-50"
              style={{ background: '#C9A96E', color: '#0A0805' }}
            >
              {saveOk ? <><CheckCircle size={14} /> Saved</> : saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </div>

        <div>
          <label className={LABEL} style={{ color: 'var(--muted-foreground)' }}>Status</label>
          <select value={form.status} onChange={e => set('status', e.target.value)} className={INPUT} style={IS}>
            {['PENDING', 'QUOTED', 'CONFIRMED', 'COMPLETED', 'CANCELLED'].map(v => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
        </div>

        <div>
          <label className={LABEL} style={{ color: 'var(--muted-foreground)' }}>Admin Notes (internal)</label>
          <textarea value={form.adminNotes} onChange={e => set('adminNotes', e.target.value)} rows={2} className={`${INPUT} resize-none`} style={IS} placeholder="Internal notes — not visible to client…" />
        </div>

        <div>
          <label className={LABEL} style={{ color: 'var(--muted-foreground)' }}>
            Remark to Customer <span style={{ color: '#C9A96E', fontWeight: 500 }}>· visible to client</span>
          </label>
          <textarea value={form.customerRemark} onChange={e => set('customerRemark', e.target.value)} rows={3} className={`${INPUT} resize-none`} style={{ ...IS, borderColor: '#C9A96E' }} placeholder="Leave a message for the customer…" />
        </div>
      </div>

      {/* ── Phase step panels ── */}
      {['CHEM_TRANSFORM', 'CVD', 'CRAFTING'].map(phase => (
        <PhasePanel
          key={phase}
          orderId={order.id}
          phase={phase}
          steps={order.steps.filter(s => s.phase === phase)}
          diamonds={diamonds}
          onRefresh={() => load(true)}
        />
      ))}
    </div>
  )
}
