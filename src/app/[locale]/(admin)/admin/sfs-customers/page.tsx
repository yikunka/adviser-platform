'use client'

import { type FormEvent, useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Link } from '@/i18n/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { ContactRound, Download, FileText, Mail, MapPin, Pencil, Phone, Search, Trash2, Upload, UserPlus, X } from 'lucide-react'

type CustomerRow = {
  id: string
  source: 'ACCOUNT' | 'MANUAL' | 'ORDER_ONLY'
  userId: string | null
  customerId: string | null
  name: string
  email: string | null
  phone: string | null
  mailingAddress: string | null
  notes: string | null
  isActive: boolean | null
  emailVerified: string | null
  createdAt: string
  orderCount: number
  latestOrderAt: string | null
  latestOrder: {
    id: string
    sampleCode: string | null
    memorialName: string
    status: string
    clientName: string
    email: string
    contactNumber: string
    mailingAddress: string
    createdAt: string
  } | null
}

type CustomerFormValues = {
  name: string
  email: string
  phone: string
  mailingAddress: string
  notes: string
}

const SOURCE_STYLE: Record<CustomerRow['source'], { label: string; bg: string; color: string }> = {
  ACCOUNT: { label: 'Account', bg: 'rgba(56,189,248,0.13)', color: '#38bdf8' },
  MANUAL: { label: 'Manual', bg: 'rgba(201,169,110,0.14)', color: '#C9A96E' },
  ORDER_ONLY: { label: 'Order contact', bg: 'rgba(120,113,108,0.16)', color: '#9A8060' },
}

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  PENDING: { bg: 'rgba(201,169,110,0.12)', color: '#C9A96E' },
  QUOTED: { bg: 'rgba(59,130,246,0.12)', color: '#3b82f6' },
  CONFIRMED: { bg: 'rgba(16,185,129,0.12)', color: '#10b981' },
  COMPLETED: { bg: 'rgba(120,113,108,0.15)', color: '#9A8060' },
  CANCELLED: { bg: 'rgba(239,68,68,0.12)', color: '#ef4444' },
}

