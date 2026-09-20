'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { useRouter } from '@/i18n/navigation'
import { useSession } from 'next-auth/react'
import { ArrowLeft, CheckCircle, RotateCcw, Trash2, Upload, X, Download } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import DiamondCards from '@/app/sfsdiamond/components/DiamondCards'
import { useAdminPermission } from '@/components/admin/AdminPermissionContext'
import { DatetimeLocalPicker } from '@/components/ui/date-picker-popover'
import {
  sfsDiamondLabel,
  sfsIsImageFile,
  sfsStepFileDiamondLabel,
  sfsStepRequiresDiamondImages,
  sfsStepRequiresWeight,
} from '@/lib/sfs/order-step-display'
import { SFS_PHASE_LABELS, SFS_PHASE_ORDER } from '@/lib/sfs/order-predefined-steps'
import {
  matchCompletedStep,
  resolveOrderStepPlan,
  type SfsPlanStep,
  type SfsStepPlan,
} from '@/lib/sfs/order-step-plan'
import { buildSfsOrderTracker } from '@/lib/sfs/order-tracker'
import { SfsOrderTrackerPanel, type SfsTrackerInvoice } from '@/components/sfs/SfsOrderTrackerPanel'

// ─── Types ────────────────────────────────────────────────────────────────────

type Step = {
  id: string
  phase: string
  stepNumber: number
  recordedAt: string
  particular: string
  notes?: string | null
  fileKeys: string[]
  planStepId?: string | null
  attachments?: StepAttachment[]
}

type StepAttachment = {
  id: string
  fileKey: string
  fileName: string
  mimeType: string
  reviewStatus: 'PENDING' | 'APPROVED' | 'REJECTED'
}

type DiamondItem = {
  code?: string
  carat?: string
  shape?: string
  type?: string
  design?: string
  designNotes?: string
  metal?: string
  ringSize?: string
  chainLength?: string
  size?: string
  cut?: string
}

type DesignAttachment = {
  id: string
  diamondIndex: number
  fileName: string
  mimeType: string
  sizeBytes: number
  uploadedAt: string
}

type Order = {
  id: string
  status: string
  sampleCode?: string | null
  memorialName: string
  clientName: string
  email: string
  phone: string
  contactNumber?: string
  sourceType: string
  mailingCompany?: string | null
  mailTrackingCode?: string | null
  color: string
  mailingAddress: string
  diamonds: DiamondItem[]
  designAttachments?: DesignAttachment[]
  quotedAmount?: number | null
  quotedAt?: string | null
  quoteNotes?: string | null
  adminNotes?: string | null
  customerRemark?: string | null
  customerInternalOrderCode?: string | null
  sampleReceivedAt?: string | null
  packageArrivedHkAt?: string | null
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
  invoices?: SfsTrackerInvoice[]
  stepPlan?: unknown
  resolvedStepPlan?: SfsStepPlan
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  PENDING:   { bg: 'rgba(201,169,110,0.12)', color: '#C9A96E' },
  QUOTED:    { bg: 'rgba(59,130,246,0.12)',  color: '#3b82f6' },
  CONFIRMED: { bg: 'rgba(16,185,129,0.12)',  color: '#10b981' },
  COMPLETED: { bg: 'rgba(120,113,108,0.15)', color: '#7A7060' },
  CANCELLED: { bg: 'rgba(239,68,68,0.12)',   color: '#ef4444' },
}

