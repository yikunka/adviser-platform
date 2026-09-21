'use client'

import { useCallback, useEffect, useState } from 'react'
import { Plus, Search, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { useAdminPermission } from '@/components/admin/AdminPermissionContext'

type Supplier = {
  id: string
  name: string
  company: string
  phone: string
  email: string
  address: string
  vatNumber: string
  notes: string
  invoiceCount: number
}

const emptyForm = { name: '', company: '', phone: '', email: '', address: '', vatNumber: '', notes: '' }
const inputStyle: React.CSSProperties = {
  background: 'var(--surface-input)',
  border: '1px solid var(--border-subtle)',
  color: 'var(--foreground)',
}

export default function AdminJmmSuppliersPage() {
  const canCreate = useAdminPermission('jmmSuppliers.create')
  const canEdit = useAdminPermission('jmmSuppliers.edit')
  const canDelete = useAdminPermission('jmmSuppliers.delete')
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [total, setTotal] = useState(0)
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

  const load = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ pageSize: '50' })
    if (debouncedSearch) params.set('q', debouncedSearch)
    try {
      const res = await fetch(`/api/admin/jmm-suppliers?${params}`)
      if (!res.ok) throw new Error('load')
      const data = await res.json() as { suppliers: Supplier[]; total: number }
      setSuppliers(data.suppliers)
      setTotal(data.total)
    } catch {
      toast.error('Could not load suppliers')
    } finally {
      setLoading(false)
    }
  }, [debouncedSearch])

  useEffect(() => { void load() }, [load])

  async function save() {
    setSaving(true)
    try {
      const res = await fetch(editingId ? `/api/admin/jmm-suppliers/${editingId}` : '/api/admin/jmm-suppliers', {
        method: editingId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json().catch(() => ({})) as { error?: string }
      if (!res.ok) {
        toast.error(data.error ?? 'Could not save supplier')
        return
      }
      toast.success(editingId ? 'Supplier updated' : 'Supplier added')
      setFormOpen(false)
      await load()
    } finally {
      setSaving(false)
    }
  }

  async function remove(supplier: Supplier) {
    if (!window.confirm(`Delete ${supplier.name}?`)) return
    const res = await fetch(`/api/admin/jmm-suppliers/${supplier.id}`, { method: 'DELETE' })
    const data = await res.json().catch(() => ({})) as { error?: string }
    if (!res.ok) {
      toast.error(data.error ?? 'Could not delete supplier')
      return
    }
    toast.success('Supplier deleted')
    await load()
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>JMM Suppliers</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>{total} supplier{total === 1 ? '' : 's'}. Their invoices stay on the order.</p>
        </div>
        {canCreate && (
          <button type="button" onClick={() => { setEditingId(null); setForm(emptyForm); setFormOpen(true) }} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold" style={{ background: '#C9A96E', color: '#1a1408' }}>
            <Plus size={14} /> Add supplier
          </button>
        )}
      </div>
      <div className="relative max-w-sm">
        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--muted-foreground)' }} />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, company, VAT" className="w-full pl-8 pr-3 py-2 rounded-lg text-sm outline-none" style={inputStyle} />
      </div>
      <div className="rounded-xl overflow-hidden" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: 'rgba(201,169,110,0.04)' }}>
              {['Name', 'Company', 'VAT', 'Phone', 'Invoices', ''].map(label => (
                <th key={label} className="text-left px-4 py-3 font-medium" style={{ color: 'var(--muted-foreground)' }}>{label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? <tr><td colSpan={6} className="px-4 py-8" style={{ color: 'var(--muted-foreground)' }}>Loading…</td></tr> : suppliers.length === 0 ? <tr><td colSpan={6} className="px-4 py-8" style={{ color: 'var(--muted-foreground)' }}>No suppliers yet.</td></tr> : suppliers.map(supplier => (
              <tr key={supplier.id} style={{ borderTop: '1px solid var(--border)' }}>
                <td className="px-4 py-3 font-medium" style={{ color: 'var(--foreground)' }}>{supplier.name}</td>
                <td className="px-4 py-3" style={{ color: 'var(--muted-foreground)' }}>{supplier.company || '—'}</td>
                <td className="px-4 py-3" style={{ color: 'var(--muted-foreground)' }}>{supplier.vatNumber || '—'}</td>
                <td className="px-4 py-3" style={{ color: 'var(--muted-foreground)' }}>{supplier.phone || '—'}</td>
                <td className="px-4 py-3" style={{ color: 'var(--muted-foreground)' }}>{supplier.invoiceCount}</td>
                <td className="px-4 py-3 text-right">
                  {canEdit && <button type="button" className="text-xs mr-3" style={{ color: 'var(--foreground)' }} onClick={() => { setEditingId(supplier.id); setForm(supplier); setFormOpen(true) }}>Edit</button>}
                  {canDelete && <button type="button" className="text-xs inline-flex items-center gap-1" style={{ color: '#ef4444' }} onClick={() => void remove(supplier)}><Trash2 size={12} /> Delete</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.45)' }}>
          <form className="w-full max-w-lg rounded-xl p-5 space-y-3" style={{ background: 'var(--card)', border: '1px solid var(--border)' }} onSubmit={e => { e.preventDefault(); void save() }}>
            <h2 className="text-lg font-semibold" style={{ color: 'var(--foreground)' }}>{editingId ? 'Edit supplier' : 'Add supplier'}</h2>
            {([
              ['name', 'Name'],
              ['company', 'Company'],
              ['phone', 'Phone'],
              ['email', 'Email'],
              ['vatNumber', 'VAT number'],
              ['address', 'Address'],
            ] as const).map(([key, label]) => (
              <label key={key} className="block text-xs" style={{ color: 'var(--muted-foreground)' }}>
                {label}
                <input required={key === 'name'} type={key === 'email' ? 'email' : 'text'} value={form[key]} onChange={e => setForm(current => ({ ...current, [key]: e.target.value }))} className="mt-1 w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle} />
              </label>
            ))}
            <label className="block text-xs" style={{ color: 'var(--muted-foreground)' }}>
              Notes
              <textarea value={form.notes} onChange={e => setForm(current => ({ ...current, notes: e.target.value }))} rows={3} className="mt-1 w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle} />
            </label>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setFormOpen(false)} className="px-3 py-2 text-sm" style={{ color: 'var(--muted-foreground)' }}>Cancel</button>
              <button type="submit" disabled={saving} className="px-3 py-2 rounded-lg text-sm font-semibold disabled:opacity-60" style={{ background: '#C9A96E', color: '#1a1408' }}>{saving ? 'Saving…' : 'Save'}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
