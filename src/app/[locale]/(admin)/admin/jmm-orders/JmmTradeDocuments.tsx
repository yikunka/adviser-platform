'use client'

import { useCallback, useEffect, useState } from 'react'
import { FileDown, Plus, Printer, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { useAdminPermission } from '@/components/admin/AdminPermissionContext'
import { JMM_BANK, JMM_COMPANY_NAME, JMM_DOCUMENT_TITLES, JMM_LETTERHEAD, formatJmmDocDate, jmmNumberLabel } from '@/lib/jmm/letterhead'
import { JMM_PACKING_OPTIONS } from '@/lib/jmm/constants'

const CURRENCIES = ['USD', 'HKD', 'CNY', 'EUR'] as const
type Kind = keyof typeof JMM_DOCUMENT_TITLES
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

function money(quantity: string, unitPrice: string): number {
  const qty = Number(quantity)
  const price = Number(unitPrice)
  if (!Number.isFinite(qty) || !Number.isFinite(price)) return 0
  return Math.round(qty * price * 100) / 100
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function blankLine(): Line {
  return { description: '', quantity: '1', unit: '', unitPrice: '' }
}

function printTradeDocument(input: {
  kind: Kind
  documentNumber: string
  date: string
  currency: string
  customerName: string
  company: string
  vatNumber: string
  deliveryAddress: string
  notes: string
  lines: Line[]
}) {
  const popup = window.open('', '_blank', 'noopener,noreferrer')
  if (!popup) {
    toast.error('Allow pop-ups to print this document')
    return
  }
  const client = input.company || input.customerName
  const attention = input.company ? input.customerName : ''
  const rows = input.lines.map((line, index) => {
    const amount = money(line.quantity, line.unitPrice)
    return `<tr>
      <td class="num">${index + 1}</td>
      <td>${escapeHtml(line.description)}</td>
      <td class="num">${escapeHtml(line.unit)}</td>
      <td class="num">${escapeHtml(line.quantity)}</td>
      <td class="num">${escapeHtml(line.unitPrice)}</td>
      <td class="num">${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
    </tr>`
  }).join('')
  const total = input.lines.reduce((sum, line) => sum + money(line.quantity, line.unitPrice), 0)
  const logo = `${window.location.origin}/jmm/logo.jpg`
  const signature = `${window.location.origin}/jmm/signature.png`
  const bankAddress = JMM_BANK.lines.map(line => `<div>${escapeHtml(line)}</div>`).join('')
  popup.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(input.documentNumber)}</title>
  <style>
    body { margin: 0; color: #111; font-family: "Times New Roman", Times, serif; }
    .sheet { max-width: 820px; margin: 0 auto; padding: 28px 32px 40px; }
    .head { display: grid; grid-template-columns: 150px 1fr; align-items: center; gap: 12px; margin-bottom: 14px; }
    .head img { width: 140px; height: auto; display: block; }
    .company { text-align: center; }
    .company h1 { margin: 0 0 4px; font-size: 22px; }
    .company p { margin: 0; font-size: 12px; line-height: 1.35; }
    .meta { font-size: 13px; line-height: 1.5; margin: 0 0 12px; }
    table.lines, table.confirm { width: 100%; border-collapse: collapse; font-size: 12px; }
    table.lines th, table.lines td, table.confirm th, table.confirm td { border: 1px solid #000; padding: 4px 6px; vertical-align: middle; }
    table.lines th { font-weight: 700; text-align: center; }
    td.num { text-align: center; }
    td.total { text-align: right; font-weight: 700; }
    .notes { margin: 10px 0 12px; white-space: pre-wrap; font-size: 12px; }
    h2 { margin: 10px 0 4px; font-size: 13px; }
    .bank { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; font-size: 12px; line-height: 1.45; margin-bottom: 12px; }
    .sign { height: 78px; text-align: center; }
    .sign img { height: 68px; width: auto; }
    @media print { .sheet { padding: 0; } }
  </style>
</head>
<body>
  <div class="sheet">
    <div class="head">
      <img src="${logo}" alt="JMM" />
      <div class="company">
        <h1>${escapeHtml(JMM_COMPANY_NAME)}</h1>
        <p>${escapeHtml(JMM_LETTERHEAD.address)}</p>
        <p>Tel: ${escapeHtml(JMM_LETTERHEAD.phone)}</p>
        <p>E-mail: ${escapeHtml(JMM_LETTERHEAD.email)}</p>
        <p>Website: ${escapeHtml(JMM_LETTERHEAD.website)}</p>
      </div>
    </div>
    <div class="meta">
      <div>Date: ${escapeHtml(formatJmmDocDate(input.date))}</div>
      <div>${escapeHtml(jmmNumberLabel(input.kind))}${escapeHtml(input.documentNumber)}</div>
      <div>Client: ${escapeHtml(client)}</div>
      <div>VAT: ${escapeHtml(input.vatNumber)}</div>
      <div>Delivery Address: ${escapeHtml(input.deliveryAddress)}</div>
      ${attention ? `<div>Attn: ${escapeHtml(attention)}</div>` : ''}
    </div>
    <table class="lines">
      <thead>
        <tr>
          <th rowspan="2">Item</th>
          <th rowspan="2">Description</th>
          <th>Packing</th>
          <th>Quantity</th>
          <th>Unit Price</th>
          <th>Amount</th>
        </tr>
        <tr>
          <th></th>
          <th></th>
          <th>(${escapeHtml(input.currency)})</th>
          <th>(${escapeHtml(input.currency)})</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
        <tr>
          <td colspan="4"></td>
          <td class="total">TOTAL ${escapeHtml(input.currency)}</td>
          <td class="num"><strong>${total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></td>
        </tr>
      </tbody>
    </table>
    ${`<h2>TERMS</h2><div class="notes">${escapeHtml(input.notes)}</div>`}
    <h2>BANK INFORMATION</h2>
    <div class="bank">
      <div>
        <div>${escapeHtml(JMM_BANK.name)}</div>
        <div>${escapeHtml(JMM_BANK.branch)}</div>
        ${bankAddress}
      </div>
      <div>
        <div>Acct Name: ${escapeHtml(JMM_BANK.accountName)}</div>
        <div>Acct #: ${escapeHtml(JMM_BANK.accountNumber)}</div>
        <div>SWIFT CODE: ${escapeHtml(JMM_BANK.swift)}</div>
      </div>
    </div>
    <table class="confirm">
      <tr><th colspan="2">CONFIRMATION</th></tr>
      <tr><th>${escapeHtml(JMM_COMPANY_NAME.toUpperCase())}</th><th>CLIENT</th></tr>
      <tr>
        <td class="sign"><img src="${signature}" alt="" /></td>
        <td class="sign"></td>
      </tr>
    </table>
  </div>
</body>
</html>`)
  popup.document.close()
  const images = [...popup.document.querySelectorAll('img')]
  const pending = images.filter(image => !image.complete)
  const startPrint = () => {
    popup.focus()
    popup.print()
  }
  if (pending.length === 0) startPrint()
  else {
    let left = pending.length
    for (const image of pending) {
      image.addEventListener('load', () => { left -= 1; if (left === 0) startPrint() }, { once: true })
      image.addEventListener('error', () => { left -= 1; if (left === 0) startPrint() }, { once: true })
    }
  }
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

  async function downloadWord() {
    const res = await fetch(`/api/admin/jmm-orders/${orderId}/documents/${doc.id}/docx`)
    if (!res.ok) {
      toast.error('Could not download the Word file. Save the document first.')
      return
    }
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${doc.documentNumber}.docx`
    link.click()
    URL.revokeObjectURL(url)
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

  const paperInput: React.CSSProperties = {
    width: '100%',
    border: 'none',
    background: 'transparent',
    color: '#111',
    font: 'inherit',
    outline: 'none',
    padding: 0,
  }
  const gridCell: React.CSSProperties = { border: '1px solid #000', padding: '4px 6px', verticalAlign: 'middle' }

  return (
    <article style={{ opacity: muted ? 0.6 : 1 }}>
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-xs font-semibold" style={{ color: 'var(--muted-foreground)' }}>{JMM_DOCUMENT_TITLES[doc.kind]}</p>
        <span className="text-xs font-semibold px-2 py-1 rounded-full" style={{ background: 'rgba(201,169,110,0.12)', color: '#C9A96E' }}>{doc.status}</span>
      </div>
      <div style={{ background: '#fff', color: '#111', fontFamily: '"Times New Roman", Times, serif', padding: '28px 24px 32px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '150px 1fr', alignItems: 'center', gap: 12, marginBottom: 14 }}>
          <img src="/jmm/logo.jpg" alt="JMM" width={140} height={57} style={{ width: 140, height: 'auto' }} />
          <div style={{ textAlign: 'center' }}>
            <p style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 700 }}>{JMM_COMPANY_NAME}</p>
            <p style={{ margin: 0, fontSize: 12, lineHeight: 1.35 }}>{JMM_LETTERHEAD.address}</p>
            <p style={{ margin: 0, fontSize: 12 }}>Tel: {JMM_LETTERHEAD.phone}</p>
            <p style={{ margin: 0, fontSize: 12 }}>E-mail: {JMM_LETTERHEAD.email}</p>
            <p style={{ margin: 0, fontSize: 12 }}>Website: {JMM_LETTERHEAD.website}</p>
          </div>
        </div>

        <div style={{ fontSize: 13, lineHeight: 1.7, marginBottom: 12 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span>Date:</span>
            {editable
              ? <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ ...paperInput, width: 160 }} />
              : <span>{formatJmmDocDate(date)}</span>}
          </div>
          <div>{jmmNumberLabel(doc.kind)}{doc.documentNumber}</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span>Client:</span>
            {editable
              ? <input value={company} onChange={e => setCompany(e.target.value)} placeholder={customerName || 'Company'} style={paperInput} />
              : <span>{company || customerName}</span>}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span>VAT:</span>
            <input value={vatNumber} disabled={!editable} onChange={e => setVatNumber(e.target.value)} style={paperInput} />
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <span style={{ whiteSpace: 'nowrap' }}>Delivery Address:</span>
            <textarea value={deliveryAddress} disabled={!editable} onChange={e => setDeliveryAddress(e.target.value)} rows={2} style={{ ...paperInput, resize: 'vertical' }} />
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span>Attn:</span>
            <input value={customerName} disabled={!editable} onChange={e => setCustomerName(e.target.value)} style={paperInput} />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr>
                <th rowSpan={2} style={gridCell}>Item</th>
                <th rowSpan={2} style={gridCell}>Description</th>
                <th style={gridCell}>Packing</th>
                <th style={gridCell}>Quantity</th>
                <th style={gridCell}>Unit Price</th>
                <th style={gridCell}>Amount</th>
                <th rowSpan={2} style={{ ...gridCell, width: 28, border: 'none' }} />
              </tr>
              <tr>
                <th style={gridCell} />
                <th style={gridCell} />
                <th style={gridCell}>
                  {editable ? (
                    <select value={currency} onChange={e => setCurrency(e.target.value as Document['currency'])} style={{ ...paperInput, textAlign: 'center' }}>
                      {CURRENCIES.map(item => <option key={item} value={item}>{item}</option>)}
                    </select>
                  ) : `(${currency})`}
                </th>
                <th style={gridCell}>({currency})</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, index) => (
                <tr key={index}>
                  <td style={{ ...gridCell, textAlign: 'center' }}>{index + 1}</td>
                  <td style={gridCell}>
                    <input value={line.description} disabled={!editable} onChange={e => setLines(current => current.map((row, i) => i === index ? { ...row, description: e.target.value } : row))} style={paperInput} />
                  </td>
                  <td style={gridCell}>
                    <select value={line.unit} disabled={!editable} onChange={e => setLines(current => current.map((row, i) => i === index ? { ...row, unit: e.target.value } : row))} style={{ ...paperInput, textAlign: 'center' }}>
                      <option value="">—</option>
                      {JMM_PACKING_OPTIONS.map(option => <option key={option} value={option}>{option}</option>)}
                      {line.unit && !(JMM_PACKING_OPTIONS as readonly string[]).includes(line.unit) && <option value={line.unit}>{line.unit}</option>}
                    </select>
                  </td>
                  <td style={gridCell}>
                    <input value={line.quantity} disabled={!editable} onChange={e => setLines(current => current.map((row, i) => i === index ? { ...row, quantity: e.target.value } : row))} style={{ ...paperInput, textAlign: 'center' }} />
                  </td>
                  <td style={gridCell}>
                    <input value={line.unitPrice} disabled={!editable} onChange={e => setLines(current => current.map((row, i) => i === index ? { ...row, unitPrice: e.target.value } : row))} style={{ ...paperInput, textAlign: 'center' }} />
                  </td>
                  <td style={{ ...gridCell, textAlign: 'center' }}>{money(line.quantity, line.unitPrice).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  <td style={{ ...gridCell, border: 'none', background: 'transparent' }}>
                    {editable && lines.length > 1 && (
                      <button type="button" onClick={() => setLines(current => current.filter((_, i) => i !== index))} style={{ color: '#ef4444' }} aria-label="Remove line"><Trash2 size={14} /></button>
                    )}
                  </td>
                </tr>
              ))}
              <tr>
                <td colSpan={4} style={gridCell} />
                <td style={{ ...gridCell, textAlign: 'right', fontWeight: 700 }}>TOTAL {currency}</td>
                <td style={{ ...gridCell, textAlign: 'center', fontWeight: 700 }}>{total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td style={{ border: 'none' }} />
              </tr>
            </tbody>
          </table>
        </div>
        {editable && (
          <button type="button" onClick={() => setLines(current => [...current, blankLine()])} className="text-xs mt-2" style={{ color: '#8a6a32' }}>Add line</button>
        )}
        <p style={{ margin: '12px 0 4px', fontSize: 13, fontWeight: 700 }}>TERMS</p>
        <textarea
          value={notes}
          disabled={!editable}
          onChange={e => setNotes(e.target.value)}
          rows={3}
          placeholder="Exchange rate, payment terms, shipping terms"
          style={{ ...paperInput, fontSize: 12, minHeight: 48 }}
        />

        <p style={{ margin: '12px 0 4px', fontSize: 13, fontWeight: 700 }}>BANK INFORMATION</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, fontSize: 12, lineHeight: 1.45 }}>
          <div>
            <div>{JMM_BANK.name}</div>
            <div>{JMM_BANK.branch}</div>
            {JMM_BANK.lines.map(line => <div key={line}>{line}</div>)}
          </div>
          <div>
            <div>Acct Name: {JMM_BANK.accountName}</div>
            <div>Acct #: {JMM_BANK.accountNumber}</div>
            <div>SWIFT CODE: {JMM_BANK.swift}</div>
          </div>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, marginTop: 12 }}>
          <thead>
            <tr><th colSpan={2} style={gridCell}>CONFIRMATION</th></tr>
            <tr>
              <th style={gridCell}>{JMM_COMPANY_NAME.toUpperCase()}</th>
              <th style={gridCell}>CLIENT</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ ...gridCell, height: 78, textAlign: 'center' }}>
                <img src="/jmm/signature.png" alt="" style={{ height: 68, width: 'auto', margin: '0 auto' }} />
              </td>
              <td style={{ ...gridCell, height: 78 }} />
            </tr>
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap gap-2 py-3">
        <button type="button" onClick={() => printTradeDocument({ kind: doc.kind, documentNumber: doc.documentNumber, date, currency, customerName, company, vatNumber, deliveryAddress, notes, lines })} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm" style={{ color: 'var(--foreground)', border: '1px solid var(--border)' }}>
          <Printer size={14} /> Print
        </button>
        <button type="button" onClick={() => void downloadWord()} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm" style={{ color: 'var(--foreground)', border: '1px solid var(--border)' }}>
          <FileDown size={14} /> Download Word
        </button>
        {canEdit && doc.status !== 'CANCELLED' && (
          <>
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
          </>
        )}
      </div>
    </article>
  )
}
