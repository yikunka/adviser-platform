'use client'

import { useState, useEffect, useMemo } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { getDesignOptionGroupsForSettingType, type SfsOrderSpecOptions } from '@/lib/sfs/diamond-spec-options'
import { getCaratPreviewDiameter } from '@/lib/sfs/carat-preview'
import { formatSfsMetalPercentLabel, formatSfsPriceLabel } from '@/lib/sfs/effective-pricing'
import { computeSfsOrderPricing, type SfsMultiDiamondDiscountTier } from '@/lib/sfs/pricing'
import { isSfsCustomDesign, SFS_CUSTOM_DESIGN_VALUE } from '@/lib/sfs/design-upload-shared'

// ─── Types ────────────────────────────────────────────────────────────────────

export type DesignUploadRef = {
  storageKey: string
  fileName: string
  mimeType: string
  sizeBytes: number
}

export type DiamondItem = {
  carat: string
  shape: string
  type: string
  ringSize: string
  design: string
  designNotes: string
  designUploads: DesignUploadRef[]
  metal: string
}

export type WizardFormData = {
  memorialName: string
  relationship: string
  relationshipPet: string
  clientName: string
  contactNumber: string
  email: string
  mailingAddress: string
  sourceType: string
  sourceOther: string
  remarks: string
  mailingPackage: string
  color: string
  diamonds: DiamondItem[]
}

const EMPTY_DIAMOND: DiamondItem = {
  carat: '',
  shape: '',
  type: '',
  ringSize: '',
  design: '',
  designNotes: '',
  designUploads: [],
  metal: '',
}

export const WIZARD_INITIAL: WizardFormData = {
  memorialName: '',
  relationship: '',
  relationshipPet: '',
  clientName: '',
  contactNumber: '',
  email: '',
  mailingAddress: '',
  sourceType: '',
  sourceOther: '',
  remarks: '',
  mailingPackage: 'Own Package',
  color: '',
  diamonds: [{ ...EMPTY_DIAMOND }],
}

// ─── Design data ──────────────────────────────────────────────────────────────

const STEPS = ['Client Info', 'Source Material', 'Color', 'Diamond Specs', 'Order Summary']

// ─── Shared UI helpers ────────────────────────────────────────────────────────

const GOLD = '#C9A96E'
const DARK = '#1A1A1A'
const MUTED = '#6B5E4A'
const BORDER = '#EDE7D8'

function SectionTitle({ step, title, sub }: { step: number; title: string; sub?: string }) {
  return (
    <div className="mb-8">
      <p className="text-xs uppercase tracking-[0.3em] mb-2" style={{ color: GOLD }}>
        Step {step} of {STEPS.length}
      </p>
      <h2 className="text-3xl font-bold mb-2" style={{ fontFamily: 'Georgia, serif', color: DARK }}>
        {title}
      </h2>
      {sub && <p className="text-sm leading-relaxed" style={{ color: MUTED }}>{sub}</p>}
    </div>
  )
}

function GroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs uppercase tracking-[0.2em] font-semibold mb-3 mt-1" style={{ color: GOLD }}>
      {children}
    </p>
  )
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium" style={{ color: DARK }}>
        {label}{required && <span style={{ color: GOLD }}> *</span>}
      </label>
      {children}
    </div>
  )
}

const inputCls = `w-full px-4 py-2.5 rounded-xl border text-sm outline-none transition-all focus:ring-2`
const inputStyle = { borderColor: BORDER, color: DARK, background: '#fff' }

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={inputCls} style={{ ...inputStyle, ...props.style }} {...props} />
}

function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`${inputCls} resize-none`} rows={3} style={{ ...inputStyle, ...props.style }} {...props} />
}

function CheckCard({ checked, onChange, children }: { checked: boolean; onChange: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onChange}
      className="flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-medium transition-all text-left"
      style={{
        borderColor: checked ? GOLD : BORDER,
        background: checked ? '#FDF8F0' : '#fff',
        color: DARK,
        boxShadow: checked ? `0 0 0 1px ${GOLD}` : undefined,
      }}
    >
      <span
        className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0 border-2 transition-all"
        style={{ borderColor: checked ? GOLD : '#CCC', background: checked ? GOLD : 'transparent' }}
      >
        {checked && <span className="text-white text-xs font-bold">✓</span>}
      </span>
      {children}
    </button>
  )
}

function ImageCard({ label, src, selected, onClick, tall, hideLabel, priceLabel }: {
  label: string; src: string | null; selected: boolean; onClick: () => void; tall?: boolean; hideLabel?: boolean; priceLabel?: string | null
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center gap-2 rounded-2xl border-2 p-3 transition-all"
      style={{
        borderColor: selected ? GOLD : BORDER,
        background: selected ? '#FDF8F0' : '#fff',
        boxShadow: selected ? `0 0 0 1px ${GOLD}` : '0 1px 6px rgba(0,0,0,0.04)',
      }}
    >
      <div className={`relative w-full ${tall ? 'h-32' : 'h-24'} rounded-xl overflow-hidden`}>
        {src ? (
          <img src={src} alt={label} className="h-full w-full object-contain" />
        ) : (
          <div className="h-full w-full flex items-center justify-center text-xs" style={{ color: MUTED }}>
            {label}
          </div>
        )}
      </div>
      {!hideLabel && (
        <span className="text-xs font-semibold text-center" style={{ color: selected ? GOLD : MUTED }}>
          {label}
        </span>
      )}
      {priceLabel && (
        <span className="text-[11px] font-semibold tabular-nums" style={{ color: GOLD }}>{priceLabel}</span>
      )}
    </button>
  )
}

