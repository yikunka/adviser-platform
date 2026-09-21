'use client'

import { useCallback, useEffect, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { useAdminPermission } from '@/components/admin/AdminPermissionContext'

const CURRENCIES = ['USD', 'HKD', 'CNY', 'EUR'] as const
const KIND_LABEL = {
  QUOTATION: 'Quotation',
  PROFORMA: 'Proforma invoice',
  COMMERCIAL_INVOICE: 'Commercial invoice',
} as const

type Kind = keyof typeof KIND_LABEL
type Line = { description: string; quantity: string; unit: string; unitPrice: string }
type Document = {
  id: string
  kind: Kind
  status: 'DRAFT' | 'ACCEPTED' | 'CANCELLED'
  documentNumber: string
  documentDate: string
  currency: (typeof CURRENCIES)[number]
  customerName: string
  company: string
  vatNumber: string
  deliveryAddress: string
  notes: string
  total: number
  lines: { description: string; quantity: number; unit: string; unitPrice: number }[]
}

const inputStyle: React.CSSProperties = {
  background: 'var(--surface-input)',
  border: '1px solid var(--border-subtle)',
  color: 'var(--foreground)',
}

function money(quantity: string, unitPrice: string): number {
  const qty = Number(quantity)
  const price = Number(unitPrice)
  if (!Number.isFinite(qty) || !Number.isFinite(price)) return 0
  return Math.round(qty * price * 100) / 100
}

function blankLine(): Line {
  return { description: '', quantity: '1', unit: '', unitPrice: '' }
}

export function JmmTradeDocuments({ orderId }: { orderId: string }) {
  const canEdit = useAdminPermission('jmmOrders.edit')
  const [documents, setDocuments] = useState<Document[]>([])
  const [actions, setActions] = useState({ createQuotation: false, createProforma: false, createInvoice: false })
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/jmm-orders/${orderId}/documents`)
    if (!res.ok) {
      toast.error('Could not load trade documents')
      setLoading(false)
      return
    }
    const data = await res.json() as { documents: Document[]; actions: typeof actions }
    setDocuments(data.documents)
    setActions(data.actions)
    setLoading(false)
  }, [orderId])

  useEffect(() => { void load() }, [load])

  async function create(action: 'QUOTATION' | 'PROFORMA' | 'COMMERCIAL_INVOICE') {
    setBusy(true)
    try {
      const res = await fetch(`/api/admin/jmm-orders/${orderId}/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const data = await res.json().catch(() => ({})) as { error?: string; documentNumber?: string }
      if (!res.ok) {
        toast.error(data.error ?? 'Could not create the document')
        return
      }
      toast.success(data.documentNumber ? `${data.documentNumber} created` : 'Document created')
      await load()
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>Loading trade documents…</p>
  }

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold" style={{ color: 'var(--foreground)' }}>Trade documents</h2>
        <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
          Save the order first. A quotation copies the saved order. The next button copies the saved document, so save it before you agree. The earlier paper stays on file.
        </p>
      </div>

      {canEdit && actions.createQuotation && (
        <button type="button" disabled={busy} onClick={() => void create('QUOTATION')} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold disabled:opacity-60" style={{ background: '#C9A96E', color: '#1a1408' }}>
          <Plus size={14} /> Create quotation
        </button>
      )}

      {documents.map(doc => (
        <DocumentCard
          key={doc.id}
          orderId={orderId}
          doc={doc}
          canEdit={canEdit}
          busy={busy}
          showProforma={doc.kind === 'QUOTATION' && doc.status !== 'CANCELLED' && actions.createProforma}
          showInvoice={doc.kind === 'PROFORMA' && doc.status !== 'CANCELLED' && actions.createInvoice}
          onCreate={create}
          onChanged={load}
        />
      ))}
    </section>
  )
}

