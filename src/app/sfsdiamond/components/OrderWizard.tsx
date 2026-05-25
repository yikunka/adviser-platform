'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'

// ─── Types ────────────────────────────────────────────────────────────────────

export type DiamondItem = {
  carat: string
  shape: string
  type: string
  ringSize: string
  design: string
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

const EMPTY_DIAMOND: DiamondItem = { carat: '', shape: '', type: '', ringSize: '', design: '', metal: '' }

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

const CUTS = [
  { label: 'Round',         src: '/sfsdiamond/order/cut-round.jpeg' },
  { label: 'Oval',          src: '/sfsdiamond/order/cut-oval.jpeg' },
  { label: 'Heart',         src: '/sfsdiamond/order/cut-heart.jpeg' },
  { label: 'Octagon',       src: '/sfsdiamond/order/cut-octagon.jpeg' },
  { label: 'Cushion Square',src: '/sfsdiamond/order/cut-cushion.jpeg' },
  { label: 'Princess',      src: '/sfsdiamond/order/cut-princess.png' },
  { label: 'Emerald',       src: '/sfsdiamond/order/cut-Emerald.png' },
]

const RING_DESIGNS = [
  { label: 'Solitaire', src: '/sfsdiamond/order/ring-solitaire.png' },
  { label: 'Pave',      src: '/sfsdiamond/order/ring-pave.png' },
  { label: 'Halo',      src: '/sfsdiamond/order/ring-halo.png' },
  { label: 'R Classic', src: '/sfsdiamond/order/ring-R-Classic.jpg' },
]

const NECKLACE_DESIGNS = [
  { label: 'Classic', src: '/sfsdiamond/order/necklace-classic.jpeg' },
  { label: 'Plain',   src: '/sfsdiamond/order/necklace-plain.jpeg' },
  { label: 'Buddha',  src: '/sfsdiamond/order/necklace-buddha.jpeg' },
  { label: 'Cross',   src: '/sfsdiamond/order/necklace-cross.jpeg' },
  { label: 'Yinyang', src: '/sfsdiamond/order/necklace-yinyang.jpeg' },
]

const METALS = [
  { label: 'Platinum',    code: 'Platinum' },
  { label: 'Yellow Gold', code: 'Yellow Gold' },
  { label: 'Rose Gold',   code: 'Rose Gold' },
  { label: 'White Gold',  code: 'White Gold' },
]

const CARATS = ['0.5', '1.0', '1.5', '2.0', '2.5', '3.0']
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

function ImageCard({ label, src, selected, onClick, tall, hideLabel }: {
  label: string; src: string; selected: boolean; onClick: () => void; tall?: boolean; hideLabel?: boolean
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
        <Image src={src} alt={label} fill className="object-contain" />
      </div>
      {!hideLabel && (
        <span className="text-xs font-semibold text-center" style={{ color: selected ? GOLD : MUTED }}>
          {label}
        </span>
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

function Step2({ data, update }: { data: WizardFormData; update: (p: Partial<WizardFormData>) => void }) {
  const SOURCES = ['Hairs', 'Ashes', 'Mix']
  return (
    <div className="space-y-6">
      <SectionTitle
        step={2}
        title="Source Material"
        sub="Approximately 60 g of bone ash or 1 g of hair is needed per carat. The amount scales linearly with the number of diamonds."
      />
      <Field label="Source Type" required>
        <div className="flex flex-wrap gap-2">
          {SOURCES.map(s => (
            <CheckCard key={s} checked={data.sourceType === s} onChange={() => update({ sourceType: s, sourceOther: '' })}>
              {s}
            </CheckCard>
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

function Step3({ data, update }: { data: WizardFormData; update: (p: Partial<WizardFormData>) => void }) {
  const COLORS = ['Natural Color', 'Transparent']
  return (
    <div className="space-y-6">
      <SectionTitle
        step={3}
        title="Diamond Color"
        sub="Each memorial diamond is cultivated from the carbon extracted from your loved one's hair or ashes. We reject any artificial color modification to fully preserve the elemental composition of the raw material."
      />
      <Field label="Select Color" required>
        <div className="flex flex-wrap gap-3">
          {COLORS.map(c => (
            <CheckCard key={c} checked={data.color === c} onChange={() => update({ color: c })}>
              {c}
            </CheckCard>
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

// ─── Diamond row (Step 4) ─────────────────────────────────────────────────────

function DiamondRow({ index, item, onChange, onRemove, showRemove, collapsed, onToggleCollapse }: {
  index: number; item: DiamondItem; onChange: (p: Partial<DiamondItem>) => void
  onRemove: () => void; showRemove: boolean; collapsed: boolean; onToggleCollapse: () => void
}) {
  const designOptions = item.type === 'Ring' ? RING_DESIGNS : item.type === 'Necklace' ? NECKLACE_DESIGNS : []
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
        <div className="flex flex-wrap gap-2">
          {CARATS.map(c => (
            <button
              key={c}
              type="button"
              onClick={() => onChange({ carat: c })}
              className="px-5 py-2 rounded-full text-sm font-semibold border-2 transition-all"
              style={{
                borderColor: item.carat === c ? GOLD : BORDER,
                background: item.carat === c ? '#FDF8F0' : '#fff',
                color: item.carat === c ? GOLD : DARK,
              }}
            >
              {c} ct
            </button>
          ))}
        </div>
      </div>

      {/* Shape — pictures already have names; no text label needed */}
      <div>
        <p className="text-sm font-medium mb-3" style={{ color: DARK }}>
          Shape<span style={{ color: GOLD }}> *</span>
        </p>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
          {CUTS.map(cut => (
            <ImageCard
              key={cut.label}
              label={cut.label}
              src={cut.src}
              selected={item.shape === cut.label}
              onClick={() => onChange({ shape: cut.label })}
              hideLabel
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
          {['Ring', 'Necklace', 'Diamond only'].map(t => (
            <CheckCard key={t} checked={item.type === t} onChange={() => onChange({ type: t, design: '', ringSize: '' })}>
              {t}
            </CheckCard>
          ))}
        </div>
      </div>

      {item.type === 'Ring' && (
        <Field label="Ring Size (EU 40–70)" required>
          <Input
            type="number" min={40} max={70} value={item.ringSize}
            onChange={e => onChange({ ringSize: e.target.value })}
            placeholder="e.g. 54" style={{ maxWidth: 160 }}
          />
        </Field>
      )}

      {designOptions.length > 0 && (
        <div>
          <p className="text-sm font-medium mb-3" style={{ color: DARK }}>
            {item.type} Design<span style={{ color: GOLD }}> *</span>
          </p>
          <div className={`grid gap-3 ${item.type === 'Ring' ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-3 sm:grid-cols-5'}`}>
            {designOptions.map(d => (
              <ImageCard key={d.label} label={d.label} src={d.src} selected={item.design === d.label} onClick={() => onChange({ design: d.label })} tall />
            ))}
          </div>
        </div>
      )}

      {item.type !== 'Diamond only' && (
        <div>
          <p className="text-sm font-medium mb-3" style={{ color: DARK }}>
            Metal<span style={{ color: GOLD }}> *</span>
          </p>
          <Image src="/sfsdiamond/order/metal-swatches.png" alt="Metal options" width={400} height={80} className="mb-4 rounded-xl" />
          <div className="flex flex-wrap gap-2">
            {METALS.map(m => (
              <CheckCard key={m.code} checked={item.metal === m.code} onChange={() => onChange({ metal: m.code })}>
                {m.label}
              </CheckCard>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Step 4 ───────────────────────────────────────────────────────────────────

function Step4({ data, update }: { data: WizardFormData; update: (p: Partial<WizardFormData>) => void }) {
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
      {data.diamonds.length >= 2 && (
        <p className="text-xs text-center" style={{ color: MUTED }}>
          {data.diamonds.length === 2 ? '5% discount applied for 2 diamonds' : '8% discount applied for 3+ diamonds'}
        </p>
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

function Step5({ data }: { data: WizardFormData }) {
  return (
    <div className="space-y-8">
      <SectionTitle step={5} title="Order Summary" sub="Please review your order before submitting." />

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
            <p className="text-sm font-semibold mb-2" style={{ color: DARK }}>#{i + 1}</p>
            <SummaryRow label="Carat" value={d.carat ? `${d.carat} ct` : undefined} />
            <SummaryRow label="Shape" value={d.shape} />
            <SummaryRow label="Type" value={d.type} />
            {d.ringSize && <SummaryRow label="Ring Size (EU)" value={d.ringSize} />}
            {d.design && <SummaryRow label="Design" value={d.design} />}
            {d.metal && <SummaryRow label="Metal" value={d.metal} />}
          </div>
        ))}
        {data.diamonds.length >= 2 && (
          <p className="text-sm font-medium" style={{ color: GOLD }}>
            {data.diamonds.length === 2 ? '✦ 5% discount — 2 diamonds' : '✦ 8% discount — 3+ diamonds'}
          </p>
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
}: {
  mode: 'create' | 'edit'
  orderId?: string
  initialData?: Partial<WizardFormData>
}) {
  const router = useRouter()
  const { data: session } = useSession()
  const [step, setStep] = useState(1)
  const [data, setData] = useState<WizardFormData>({ ...WIZARD_INITIAL, ...initialData })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

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
        metal:    d.metal     || undefined,
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
        {step === 1 && <Step1 data={data} update={update} />}
        {step === 2 && <Step2 data={data} update={update} />}
        {step === 3 && <Step3 data={data} update={update} />}
        {step === 4 && <Step4 data={data} update={update} />}
        {step === 5 && <Step5 data={data} />}

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
