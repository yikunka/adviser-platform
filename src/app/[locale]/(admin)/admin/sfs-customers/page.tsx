'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Link } from '@/i18n/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { ContactRound, Mail, MapPin, Phone, Search, UserPlus, X } from 'lucide-react'

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

function CreateCustomerModal({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated: () => void
}) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [mailingAddress, setMailingAddress] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await fetch('/api/admin/sfs-customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, phone, mailingAddress, notes }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error ?? 'Failed to create customer')
      toast.success('Customer created.')
      onCreated()
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create customer.')
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
            <h2 className="text-lg font-semibold" style={{ color: 'var(--foreground)' }}>Create SFS customer</h2>
            <p className="text-xs mt-1" style={{ color: 'var(--muted-foreground)' }}>
              Manual customer records do not create or require a platform login account.
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
              <Input value={name} onChange={e => setName(e.target.value)} required maxLength={200} />
            </label>
            <label className="space-y-1.5">
              <span className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>Email optional</span>
              <Input type="email" value={email} onChange={e => setEmail(e.target.value)} maxLength={320} />
            </label>
          </div>

          <label className="space-y-1.5 block">
            <span className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>Phone</span>
            <Input value={phone} onChange={e => setPhone(e.target.value)} maxLength={50} />
          </label>

          <label className="space-y-1.5 block">
            <span className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>Mailing address</span>
            <textarea
              value={mailingAddress}
              onChange={e => setMailingAddress(e.target.value)}
              maxLength={500}
              rows={3}
              className="w-full rounded-md px-3 py-2 text-sm outline-none"
              style={{ background: '#0A0A0A', border: '1px solid #2A2418', color: 'var(--foreground)' }}
            />
          </label>

          <label className="space-y-1.5 block">
            <span className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>Notes</span>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              maxLength={2000}
              rows={3}
              className="w-full rounded-md px-3 py-2 text-sm outline-none"
              style={{ background: '#0A0A0A', border: '1px solid #2A2418', color: 'var(--foreground)' }}
            />
          </label>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving}>
              <UserPlus size={14} />
              {saving ? 'Creating...' : 'Create customer'}
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
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2A2418]">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center" style={{ color: 'var(--muted-foreground)' }}>Loading...</td>
                  </tr>
                ) : customers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center">
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
        <CreateCustomerModal
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setPage(1)
            fetchCustomers()
          }}
        />
      )}
    </div>
  )
}
