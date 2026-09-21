'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from '@/i18n/navigation'
import { Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { useAdminPermission } from '@/components/admin/AdminPermissionContext'
import { JmmTradeDocuments } from './JmmTradeDocuments'
import { JmmPurchaseFile } from './JmmPurchaseFile'
import { JMM_PACKING_OPTIONS } from '@/lib/jmm/constants'

const STATUSES = ['DRAFT', 'CONFIRMED', 'SHIPPED', 'COMPLETED', 'CANCELLED'] as const
const CURRENCIES = ['USD', 'HKD', 'CNY', 'EUR'] as const

type CustomerOption = { id: string; name: string; company: string }
type Line = { description: string; quantity: string; unit: string; unitPrice: string }

const inputStyle: React.CSSProperties = {
  background: 'var(--surface-input)',
  border: '1px solid var(--border-subtle)',
  color: 'var(--foreground)',
}

function blankLine(): Line {
  return { description: '', quantity: '1', unit: '', unitPrice: '' }
}

function money(quantity: string, unitPrice: string): number {
  const qty = Number(quantity)
  const price = Number(unitPrice)
  if (!Number.isFinite(qty) || !Number.isFinite(price)) return 0
  return Math.round(qty * price * 100) / 100
}

export function JmmOrderForm({ orderId }: { orderId?: string }) {
  const router = useRouter()
  const canCreateCustomer = useAdminPermission('jmmCustomers.create')
  const canEdit = useAdminPermission(orderId ? 'jmmOrders.edit' : 'jmmOrders.create')
  const canDelete = useAdminPermission('jmmOrders.delete')
  const [customers, setCustomers] = useState<CustomerOption[]>([])
  const [orderNumber, setOrderNumber] = useState('')
  const [customerId, setCustomerId] = useState('')
  const [orderDate, setOrderDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [status, setStatus] = useState<(typeof STATUSES)[number]>('DRAFT')
  const [currency, setCurrency] = useState<(typeof CURRENCIES)[number]>('USD')
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState<Line[]>([blankLine()])
  const [loading, setLoading] = useState(Boolean(orderId))
  const [saving, setSaving] = useState(false)
  const [addingCustomer, setAddingCustomer] = useState(false)
  const [newCustomerName, setNewCustomerName] = useState('')
  const [newCustomerCompany, setNewCustomerCompany] = useState('')

  const loadCustomers = useCallback(async () => {
    const res = await fetch('/api/admin/jmm-customers?pageSize=200')
    if (!res.ok) return
    const data = await res.json() as { customers: CustomerOption[] }
    setCustomers(data.customers)
  }, [])

  useEffect(() => {
    void loadCustomers()
  }, [loadCustomers])

  useEffect(() => {
    if (!orderId) return
    let cancelled = false
    void (async () => {
      const res = await fetch(`/api/admin/jmm-orders/${orderId}`)
      if (!res.ok) {
        toast.error('Order not found')
        router.push('/admin/jmm-orders')
        return
      }
      const data = await res.json() as {
        orderNumber: string
        customerId: string
        orderDate: string
        status: (typeof STATUSES)[number]
        currency: (typeof CURRENCIES)[number]
        notes: string
        lines: { description: string; quantity: number; unit: string; unitPrice: number }[]
      }
      if (cancelled) return
      setOrderNumber(data.orderNumber)
      setCustomerId(data.customerId)
      setOrderDate(data.orderDate)
      setStatus(data.status)
      setCurrency(data.currency)
      setNotes(data.notes)
      setLines(data.lines.map(line => ({
        description: line.description,
        quantity: String(line.quantity),
        unit: line.unit,
        unitPrice: String(line.unitPrice),
      })))
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [orderId, router])

  const total = useMemo(
    () => lines.reduce((sum, line) => sum + money(line.quantity, line.unitPrice), 0),
    [lines],
  )

  function updateLine(index: number, patch: Partial<Line>) {
    setLines(current => current.map((line, i) => (i === index ? { ...line, ...patch } : line)))
  }

  async function addCustomer() {
    const name = newCustomerName.trim()
    if (!name) return
    const res = await fetch('/api/admin/jmm-customers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, company: newCustomerCompany.trim() }),
    })
    const data = await res.json().catch(() => ({})) as { id?: string; error?: string }
    if (!res.ok || !data.id) {
      toast.error(data.error ?? 'Could not add customer')
      return
    }
    await loadCustomers()
    setCustomerId(data.id)
    setNewCustomerName('')
    setNewCustomerCompany('')
    setAddingCustomer(false)
    toast.success('Customer added')
  }

  async function save() {
    const payload = {
      customerId,
      orderDate,
      status,
      currency,
      notes,
      lines: lines.map(line => ({
        description: line.description.trim(),
        quantity: Number(line.quantity),
        unit: line.unit.trim(),
        unitPrice: Number(line.unitPrice),
      })),
    }
    if (!payload.customerId) {
      toast.error('Choose a customer')
      return
    }
    if (payload.lines.some(line => !line.description || !(line.quantity > 0) || !(line.unitPrice >= 0) || Number.isNaN(line.unitPrice))) {
      toast.error('Each line needs a description, quantity, and unit price')
      return
    }

    setSaving(true)
    try {
      const res = await fetch(orderId ? `/api/admin/jmm-orders/${orderId}` : '/api/admin/jmm-orders', {
        method: orderId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json().catch(() => ({})) as { id?: string; error?: string }
      if (!res.ok || !data.id) {
        toast.error(data.error ?? 'Could not save order')
        return
      }
      toast.success(orderId ? 'Order updated' : 'Order saved')
      router.push(`/admin/jmm-orders/${data.id}`)
      router.refresh()
    } catch {
      toast.error('Network error')
    } finally {
      setSaving(false)
    }
  }

  async function remove() {
    if (!orderId || !window.confirm(`Delete ${orderNumber}?`)) return
    const res = await fetch(`/api/admin/jmm-orders/${orderId}`, { method: 'DELETE' })
    if (!res.ok) {
      toast.error('Could not delete order')
      return
    }
    toast.success('Order deleted')
    router.push('/admin/jmm-orders')
  }

  if (loading) {
    return <div className="p-6 text-sm" style={{ color: 'var(--muted-foreground)' }}>Loading…</div>
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <button type="button" onClick={() => router.push('/admin/jmm-orders')} className="text-xs mb-2" style={{ color: '#C9A96E' }}>
            Back to orders
          </button>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>
            {orderNumber || 'New JMM order'}
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
            Offline trading order. Amounts are calculated from quantity × unit price.
          </p>
        </div>
        {orderId && canDelete && (
          <button type="button" onClick={() => void remove()} className="inline-flex items-center gap-1 text-sm" style={{ color: '#ef4444' }}>
            <Trash2 size={14} /> Delete
          </button>
        )}
      </div>

      <div className="rounded-xl p-4 grid gap-3 md:grid-cols-2" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
        <label className="text-xs md:col-span-2" style={{ color: 'var(--muted-foreground)' }}>
          Customer
          <select
            value={customerId}
            disabled={!canEdit}
            onChange={e => setCustomerId(e.target.value)}
            className="mt-1 w-full px-3 py-2 rounded-lg text-sm outline-none"
            style={inputStyle}
          >
            <option value="">Select a customer</option>
            {customers.map(customer => (
              <option key={customer.id} value={customer.id}>
                {customer.name}{customer.company ? ` · ${customer.company}` : ''}
              </option>
            ))}
          </select>
        </label>
        {canCreateCustomer && canEdit && (
          <div className="md:col-span-2">
            {addingCustomer ? (
              <div className="flex flex-wrap gap-2">
                <input value={newCustomerName} onChange={e => setNewCustomerName(e.target.value)} placeholder="Customer name" className="px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle} />
                <input value={newCustomerCompany} onChange={e => setNewCustomerCompany(e.target.value)} placeholder="Company (optional)" className="px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle} />
                <button type="button" onClick={() => void addCustomer()} className="px-3 py-2 rounded-lg text-sm font-semibold" style={{ background: '#C9A96E', color: '#1a1408' }}>Save customer</button>
                <button type="button" onClick={() => setAddingCustomer(false)} className="px-3 py-2 text-sm" style={{ color: 'var(--muted-foreground)' }}>Cancel</button>
              </div>
            ) : (
              <button type="button" onClick={() => setAddingCustomer(true)} className="text-xs" style={{ color: '#C9A96E' }}>Add a customer</button>
            )}
          </div>
        )}
        <label className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
          Order date
          <input type="date" value={orderDate} disabled={!canEdit} onChange={e => setOrderDate(e.target.value)} className="mt-1 w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle} />
        </label>
        <label className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
          Status
          <select value={status} disabled={!canEdit} onChange={e => setStatus(e.target.value as (typeof STATUSES)[number])} className="mt-1 w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle}>
            {STATUSES.map(item => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        <label className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
          Currency
          <select value={currency} disabled={!canEdit} onChange={e => setCurrency(e.target.value as (typeof CURRENCIES)[number])} className="mt-1 w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle}>
            {CURRENCIES.map(item => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        <label className="text-xs md:col-span-2" style={{ color: 'var(--muted-foreground)' }}>
          Notes
          <textarea value={notes} disabled={!canEdit} onChange={e => setNotes(e.target.value)} rows={3} className="mt-1 w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle} />
        </label>
      </div>

      <div className="rounded-xl overflow-hidden" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
        <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
          <h2 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Lines</h2>
          {canEdit && (
            <button type="button" onClick={() => setLines(current => [...current, blankLine()])} className="inline-flex items-center gap-1 text-xs" style={{ color: '#C9A96E' }}>
              <Plus size={12} /> Add line
            </button>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ color: 'var(--muted-foreground)' }}>
                <th className="text-left px-4 py-2 font-medium">Item</th>
                <th className="text-left px-4 py-2 font-medium">Description</th>
                <th className="text-left px-4 py-2 font-medium">Packing</th>
                <th className="text-left px-4 py-2 font-medium">Quantity</th>
                <th className="text-left px-4 py-2 font-medium">Unit price</th>
                <th className="text-right px-4 py-2 font-medium">Amount</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {lines.map((line, index) => (
                <tr key={index} style={{ borderTop: '1px solid var(--border)' }}>
                  <td className="px-4 py-2 font-medium" style={{ color: 'var(--foreground)' }}>{index + 1}</td>
                  <td className="px-4 py-2">
                    <input value={line.description} disabled={!canEdit} onChange={e => updateLine(index, { description: e.target.value })} className="w-full min-w-48 px-2 py-1.5 rounded text-sm outline-none" style={inputStyle} />
                  </td>
                  <td className="px-4 py-2">
                    <select value={line.unit} disabled={!canEdit} onChange={e => updateLine(index, { unit: e.target.value })} className="w-28 px-2 py-1.5 rounded text-sm outline-none" style={inputStyle}>
                      <option value="">—</option>
                      {JMM_PACKING_OPTIONS.map(option => <option key={option} value={option}>{option}</option>)}
                      {line.unit && !(JMM_PACKING_OPTIONS as readonly string[]).includes(line.unit) && <option value={line.unit}>{line.unit}</option>}
                    </select>
                  </td>
                  <td className="px-4 py-2">
                    <input value={line.quantity} disabled={!canEdit} onChange={e => updateLine(index, { quantity: e.target.value })} className="w-24 px-2 py-1.5 rounded text-sm outline-none" style={inputStyle} />
                  </td>
                  <td className="px-4 py-2">
                    <input value={line.unitPrice} disabled={!canEdit} onChange={e => updateLine(index, { unitPrice: e.target.value })} className="w-28 px-2 py-1.5 rounded text-sm outline-none" style={inputStyle} />
                  </td>
                  <td className="px-4 py-2 text-right whitespace-nowrap" style={{ color: 'var(--foreground)' }}>
                    {money(line.quantity, line.unitPrice).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-2">
                    {canEdit && lines.length > 1 && (
                      <button type="button" onClick={() => setLines(current => current.filter((_, i) => i !== index))} style={{ color: '#ef4444' }} aria-label="Remove line">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 text-right text-sm font-semibold" style={{ borderTop: '1px solid var(--border)', color: 'var(--foreground)' }}>
          Total price {currency} {total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
      </div>

      {canEdit && (
        <button type="button" disabled={saving} onClick={() => void save()} className="px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-60" style={{ background: '#C9A96E', color: '#1a1408' }}>
          {saving ? 'Saving…' : 'Save order'}
        </button>
      )}

      {orderId && <JmmTradeDocuments orderId={orderId} />}
      {orderId && <JmmPurchaseFile orderId={orderId} orderStatus={status} />}
    </div>
  )
}