function DocumentCard({
  orderId,
  doc,
  canEdit,
  busy,
  showProforma,
  showInvoice,
  onCreate,
  onChanged,
}: {
  orderId: string
  doc: Document
  canEdit: boolean
  busy: boolean
  showProforma: boolean
  showInvoice: boolean
  onCreate: (action: 'PROFORMA' | 'COMMERCIAL_INVOICE') => Promise<void>
  onChanged: () => Promise<void>
}) {
  const editable = canEdit && doc.status === 'DRAFT'
  const [date, setDate] = useState(doc.documentDate)
  const [currency, setCurrency] = useState(doc.currency)
  const [customerName, setCustomerName] = useState(doc.customerName)
  const [company, setCompany] = useState(doc.company)
  const [vatNumber, setVatNumber] = useState(doc.vatNumber)
  const [deliveryAddress, setDeliveryAddress] = useState(doc.deliveryAddress)
  const [notes, setNotes] = useState(doc.notes)
  const [lines, setLines] = useState<Line[]>(doc.lines.map(line => ({
    description: line.description,
    quantity: String(line.quantity),
    unit: line.unit,
    unitPrice: String(line.unitPrice),
  })))
  const [saving, setSaving] = useState(false)
  const total = lines.reduce((sum, line) => sum + money(line.quantity, line.unitPrice), 0)
  const muted = doc.status === 'CANCELLED'

  useEffect(() => {
    setDate(doc.documentDate)
    setCurrency(doc.currency)
    setCustomerName(doc.customerName)
    setCompany(doc.company)
    setVatNumber(doc.vatNumber)
    setDeliveryAddress(doc.deliveryAddress)
    setNotes(doc.notes)
    setLines(doc.lines.map(line => ({
      description: line.description,
      quantity: String(line.quantity),
      unit: line.unit,
      unitPrice: String(line.unitPrice),
    })))
  }, [doc])

  async function save() {
    const payload = {
      action: 'UPDATE',
      documentDate: date,
      currency,
      customerName: customerName.trim(),
      company: company.trim(),
      vatNumber: vatNumber.trim(),
      deliveryAddress: deliveryAddress.trim(),
      notes: notes.trim(),
      lines: lines.map(line => ({
        description: line.description.trim(),
        quantity: Number(line.quantity),
        unit: line.unit.trim(),
        unitPrice: Number(line.unitPrice),
      })),
    }
    if (!payload.customerName || payload.lines.some(line => !line.description || !(line.quantity > 0) || Number.isNaN(line.unitPrice))) {
      toast.error('Each line needs a description, quantity, and unit price')
      return
    }
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/jmm-orders/${orderId}/documents/${doc.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json().catch(() => ({})) as { error?: string }
      if (!res.ok) {
        toast.error(data.error ?? 'Could not save')
        return
      }
      toast.success('Document saved')
      await onChanged()
    } finally {
      setSaving(false)
    }
  }

  async function cancel() {
    if (!window.confirm(`Cancel ${doc.documentNumber}?`)) return
    const res = await fetch(`/api/admin/jmm-orders/${orderId}/documents/${doc.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'CANCEL' }),
    })
    const data = await res.json().catch(() => ({})) as { error?: string }
    if (!res.ok) {
      toast.error(data.error ?? 'Could not cancel')
      return
    }
    toast.success('Document cancelled')
    await onChanged()
  }

  return (
    <article className="rounded-xl p-4 space-y-3" style={{ background: 'var(--card)', border: '1px solid var(--border)', opacity: muted ? 0.6 : 1 }}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold" style={{ color: '#C9A96E' }}>{KIND_LABEL[doc.kind]}</p>
          <h3 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>{doc.documentNumber}</h3>
        </div>
        <span className="text-xs font-semibold px-2 py-1 rounded-full" style={{ background: 'rgba(201,169,110,0.12)', color: '#C9A96E' }}>{doc.status}</span>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
          Date
          <input type="date" value={date} disabled={!editable} onChange={e => setDate(e.target.value)} className="mt-1 w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle} />
        </label>
        <label className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
          Currency
          <select value={currency} disabled={!editable} onChange={e => setCurrency(e.target.value as Document['currency'])} className="mt-1 w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle}>
            {CURRENCIES.map(item => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        <label className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
          Customer
          <input value={customerName} disabled={!editable} onChange={e => setCustomerName(e.target.value)} className="mt-1 w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle} />
        </label>
        <label className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
          Company
          <input value={company} disabled={!editable} onChange={e => setCompany(e.target.value)} className="mt-1 w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle} />
        </label>
        <label className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
          VAT number
          <input value={vatNumber} disabled={!editable} onChange={e => setVatNumber(e.target.value)} className="mt-1 w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle} />
        </label>
        <label className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
          Delivery address
          <textarea value={deliveryAddress} disabled={!editable} onChange={e => setDeliveryAddress(e.target.value)} rows={2} className="mt-1 w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle} />
        </label>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ color: 'var(--muted-foreground)' }}>
              <th className="text-left py-2 font-medium">Description</th>
              <th className="text-left py-2 font-medium">Qty</th>
              <th className="text-left py-2 font-medium">Unit</th>
              <th className="text-left py-2 font-medium">Unit price</th>
              <th className="text-right py-2 font-medium">Amount</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {lines.map((line, index) => (
              <tr key={index} style={{ borderTop: '1px solid var(--border)' }}>
                <td className="py-2 pr-2"><input value={line.description} disabled={!editable} onChange={e => setLines(current => current.map((row, i) => i === index ? { ...row, description: e.target.value } : row))} className="w-full min-w-40 px-2 py-1.5 rounded text-sm outline-none" style={inputStyle} /></td>
                <td className="py-2 pr-2"><input value={line.quantity} disabled={!editable} onChange={e => setLines(current => current.map((row, i) => i === index ? { ...row, quantity: e.target.value } : row))} className="w-20 px-2 py-1.5 rounded text-sm outline-none" style={inputStyle} /></td>
                <td className="py-2 pr-2"><input value={line.unit} disabled={!editable} onChange={e => setLines(current => current.map((row, i) => i === index ? { ...row, unit: e.target.value } : row))} className="w-20 px-2 py-1.5 rounded text-sm outline-none" style={inputStyle} /></td>
                <td className="py-2 pr-2"><input value={line.unitPrice} disabled={!editable} onChange={e => setLines(current => current.map((row, i) => i === index ? { ...row, unitPrice: e.target.value } : row))} className="w-24 px-2 py-1.5 rounded text-sm outline-none" style={inputStyle} /></td>
                <td className="py-2 text-right whitespace-nowrap" style={{ color: 'var(--foreground)' }}>{money(line.quantity, line.unitPrice).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td className="py-2 pl-2">
                  {editable && lines.length > 1 && (
                    <button type="button" onClick={() => setLines(current => current.filter((_, i) => i !== index))} style={{ color: '#ef4444' }} aria-label="Remove line"><Trash2 size={14} /></button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editable && (
        <button type="button" onClick={() => setLines(current => [...current, blankLine()])} className="text-xs" style={{ color: '#C9A96E' }}>Add line</button>
      )}
      <p className="text-sm font-semibold text-right" style={{ color: 'var(--foreground)' }}>
        Total {currency} {total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </p>
      <label className="block text-xs" style={{ color: 'var(--muted-foreground)' }}>
        Notes
        <textarea value={notes} disabled={!editable} onChange={e => setNotes(e.target.value)} rows={2} className="mt-1 w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle} />
      </label>

      {canEdit && doc.status !== 'CANCELLED' && (
        <div className="flex flex-wrap gap-2">
          {editable && (
            <button type="button" disabled={saving} onClick={() => void save()} className="px-3 py-2 rounded-lg text-sm font-semibold disabled:opacity-60" style={{ background: '#C9A96E', color: '#1a1408' }}>
              {saving ? 'Saving…' : 'Save document'}
            </button>
          )}
          {showProforma && (
            <button type="button" disabled={busy} onClick={() => void onCreate('PROFORMA')} className="px-3 py-2 rounded-lg text-sm font-semibold disabled:opacity-60" style={{ background: '#1a1408', color: '#C9A96E', border: '1px solid #C9A96E' }}>
              Customer agreed — create proforma
            </button>
          )}
          {showInvoice && (
            <button type="button" disabled={busy} onClick={() => void onCreate('COMMERCIAL_INVOICE')} className="px-3 py-2 rounded-lg text-sm font-semibold disabled:opacity-60" style={{ background: '#1a1408', color: '#C9A96E', border: '1px solid #C9A96E' }}>
              Proforma accepted — create commercial invoice
            </button>
          )}
          <button type="button" onClick={() => void cancel()} className="px-3 py-2 rounded-lg text-sm" style={{ color: '#ef4444' }}>Cancel document</button>
        </div>
      )}
    </article>
  )
}
