'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from '@/i18n/navigation'
import { Plus, Search, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { useAdminPermission } from '@/components/admin/AdminPermissionContext'

type Customer = {
  id: string
  name: string
  company: string
  phone: string
  email: string
  address: string
  deliveryAddress: string
  vatNumber: string
  notes: string
  orderCount: number
}

const emptyForm = {
  name: '',
  company: '',
  phone: '',
  email: '',
  address: '',
  deliveryAddress: '',
  vatNumber: '',
  notes: '',
}

const inputStyle: React.CSSProperties = {
  background: 'var(--surface-input)',
  border: '1px solid var(--border-subtle)',
  color: 'var(--foreground)',
}

export default function AdminJmmCustomersPage() {
  const router = useRouter()
  const canCreate = useAdminPermission('jmmCustomers.create')
  const canEdit = useAdminPermission('jmmCustomers.edit')
  const canDelete = useAdminPermission('jmmCustomers.delete')
  const [customers, setCustomers] = useState<Customer[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), search ? 300 : 0)
    return () => clearTimeout(timer)
  }, [search])

  const fetchCustomers = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(page), pageSize: '20' })
    if (debouncedSearch) params.set('q', debouncedSearch)
    try {
      const res = await fetch(`/api/admin/jmm-customers?${params}`)
      if (!res.ok) throw new Error('load')
      const data = await res.json() as { customers: Customer[]; total: number }
      setCustomers(data.customers)
      setTotal(data.total)
    } catch {
      toast.error('Could not load customers')
    } finally {
      setLoading(false)
    }
  }, [page, debouncedSearch])

  useEffect(() => { void fetchCustomers() }, [fetchCustomers])

  function openCreate() {
    setEditingId(null)
    setForm(emptyForm)
    setFormOpen(true)
  }

  function openEdit(customer: Customer) {
    setEditingId(customer.id)
    setForm({
      name: customer.name,
      company: customer.company,
      phone: customer.phone,
      email: customer.email,
      address: customer.address,
      deliveryAddress: customer.deliveryAddress,
      vatNumber: customer.vatNumber,
      notes: customer.notes,
    })
    setFormOpen(true)
  }

  async function save() {
    setSaving(true)
    try {
      const res = await fetch(editingId ? `/api/admin/jmm-customers/${editingId}` : '/api/admin/jmm-customers', {
        method: editingId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json().catch(() => ({})) as { error?: string }
      if (!res.ok) {
        toast.error(data.error ?? 'Could not save customer')
        return
      }
      toast.success(editingId ? 'Customer updated' : 'Customer added')
      setFormOpen(false)
      await fetchCustomers()
    } catch {
      toast.error('Network error')
    } finally {
      setSaving(false)
    }
  }

  async function remove(customer: Customer) {
    if (!window.confirm(`Delete ${customer.name}?`)) return
    const res = await fetch(`/api/admin/jmm-customers/${customer.id}`, { method: 'DELETE' })
    const data = await res.json().catch(() => ({})) as { error?: string }
    if (!res.ok) {
      toast.error(data.error ?? 'Could not delete customer')
      return
    }
    toast.success('Customer deleted')
    await fetchCustomers()
  }

  const totalPages = Math.max(1, Math.ceil(total / 20))

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>JMM Customers</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
            Offline trading counterparties. {total} customer{total === 1 ? '' : 's'}.
          </p>
        </div>
        {canCreate && (
          <button type="button" onClick={openCreate} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold" style={{ background: '#C9A96E', color: '#1a1408' }}>
            <Plus size={14} /> Add customer
          </button>
        )}
      </div>

      <div className="relative max-w-sm">
        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--muted-foreground)' }} />
          <input
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1) }}
          placeholder="Search name, company, phone, email, VAT"
          className="w-full pl-8 pr-3 py-2 rounded-lg text-sm outline-none"
          style={inputStyle}
        />
      </div>

      <div className="rounded-xl overflow-hidden" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: 'rgba(201,169,110,0.04)' }}>
              {['Name', 'Company', 'VAT', 'Phone', 'Email', 'Orders', ''].map(label => (
                <th key={label} className="text-left px-4 py-3 font-medium" style={{ color: 'var(--muted-foreground)' }}>{label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="px-4 py-8" style={{ color: 'var(--muted-foreground)' }}>Loading…</td></tr>
            ) : customers.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8" style={{ color: 'var(--muted-foreground)' }}>No customers yet.</td></tr>
            ) : customers.map(customer => (
              <tr key={customer.id} style={{ borderTop: '1px solid var(--border)' }}>
                <td className="px-4 py-3 font-medium" style={{ color: 'var(--foreground)' }}>{customer.name}</td>
                <td className="px-4 py-3" style={{ color: 'var(--muted-foreground)' }}>{customer.company || '—'}</td>
                <td className="px-4 py-3" style={{ color: 'var(--muted-foreground)' }}>{customer.vatNumber || '—'}</td>
                <td className="px-4 py-3" style={{ color: 'var(--muted-foreground)' }}>{customer.phone || '—'}</td>
                <td className="px-4 py-3" style={{ color: 'var(--muted-foreground)' }}>{customer.email || '—'}</td>
                <td className="px-4 py-3" style={{ color: 'var(--muted-foreground)' }}>{customer.orderCount}</td>
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  {customer.orderCount > 0 && (
                    <button type="button" className="text-xs mr-3 underline-offset-2 hover:underline" style={{ color: '#C9A96E' }} onClick={() => router.push(`/admin/jmm-orders?q=${encodeURIComponent(customer.name)}`)}>
                      Orders
                    </button>
                  )}
                  {canEdit && (
                    <button type="button" className="text-xs mr-3" style={{ color: 'var(--foreground)' }} onClick={() => openEdit(customer)}>Edit</button>
                  )}
                  {canDelete && (
                    <button type="button" className="text-xs inline-flex items-center gap-1" style={{ color: '#ef4444' }} onClick={() => void remove(customer)}>
                      <Trash2 size={12} /> Delete
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center gap-3 text-sm" style={{ color: 'var(--muted-foreground)' }}>
          <button type="button" disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-2 py-1 rounded disabled:opacity-40" style={{ border: '1px solid var(--border)' }}>Previous</button>
          <span>{page} / {totalPages}</span>
          <button type="button" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="px-2 py-1 rounded disabled:opacity-40" style={{ border: '1px solid var(--border)' }}>Next</button>
        </div>
      )}

      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.45)' }}>
          <form
            className="w-full max-w-lg rounded-xl p-5 space-y-3"
            style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
            onSubmit={e => { e.preventDefault(); void save() }}
          >
            <h2 className="text-lg font-semibold" style={{ color: 'var(--foreground)' }}>{editingId ? 'Edit customer' : 'Add customer'}</h2>
            {([
              ['name', 'Name', true],
              ['company', 'Company', false],
              ['phone', 'Phone', false],
              ['email', 'Email', false],
              ['vatNumber', 'VAT number', false],
              ['address', 'Address', false],
              ['deliveryAddress', 'Delivery address', false],
            ] as const).map(([key, label, required]) => (
              <label key={key} className="block text-xs" style={{ color: 'var(--muted-foreground)' }}>
                {label}
                {key === 'deliveryAddress' || key === 'address' ? (
                  <textarea
                    required={required}
                    value={form[key]}
                    onChange={e => setForm(current => ({ ...current, [key]: e.target.value }))}
                    rows={2}
                    className="mt-1 w-full px-3 py-2 rounded-lg text-sm outline-none"
                    style={inputStyle}
                  />
                ) : (
                  <input
                    required={required}
                    type={key === 'email' ? 'email' : 'text'}
                    value={form[key]}
                    onChange={e => setForm(current => ({ ...current, [key]: e.target.value }))}
                    className="mt-1 w-full px-3 py-2 rounded-lg text-sm outline-none"
                    style={inputStyle}
                  />
                )}
              </label>
            ))}
            <label className="block text-xs" style={{ color: 'var(--muted-foreground)' }}>
              Notes
              <textarea
                value={form.notes}
                onChange={e => setForm(current => ({ ...current, notes: e.target.value }))}
                rows={3}
                className="mt-1 w-full px-3 py-2 rounded-lg text-sm outline-none"
                style={inputStyle}
              />
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setFormOpen(false)} className="px-3 py-2 rounded-lg text-sm" style={{ color: 'var(--muted-foreground)' }}>Cancel</button>
              <button type="submit" disabled={saving} className="px-3 py-2 rounded-lg text-sm font-semibold disabled:opacity-60" style={{ background: '#C9A96E', color: '#1a1408' }}>
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
