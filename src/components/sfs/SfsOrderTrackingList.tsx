'use client'

import { useEffect, useState } from 'react'
import { Link } from '@/i18n/navigation'
import type { ProjectCollectionStatus, ProjectInvoicingStatus } from '@/lib/adviser/project-labels'

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

export function SfsOrderTrackingList({
  activeId,
  refreshKey,
}: {
  activeId: string
  refreshKey?: string
}) {
  const [orders, setOrders] = useState<TrackingRow[]>([])
  const [loading, setLoading] = useState(true)

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
  }, [activeId, refreshKey])

  return (
    <aside className="w-full shrink-0 lg:sticky lg:top-4 lg:w-72 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto">
      <div className="rounded-xl p-3" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
        <h2 className="px-1 text-xs font-semibold uppercase tracking-wider" style={{ color: '#C9A96E' }}>
          Order tracking
        </h2>
        {loading ? <p className="mt-3 px-1 text-xs" style={{ color: 'var(--muted-foreground)' }}>Loading…</p> : null}
        {!loading && orders.length === 0 ? (
          <p className="mt-3 px-1 text-xs" style={{ color: 'var(--muted-foreground)' }}>No open orders.</p>
        ) : null}
        <ul className="mt-2 flex flex-col gap-1">
          {orders.map(order => {
            const active = order.id === activeId
            const paid = order.collectionStatus === 'PAID'
            return (
              <li key={order.id}>
                <Link
                  href={`/admin/sfs-orders/${order.id}`}
                  className="block rounded-lg px-2 py-2"
                  style={{
                    background: active ? 'rgba(201,169,110,0.12)' : 'transparent',
                    border: active ? '1px solid rgba(201,169,110,0.35)' : '1px solid transparent',
                  }}
                >
                  <p className="truncate text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                    {order.sampleCode ? <span className="mr-1 font-mono text-xs" style={{ color: '#C9A96E' }}>{order.sampleCode}</span> : null}
                    {order.memorialName}
                  </p>
                  <p className="truncate text-xs" style={{ color: 'var(--muted-foreground)' }}>{order.clientName}</p>
                  <p className="mt-1 text-xs" style={{ color: order.stageState === 'done' ? '#10b981' : '#C9A96E' }}>
                    {order.stageNumber}. {order.stageLabel}
                  </p>
                  <p className="mt-0.5 text-[11px]" style={{ color: paid ? '#10b981' : '#ef4444' }}>
                    {INVOICING[order.invoicingStatus]} · {COLLECTION[order.collectionStatus]}
                  </p>
                </Link>
              </li>
            )
          })}
        </ul>
      </div>
    </aside>
  )
}