function formatDate(value: string | null) {
  if (!value) return '-'
  return new Date(value).toLocaleDateString('en-HK', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function contractFileUrl(storageKey: string) {
  return `/api/files?key=${encodeURIComponent(storageKey)}`
}

type CustomerContract = {
  id: string
  fileName: string
  storageKey: string
  mimeType: string
  fileSize: number
  notes: string | null
  createdAt: string
  uploadedBy: { nameEn: string | null; email: string }
}

function CustomerContractsSection({
  customer,
  onCustomerBound,
}: {
  customer: CustomerRow
  onCustomerBound: (customerId: string) => void
}) {
  const [contracts, setContracts] = useState<CustomerContract[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [notes, setNotes] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const resolvedCustomerId = customer.customerId

  const fetchContracts = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/sfs-customers/${encodeURIComponent(customer.id)}/contracts`)
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error ?? 'Failed to load contracts')
      if (json.customerId && !resolvedCustomerId) onCustomerBound(json.customerId)
      setContracts(json.contracts ?? [])
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load contracts.')
      setContracts([])
    } finally {
      setLoading(false)
    }
  }, [customer.id, onCustomerBound, resolvedCustomerId])

  useEffect(() => {
    fetchContracts()
  }, [fetchContracts])

  async function handleUpload(fileList: FileList | null) {
    const file = fileList?.[0]
    if (!file) return
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      if (notes.trim()) fd.append('notes', notes.trim())
      const res = await fetch(`/api/admin/sfs-customers/${encodeURIComponent(customer.id)}/contracts`, {
        method: 'POST',
        body: fd,
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error ?? 'Upload failed')
      if (json.contract?.customerId) onCustomerBound(json.contract.customerId)
      toast.success('Contract uploaded.')
      setNotes('')
      if (fileRef.current) fileRef.current.value = ''
      await fetchContracts()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed.')
    } finally {
      setUploading(false)
    }
  }

  async function handleDelete(contractId: string) {
    if (!window.confirm('Delete this contract file?')) return
    setDeletingId(contractId)
    try {
      const res = await fetch(
        `/api/admin/sfs-customers/${encodeURIComponent(customer.id)}/contracts/${encodeURIComponent(contractId)}`,
        { method: 'DELETE' },
      )
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error ?? 'Delete failed')
      toast.success('Contract deleted.')
      setContracts(prev => prev.filter(item => item.id !== contractId))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed.')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="space-y-3 rounded-md p-4" style={{ background: '#0A0A0A', border: '1px solid #2A2418' }}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Cooperation contracts</h3>
          <p className="text-xs mt-1" style={{ color: 'var(--muted-foreground)' }}>
            Upload, view, and download partnership agreements with this customer.
          </p>
        </div>
        <FileText size={16} style={{ color: '#C9A96E' }} />
      </div>

      {!resolvedCustomerId && (
        <p className="text-xs rounded-md px-3 py-2" style={{ background: 'rgba(201,169,110,0.08)', color: '#C9A96E' }}>
          Save the customer profile first to enable contract uploads.
        </p>
      )}

      <div className="space-y-2">
        <label className="space-y-1.5 block">
          <span className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>Notes optional</span>
          <Input value={notes} onChange={e => setNotes(e.target.value)} maxLength={500} placeholder="Contract version, effective date, etc." />
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={e => handleUpload(e.target.files)}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={uploading || !resolvedCustomerId}
            onClick={() => fileRef.current?.click()}
          >
            <Upload size={13} />
            {uploading ? 'Uploading...' : 'Upload contract'}
          </Button>
        </div>
      </div>

      {loading ? (
        <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Loading contracts...</p>
      ) : contracts.length === 0 ? (
        <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>No contract files yet.</p>
      ) : (
        <div className="space-y-2">
          {contracts.map(contract => (
            <div
              key={contract.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-md px-3 py-2"
              style={{ border: '1px solid #2A2418' }}
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate" style={{ color: 'var(--foreground)' }}>{contract.fileName}</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                  {formatFileSize(contract.fileSize)} · {formatDate(contract.createdAt)}
                  {contract.uploadedBy?.nameEn || contract.uploadedBy?.email
                    ? ` · ${contract.uploadedBy.nameEn ?? contract.uploadedBy.email}`
                    : ''}
                </p>
                {contract.notes && (
                  <p className="text-xs mt-1 whitespace-pre-wrap" style={{ color: 'var(--muted-foreground)' }}>{contract.notes}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={contractFileUrl(contract.storageKey)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex"
                >
                  <Button type="button" variant="outline" size="sm">
                    <FileText size={13} />
                    View
                  </Button>
                </a>
                <a href={contractFileUrl(contract.storageKey)} download={contract.fileName} className="inline-flex">
                  <Button type="button" variant="outline" size="sm">
                    <Download size={13} />
                    Download
                  </Button>
                </a>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={deletingId === contract.id}
                  onClick={() => handleDelete(contract.id)}
                >
                  <Trash2 size={13} />
                  {deletingId === contract.id ? 'Deleting...' : 'Delete'}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function CustomerModal({
  customer,
  onClose,
  onSaved,
}: {
  customer?: CustomerRow
  onClose: () => void
  onSaved: () => void
}) {
  const isEdit = Boolean(customer)
  const [form, setForm] = useState<CustomerFormValues>({
    name: customer?.name ?? '',
    email: customer?.email ?? '',
    phone: customer?.phone ?? '',
    mailingAddress: customer?.mailingAddress ?? '',
    notes: customer?.notes ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [boundCustomerId, setBoundCustomerId] = useState<string | null>(customer?.customerId ?? null)

  const displayCustomer: CustomerRow | undefined = customer
    ? { ...customer, customerId: boundCustomerId ?? customer.customerId }
    : undefined

  function updateField<K extends keyof CustomerFormValues>(key: K, value: CustomerFormValues[K]) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await fetch(
        isEdit ? `/api/admin/sfs-customers/${encodeURIComponent(customer!.id)}` : '/api/admin/sfs-customers',
        {
          method: isEdit ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        },
      )
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error ?? (isEdit ? 'Failed to update customer' : 'Failed to create customer'))
      if (json.customer?.id) setBoundCustomerId(json.customer.id)
      toast.success(isEdit ? 'Customer updated.' : 'Customer created.')
      onSaved()
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : (isEdit ? 'Failed to update customer.' : 'Failed to create customer.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-lg rounded-lg p-6 space-y-5" style={{ background: '#111111', border: '1px solid #2A2418' }}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold" style={{ color: 'var(--foreground)' }}>
              {isEdit ? 'Edit SFS customer' : 'Create SFS customer'}
            </h2>
            <p className="text-xs mt-1" style={{ color: 'var(--muted-foreground)' }}>
              {isEdit
                ? 'Updates the SFS customer profile shown in this registry.'
                : 'Manual customer records do not create or require a platform login account.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 inline-flex items-center justify-center rounded-md"
            style={{ color: 'var(--muted-foreground)', border: '1px solid #2A2418' }}
            aria-label="Close"
          >
            <X size={14} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-1.5">
              <span className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>Name</span>
              <Input value={form.name} onChange={e => updateField('name', e.target.value)} required maxLength={200} />
            </label>
            <label className="space-y-1.5">
              <span className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>Email optional</span>
              <Input value={form.email} onChange={e => updateField('email', e.target.value)} maxLength={320} />
            </label>
          </div>

          <label className="space-y-1.5 block">
            <span className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>Phone</span>
            <Input value={form.phone} onChange={e => updateField('phone', e.target.value)} maxLength={50} />
          </label>

          <label className="space-y-1.5 block">
            <span className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>Mailing address</span>
            <textarea
              value={form.mailingAddress}
              onChange={e => updateField('mailingAddress', e.target.value)}
              maxLength={500}
              rows={3}
              className="w-full rounded-md px-3 py-2 text-sm outline-none"
              style={{ background: '#0A0A0A', border: '1px solid #2A2418', color: 'var(--foreground)' }}
            />
          </label>

          <label className="space-y-1.5 block">
            <span className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>Notes</span>
            <textarea
              value={form.notes}
              onChange={e => updateField('notes', e.target.value)}
              maxLength={2000}
              rows={3}
              className="w-full rounded-md px-3 py-2 text-sm outline-none"
              style={{ background: '#0A0A0A', border: '1px solid #2A2418', color: 'var(--foreground)' }}
            />
          </label>

          {isEdit && displayCustomer && (
            <CustomerContractsSection
              customer={displayCustomer}
              onCustomerBound={setBoundCustomerId}
            />
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving}>
              {isEdit ? <Pencil size={14} /> : <UserPlus size={14} />}
              {saving ? 'Saving...' : isEdit ? 'Save changes' : 'Create customer'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function SfsCustomersPage() {
  const [customers, setCustomers] = useState<CustomerRow[]>([])
  const [total, setTotal] = useState(0)
  const [pageSize, setPageSize] = useState(20)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState<CustomerRow | null>(null)

  const fetchCustomers = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page) })
      if (search.trim()) params.set('q', search.trim())
      const res = await fetch(`/api/admin/sfs-customers?${params}`)
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error ?? 'Failed to load customers')
      setCustomers(json.customers ?? [])
      setTotal(json.total ?? 0)
      setPageSize(json.pageSize ?? 20)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load customers.')
    } finally {
      setLoading(false)
    }
  }, [page, search])

  useEffect(() => {
    const t = setTimeout(fetchCustomers, search ? 250 : 0)
    return () => clearTimeout(t)
  }, [fetchCustomers, search])

  const pages = Math.max(1, Math.ceil(total / pageSize))

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>SFS Customers</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
            {total} customer record{total === 1 ? '' : 's'}
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <UserPlus size={14} />
          Create customer
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative w-full max-w-sm">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--muted-foreground)' }} />
          <Input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            placeholder="Search name, email, phone, address, order..."
            className="pl-8"
          />
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead style={{ background: '#111108', borderBottom: '1px solid #2A2418' }}>
                <tr>
                  {['Customer', 'Contact', 'Address', 'Orders', 'Latest order', 'Source', 'Created'].map(h => (
                    <th key={h} className="px-4 py-3 text-left font-medium whitespace-nowrap" style={{ color: 'var(--muted-foreground)' }}>{h}</th>
                  ))}
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2A2418]">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center" style={{ color: 'var(--muted-foreground)' }}>Loading...</td>
                  </tr>
                ) : customers.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <ContactRound size={28} style={{ color: '#C9A96E', opacity: 0.45 }} />
                        <span style={{ color: 'var(--muted-foreground)' }}>{search ? 'No customers match your search.' : 'No SFS customers yet.'}</span>
                      </div>
                    </td>
                  </tr>
                ) : customers.map(customer => {
                  const source = SOURCE_STYLE[customer.source]
                  const latest = customer.latestOrder
                  const status = latest ? (STATUS_STYLE[latest.status] ?? STATUS_STYLE.PENDING) : null
                  return (
                    <tr key={customer.id} className="hover:bg-[#1A1A12]/50 align-top">
                      <td className="px-4 py-3 min-w-[220px]">
                        <div className="font-medium" style={{ color: 'var(--foreground)' }}>{customer.name}</div>
                        <div className="mt-1 text-xs" style={{ color: 'var(--muted-foreground)' }}>
                          {customer.userId ? 'Registered platform account' : customer.customerId ? 'Manual profile' : 'From order data'}
                        </div>
                      </td>
                      <td className="px-4 py-3 min-w-[240px]">
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2">
                            <Mail size={13} style={{ color: '#756A58' }} />
                            <span className="break-all" style={{ color: customer.email ? 'var(--foreground)' : 'var(--muted-foreground)' }}>{customer.email ?? '-'}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Phone size={13} style={{ color: '#756A58' }} />
                            <span style={{ color: customer.phone ? 'var(--foreground)' : 'var(--muted-foreground)' }}>{customer.phone ?? '-'}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 min-w-[260px] max-w-[360px]">
                        <div className="flex items-start gap-2">
                          <MapPin size={13} className="mt-0.5 flex-shrink-0" style={{ color: '#756A58' }} />
                          <span className="whitespace-normal" style={{ color: customer.mailingAddress ? 'var(--foreground)' : 'var(--muted-foreground)' }}>
                            {customer.mailingAddress ?? '-'}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap" style={{ color: 'var(--foreground)' }}>{customer.orderCount}</td>
                      <td className="px-4 py-3 min-w-[220px]">
                        {latest ? (
                          <div className="space-y-1.5">
                            <Link href={`/admin/sfs-orders/${latest.id}`} className="font-medium underline-offset-4 hover:underline" style={{ color: '#C9A96E' }}>
                              {latest.sampleCode ?? latest.memorialName}
                            </Link>
                            <div className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{latest.memorialName}</div>
                            <div className="flex items-center gap-2">
                              {status && (
                                <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium" style={{ background: status.bg, color: status.color }}>
                                  {latest.status}
                                </span>
                              )}
                              <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{formatDate(latest.createdAt)}</span>
                            </div>
                          </div>
                        ) : (
                          <span style={{ color: 'var(--muted-foreground)' }}>-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium" style={{ background: source.bg, color: source.color }}>
                          {source.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap" style={{ color: 'var(--muted-foreground)' }}>{formatDate(customer.createdAt)}</td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <Button variant="outline" size="sm" onClick={() => setEditingCustomer(customer)}>
                          <Pencil size={13} />
                          Edit
                        </Button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {pages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>Prev</Button>
          <span className="text-sm" style={{ color: 'var(--muted-foreground)' }}>{page} / {pages}</span>
          <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage(p => Math.min(pages, p + 1))}>Next</Button>
        </div>
      )}

      {showCreate && (
        <CustomerModal
          onClose={() => setShowCreate(false)}
          onSaved={() => {
            setPage(1)
            fetchCustomers()
          }}
        />
      )}
      {editingCustomer && (
        <CustomerModal
          customer={editingCustomer}
          onClose={() => setEditingCustomer(null)}
          onSaved={fetchCustomers}
        />
      )}
    </div>
  )
}
