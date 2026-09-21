'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from '@/i18n/navigation'
import { useSearchParams } from 'next/navigation'
import { Plus, Search, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { useAdminPermission } from '@/components/admin/AdminPermissionContext'

const STATUSES = ['DRAFT', 'CONFIRMED', 'SHIPPED', 'COMPLETED', 'CANCELLED'] as const

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  DRAFT: { bg: 'rgba(201,169,110,0.12)', color: '#C9A96E' },
  CONFIRMED: { bg: 'rgba(59,130,246,0.12)', color: '#3b82f6' },
  SHIPPED: { bg: 'rgba(16,185,129,0.12)', color: '#10b981' },
  COMPLETED: { bg: 'rgba(120,113,108,0.15)', color: '#7A7060' },
  CANCELLED: { bg: 'rgba(239,68,68,0.12)', color: '#ef4444' },
}

type Order = {
  id: string
  orderNumber: string
  orderDate: string
  status: string
  currency: string
  customer: { name: string; company: string }
  lineCount: number
  total: number
}

export default function AdminJmmOrdersPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const canCreate = useAdminPermission('jmmOrders.create')
  const canDelete = useAdminPermission('jmmOrders.delete')
  const [orders, setOrders] = useState<Order[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState(searchParams.get('q') ?? '')
  const [debouncedSearch, setDebouncedSearch] = useState(search.trim())
  const [status, setStatus] = useState(searchParams.get('status') ?? '')
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), search ? 300 : 0)
    return () => clearTimeout(timer)
  }, [search])

  const fetchOrders = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(page), pageSize: '20' })
    if (debouncedSearch) params.set('q', debouncedSearch)
    if (status) params.set('status', status)
    try {
      const res = await fetch(`/api/admin/jmm-orders?${params}`)
      if (!res.ok) throw new Error('load')
      const data = await res.json() as { orders: Order[]; total: number }
      setOrders(data.orders)
      setTotal(data.total)
    } catch {
      toast.error('Could not load orders')
    } finally {
      setLoading(false)
    }
  }, [page, debouncedSearch, status])

  useEffect(() => { void fetchOrders() }, [fetchOrders])

  async function remove(order: Order) {
    if (!window.confirm(`Delete ${order.orderNumber}?`)) return
    setDeletingId(order.id)
    try {
      const res = await fetch(`/api/admin/jmm-orders/${order.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('delete')
      toast.success('Order deleted')
      await fetchOrders()
    } catch {
      toast.error('Could not delete order')
    } finally {
      setDeletingId(null)
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / 20))

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>JMM Orders</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
            {total} order{total === 1 ? '' : 's'}{status ? ` · ${status}` : ''}
          </p>
        </div>
        {canCreate && (
          <button type="button" onClick={() => router.push('/admin/jmm-orders/new')} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold" style={{ background: '#C9A96E', color: '#1a1408' }}>
            <Plus size={14} /> New order
          </button>
        )}
      </div>

      <div className="rounded-xl p-4 space-y-3" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
        <div className="relative max-w-sm">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--muted-foreground)' }} />
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            placeholder="Search order, customer, or item"
            className="w-full pl-8 pr-3 py-2 rounded-lg text-sm outline-none"
            style={{ background: 'var(--surface-input)', border: '1px solid var(--border-subtle)', color: 'var(--foreground)' }}
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button type="button" onClick={() => { setStatus(''); setPage(1) }} className="px-2.5 py-1 rounded-full text-xs font-semibold" style={{ background: !status ? 'rgba(201,169,110,0.2)' : 'transparent', color: !status ? '#C9A96E' : 'var(--muted-foreground)', border: !status ? '1px solid #C9A96E' : '1px solid transparent' }}>
            All
          </button>
          {STATUSES.map(item => {
            const style = STATUS_STYLE[item]
            const active = status === item
            return (
              <button key={item} type="button" onClick={() => { setStatus(item); setPage(1) }} className="px-2.5 py-1 rounded-full text-xs font-semibold" style={{ background: style.bg, color: style.color, border: active ? `1px solid ${style.color}` : '1px solid transparent' }}>
                {item}
              </button>
            )
          })}
        </div>
      </div>

      <div className="rounded-xl overflow-hidden" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: 'rgba(201,169,110,0.04)' }}>
              {['Order', 'Date', 'Customer', 'Status', 'Total', ''].map(label => (
                <th key={label} className="text-left px-4 py-3 font-medium" style={{ color: 'var(--muted-foreground)' }}>{label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-8" style={{ color: 'var(--muted-foreground)' }}>Loading…</td></tr>
            ) : orders.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8" style={{ color: 'var(--muted-foreground)' }}>No orders yet.</td></tr>
            ) : orders.map(order => {
              const style = STATUS_STYLE[order.status] ?? STATUS_STYLE.DRAFT
              return (
                <tr
                  key={order.id}
                  className="cursor-pointer"
                  style={{ borderTop: '1px solid var(--border)' }}
                  onClick={() => router.push(`/admin/jmm-orders/${order.id}`)}
                >
                  <td className="px-4 py-3 font-medium" style={{ color: 'var(--foreground)' }}>{order.orderNumber}</td>
                  <td className="px-4 py-3" style={{ color: 'var(--muted-foreground)' }}>{order.orderDate}</td>
                  <td className="px-4 py-3" style={{ color: 'var(--muted-foreground)' }}>
                    {order.customer.name}{order.customer.company ? ` · ${order.customer.company}` : ''}
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold" style={{ background: style.bg, color: style.color }}>{order.status}</span>
                  </td>
                  <td className="px-4 py-3" style={{ color: 'var(--foreground)' }}>
                    {order.currency} {order.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                    {canDelete && (
                      <button type="button" disabled={deletingId === order.id} onClick={() => void remove(order)} style={{ color: '#ef4444' }} aria-label={`Delete ${order.orderNumber}`}>
                        <Trash2 size={14} />
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
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
    </div>
  )
}