function CaratCard({
  label,
  value,
  src,
  selected,
  onClick,
  priceLabel,
}: {
  label: string
  value: string
  src: string | null
  selected: boolean
  onClick: () => void
  priceLabel?: string | null
}) {
  const diameter = getCaratPreviewDiameter(value)

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center gap-2 rounded-2xl border-2 p-3 transition-all"
      style={{
        borderColor: selected ? GOLD : BORDER,
        background: selected ? '#FDF8F0' : '#fff',
        boxShadow: selected ? `0 0 0 1px ${GOLD}` : '0 1px 6px rgba(0,0,0,0.04)',
      }}
    >
      <div className="relative flex h-24 w-full items-center justify-center overflow-hidden rounded-xl" style={{ background: '#FBF7EF' }}>
        {src ? (
          <img src={src} alt={`${label} ct`} className="h-full w-full object-contain" />
        ) : (
          <div
            className="rounded-full border"
            style={{
              width: diameter,
              height: diameter,
              borderColor: selected ? GOLD : '#D8CCB7',
              background: selected ? 'rgba(201,169,110,0.16)' : 'rgba(201,169,110,0.08)',
              boxShadow: 'inset 0 0 18px rgba(255,255,255,0.72)',
            }}
          />
        )}
      </div>
      <span className="text-xs font-semibold text-center" style={{ color: selected ? GOLD : MUTED }}>
        {label} ct
      </span>
      {priceLabel && (
        <span className="text-[11px] font-semibold tabular-nums" style={{ color: GOLD }}>{priceLabel}</span>
      )}
    </button>
  )
}

function NavButtons({ step, total, onBack, onNext, nextLabel, disabled }: {
  step: number; total: number; onBack: () => void; onNext: () => void; nextLabel?: string; disabled?: boolean
}) {
  return (
    <div className="flex justify-between mt-10 pt-6 border-t" style={{ borderColor: BORDER }}>
      {step > 1 ? (
        <button
          type="button"
          onClick={onBack}
          className="px-6 py-3 rounded-full text-sm font-medium border transition-all hover:bg-gray-50"
          style={{ borderColor: BORDER, color: DARK }}
        >
          ← Back
        </button>
      ) : (
        <div />
      )}
      <button
        type="button"
        onClick={onNext}
        disabled={disabled}
        className="px-8 py-3 rounded-full text-sm font-medium transition-all hover:opacity-90 disabled:opacity-40"
        style={{ background: DARK, color: '#F5F0E8' }}
      >
        {nextLabel ?? (step < total ? 'Continue →' : 'Submit Order')}
      </button>
    </div>
  )
}

// ─── Step 1 ───────────────────────────────────────────────────────────────────

function Step1({ data, update }: { data: WizardFormData; update: (p: Partial<WizardFormData>) => void }) {
  const RELATIONS = ['Spouse', 'Parent', 'Children', 'Sibling', 'Friend', 'Pet']
  return (
    <div className="space-y-6">
      <SectionTitle step={1} title="Client Information" />

      {/* Group A — Memorial info */}
      <div
        className="rounded-2xl p-5 space-y-5"
        style={{ background: '#F9F6EF', border: `1px solid ${BORDER}` }}
      >
        <GroupLabel>Memorial</GroupLabel>
        <Field label="Memorial / Deceased Name" required>
          <Input value={data.memorialName} onChange={e => update({ memorialName: e.target.value })} placeholder="Name of your loved one" />
        </Field>
        <Field label="Relationship" required>
          <div className="flex flex-wrap gap-2">
            {RELATIONS.map(r => (
              <CheckCard
                key={r}
                checked={data.relationship === r}
                onChange={() => update({ relationship: r, relationshipPet: r === 'Pet' ? data.relationshipPet : '' })}
              >
                {r}
              </CheckCard>
            ))}
          </div>
          {data.relationship === 'Pet' && (
            <Input
              className="mt-2"
              value={data.relationshipPet}
              onChange={e => update({ relationshipPet: e.target.value })}
              placeholder="Pet name / type"
            />
          )}
        </Field>
      </div>

      {/* Group B — Contact info */}
      <div
        className="rounded-2xl p-5 space-y-5"
        style={{ background: '#F9F6EF', border: `1px solid ${BORDER}` }}
      >
        <GroupLabel>Your Contact Details</GroupLabel>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <Field label="Your Name" required>
            <Input value={data.clientName} onChange={e => update({ clientName: e.target.value })} placeholder="Full name" />
          </Field>
          <Field label="Contact Number" required>
            <Input type="tel" value={data.contactNumber} onChange={e => update({ contactNumber: e.target.value })} placeholder="+852 XXXX XXXX" />
          </Field>
          <Field label="Email" required>
            <Input type="email" value={data.email} onChange={e => update({ email: e.target.value })} placeholder="your@email.com" />
          </Field>
        </div>
        <Field label="Mailing Address" required>
          <Textarea value={data.mailingAddress} onChange={e => update({ mailingAddress: e.target.value })} placeholder="Full mailing address" />
        </Field>
      </div>
    </div>
  )
}