const REVIEW_STATUS_STYLE: Record<StepAttachment['reviewStatus'], { label: string; bg: string; color: string }> = {
  PENDING: { label: 'Pending review', bg: 'rgba(245,158,11,0.14)', color: '#f59e0b' },
  APPROVED: { label: 'Approved', bg: 'rgba(16,185,129,0.14)', color: '#10b981' },
  REJECTED: { label: 'Rejected', bg: 'rgba(239,68,68,0.14)', color: '#ef4444' },
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

function stepAttachmentsForDisplay(step: Step) {
  const attachments = step.attachments ?? []
  const attachmentKeys = new Set(attachments.map(attachment => attachment.fileKey))
  return [
    ...attachments,
    ...step.fileKeys
      .filter(key => !attachmentKeys.has(key))
      .map(key => ({
        id: '',
        fileKey: key,
        fileName: fileName(key),
        mimeType: '',
        reviewStatus: 'APPROVED' as const,
      })),
  ]
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
  planStepId,
  defaultKey,
  doneStep,     // the saved Step record if completed, else undefined
  diamonds,
  onRefresh,
  canReviewAttachments,
  canManageSteps,
  onRemoveFromPlan,
}: {
  orderId: string
  phase: string
  stepIndex: number
  description: string
  planStepId: string
  defaultKey?: string
  doneStep?: Step
  diamonds: DiamondItem[]
  onRefresh: () => void
  canReviewAttachments: boolean
  canManageSteps: boolean
  onRemoveFromPlan: () => void
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
  const [reviewingId, setReviewingId] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const isDone = !!doneStep
  const isWeightStep = sfsStepRequiresWeight(defaultKey, phase, stepIndex)
  const isDiamondImageStep = sfsStepRequiresDiamondImages(phase, stepIndex + 1, defaultKey)
  const isSinglePhotoStep = false

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
    fd.append('planStepId', planStepId)
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

  const setAttachmentReview = async (attachmentId: string, reviewStatus: StepAttachment['reviewStatus']) => {
    if (!doneStep || !attachmentId) return
    setReviewingId(attachmentId)
    await fetch(`/api/sfsdiamond/admin/orders/${orderId}/steps/${doneStep.id}/attachments/${attachmentId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reviewStatus }),
    })
    setReviewingId(null)
    onRefresh()
  }

  const removeFromPlan = () => {
    if (!confirm(`Remove step "${description}" from this order's plan? Any completion for this step will also be cleared.`)) return
    onRemoveFromPlan()
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
            {stepAttachmentsForDisplay(doneStep).length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-1">
                {stepAttachmentsForDisplay(doneStep).map((attachment, i) => {
                  const key = attachment.fileKey
                  const name = attachment.fileName || fileName(key)
                  const isImage = sfsIsImageFile(key, attachment.mimeType)
                  const reviewMeta = REVIEW_STATUS_STYLE[attachment.reviewStatus]
                  return isImage ? (
                    <div key={`${key}-${i}`} className="max-w-56">
                      <a href={fileUrl(key)} target="_blank" rel="noreferrer">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={fileUrl(key)}
                          alt={fileDiamondLabel(key) ? `${fileDiamondLabel(key)} ${name}` : name}
                          className="w-56 h-56 object-cover rounded-lg"
                          style={{ border: `1px solid ${reviewMeta.color}` }}
                        />
                      </a>
                      {fileDiamondLabel(key) && (
                        <span className="mt-0.5 block max-w-56 truncate text-[10px] font-mono text-center" style={{ color: '#10b981' }}>
                          {fileDiamondLabel(key)}
                        </span>
                      )}
                      <div className="mt-1 flex flex-wrap items-center justify-center gap-1">
                        <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: reviewMeta.bg, color: reviewMeta.color }}>
                          {reviewMeta.label}
                        </span>
                        {attachment.id && canReviewAttachments && (
                          <>
                            <button
                              type="button"
                              onClick={() => setAttachmentReview(attachment.id, 'APPROVED')}
                              disabled={reviewingId === attachment.id || attachment.reviewStatus === 'APPROVED'}
                              className="rounded px-1.5 py-0.5 text-[10px] font-semibold disabled:opacity-40"
                              style={{ background: 'rgba(16,185,129,0.12)', color: '#10b981' }}
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              onClick={() => setAttachmentReview(attachment.id, 'REJECTED')}
                              disabled={reviewingId === attachment.id || attachment.reviewStatus === 'REJECTED'}
                              className="rounded px-1.5 py-0.5 text-[10px] font-semibold disabled:opacity-40"
                              style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444' }}
                            >
                              Reject
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ) : (
                    <a
                      key={`${key}-${i}`}
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

      {/* Action buttons */}
      <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
        {isDone ? (
          <button
            onClick={undo}
            disabled={undoing}
            title="Undo"
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs transition-all hover:opacity-70 disabled:opacity-40"
            style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.15)' }}
          >
            <RotateCcw size={12} />
            Undo
          </button>
        ) : (
          <button
            onClick={markDone}
            disabled={uploading}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:opacity-90 disabled:opacity-50"
            style={{ background: '#C9A96E', color: '#0A0805' }}
          >
            <CheckCircle size={12} />
            {uploading ? 'Saving…' : 'Done'}
          </button>
        )}
        {canManageSteps && (
          <button
            type="button"
            onClick={removeFromPlan}
            className="text-[10px] px-1.5 py-0.5 rounded transition-all hover:opacity-80"
            style={{ color: 'var(--muted-foreground)', border: '1px solid var(--border)' }}
          >
            Remove step
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Insert gap between plan steps ────────────────────────────────────────────

function InsertStepGap({
  onInsert,
  busy,
}: {
  onInsert: (label: string) => Promise<void>
  busy: boolean
}) {
  const [open, setOpen] = useState(false)
  const [label, setLabel] = useState('')

  const submit = async () => {
    const trimmed = label.trim()
    if (!trimmed || busy) return
    await onInsert(trimmed)
    setLabel('')
    setOpen(false)
  }

  if (!open) {
    return (
      <div className="flex justify-center py-0.5">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-[10px] px-2 py-0.5 rounded transition-all hover:opacity-80"
          style={{ color: '#C9A96E', border: '1px dashed rgba(201,169,110,0.35)' }}
        >
          + Insert step
        </button>
      </div>
    )
  }

  return (
    <div
      className="flex items-center gap-2 px-3 py-2 rounded-lg"
      style={{ background: 'rgba(201,169,110,0.04)', border: '1px dashed rgba(201,169,110,0.3)' }}
    >
      <input
        value={label}
        onChange={e => setLabel(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') void submit() }}
        placeholder="New step label…"
        className="flex-1 rounded-lg px-2 py-1 text-xs"
        style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--foreground)' }}
        autoFocus
      />
      <button
        type="button"
        onClick={() => void submit()}
        disabled={busy || !label.trim()}
        className="text-xs px-2.5 py-1 rounded-lg font-semibold disabled:opacity-40"
        style={{ background: '#C9A96E', color: '#0A0805' }}
      >
        Insert
      </button>
      <button
        type="button"
        onClick={() => { setOpen(false); setLabel('') }}
        className="text-xs"
        style={{ color: 'var(--muted-foreground)' }}
      >
        Cancel
      </button>
    </div>
  )
}

// ─── Phase panel ──────────────────────────────────────────────────────────────

function PhasePanel({
  orderId,
  phase,
  planSteps,
  steps,
  diamonds,
  onRefresh,
  onPlanChanged,
  canReviewAttachments,
  canManageSteps,
}: {
  orderId: string
  phase: string
  planSteps: SfsPlanStep[]
  steps: Step[]
  diamonds: DiamondItem[]
  onRefresh: () => void
  onPlanChanged: (order: Order) => void
  canReviewAttachments: boolean
  canManageSteps: boolean
}) {
  const [planBusy, setPlanBusy] = useState(false)

  const doneCount = planSteps.filter((item, i) => matchCompletedStep(item, i, steps)).length
  const total = planSteps.length
  const progressPct = total > 0 ? (doneCount / total) * 100 : 0

  const patchPlan = async (body: Record<string, unknown>) => {
    setPlanBusy(true)
    try {
      const res = await fetch(`/api/sfsdiamond/admin/orders/${orderId}/step-plan`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) return
      const data: Order = await res.json()
      onPlanChanged(data)
    } finally {
      setPlanBusy(false)
    }
  }

  const insertAt = async (index: number, label: string) => {
    await patchPlan({ action: 'insert', phase, index, label })
  }

  const removeStep = async (planStepId: string) => {
    await patchPlan({ action: 'remove', phase, planStepId })
  }

  const resetPhase = async () => {
    if (!confirm(`Reset ${SFS_PHASE_LABELS[phase]} to the default step plan? Custom steps in this phase will be removed.`)) return
    await patchPlan({ action: 'resetPhase', phase })
  }

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
      <div
        className="px-4 py-3 flex items-center justify-between gap-3"
        style={{ background: 'rgba(201,169,110,0.04)', borderBottom: '1px solid var(--border)' }}
      >
        <h3 className="font-semibold text-sm" style={{ color: 'var(--foreground)' }}>
          {SFS_PHASE_LABELS[phase]}
        </h3>
        <div className="flex items-center gap-3">
          {canManageSteps && (
            <button
              type="button"
              onClick={() => void resetPhase()}
              disabled={planBusy}
              className="text-[10px] px-2 py-0.5 rounded transition-all hover:opacity-80 disabled:opacity-40"
              style={{ color: 'var(--muted-foreground)', border: '1px solid var(--border)' }}
            >
              Reset phase
            </button>
          )}
          {/* Progress bar */}
          <div className="w-32 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(201,169,110,0.15)' }}>
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${progressPct}%`, background: total > 0 && doneCount === total ? '#10b981' : '#C9A96E' }}
            />
          </div>
          <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
            {doneCount}/{total}
          </span>
        </div>
      </div>
      <div className="p-4 space-y-2">
        {canManageSteps && (
          <InsertStepGap busy={planBusy} onInsert={label => insertAt(0, label)} />
        )}
        {planSteps.map((item, i) => (
          <div key={item.id} className="space-y-2">
            <StepRow
              orderId={orderId}
              phase={phase}
              stepIndex={i}
              description={item.label}
              planStepId={item.id}
              defaultKey={item.defaultKey}
              doneStep={matchCompletedStep(item, i, steps) as Step | undefined}
              diamonds={diamonds}
              onRefresh={onRefresh}
              canReviewAttachments={canReviewAttachments}
              canManageSteps={canManageSteps}
              onRemoveFromPlan={() => void removeStep(item.id)}
            />
            {canManageSteps && (
              <InsertStepGap busy={planBusy} onInsert={label => insertAt(i + 1, label)} />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AdminSfsOrderDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string
  const { data: session } = useSession()
  const canReviewAttachments = session?.user?.role === 'SUPER_ADMIN'
  const canManageSteps = useAdminPermission('sfsOrders.manageSteps')
  const canDelete = useAdminPermission('sfsOrders.delete')

  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
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
    if (!data.resolvedStepPlan) {
      data.resolvedStepPlan = resolveOrderStepPlan(data.stepPlan)
    }
    setOrder(data)
    if (!keepForm) {
      setForm({
        status:               data.status,
        adminNotes:           data.adminNotes ?? '',
        customerRemark:       data.customerRemark ?? '',
        quotedAmount:         data.quotedAmount == null ? '' : String(data.quotedAmount),
        quoteNotes:           data.quoteNotes ?? '',
        sampleReceivedAt:     toDatetimeLocal(data.sampleReceivedAt),
        packageArrivedHkAt:   toDatetimeLocal(data.packageArrivedHkAt),
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
      const quotedRaw = form.quotedAmount.trim()
      let quotedAmount: number | null = null
      if (quotedRaw !== '') {
        quotedAmount = Number(quotedRaw)
        if (!Number.isFinite(quotedAmount) || quotedAmount < 0) {
          setSaveError('Quoted amount must be a valid non-negative number')
          setSaving(false)
          return
        }
      }

      const res = await fetch(`/api/sfsdiamond/admin/orders/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status:               form.status,
          adminNotes:           form.adminNotes || null,
          customerRemark:       form.customerRemark || null,
          quotedAmount,
          quoteNotes:           form.quoteNotes || null,
          sampleReceivedAt:     toIsoOrNull(form.sampleReceivedAt),
          packageArrivedHkAt:   toIsoOrNull(form.packageArrivedHkAt),
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

  const deleteOrder = async () => {
    const label = order?.sampleCode || order?.memorialName || id
    if (!window.confirm(`Permanently delete order "${label}"? Steps and production images will be removed. Linked invoices stay but will be unlinked. This cannot be undone.`)) {
      return
    }
    setDeleting(true)
    try {
      const res = await fetch(`/api/sfsdiamond/admin/orders/${id}`, { method: 'DELETE' })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(typeof body.error === 'string' ? body.error : 'Failed to delete order')
        return
      }
      toast.success('Order deleted.')
      router.push('/admin/sfs-orders')
    } catch {
      toast.error('Network error — please try again')
    } finally {
      setDeleting(false)
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
  const designAttachments = order.designAttachments ?? []
  const hasCustomDesign = diamonds.some(d => d.design === 'Custom') || designAttachments.length > 0
  const resolvedPlan = order.resolvedStepPlan ?? resolveOrderStepPlan(order.stepPlan)
  const LABEL = 'block text-xs mb-1'
  const INPUT = 'w-full rounded-lg px-3 py-2 text-sm'
  const IS = { background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--foreground)' }

  const handlePlanChanged = (updated: Order) => {
    if (!updated.resolvedStepPlan) {
      updated.resolvedStepPlan = resolveOrderStepPlan(updated.stepPlan)
    }
    setOrder(prev => prev ? {
      ...prev,
      ...updated,
      steps: updated.steps ?? prev.steps,
      stepPlan: updated.stepPlan ?? prev.stepPlan,
      resolvedStepPlan: updated.resolvedStepPlan,
    } : updated)
  }

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
          {canDelete && (
            <button
              type="button"
              disabled={deleting}
              onClick={() => void deleteOrder()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:opacity-80 disabled:opacity-50"
              style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.35)' }}
            >
              <Trash2 size={12} />
              {deleting ? 'Deleting…' : 'Delete'}
            </button>
          )}
        </div>
      </div>

      <SfsOrderTrackerPanel
        orderId={order.id}
        stages={buildSfsOrderTracker({
          status: order.status,
          createdAt: order.createdAt,
          packageArrivedHkAt: form.packageArrivedHkAt ? new Date(form.packageArrivedHkAt).toISOString() : null,
          sampleReceivedAt: form.sampleReceivedAt ? new Date(form.sampleReceivedAt).toISOString() : order.sampleReceivedAt,
          chemTransformStartAt: form.chemTransformStartAt ? new Date(form.chemTransformStartAt).toISOString() : order.chemTransformStartAt,
          chemTransformEndAt: form.chemTransformEndAt ? new Date(form.chemTransformEndAt).toISOString() : order.chemTransformEndAt,
          cvdStartAt: form.cvdStartAt ? new Date(form.cvdStartAt).toISOString() : order.cvdStartAt,
          craftingEndAt: form.craftingEndAt ? new Date(form.craftingEndAt).toISOString() : order.craftingEndAt,
          igiCertificationAt: form.igiCertificationAt ? new Date(form.igiCertificationAt).toISOString() : order.igiCertificationAt,
          jewelrySettingEndAt: form.jewelrySettingEndAt ? new Date(form.jewelrySettingEndAt).toISOString() : order.jewelrySettingEndAt,
          deliveryAt: form.deliveryAt ? new Date(form.deliveryAt).toISOString() : order.deliveryAt,
          stepPlan: resolvedPlan,
          steps: order.steps,
        })}
        packageArrivedHkAt={form.packageArrivedHkAt ?? ''}
        invoices={order.invoices ?? []}
        onHkChange={value => set('packageArrivedHkAt', value)}
        onInvoicesChange={invoices => setOrder(prev => prev ? { ...prev, invoices } : prev)}
      />

      {/* ── Client + Diamonds ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl p-4 space-y-2" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          <h2 className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#C9A96E' }}>Client</h2>
          {[
            ['Name', order.clientName],
            ['Email', order.email],
            ['Phone', order.contactNumber || order.phone || '—'],
            ['Source', order.sourceType],
            ['Mailing company', order.mailingCompany || '—'],
            ['Tracking code', order.mailTrackingCode || '—'],
            ['Address', order.mailingAddress || '—'],
            ['Customer ref.', order.customerInternalOrderCode || '—'],
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

      {hasCustomDesign && (
        <div className="rounded-xl p-5 space-y-4" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          <h2 className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#C9A96E' }}>
            Custom design uploads
          </h2>
          {designAttachments.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>No design files attached.</p>
          ) : (
            <div className="space-y-4">
              {diamonds.map((diamond, index) => {
                const files = designAttachments.filter(a => a.diamondIndex === index)
                if (files.length === 0 && diamond.design !== 'Custom') return null
                return (
                  <div key={index} className="space-y-2">
                    <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                      Diamond #{index + 1}
                      {diamond.design ? ` · ${diamond.design}` : ''}
                      {diamond.metal ? ` · ${diamond.metal}` : ''}
                    </p>
                    {diamond.designNotes && (
                      <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                        Notes: {diamond.designNotes}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-2">
                      {files.map(file => {
                        const isImage = file.mimeType.startsWith('image/') || /\.(jpg|jpeg|png|webp)$/i.test(file.fileName)
                        return isImage ? (
                          <a key={file.id} href={`/api/files?designAttachmentId=${encodeURIComponent(file.id)}`} target="_blank" rel="noreferrer" className="block">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={`/api/files?designAttachmentId=${encodeURIComponent(file.id)}`}
                              alt={file.fileName}
                              className="w-24 h-24 object-cover rounded-lg"
                              style={{ border: '1px solid var(--border)' }}
                            />
                          </a>
                        ) : (
                          <a
                            key={file.id}
                            href={`/api/files?designAttachmentId=${encodeURIComponent(file.id)}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg"
                            style={{ background: 'rgba(201,169,110,0.1)', color: '#C9A96E' }}
                          >
                            📄 {file.fileName}
                          </a>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

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

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={LABEL} style={{ color: 'var(--muted-foreground)' }}>
              Quoted amount (HKD) <span style={{ color: '#C9A96E' }}>· visible to client when set</span>
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.quotedAmount}
              onChange={e => set('quotedAmount', e.target.value)}
              className={INPUT}
              style={IS}
              placeholder="e.g. 12800"
            />
            {order.quotedAt && (
              <p className="text-[11px] mt-1" style={{ color: 'var(--muted-foreground)' }}>
                Last set {new Date(order.quotedAt).toLocaleString('en-HK')}
              </p>
            )}
          </div>
          <div>
            <label className={LABEL} style={{ color: 'var(--muted-foreground)' }}>
              Quote notes <span style={{ color: '#C9A96E' }}>· visible to client</span>
            </label>
            <textarea
              value={form.quoteNotes}
              onChange={e => set('quoteNotes', e.target.value)}
              rows={2}
              className={`${INPUT} resize-none`}
              style={{ ...IS, borderColor: '#C9A96E' }}
              placeholder="Optional note with the quotation…"
            />
          </div>
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
      {SFS_PHASE_ORDER.map(phase => (
        <PhasePanel
          key={phase}
          orderId={order.id}
          phase={phase}
          planSteps={resolvedPlan[phase] ?? []}
          steps={order.steps.filter(s => s.phase === phase)}
          diamonds={diamonds}
          onRefresh={() => load(true)}
          onPlanChanged={handlePlanChanged}
          canReviewAttachments={canReviewAttachments}
          canManageSteps={canManageSteps}
        />
      ))}
    </div>
  )
}
