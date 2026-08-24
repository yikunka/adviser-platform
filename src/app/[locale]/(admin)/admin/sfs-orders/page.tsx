'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from '@/i18n/navigation'
import { Diamond, Search, ChevronLeft, ChevronRight, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { useAdminPermission } from '@/components/admin/AdminPermissionContext'

const STATUS_VALUES = ['PENDING', 'QUOTED', 'CONFIRMED', 'COMPLETED', 'CANCELLED'] as const

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  PENDING:   { bg: 'rgba(201,169,110,0.12)', color: '#C9A96E' },
  QUOTED:    { bg: 'rgba(59,130,246,0.12)',  color: '#3b82f6' },
  CONFIRMED: { bg: 'rgba(16,185,129,0.12)',  color: '#10b981' },
  COMPLETED: { bg: 'rgba(120,113,108,0.15)', color: '#7A7060' },
  CANCELLED: { bg: 'rgba(239,68,68,0.12)',   color: '#ef4444' },
}

const th: React.CSSProperties = {
  textAlign: 'left',
  padding: '0.75rem 1rem',
  fontWeight: 500,
  fontSize: '0.8125rem',
  color: 'var(--muted-foreground)',
  background: 'rgba(201,169,110,0.04)',
  borderBottom: '1px solid var(--border)',
  whiteSpace: 'nowrap',
}

const td: React.CSSProperties = {
  padding: '0.75rem 1rem',
  fontSize: '0.875rem',
  color: 'var(--muted-foreground)',
  whiteSpace: 'nowrap',
}

type Order = {
  id: string
  sampleCode: string | null
  memorialName: string
  clientName: string
  email: string
  sourceType: string
  color: string | null
  status: string
  createdAt: string
  diamonds: { carat?: string }[]
  _count: { steps: number }
}

