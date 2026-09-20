'use client'

import { useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { summarizeProjectBilling } from '@/lib/adviser/project-labels'
import { useAdminPermission } from '@/components/admin/AdminPermissionContext'
import { SfsProductionTracker } from '@/components/sfs/SfsProductionTracker'
import type { SfsTrackerStage } from '@/lib/sfs/order-tracker'

export type SfsTrackerInvoice = {
  id: string
  invoiceNumber: string
  status: string
  total: number
  currency: string
}

export function SfsOrderTrackerPanel({
  orderId,
  stages,
  packageArrivedHkAt,
  invoices,
  onHkChange,
  onInvoicesChange,
}: {
  orderId: string
  stages: SfsTrackerStage[]
  packageArrivedHkAt: string
  invoices: SfsTrackerInvoice[]
  onHkChange: (value: string) => void
  onInvoicesChange: (invoices: SfsTrackerInvoice[]) => void
}) {
  const canInvoice = useAdminPermission('sfsInvoices')
  const billing = summarizeProjectBilling(invoices.map(invoice => invoice.status))
  const delivery = stages.find(stage => stage.key === 'delivery')
  const deliveryWarning = delivery && delivery.state !== 'upcoming' && billing.collectionStatus !== 'PAID'
    ? 'Delivery is not blocked, but payment has not been received in full.'
    : null
  const [hkAt, setHkAt] = useState(packageArrivedHkAt)
  const [savingHk, setSavingHk] = useState(false)
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  async function saveHk() {
    setSavingHk(true)
    try {
      const res = await fetch(`/api/sfsdiamond/admin/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packageArrivedHkAt: hkAt ? new Date(hkAt).toISOString() : null }),
      })
      if (!res.ok) throw new Error('Could not save the Hong Kong arrival time.')
      onHkChange(hkAt)
      toast.success('Package arrival in Hong Kong saved.')
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'Could not save the Hong Kong arrival time.')
    } finally {
      setSavingHk(false)
    }
  }

  async function togglePaid(invoice: SfsTrackerInvoice) {
    if (invoice.status !== 'SENT' && invoice.status !== 'PAID') return
    const status = invoice.status === 'PAID' ? 'SENT' : 'PAID'
    setUpdatingId(invoice.id)
    try {
      const res = await fetch(`/api/admin/sfs-invoices/${invoice.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) throw new Error('Could not update the invoice.')
      onInvoicesChange(invoices.map(row => row.id === invoice.id ? { ...row, status } : row))
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'Could not update the invoice.')
    } finally {
      setUpdatingId(null)
    }
  }

  return (
    <div className="space-y-3">
      <SfsProductionTracker
        stages={stages}
        invoicingStatus={billing.invoicingStatus}
        collectionStatus={billing.collectionStatus}
        deliveryWarning={deliveryWarning}
      />
      <div className="rounded-xl p-4 space-y-3" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <label className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
            Package arrived HK
            <input
              type="datetime-local"
              value={hkAt}
              onChange={event => setHkAt(event.target.value)}
              className="mt-1 block rounded-lg px-3 py-2 text-sm"
              style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--foreground)' }}
            />
          </label>
          <button
            type="button"
            disabled={savingHk || hkAt === packageArrivedHkAt}
            onClick={() => void saveHk()}
            className="px-3 py-2 rounded-lg text-xs font-semibold disabled:opacity-50"
            style={{ background: '#C9A96E', color: '#0A0805' }}
          >
            {savingHk ? 'Saving…' : 'Save arrival'}
          </button>
        </div>
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#C9A96E' }}>Invoices</h3>
          {canInvoice ? (
            <Link href={`/admin/sfs-invoices/new?orderId=${orderId}`} className="text-xs" style={{ color: '#3b82f6' }}>
              New invoice
            </Link>
          ) : null}
        </div>
        {invoices.length === 0 ? (
          <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>No invoice yet.</p>
        ) : (
          <ul className="space-y-2">
            {invoices.map(invoice => {
              const canToggle = canInvoice && (invoice.status === 'SENT' || invoice.status === 'PAID')
              return (
                <li key={invoice.id} className="flex items-center justify-between gap-3 text-sm">
                  <Link href={`/admin/sfs-invoices/${invoice.id}`} className="font-mono text-xs" style={{ color: '#C9A96E' }}>
                    {invoice.invoiceNumber}
                  </Link>
                  <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                    {invoice.currency} {invoice.total.toLocaleString('en-HK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  <label className="flex items-center gap-2 text-xs" style={{ color: 'var(--foreground)' }}>
                    <input
                      type="checkbox"
                      checked={invoice.status === 'PAID'}
                      disabled={!canToggle || updatingId === invoice.id}
                      onChange={() => void togglePaid(invoice)}
                    />
                    {invoice.status === 'PAID' ? 'Paid' : invoice.status === 'SENT' ? 'Unpaid' : invoice.status === 'DRAFT' ? 'Draft' : 'Cancelled'}
                  </label>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