// ─── Step 2 ───────────────────────────────────────────────────────────────────

function Step2({ data, update, specOptions }: {
  data: WizardFormData
  update: (p: Partial<WizardFormData>) => void
  specOptions: SfsOrderSpecOptions
}) {
  const sourceOptions = specOptions.sources
  return (
    <div className="space-y-6">
      <SectionTitle
        step={2}
        title="Source Material"
        sub="Approximately 60 g of bone ash or 1 g of hair is needed per carat. The amount scales linearly with the number of diamonds."
      />
      <Field label="Source Type" required>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {sourceOptions.map(source => (
            <ImageCard
              key={source.id}
              label={source.label}
              src={source.imageUrl}
              selected={data.sourceType === source.value}
              onClick={() => update({ sourceType: source.value, sourceOther: '' })}
              tall
              priceLabel={formatSfsPriceLabel(source.price, { additive: true })}
            />
          ))}
          <CheckCard checked={data.sourceType === 'Other'} onChange={() => update({ sourceType: 'Other', sourceOther: '' })}>
            Other carbon source
          </CheckCard>
        </div>
      </Field>

      <Field label="Remarks">
        <Textarea
          value={data.remarks}
          onChange={e => update({ remarks: e.target.value })}
          placeholder="e.g. hairs/ashes already mixed, with metal, etc."
        />
      </Field>

      <Field label="Mailing Package" required>
        <div className="flex flex-wrap gap-2">
          <CheckCard checked={data.mailingPackage === 'Own Package'} onChange={() => update({ mailingPackage: 'Own Package' })}>
            Own Package
          </CheckCard>
        </div>
      </Field>
    </div>
  )
}

// ─── Step 3 ───────────────────────────────────────────────────────────────────

function Step3({ data, update, specOptions }: {
  data: WizardFormData
  update: (p: Partial<WizardFormData>) => void
  specOptions: SfsOrderSpecOptions
}) {
  return (
    <div className="space-y-6">
      <SectionTitle
        step={3}
        title="Diamond Color"
        sub="Each memorial diamond is cultivated from the carbon extracted from your loved one's hair or ashes. We reject any artificial color modification to fully preserve the elemental composition of the raw material."
      />
      <Field label="Select Color" required>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {specOptions.colors.map(c => (
            <ImageCard
              key={c.id}
              label={c.label}
              src={c.imageUrl}
              selected={data.color === c.value}
              onClick={() => update({ color: c.value })}
              tall
              priceLabel={formatSfsPriceLabel(c.price, { additive: true })}
            />
          ))}
        </div>
      </Field>
      <div className="rounded-2xl p-5 text-sm leading-relaxed" style={{ background: '#F2EDE3', color: MUTED }}>
        <strong style={{ color: DARK }}>Natural Color</strong> — the unique hue stems from the natural combination of trace elements and carbon structure, an untouched mark of the memorial.
        <br /><br />
        <strong style={{ color: DARK }}>Transparent</strong> — a colourless diamond that highlights the purity of the stone.
      </div>
    </div>
  )
}

// ─── Custom design upload (Step 4) ────────────────────────────────────────────

