'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useAdminPermission } from '@/components/admin/AdminPermissionContext'

const CURRENCIES = ['USD', 'HKD', 'CNY', 'EUR'] as const
const STATUSES = ['EXPECTED', 'RECEIVED', 'CHECKED', 'PAID'] as const
const DOC_KINDS = [
  ['BILL_OF_LADING', 'Bill of lading'],
  ['AIRWAY_BILL', 'Airway bill'],
  ['PACKING_LIST', 'Packing list'],
  ['SUPPLIER_INVOICE', 'Supplier invoice'],
  ['CERTIFICATE_OF_ORIGIN', 'Certificate of origin'],
  ['INSURANCE', 'Insurance'],
  ['INSPECTION', 'Inspection'],
  ['OTHER', 'Other'],
] as const

type SupplierOption = { id: string; name: string; company: string }
type ShipmentFile = { id: string; kind: string; fileName: string }
type Shipment = {
  id: string
  reference: string
  shipper: string
  consignee: string
  carrier: string
  incoterm: string
  portOfLoading: string
  portOfDischarge: string
  etd: string
  eta: string
  notes: string
  hasTransportDoc: boolean
  hasPackingList: boolean
  files: ShipmentFile[]
}
type Invoice = {
  id: string
  invoiceNumber: string
  invoiceDate: string
  currency: (typeof CURRENCIES)[number]
  amount: number
  status: (typeof STATUSES)[number]
  notes: string
  fileName: string
  hasFile: boolean
  supplier: SupplierOption
  shipments: Shipment[]
  papersComplete: boolean
}

const inputStyle: React.CSSProperties = {
  background: 'var(--surface-input)',
  border: '1px solid var(--border-subtle)',
  color: 'var(--foreground)',
}

async function openDownload(urlPath: string) {
  const res = await fetch(urlPath)
  const data = await res.json().catch(() => ({})) as { url?: string; error?: string }
  if (!res.ok || !data.url) {
    toast.error(data.error ?? 'Could not open the file')
    return
  }
  window.open(data.url, '_blank', 'noopener,noreferrer')
}