export default function AdminSfsOrdersPage() {
  const router = useRouter()
  const canDelete = useAdminPermission('sfsOrders.delete')
  const [orders, setOrders]     = useState<Order[]>([])
  const [total, setTotal]       = useState(0)
  const [page, setPage]         = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [search, setSearch]     = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [status, setStatus]     = useState('')
  const [loading, setLoading]   = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), search ? 300 : 0)
    return () => clearTimeout(t)
  }, [search])

  const fetchOrders = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page) })
      if (debouncedSearch) params.set('q', debouncedSearch)
      if (status) params.set('status', status)
      const res = await fetch(`/api/sfsdiamond/admin/orders?${params}`)
      if (!res.ok) {
        console.error('SFS orders API error', res.status, await res.text())
        return
      }
      const data = await res.json()
      setOrders(data.orders ?? [])
      setTotal(data.total ?? 0)
      setPageSize(data.pageSize ?? 10)
    } catch (e) {
      console.error('SFS orders fetch failed', e)
    } finally {
      setLoading(false)
    }
  }, [debouncedSearch, status, page])

  useEffect(() => {
    void fetchOrders()
  }, [fetchOrders])

  async function deleteOrder(order: Order, e: React.MouseEvent) {
    e.stopPropagation()
    const label = order.sampleCode || order.memorialName
    if (!window.confirm(`Permanently delete order "${label}"? Steps and production images will be removed. Linked invoices stay but will be unlinked. This cannot be undone.`)) {
      return
    }
    setDeletingId(order.id)
    try {
      const res = await fetch(`/api/sfsdiamond/admin/orders/${order.id}`, { method: 'DELETE' })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(typeof body.error === 'string' ? body.error : 'Failed to delete order')
        return
      }
      toast.success('Order deleted.')
      await fetchOrders()
    } catch {
      toast.error('Network error — please try again')
    } finally {
      setDeletingId(null)
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const hasFilter = Boolean(debouncedSearch || status)

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>
            SFS Diamond Orders
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
            {total} order{total !== 1 ? 's' : ''}{status ? ` · ${status}` : ''}
          </p>
        </div>
      </div>

      {/* Search + status filter */}
      <div className="rounded-xl p-4 space-y-3" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
        <div className="relative max-w-sm">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--muted-foreground)' }} />
          <input
            type="text"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            placeholder="Search name, email, sample code…"
            className="w-full pl-8 pr-3 py-2 rounded-lg text-sm outline-none"
            style={{ background: '#0E0E0A', border: '1px solid #2A2418', color: 'var(--foreground)' }}
            onFocus={e => (e.currentTarget.style.borderColor = '#C9A96E')}
            onBlur={e  => (e.currentTarget.style.borderColor = '#2A2418')}
          />
        </div>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by status">
          <button
            type="button"
            onClick={() => { setStatus(''); setPage(1) }}
            className="px-2.5 py-1 rounded-full text-xs font-semibold transition-colors"
            style={{
              background: !status ? 'rgba(201,169,110,0.2)' : 'rgba(201,169,110,0.06)',
              color: !status ? '#C9A96E' : 'var(--muted-foreground)',
              border: !status ? '1px solid #C9A96E' : '1px solid transparent',
            }}
          >
            All
          </button>
          {STATUS_VALUES.map(s => {
            const style = STATUS_STYLE[s]
            const active = status === s
            return (
              <button
                key={s}
                type="button"
                onClick={() => { setStatus(s); setPage(1) }}
                className="px-2.5 py-1 rounded-full text-xs font-semibold transition-opacity"
                style={{
                  background: style.bg,
                  color: style.color,
                  border: active ? `1px solid ${style.color}` : '1px solid transparent',
                  opacity: active || !status ? 1 : 0.5,
                }}
              >
                {s}
              </button>
            )
          })}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl overflow-hidden" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
        {loading ? (
          <div className="py-16 text-center text-sm" style={{ color: 'var(--muted-foreground)' }}>Loading…</div>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Diamond size={32} style={{ color: '#C9A96E', opacity: 0.4 }} />
            <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
              {hasFilter ? 'No orders match your filters.' : 'No orders yet.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  {['Sample Code', 'Memorial', 'Client', 'Source', 'Color', 'Diamonds', 'Steps', 'Status', 'Date', ''].map(h => (
                    <th key={h} style={th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {orders.map((order, i) => {
                  const s = STATUS_STYLE[order.status] ?? STATUS_STYLE.PENDING
                  return (
                    <tr
                      key={order.id}
                      className="cursor-pointer transition-colors hover:bg-[#111108]"
                      style={{ borderBottom: i < orders.length - 1 ? '1px solid var(--border)' : 'none' }}
                      tabIndex={0}
                      onClick={() => router.push(`/admin/sfs-orders/${order.id}`)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' || e.key === ' ') router.push(`/admin/sfs-orders/${order.id}`)
                      }}
                    >
                      <td style={{ ...td, color: '#C9A96E', fontFamily: 'monospace' }}>
                        {order.sampleCode ?? '—'}
                      </td>
                      <td style={{ ...td, color: 'var(--foreground)', fontWeight: 500 }}>
                        {order.memorialName}
                      </td>
                      <td style={td}>
                        <div>{order.clientName}</div>
                        <div className="text-xs">{order.email}</div>
                      </td>
                      <td style={td}>{order.sourceType}</td>
                      <td style={td}>
                        {order.color
                          ? <span className="px-2.5 py-0.5 rounded-full text-xs font-medium" style={{ background: 'rgba(201,169,110,0.1)', color: '#C9A96E' }}>{order.color}</span>
                          : <span style={{ color: 'var(--muted-foreground)' }}>—</span>}
                      </td>
                      <td style={{ ...td, textAlign: 'center' }}>{order.diamonds.length}</td>
                      <td style={{ ...td, textAlign: 'center' }}>{order._count.steps}</td>
                      <td style={td}>
                        <span className="px-2.5 py-1 rounded-full text-xs font-semibold" style={{ background: s.bg, color: s.color }}>
                          {order.status}
                        </span>
                      </td>
                      <td style={td}>
                        {new Date(order.createdAt).toLocaleDateString('en-HK', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </td>
                      <td style={{ ...td, paddingRight: '1rem' }}>
                        <div className="flex items-center gap-2 justify-end">
                          {canDelete && (
                            <button
                              type="button"
                              disabled={deletingId === order.id}
                              onClick={e => void deleteOrder(order, e)}
                              className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium transition-opacity disabled:opacity-50"
                              style={{ color: '#ef4444', border: '1px solid rgba(239,68,68,0.35)', background: 'rgba(239,68,68,0.08)' }}
                              aria-label={`Delete order ${order.sampleCode ?? order.memorialName}`}
                            >
                              <Trash2 size={12} />
                              {deletingId === order.id ? '…' : 'Delete'}
                            </button>
                          )}
                          <span className="text-xs font-medium px-3 py-1.5 rounded-lg" style={{ background: 'rgba(201,169,110,0.1)', color: '#C9A96E', border: '1px solid rgba(201,169,110,0.2)', whiteSpace: 'nowrap' }}>
                            Manage →
                          </span>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div className="flex items-center justify-between flex-wrap gap-3">
          <p className="text-xs" style={{ color: '#5A5040' }}>
            Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total}
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-1.5 rounded-md transition-opacity disabled:opacity-30"
              style={{ border: '1px solid var(--border)', color: 'var(--muted-foreground)' }}
            >
              <ChevronLeft size={14} />
            </button>

            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(n => n === 1 || n === totalPages || Math.abs(n - page) <= 1)
              .reduce<(number | '…')[]>((acc, n, idx, arr) => {
                if (idx > 0 && n - (arr[idx - 1] as number) > 1) acc.push('…')
                acc.push(n)
                return acc
              }, [])
              .map((n, i) =>
                n === '…'
                  ? <span key={`el-${i}`} className="px-1 text-xs" style={{ color: 'var(--muted-foreground)' }}>…</span>
                  : (
                    <button
                      key={n}
                      onClick={() => setPage(n as number)}
                      className="min-w-[2rem] h-8 px-2 rounded-md text-xs font-medium transition-all"
                      style={{
                        background: page === n ? '#C9A96E' : 'transparent',
                        color:      page === n ? '#0A0805' : 'var(--muted-foreground)',
                        border:     page === n ? 'none'    : '1px solid var(--border)',
                      }}
                    >
                      {n}
                    </button>
                  )
              )}

            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="p-1.5 rounded-md transition-opacity disabled:opacity-30"
              style={{ border: '1px solid var(--border)', color: 'var(--muted-foreground)' }}
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