function CustomDesignUpload({
  notes,
  uploads,
  onNotesChange,
  onUploadsChange,
}: {
  notes: string
  uploads: DesignUploadRef[]
  onNotesChange: (notes: string) => void
  onUploadsChange: (uploads: DesignUploadRef[]) => void
}) {
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList?.length) return
    setUploading(true)
    setUploadError('')
    const next = [...uploads]
    try {
      for (const file of Array.from(fileList)) {
        if (next.length >= 8) break
        const formData = new FormData()
        formData.append('file', file)
        const res = await fetch('/api/sfsdiamond/orders/design-upload', { method: 'POST', body: formData })
        const body = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(body.error ?? `Failed to upload ${file.name}`)
        next.push({
          storageKey: body.storageKey,
          fileName: body.fileName,
          mimeType: body.mimeType,
          sizeBytes: body.sizeBytes,
        })
      }
      onUploadsChange(next)
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="rounded-2xl border p-4 space-y-3" style={{ borderColor: GOLD, background: '#FDF8F0' }}>
      <p className="text-sm font-medium" style={{ color: DARK }}>
        Upload your design<span style={{ color: GOLD }}> *</span>
      </p>
      <p className="text-xs" style={{ color: MUTED }}>
        Share a sketch, photo, or PDF of your custom jewellery. Our team will review and send a quotation.
        JPG, PNG, WEBP, or PDF · max 10 MB each · up to 8 files.
      </p>
      <input
        type="file"
        accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
        multiple
        disabled={uploading || uploads.length >= 8}
        onChange={e => {
          void handleFiles(e.target.files)
          e.target.value = ''
        }}
        className="block w-full text-sm"
        style={{ color: MUTED }}
      />
      {uploading && <p className="text-xs" style={{ color: GOLD }}>Uploading…</p>}
      {uploadError && <p className="text-xs" style={{ color: '#B91C1C' }}>{uploadError}</p>}
      {uploads.length > 0 && (
        <ul className="space-y-1.5">
          {uploads.map(file => (
            <li
              key={file.storageKey}
              className="flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-xs"
              style={{ background: '#fff', border: `1px solid ${BORDER}`, color: DARK }}
            >
              <span className="truncate">{file.fileName}</span>
              <button
                type="button"
                className="flex-shrink-0 text-[11px] font-medium"
                style={{ color: '#999' }}
                onClick={() => onUploadsChange(uploads.filter(u => u.storageKey !== file.storageKey))}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
      <Field label="Design notes (optional)">
        <Textarea
          value={notes}
          onChange={e => onNotesChange(e.target.value)}
          placeholder="Describe materials, dimensions, or other preferences…"
          maxLength={1000}
        />
      </Field>
    </div>
  )
}

// ─── Diamond row (Step 4) ─────────────────────────────────────────────────────

function DiamondRow({ index, item, onChange, onRemove, showRemove, collapsed, onToggleCollapse, specOptions }: {
  index: number; item: DiamondItem; onChange: (p: Partial<DiamondItem>) => void
  onRemove: () => void; showRemove: boolean; collapsed: boolean; onToggleCollapse: () => void
  specOptions: SfsOrderSpecOptions
}) {
  const designOptionGroups = getDesignOptionGroupsForSettingType(item.type, specOptions)
  const summary = [item.carat ? `${item.carat} ct` : '', item.shape, item.type].filter(Boolean).join(' · ')

  if (collapsed) {
    return (
      <div
        className="rounded-2xl border px-5 py-4 flex items-center justify-between cursor-pointer hover:bg-amber-50 transition-all"
        style={{ borderColor: BORDER, background: '#FAFAF8' }}
        onClick={onToggleCollapse}
      >
        <div className="flex items-center gap-3">
          <span className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0" style={{ background: GOLD, color: '#0A0805' }}>
            {index + 1}
          </span>
          <span className="text-sm font-medium" style={{ color: DARK }}>
            {summary || `Diamond #${index + 1} — incomplete`}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {showRemove && (
            <button
              type="button"
              onClick={e => { e.stopPropagation(); onRemove() }}
              className="text-xs px-3 py-1 rounded-full border transition-all hover:bg-red-50"
              style={{ borderColor: '#EEE', color: '#999' }}
            >
              Remove
            </button>
          )}
          <span className="text-xs" style={{ color: MUTED }}>▼ expand</span>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border p-6 space-y-6" style={{ borderColor: BORDER, background: '#FAFAF8' }}>
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-base" style={{ color: DARK }}>Diamond #{index + 1}</h3>
        <div className="flex items-center gap-2">
          {showRemove && (
            <button
              type="button"
              onClick={onRemove}
              className="text-xs px-3 py-1.5 rounded-full border transition-all hover:bg-red-50"
              style={{ borderColor: '#EEE', color: '#999' }}
            >
              Remove
            </button>
          )}
          <button
            type="button"
            onClick={onToggleCollapse}
            className="text-xs px-3 py-1.5 rounded-full border transition-all hover:bg-gray-50"
            style={{ borderColor: '#EEE', color: '#999' }}
          >
            ▲ collapse
          </button>
        </div>
      </div>

      {/* Carat */}
      <div>
        <p className="text-sm font-medium mb-3" style={{ color: DARK }}>
          Carat<span style={{ color: GOLD }}> *</span>
        </p>
        <Image src="/sfsdiamond/order/size-chart.png" alt="Diamond size chart" width={420} height={80} className="mb-4 rounded-xl" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {specOptions.carats.map(c => (
            <CaratCard
              key={c.id}
              label={c.label}
              value={c.value}
              src={c.imageUrl}
              selected={item.carat === c.value}
              onClick={() => onChange({ carat: c.value })}
              priceLabel={formatSfsPriceLabel(c.price)}
            />
          ))}
        </div>
      </div>

      {/* Shape — pictures already have names; no text label needed */}
      <div>
        <p className="text-sm font-medium mb-3" style={{ color: DARK }}>
          Shape<span style={{ color: GOLD }}> *</span>
        </p>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
          {specOptions.shapes.map(cut => (
            <ImageCard
              key={cut.id}
              label={cut.label}
              src={cut.imageUrl}
              selected={item.shape === cut.value}
              onClick={() => onChange({ shape: cut.value })}
              hideLabel
              priceLabel={formatSfsPriceLabel(cut.price, { additive: true })}
            />
          ))}
        </div>
      </div>

      {/* Type */}
      <div>
        <p className="text-sm font-medium mb-3" style={{ color: DARK }}>
          Setting Type<span style={{ color: GOLD }}> *</span>
        </p>
        <div className="flex flex-wrap gap-2">
          {specOptions.settingTypes.map(t => (
            <CheckCard key={t.id} checked={item.type === t.value} onChange={() => onChange({ type: t.value, design: '', designNotes: '', designUploads: [], ringSize: '' })}>
              {t.label}
            </CheckCard>
          ))}
        </div>
      </div>

      {item.type === 'Ring' && (
        <Field label="Ring Size (EU)" required>
          <Input
            type="text"
            value={item.ringSize}
            onChange={e => onChange({ ringSize: e.target.value })}
            placeholder="e.g. EU35"
            style={{ maxWidth: 160 }}
          />
        </Field>
      )}

      {(designOptionGroups.length > 0 || (item.type && item.type !== 'Diamond only')) && (
        <div>
          <p className="text-sm font-medium mb-3" style={{ color: DARK }}>
            {(designOptionGroups[0]?.label ?? `${item.type} Design`)}
            <span style={{ color: GOLD }}> *</span>
          </p>
          <div className={`grid gap-3 ${item.type === 'Ring' ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-3 sm:grid-cols-5'}`}>
            {designOptionGroups.flatMap(group => group.options).map(d => (
              <ImageCard
                key={d.id}
                label={d.label}
                src={d.imageUrl}
                selected={item.design === d.value}
                onClick={() => onChange({ design: d.value, designNotes: '', designUploads: [] })}
                tall
                priceLabel={formatSfsPriceLabel(d.price)}
              />
            ))}
            <ImageCard
              label="Custom"
              src={null}
              selected={isSfsCustomDesign(item.design)}
              onClick={() => onChange({ design: SFS_CUSTOM_DESIGN_VALUE })}
              tall
              priceLabel="Quote"
            />
          </div>
        </div>
      )}

      {isSfsCustomDesign(item.design) && (
        <CustomDesignUpload
          notes={item.designNotes}
          uploads={item.designUploads}
          onNotesChange={designNotes => onChange({ designNotes })}
          onUploadsChange={designUploads => onChange({ designUploads })}
        />
      )}

      {item.type !== 'Diamond only' && (
        <div>
          <p className="text-sm font-medium mb-3" style={{ color: DARK }}>
            Metal<span style={{ color: GOLD }}> *</span>
          </p>
          <Image src="/sfsdiamond/order/metal-swatches.png" alt="Metal options" width={400} height={80} className="mb-4 rounded-xl" />
          <div className="flex flex-wrap gap-2">
            {specOptions.metals.map(m => (
              <CheckCard key={m.id} checked={item.metal === m.value} onChange={() => onChange({ metal: m.value })}>
                <span className="flex flex-col items-start gap-0.5">
                  <span>{m.label}</span>
                  {formatSfsMetalPercentLabel(m.price) && (
                    <span className="text-[11px] font-semibold tabular-nums" style={{ color: GOLD }}>
                      {formatSfsMetalPercentLabel(m.price)}
                    </span>
                  )}
                </span>
              </CheckCard>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Step 4 ───────────────────────────────────────────────────────────────────

function Step4({ data, update, specOptions }: {
  data: WizardFormData
  update: (p: Partial<WizardFormData>) => void
  specOptions: SfsOrderSpecOptions
}) {
  const [collapsedSet, setCollapsedSet] = useState<Set<number>>(new Set())

  const updateDiamond = (i: number, patch: Partial<DiamondItem>) => {
    update({ diamonds: data.diamonds.map((d, idx) => (idx === i ? { ...d, ...patch } : d)) })
  }
  const addDiamond = () => {
    if (data.diamonds.length >= 8) return
    setCollapsedSet(new Set(data.diamonds.map((_, i) => i)))
    update({ diamonds: [...data.diamonds, { ...EMPTY_DIAMOND }] })
  }
  const removeDiamond = (i: number) => {
    setCollapsedSet(prev => new Set([...prev].filter(n => n !== i).map(n => (n > i ? n - 1 : n))))
    update({ diamonds: data.diamonds.filter((_, idx) => idx !== i) })
  }
  const toggleCollapse = (i: number) => {
    setCollapsedSet(prev => {
      const s = new Set(prev)
      if (s.has(i)) {
        s.delete(i)
      } else {
        s.add(i)
      }
      return s
    })
  }

  return (
    <div className="space-y-6">
      <SectionTitle step={4} title="Diamond Specification" />
      <div className="space-y-5">
        {data.diamonds.map((d, i) => (
          <DiamondRow
            key={i} index={i} item={d}
            onChange={patch => updateDiamond(i, patch)}
            onRemove={() => removeDiamond(i)}
            showRemove={data.diamonds.length > 1}
            collapsed={collapsedSet.has(i)}
            onToggleCollapse={() => toggleCollapse(i)}
            specOptions={specOptions}
          />
        ))}
      </div>
      {data.diamonds.length < 8 && (
        <button
          type="button"
          onClick={addDiamond}
          className="w-full py-3 rounded-xl border-2 border-dashed text-sm font-medium transition-all hover:bg-amber-50"
          style={{ borderColor: GOLD, color: GOLD }}
        >
          + Add Another Diamond
        </button>
      )}
    </div>
  )
}

// ─── Step 5 (summary) ────────────────────────────────────────────────────────

function SummaryRow({ label, value }: { label: string; value?: string }) {
  if (!value) return null
  return (
    <div className="flex gap-4 py-2 border-b text-sm" style={{ borderColor: BORDER }}>
      <span className="w-40 flex-shrink-0 font-medium" style={{ color: MUTED }}>{label}</span>
      <span style={{ color: DARK }}>{value}</span>
    </div>
  )
}

function Step5({
  data,
  pricing,
  personalized,
}: {
  data: WizardFormData
  pricing: ReturnType<typeof computeSfsOrderPricing> | null
  personalized: boolean
}) {
  const hasCustomDesign = data.diamonds.some(d => isSfsCustomDesign(d.design))

  return (
    <div className="space-y-8">
      <SectionTitle step={5} title="Order Summary" sub="Please review your order before submitting." />

      {personalized && (
        <p className="text-xs rounded-xl px-4 py-3" style={{ background: '#FDF8F0', color: GOLD }}>
          Prices below use your personalised client price list.
        </p>
      )}

      {hasCustomDesign && (
        <p className="text-xs rounded-xl px-4 py-3" style={{ background: '#EFF6FF', color: '#1D4ED8' }}>
          Custom jewellery designs require a staff quotation. The estimate below covers diamond options only;
          jewellery pricing will follow after our team reviews your upload.
        </p>
      )}

      <div className="rounded-2xl border p-6 space-y-1" style={{ borderColor: BORDER }}>
        <p className="font-semibold mb-3" style={{ color: DARK }}>Memorial</p>
        <SummaryRow label="Memorial Name" value={data.memorialName} />
        <SummaryRow label="Relationship" value={data.relationship === 'Pet' ? `Pet — ${data.relationshipPet}` : data.relationship} />
      </div>

      <div className="rounded-2xl border p-6 space-y-1" style={{ borderColor: BORDER }}>
        <p className="font-semibold mb-3" style={{ color: DARK }}>Contact Details</p>
        <SummaryRow label="Client Name" value={data.clientName} />
        <SummaryRow label="Contact" value={data.contactNumber} />
        <SummaryRow label="Email" value={data.email} />
        <SummaryRow label="Mailing Address" value={data.mailingAddress} />
      </div>

      <div className="rounded-2xl border p-6 space-y-1" style={{ borderColor: BORDER }}>
        <p className="font-semibold mb-3" style={{ color: DARK }}>Source Material</p>
        <SummaryRow label="Source" value={data.sourceType} />
        <SummaryRow label="Remarks" value={data.remarks} />
        <SummaryRow label="Package" value={data.mailingPackage} />
        <SummaryRow label="Color" value={data.color} />
      </div>

      <div className="rounded-2xl border p-6 space-y-4" style={{ borderColor: BORDER }}>
        <p className="font-semibold" style={{ color: DARK }}>Diamonds ({data.diamonds.length})</p>
        {data.diamonds.map((d, i) => (
          <div key={i} className="rounded-xl p-4 space-y-1" style={{ background: '#F2EDE3' }}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold" style={{ color: DARK }}>#{i + 1}</p>
              {pricing?.lines[i] && (
                <p className="text-sm font-semibold tabular-nums" style={{ color: GOLD }}>
                  {isSfsCustomDesign(d.design)
                    ? `${formatSfsPriceLabel(pricing.lines[i].unitPrice)} + jewellery quote`
                    : formatSfsPriceLabel(pricing.lines[i].unitPrice)}
                </p>
              )}
            </div>
            <SummaryRow label="Carat" value={d.carat ? `${d.carat} ct` : undefined} />
            <SummaryRow label="Shape" value={d.shape} />
            <SummaryRow label="Type" value={d.type} />
            {d.ringSize && <SummaryRow label="Ring Size (EU)" value={d.ringSize} />}
            {d.design && <SummaryRow label="Design" value={d.design} />}
            {isSfsCustomDesign(d.design) && d.designUploads.length > 0 && (
              <SummaryRow label="Design files" value={d.designUploads.map(f => f.fileName).join(', ')} />
            )}
            {d.designNotes && <SummaryRow label="Design notes" value={d.designNotes} />}
            {d.metal && <SummaryRow label="Metal" value={d.metal} />}
            {isSfsCustomDesign(d.design) && (
              <SummaryRow label="Jewellery" value="Pending quotation" />
            )}
          </div>
        ))}
        {pricing && (
          <div className="pt-2 border-t space-y-1.5" style={{ borderColor: BORDER }}>
            {pricing.discountAmount > 0 && (
              <>
                <div className="flex items-center justify-between text-sm">
                  <span style={{ color: MUTED }}>Diamond subtotal</span>
                  <span className="tabular-nums" style={{ color: DARK }}>{formatSfsPriceLabel(pricing.diamondGross)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span style={{ color: MUTED }}>Multi-diamond discount (−{pricing.discountPct}%)</span>
                  <span className="tabular-nums" style={{ color: '#B91C1C' }}>
                    −HK${pricing.discountAmount.toLocaleString('en-HK', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                  </span>
                </div>
                {pricing.jewelleryTotal > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <span style={{ color: MUTED }}>Jewellery</span>
                    <span className="tabular-nums" style={{ color: DARK }}>{formatSfsPriceLabel(pricing.jewelleryTotal)}</span>
                  </div>
                )}
              </>
            )}
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold" style={{ color: DARK }}>
                {hasCustomDesign ? 'Estimated diamond total' : 'Estimated total'}
              </span>
              <span className="text-lg font-bold tabular-nums" style={{ color: GOLD }}>
                {formatSfsPriceLabel(pricing.subtotal)}
              </span>
            </div>
            {hasCustomDesign && (
              <p className="text-xs" style={{ color: MUTED }}>Jewellery quotation will be provided separately by our team.</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Wizard shell ─────────────────────────────────────────────────────────────

export default function OrderWizard({
  mode,
  orderId,
  initialData,
  specOptions,
}: {
  mode: 'create' | 'edit'
  orderId?: string
  initialData?: Partial<WizardFormData>
  specOptions: SfsOrderSpecOptions
}) {
  const router = useRouter()
  const { data: session, status: sessionStatus } = useSession()
  const [step, setStep] = useState(1)
  const [data, setData] = useState<WizardFormData>(() => {
    const base = { ...WIZARD_INITIAL, ...initialData }
    return {
      ...base,
      diamonds: (initialData?.diamonds ?? WIZARD_INITIAL.diamonds).map(d => ({
        ...EMPTY_DIAMOND,
        ...d,
        designNotes: d.designNotes ?? '',
        designUploads: d.designUploads ?? [],
      })),
    }
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [pricedSpecs, setPricedSpecs] = useState<SfsOrderSpecOptions>(specOptions)
  const [personalized, setPersonalized] = useState(false)
  const [discountTiers, setDiscountTiers] = useState<SfsMultiDiamondDiscountTier[]>([])

  // Load effective catalog prices (global, or personalised when logged in with overrides).
  useEffect(() => {
    if (sessionStatus === 'loading') return
    let cancelled = false
    fetch('/api/sfsdiamond/pricing')
      .then(r => r.json())
      .then(body => {
        if (cancelled || !body?.specOptions) return
        setPricedSpecs(body.specOptions as SfsOrderSpecOptions)
        setPersonalized(Boolean(body.personalized))
        setDiscountTiers(Array.isArray(body.multiDiamondDiscountTiers) ? body.multiDiamondDiscountTiers : [])
      })
      .catch(() => {/* keep server-provided catalog */})
    return () => { cancelled = true }
  }, [sessionStatus, session?.user?.id])

  const quote = useMemo(
    () => computeSfsOrderPricing({
      diamonds: data.diamonds,
      sourceType: data.sourceType,
      color: data.color,
      specOptions: pricedSpecs,
      multiDiamondDiscountTiers: discountTiers,
    }),
    [data.diamonds, data.sourceType, data.color, pricedSpecs, discountTiers],
  )

  // Pre-fill from session + saved profile (create mode only)
  useEffect(() => {
    if (!session?.user) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- session data arrives asynchronously and only fills empty defaults.
    setData(prev => ({
      ...prev,
      clientName: prev.clientName || session.user.name || '',
      email: prev.email || session.user.email || '',
    }))
    if (mode === 'create') {
      fetch('/api/sfsdiamond/profile')
        .then(r => r.json())
        .then(profile => {
          if (profile.phone || profile.mailingAddress) {
            setData(prev => ({
              ...prev,
              contactNumber: prev.contactNumber || profile.phone || '',
              mailingAddress: prev.mailingAddress || profile.mailingAddress || '',
            }))
          }
        })
        .catch(() => {/* ignore */})
    }
  }, [session, mode])

  const update = (patch: Partial<WizardFormData>) => setData(prev => ({ ...prev, ...patch }))

  const validateStep = (): string => {
    if (step === 1) {
      if (!data.memorialName) return 'Please enter the memorial name.'
      if (!data.relationship) return 'Please select a relationship.'
      if (!data.clientName) return 'Please enter your name.'
      if (!data.contactNumber) return 'Please enter a contact number.'
      if (!data.email || !/\S+@\S+\.\S+/.test(data.email)) return 'Please enter a valid email.'
      if (!data.mailingAddress) return 'Please enter a mailing address.'
    }
    if (step === 2) {
      if (!data.sourceType) return 'Please select a source type.'
      if (!data.mailingPackage) return 'Please select a mailing package.'
    }
    if (step === 3) {
      if (!data.color) return 'Please select a diamond color.'
    }
    if (step === 4) {
      for (let i = 0; i < data.diamonds.length; i++) {
        const d = data.diamonds[i]
        if (!d.carat) return `Diamond #${i + 1}: please select a carat.`
        if (!d.shape) return `Diamond #${i + 1}: please select a shape.`
        if (!d.type) return `Diamond #${i + 1}: please select a setting type.`
        if (d.type === 'Ring' && !d.ringSize) return `Diamond #${i + 1}: please enter a ring size.`
        if (d.type !== 'Diamond only' && !d.design) return `Diamond #${i + 1}: please select a design.`
        if (isSfsCustomDesign(d.design) && d.designUploads.length === 0) {
          return `Diamond #${i + 1}: please upload at least one custom design file.`
        }
        if (d.type !== 'Diamond only' && !d.metal) return `Diamond #${i + 1}: please select a metal.`
      }
    }
    return ''
  }

  const handleNext = () => {
    const err = validateStep()
    if (err) { setError(err); return }
    setError('')
    setStep(s => s + 1)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleBack = () => {
    setError('')
    setStep(s => s - 1)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    setError('')
    const payload = {
      memorialName: data.memorialName,
      relationship: data.relationship === 'Pet' ? `Pet — ${data.relationshipPet}` : data.relationship,
      clientName: data.clientName,
      contactNumber: data.contactNumber,
      email: data.email,
      mailingAddress: data.mailingAddress,
      sourceType: data.sourceType,
      sourceOther: '',
      remarks: data.remarks || undefined,
      mailingPackage: data.mailingPackage,
      color: data.color,
      diamonds: data.diamonds.map(d => ({
        carat:    d.carat,
        shape:    d.shape,
        type:     d.type,
        ringSize: d.ringSize  || undefined,
        design:   d.design    || undefined,
        designNotes: d.designNotes.trim() || undefined,
        metal:    d.metal     || undefined,
        designUploads: isSfsCustomDesign(d.design) && d.designUploads.length > 0
          ? d.designUploads
          : undefined,
      })),
    }

    try {
      const url    = mode === 'edit' ? `/api/sfsdiamond/orders/${orderId}` : '/api/sfsdiamond/orders'
      const method = mode === 'edit' ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.error ?? 'Submission failed')
      }
      const { sampleCode } = await res.json()
      if (mode === 'edit') {
        router.push(`/sfsdiamond/dashboard/${orderId}`)
      } else {
        router.push(`/sfsdiamond/order/success?code=${encodeURIComponent(sampleCode)}`)
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen" style={{ background: '#FAFAF8' }}>
      {/* Progress bar */}
      <div className="sticky top-16 z-40 border-b" style={{ background: 'rgba(250,250,248,0.95)', borderColor: BORDER }}>
        <div className="max-w-3xl mx-auto px-6 py-3 flex items-center gap-2 overflow-x-auto">
          {STEPS.map((label, i) => {
            const n = i + 1
            const done = step > n
            const active = step === n
            return (
              <div key={label} className="flex items-center gap-2 flex-shrink-0">
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                  style={{ background: done ? GOLD : active ? DARK : '#EDE7D8', color: done || active ? '#fff' : MUTED }}
                >
                  {done ? '✓' : n}
                </div>
                <span className="text-xs font-medium hidden sm:block" style={{ color: active ? DARK : MUTED }}>
                  {label}
                </span>
                {i < STEPS.length - 1 && (
                  <div className="w-6 h-px mx-1 flex-shrink-0" style={{ background: done ? GOLD : BORDER }} />
                )}
              </div>
            )
          })}
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-12">
        {personalized && step >= 2 && (
          <p className="mb-6 text-xs rounded-xl px-4 py-3" style={{ background: '#FDF8F0', color: GOLD }}>
            Showing your personalised client prices.
          </p>
        )}
        {step === 1 && <Step1 data={data} update={update} />}
        {step === 2 && <Step2 data={data} update={update} specOptions={pricedSpecs} />}
        {step === 3 && <Step3 data={data} update={update} specOptions={pricedSpecs} />}
        {step === 4 && (
          <>
            <Step4 data={data} update={update} specOptions={pricedSpecs} />
            {quote.subtotal > 0 && (
              <div className="mt-6 rounded-2xl border px-5 py-4 space-y-1.5" style={{ borderColor: BORDER, background: '#fff' }}>
                {quote.discountAmount > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <span style={{ color: MUTED }}>Multi-diamond discount (−{quote.discountPct}%)</span>
                    <span className="tabular-nums" style={{ color: '#B91C1C' }}>
                      −HK${quote.discountAmount.toLocaleString('en-HK', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium" style={{ color: MUTED }}>
                    {data.diamonds.some(d => isSfsCustomDesign(d.design))
                      ? 'Estimated diamond total so far'
                      : 'Estimated total so far'}
                  </span>
                  <span className="text-lg font-bold tabular-nums" style={{ color: GOLD }}>
                    {formatSfsPriceLabel(quote.subtotal)}
                  </span>
                </div>
                {data.diamonds.some(d => isSfsCustomDesign(d.design)) && (
                  <p className="text-xs" style={{ color: MUTED }}>
                    Custom jewellery will be quoted by our team after review.
                  </p>
                )}
              </div>
            )}
          </>
        )}
        {step === 5 && <Step5 data={data} pricing={quote} personalized={personalized} />}

        {error && (
          <div className="mt-4 p-4 rounded-xl text-sm" style={{ background: '#FEF2F2', color: '#B91C1C' }}>
            {error}
          </div>
        )}

        <NavButtons
          step={step}
          total={STEPS.length}
          onBack={handleBack}
          onNext={step < STEPS.length ? handleNext : handleSubmit}
          nextLabel={step === STEPS.length ? (submitting ? 'Saving…' : mode === 'edit' ? 'Save Changes' : 'Submit Order') : undefined}
          disabled={submitting}
        />
      </div>
    </div>
  )
}
