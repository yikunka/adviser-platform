'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from '@/i18n/navigation'
import { ListChecks, Search } from 'lucide-react'
import type { ProjectCollectionStatus, ProjectInvoicingStatus } from '@/lib/adviser/project-labels'
import { SFS_TRACKER_STAGES } from '@/lib/sfs/order-tracker'

type TrackingRow = {
  id: string
  sampleCode: string | null
  memorialName: string
  clientName: string
  status: string
  stageKey: string
  stageLabel: string
  stageNumber: number
  stageState: 'done' | 'current' | 'upcoming'
  invoicingStatus: ProjectInvoicingStatus
  collectionStatus: ProjectCollectionStatus
}

const INVOICING: Record<ProjectInvoicingStatus, string> = {
  NOT_INVOICED: 'Not invoiced',
  PARTIAL: 'Partly invoiced',
  INVOICED: 'Invoiced',
}

const COLLECTION: Record<ProjectCollectionStatus, string> = {
  UNPAID: 'Unpaid',
  PARTIAL: 'Partly paid',
  PAID: 'Paid',
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

export default function AdminSfsOrderTrackerPage() {
  const router = useRouter()
  const [orders, setOrders] = useState<TrackingRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [stageKey, setStageKey] = useState('')

  useEffect(() => {
    let cancelled = false
    fetch('/api/sfsdiamond/admin/orders/tracker')
      .then(async res => {
        const json = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(json.error || 'Failed to load orders')
        return json
      })
      .then(json => {
        if (!cancelled) setOrders(Array.isArray(json.orders) ? json.orders : [])
      })
      .catch(() => {
        if (!cancelled) setOrders([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return orders.filter(order => {
      if (stageKey && order.stageKey !== stageKey) return false
      if (!q) return true
      const haystack = [order.sampleCode, order.memorialName, order.clientName].filter(Boolean).join(' ').toLowerCase()
      return haystack.includes(q)
    })
  }, [orders, search, stageKey])

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>
          Order tracking
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
          {loading ? 'Loading…' : `${filtered.length} open order${filtered.length === 1 ? '' : 's'}`}
        </p>
      </div>

      <div className="rounded-xl p-4 space-y-3" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
        <div className="relative max-w-sm">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--muted-foreground)' }} />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search name, client, sample code…"
            className="w-full pl-8 pr-3 py-2 rounded-lg text-sm outline-none"
            style={{ background: 'var(--surface-input)', border: '1px solid var(--border-subtle)', color: 'var(--foreground)' }}
            onFocus={e => (e.currentTarget.style.borderColor = '#C9A96E')}
            onBlur={e => (e.currentTarget.style.borderColor = 'var(--border-subtle)')}
          />
        </div>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by production stage">
          <button
            type="button"
            onClick={() => setStageKey('')}
            className="px-2.5 py-1 rounded-full text-xs font-semibold"
            style={{
              background: !stageKey ? 'rgba(201,169,110,0.2)' : 'rgba(201,169,110,0.06)',
              color: !stageKey ? '#C9A96E' : 'var(--muted-foreground)',
              border: !stageKey ? '1px solid #C9A96E' : '1px solid transparent',
            }}
          >
            All stages
          </button>
          {SFS_TRACKER_STAGES.map((stage, index) => {
            const active = stageKey === stage.key
            return (
              <button
                key={stage.key}
                type="button"
                onClick={() => setStageKey(stage.key)}
                className="px-2.5 py-1 rounded-full text-xs font-semibold"
                style={{
                  background: active ? 'rgba(201,169,110,0.2)' : 'rgba(201,169,110,0.06)',
                  color: active ? '#C9A96E' : 'var(--muted-foreground)',
                  border: active ? '1px solid #C9A96E' : '1px solid transparent',
                  opacity: active || !stageKey ? 1 : 0.55,
                }}
              >
                {index + 1}. {stage.label}
              </button>
            )
          })}
        </div>
      </div>

      <div className="rounded-xl overflow-hidden" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
        {loading ? (
          <div className="py-16 text-center text-sm" style={{ color: 'var(--muted-foreground)' }}>Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <ListChecks size={32} style={{ color: '#C9A96E', opacity: 0.4 }} />
            <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
              {orders.length === 0 ? 'No open orders.' : 'No orders match your filters.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  {['Sample Code', 'Memorial', 'Client', 'Stage', 'Invoicing', 'Collection', ''].map(h => (
                    <th key={h || 'action'} style={th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((order, i) => {
                  const paid = order.collectionStatus === 'PAID'
                  const stageDone = order.stageState === 'done'
                  return (
                    <tr
                      key={order.id}
                      className="cursor-pointer transition-colors hover:bg-[var(--surface-modal)]"
                      style={{ borderBottom: i < filtered.length - 1 ? '1px solid var(--border)' : 'none' }}
                      tabIndex={0}
                      onClick={() => router.push(`/admin/sfs-orders/${order.id}`)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' || e.key === ' ') router.push(`/admin/sfs-orders/${order.id}`)
                      }}
                    >
                      <td style={{ ...td, color: '#C9A96E', fontFamily: 'monospace' }}>
                        {order.sampleCode ?? '—'}
                      </td>
                      <td style={{ ...td, color: 'var(--foreground)', fontWeight: 500 }}>{order.memorialName}</td>
                      <td style={td}>{order.clientName}</td>
                      <td style={td}>
                        <span
                          className="px-2.5 py-1 rounded-full text-xs font-semibold"
                          style={{
                            background: stageDone ? 'rgba(16,185,129,0.12)' : 'rgba(201,169,110,0.12)',
                            color: stageDone ? '#10b981' : '#C9A96E',
                          }}
                        >
                          {order.stageNumber}. {order.stageLabel}
                        </span>
                      </td>
                      <td style={td}>{INVOICING[order.invoicingStatus]}</td>
                      <td style={{ ...td, color: paid ? '#10b981' : '#ef4444', fontWeight: 500 }}>
                        {COLLECTION[order.collectionStatus]}
                      </td>
                      <td style={{ ...td, paddingRight: '1rem' }}>
                        <span className="text-xs font-medium px-3 py-1.5 rounded-lg" style={{ background: 'rgba(201,169,110,0.1)', color: '#C9A96E', border: '1px solid rgba(201,169,110,0.2)' }}>
                          Open →
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