export function JmmPurchaseFile({ orderId, orderStatus }: { orderId: string; orderStatus: string }) {
  const canEdit = useAdminPermission('jmmOrders.edit')
  const canCreateSupplier = useAdminPermission('jmmSuppliers.create')
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([])
  const [loading, setLoading] = useState(true)
  const [supplierId, setSupplierId] = useState('')
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [invoiceDate, setInvoiceDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [currency, setCurrency] = useState<(typeof CURRENCIES)[number]>('USD')
  const [amount, setAmount] = useState('')
  const [newSupplier, setNewSupplier] = useState('')

  const load = useCallback(async () => {
    const [invoiceRes, supplierRes] = await Promise.all([
      fetch(`/api/admin/jmm-orders/${orderId}/supplier-invoices`),
      fetch('/api/admin/jmm-suppliers?pageSize=200'),
    ])
    if (invoiceRes.ok) {
      const data = await invoiceRes.json() as { invoices: Invoice[] }
      setInvoices(data.invoices)
    }
    if (supplierRes.ok) {
      const data = await supplierRes.json() as { suppliers: SupplierOption[] }
      setSuppliers(data.suppliers)
    }
    setLoading(false)
  }, [orderId])

  useEffect(() => { void load() }, [load])

  const transportReady = invoices.some(invoice => invoice.shipments.some(shipment => shipment.hasTransportDoc))
  const shippedWithoutPaper = orderStatus === 'SHIPPED' && !transportReady

  async function addSupplier() {
    const name = newSupplier.trim()
    if (!name) return
    const res = await fetch('/api/admin/jmm-suppliers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    const data = await res.json().catch(() => ({})) as { id?: string; error?: string }
    if (!res.ok || !data.id) {
      toast.error(data.error ?? 'Could not add supplier')
      return
    }
    setNewSupplier('')
    setSupplierId(data.id)
    await load()
  }

  async function addInvoice() {
    const parsedAmount = Number(amount)
    if (!supplierId || !invoiceNumber.trim() || !(parsedAmount >= 0) || Number.isNaN(parsedAmount)) {
      toast.error('Choose a supplier, their invoice number, and an amount')
      return
    }
    const res = await fetch(`/api/admin/jmm-orders/${orderId}/supplier-invoices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        supplierId,
        invoiceNumber: invoiceNumber.trim(),
        invoiceDate,
        currency,
        amount: parsedAmount,
        status: 'EXPECTED',
      }),
    })
    const data = await res.json().catch(() => ({})) as { error?: string }
    if (!res.ok) {
      toast.error(data.error ?? 'Could not add the supplier invoice')
      return
    }
    setInvoiceNumber('')
    setAmount('')
    toast.success('Supplier invoice added')
    await load()
  }

  if (loading) return <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>Loading supplier invoices…</p>

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold" style={{ color: 'var(--foreground)' }}>Supplier invoices and shipment papers</h2>
        <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
          Keep the supplier&apos;s own invoice number and file here. Shipment scans belong to that invoice. This is separate from the customer quotation and commercial invoice.
        </p>
      </div>
      {shippedWithoutPaper && (
        <p className="text-sm rounded-lg px-3 py-2" style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444' }}>
          This order is marked shipped, but no bill of lading or airway bill is on file.
        </p>
      )}

      {canEdit && (
        <div className="rounded-xl p-4 space-y-3" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-xs md:col-span-2" style={{ color: 'var(--muted-foreground)' }}>
              Supplier
              <select value={supplierId} onChange={e => setSupplierId(e.target.value)} className="mt-1 w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle}>
                <option value="">Select a supplier</option>
                {suppliers.map(supplier => <option key={supplier.id} value={supplier.id}>{supplier.name}{supplier.company ? ` · ${supplier.company}` : ''}</option>)}
              </select>
            </label>
            {canCreateSupplier && (
              <div className="md:col-span-2 flex flex-wrap gap-2">
                <input value={newSupplier} onChange={e => setNewSupplier(e.target.value)} placeholder="New supplier name" className="px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle} />
                <button type="button" onClick={() => void addSupplier()} className="px-3 py-2 rounded-lg text-sm" style={{ color: '#C9A96E' }}>Add supplier</button>
              </div>
            )}
            <label className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
              Their invoice number
              <input value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} className="mt-1 w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle} />
            </label>
            <label className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
              Invoice date
              <input type="date" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)} className="mt-1 w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle} />
            </label>
            <label className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
              Currency
              <select value={currency} onChange={e => setCurrency(e.target.value as Invoice['currency'])} className="mt-1 w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle}>
                {CURRENCIES.map(item => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
            <label className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
              Amount
              <input value={amount} onChange={e => setAmount(e.target.value)} className="mt-1 w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle} />
            </label>
          </div>
          <button type="button" onClick={() => void addInvoice()} className="px-3 py-2 rounded-lg text-sm font-semibold" style={{ background: '#C9A96E', color: '#1a1408' }}>Add supplier invoice</button>
        </div>
      )}

      {invoices.map(invoice => (
        <InvoiceCard key={invoice.id} orderId={orderId} invoice={invoice} suppliers={suppliers} canEdit={canEdit} onChanged={load} />
      ))}
    </section>
  )
}

function InvoiceCard({
  orderId,
  invoice,
  suppliers,
  canEdit,
  onChanged,
}: {
  orderId: string
  invoice: Invoice
  suppliers: SupplierOption[]
  canEdit: boolean
  onChanged: () => Promise<void>
}) {
  const [supplierId, setSupplierId] = useState(invoice.supplier.id)
  const [invoiceNumber, setInvoiceNumber] = useState(invoice.invoiceNumber)
  const [invoiceDate, setInvoiceDate] = useState(invoice.invoiceDate)
  const [currency, setCurrency] = useState(invoice.currency)
  const [amount, setAmount] = useState(String(invoice.amount))
  const [status, setStatus] = useState(invoice.status)
  const [notes, setNotes] = useState(invoice.notes)

  useEffect(() => {
    setSupplierId(invoice.supplier.id)
    setInvoiceNumber(invoice.invoiceNumber)
    setInvoiceDate(invoice.invoiceDate)
    setCurrency(invoice.currency)
    setAmount(String(invoice.amount))
    setStatus(invoice.status)
    setNotes(invoice.notes)
  }, [invoice])

  async function save() {
    const res = await fetch(`/api/admin/jmm-orders/${orderId}/supplier-invoices/${invoice.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        supplierId,
        invoiceNumber: invoiceNumber.trim(),
        invoiceDate,
        currency,
        amount: Number(amount),
        status,
        notes,
      }),
    })
    const data = await res.json().catch(() => ({})) as { error?: string }
    if (!res.ok) {
      toast.error(data.error ?? 'Could not save')
      return
    }
    toast.success('Supplier invoice saved')
    await onChanged()
  }

  async function upload(file: File | undefined) {
    if (!file) return
    const body = new FormData()
    body.set('file', file)
    const res = await fetch(`/api/admin/jmm-orders/${orderId}/supplier-invoices/${invoice.id}/file`, { method: 'POST', body })
    const data = await res.json().catch(() => ({})) as { error?: string }
    if (!res.ok) {
      toast.error(data.error ?? 'Could not upload')
      return
    }
    toast.success('Invoice file saved')
    await onChanged()
  }

  async function remove() {
    if (!window.confirm(`Delete supplier invoice ${invoice.invoiceNumber}?`)) return
    const res = await fetch(`/api/admin/jmm-orders/${orderId}/supplier-invoices/${invoice.id}`, { method: 'DELETE' })
    if (!res.ok) {
      toast.error('Could not delete')
      return
    }
    await onChanged()
  }

  async function addShipment() {
    const res = await fetch(`/api/admin/jmm-orders/${orderId}/supplier-invoices/${invoice.id}/shipments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    if (!res.ok) {
      toast.error('Could not add a shipment')
      return
    }
    await onChanged()
  }

  return (
    <article className="rounded-xl p-4 space-y-3" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold" style={{ color: '#C9A96E' }}>Supplier invoice</p>
          <h3 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>{invoice.invoiceNumber}</h3>
          <p className="text-xs mt-1" style={{ color: invoice.papersComplete ? '#10b981' : 'var(--muted-foreground)' }}>
            {invoice.papersComplete ? 'Invoice file, packing list, and transport document are on file.' : 'Still missing the invoice file, a packing list, or a bill of lading / airway bill.'}
          </p>
        </div>
        {canEdit && <button type="button" onClick={() => void remove()} className="text-xs" style={{ color: '#ef4444' }}>Delete</button>}
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
          Supplier
          <select value={supplierId} disabled={!canEdit} onChange={e => setSupplierId(e.target.value)} className="mt-1 w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle}>
            {suppliers.map(supplier => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
          </select>
        </label>
        <label className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
          Status
          <select value={status} disabled={!canEdit} onChange={e => setStatus(e.target.value as Invoice['status'])} className="mt-1 w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle}>
            {STATUSES.map(item => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        <label className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
          Their invoice number
          <input value={invoiceNumber} disabled={!canEdit} onChange={e => setInvoiceNumber(e.target.value)} className="mt-1 w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle} />
        </label>
        <label className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
          Date
          <input type="date" value={invoiceDate} disabled={!canEdit} onChange={e => setInvoiceDate(e.target.value)} className="mt-1 w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle} />
        </label>
        <label className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
          Currency
          <select value={currency} disabled={!canEdit} onChange={e => setCurrency(e.target.value as Invoice['currency'])} className="mt-1 w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle}>
            {CURRENCIES.map(item => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        <label className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
          Amount
          <input value={amount} disabled={!canEdit} onChange={e => setAmount(e.target.value)} className="mt-1 w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle} />
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span style={{ color: 'var(--muted-foreground)' }}>{invoice.hasFile ? invoice.fileName : 'No invoice file yet'}</span>
        {invoice.hasFile && <button type="button" className="underline" style={{ color: '#C9A96E' }} onClick={() => void openDownload(`/api/admin/jmm-orders/${orderId}/supplier-invoices/${invoice.id}/file`)}>Open</button>}
        {canEdit && <input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={e => void upload(e.target.files?.[0])} />}
      </div>
      {canEdit && <button type="button" onClick={() => void save()} className="px-3 py-2 rounded-lg text-sm font-semibold" style={{ background: '#C9A96E', color: '#1a1408' }}>Save invoice</button>}

      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Shipments</h4>
          {canEdit && <button type="button" onClick={() => void addShipment()} className="text-xs" style={{ color: '#C9A96E' }}>Add shipment</button>}
        </div>
        {invoice.shipments.map(shipment => (
          <ShipmentCard key={shipment.id} orderId={orderId} invoiceId={invoice.id} shipment={shipment} canEdit={canEdit} onChanged={onChanged} />
        ))}
      </div>
    </article>
  )
}

function ShipmentCard({
  orderId,
  invoiceId,
  shipment,
  canEdit,
  onChanged,
}: {
  orderId: string
  invoiceId: string
  shipment: Shipment
  canEdit: boolean
  onChanged: () => Promise<void>
}) {
  const [form, setForm] = useState(shipment)
  const [kind, setKind] = useState<(typeof DOC_KINDS)[number][0]>('BILL_OF_LADING')
  useEffect(() => { setForm(shipment) }, [shipment])

  function setField(key: keyof Shipment, value: string) {
    setForm(current => ({ ...current, [key]: value }))
  }

  async function save() {
    const res = await fetch(`/api/admin/jmm-orders/${orderId}/supplier-invoices/${invoiceId}/shipments/${shipment.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    if (!res.ok) {
      toast.error('Could not save the shipment')
      return
    }
    toast.success('Shipment saved')
    await onChanged()
  }

  async function upload(file: File | undefined) {
    if (!file) return
    const body = new FormData()
    body.set('file', file)
    body.set('kind', kind)
    const res = await fetch(`/api/admin/jmm-orders/${orderId}/supplier-invoices/${invoiceId}/shipments/${shipment.id}/files`, { method: 'POST', body })
    const data = await res.json().catch(() => ({})) as { error?: string }
    if (!res.ok) {
      toast.error(data.error ?? 'Could not upload')
      return
    }
    await onChanged()
  }

  async function removeFile(fileId: string) {
    const res = await fetch(`/api/admin/jmm-shipment-files/${fileId}`, { method: 'DELETE' })
    if (!res.ok) {
      toast.error('Could not remove the file')
      return
    }
    await onChanged()
  }

  async function remove() {
    if (!window.confirm('Delete this shipment and its files?')) return
    const res = await fetch(`/api/admin/jmm-orders/${orderId}/supplier-invoices/${invoiceId}/shipments/${shipment.id}`, { method: 'DELETE' })
    if (!res.ok) {
      toast.error('Could not delete the shipment')
      return
    }
    await onChanged()
  }

  const fields = [
    ['reference', 'Container / tracking'],
    ['shipper', 'Shipper'],
    ['consignee', 'Consignee'],
    ['carrier', 'Vessel or flight'],
    ['incoterm', 'Incoterm'],
    ['portOfLoading', 'Port of loading'],
    ['portOfDischarge', 'Port of discharge'],
  ] as const

  return (
    <div className="rounded-lg p-3 space-y-3" style={{ border: '1px solid var(--border)' }}>
      <div className="flex justify-between gap-3 text-xs">
        <span style={{ color: shipment.hasTransportDoc && shipment.hasPackingList ? '#10b981' : '#C9A96E' }}>
          {shipment.hasTransportDoc ? 'Transport document on file' : 'Bill of lading or airway bill missing'}
          {shipment.hasPackingList ? ' · Packing list on file' : ' · Packing list missing'}
        </span>
        {canEdit && <button type="button" onClick={() => void remove()} style={{ color: '#ef4444' }}>Delete shipment</button>}
      </div>
      <div className="grid gap-2 md:grid-cols-2">
        {fields.map(([key, label]) => (
          <label key={key} className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
            {label}
            <input value={form[key]} disabled={!canEdit} onChange={e => setField(key, e.target.value)} className="mt-1 w-full px-2 py-1.5 rounded text-sm outline-none" style={inputStyle} />
          </label>
        ))}
        <label className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
          ETD
          <input type="date" value={form.etd} disabled={!canEdit} onChange={e => setField('etd', e.target.value)} className="mt-1 w-full px-2 py-1.5 rounded text-sm outline-none" style={inputStyle} />
        </label>
        <label className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
          ETA
          <input type="date" value={form.eta} disabled={!canEdit} onChange={e => setField('eta', e.target.value)} className="mt-1 w-full px-2 py-1.5 rounded text-sm outline-none" style={inputStyle} />
        </label>
      </div>
      <ul className="text-sm space-y-1">
        {shipment.files.map(file => (
          <li key={file.id} className="flex flex-wrap items-center gap-2">
            <span style={{ color: 'var(--muted-foreground)' }}>{DOC_KINDS.find(item => item[0] === file.kind)?.[1] ?? file.kind}: {file.fileName}</span>
            <button type="button" className="underline text-xs" style={{ color: '#C9A96E' }} onClick={() => void openDownload(`/api/admin/jmm-shipment-files/${file.id}`)}>Open</button>
            {canEdit && <button type="button" className="text-xs" style={{ color: '#ef4444' }} onClick={() => void removeFile(file.id)}>Remove</button>}
          </li>
        ))}
      </ul>
      {canEdit && (
        <div className="flex flex-wrap items-center gap-2">
          <select value={kind} onChange={e => setKind(e.target.value as typeof kind)} className="px-2 py-1.5 rounded text-sm outline-none" style={inputStyle}>
            {DOC_KINDS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={e => void upload(e.target.files?.[0])} />
          <button type="button" onClick={() => void save()} className="px-3 py-1.5 rounded-lg text-sm font-semibold" style={{ background: '#C9A96E', color: '#1a1408' }}>Save shipment</button>
        </div>
      )}
    </div>
  )
}
