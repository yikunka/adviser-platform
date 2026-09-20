'use client'

import { useEffect, useMemo, useState } from 'react'
import { Link } from '@/i18n/navigation'
import { ListChecks, Search } from 'lucide-react'
import { SfsProductionTracker } from '@/components/sfs/SfsProductionTracker'
import type { ProjectCollectionStatus, ProjectInvoicingStatus } from '@/lib/adviser/project-labels'
import { SFS_TRACKER_STAGES, type SfsTrackerStage } from '@/lib/sfs/order-tracker'

type TrackingRow = {
  id: string
  sampleCode: string | null
  memorialName: string
  clientName: string
  status: string
  stages: SfsTrackerStage[]
  stageKey: string
  stageLabel: string
  stageNumber: number
  stageState: 'done' | 'current' | 'upcoming'
  invoicingStatus: ProjectInvoicingStatus
  collectionStatus: ProjectCollectionStatus
}

export default function AdminSfsOrderTrackerPage() {
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

      {loading || filtered.length === 0 ? (
        <div className="rounded-xl overflow-hidden" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          {loading ? (
            <div className="py-16 text-center text-sm" style={{ color: 'var(--muted-foreground)' }}>Loading…</div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <ListChecks size={32} style={{ color: '#C9A96E', opacity: 0.4 }} />
              <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                {orders.length === 0 ? 'No open orders.' : 'No orders match your filters.'}
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map(order => {
            const delivery = order.stages?.find(stage => stage.key === 'delivery')
            const deliveryWarning = delivery && delivery.state !== 'upcoming' && order.collectionStatus !== 'PAID'
              ? 'Delivery is not blocked, but payment has not been received in full.'
              : null
            return (
              <Link key={order.id} href={`/admin/sfs-orders/${order.id}`} className="block space-y-2">
                <div className="flex flex-wrap items-baseline justify-between gap-2 px-1">
                  <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                    {order.sampleCode ? (
                      <span className="mr-2 font-mono text-xs" style={{ color: '#C9A96E' }}>{order.sampleCode}</span>
                    ) : null}
                    {order.memorialName}
                  </p>
                  <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{order.clientName}</p>
                </div>
                <SfsProductionTracker
                  stages={order.stages ?? []}
                  invoicingStatus={order.invoicingStatus}
                  collectionStatus={order.collectionStatus}
                  deliveryWarning={deliveryWarning}
                />
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
