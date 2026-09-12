'use client'

import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { ShoppingBag, Plus, X, Loader2 } from 'lucide-react'

const schema = z.object({
  orderType: z.enum(['INCORPORATION', 'REGISTERED_ADDRESS', 'ANNUAL_RETURN', 'ACCOUNTING', 'ADVISORY']),
  description: z.string().max(1000).optional(),
})
type FormData = z.infer<typeof schema>

type Order = { id: string; orderType: string; status: string; createdAt: string; description?: string }

const STATUS_STYLE: Record<string, { bg: string; text: string }> = {
  PENDING:    { bg: 'rgba(201,169,110,0.15)', text: '#C9A96E' },
  PROCESSING: { bg: 'rgba(99,102,241,0.15)',  text: '#818cf8' },
  COMPLETED:  { bg: 'rgba(16,185,129,0.12)',  text: '#10b981' },
  CANCELLED:  { bg: 'rgba(120,113,108,0.15)', text: '#7A7060' },
}

const selectStyle: React.CSSProperties = {
  width: '100%',
  background: 'var(--background)',
  border: '1px solid var(--border-subtle)',
  color: 'var(--text-cream)',
  borderRadius: '0.375rem',
  padding: '0.625rem 0.75rem',
  fontSize: '0.875rem',
  outline: 'none',
}

export default function OrdersPage() {
  const t = useTranslations('orders')
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)

  const form = useForm<FormData>({ resolver: zodResolver(schema) })

  useEffect(() => {
    fetch('/api/orders').then(r => r.json()).then(setOrders).catch(() => {})
  }, [])

  async function onSubmit(data: FormData) {
    setLoading(true)
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error ?? t('failed')); return }
      toast.success(t('created'))
      setShowForm(false)
      setOrders(prev => [{
        id: json.orderId,
        orderType: data.orderType,
        status: 'PENDING',
        createdAt: new Date().toISOString(),
        description: data.description,
      }, ...prev])
      form.reset()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: 'var(--foreground)' }}>{t('title')}</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>{t('subtitle', { defaultValue: 'Manage your service requests' })}</p>
        </div>
        <button
          onClick={() => setShowForm(f => !f)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all"
          style={{
            background: showForm ? 'transparent' : '#C9A96E',
            color: showForm ? 'var(--muted-foreground)' : '#0C0C0C',
            border: showForm ? '1px solid var(--border)' : 'none',
          }}
        >
          {showForm ? <X size={15} /> : <Plus size={15} />}
          {showForm ? t('cancel') : t('newOrder')}
        </button>
      </div>

      {/* New order form */}
      {showForm && (
        <div
          className="rounded-xl p-6 space-y-5"
          style={{ background: 'var(--card)', border: '1px solid #C9A96E40' }}
        >
          <div style={{ height: '2px', background: 'linear-gradient(90deg, #8A6E42, #C9A96E, #F0D090, #C9A96E, #8A6E42)', borderRadius: 1, marginBottom: 4 }} />
          <h3 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>{t('newOrder')}</h3>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium uppercase tracking-wider" style={{ color: '#9A8060' }}>{t('orderType')}</label>
              <select
                {...form.register('orderType')}
                style={selectStyle}
                onFocus={e => (e.currentTarget.style.borderColor = '#C9A96E')}
                onBlur={e => (e.currentTarget.style.borderColor = 'var(--border-subtle)')}
              >
                {(['INCORPORATION', 'REGISTERED_ADDRESS', 'ANNUAL_RETURN', 'ACCOUNTING', 'ADVISORY'] as const).map(type => (
                  <option key={type} value={type} style={{ background: 'var(--surface-raised)' }}>
                    {t(`types.${type.toLowerCase()}`)}
                  </option>
                ))}
              </select>
              {form.formState.errors.orderType && (
                <p className="text-xs" style={{ color: '#ef4444' }}>{form.formState.errors.orderType.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium uppercase tracking-wider" style={{ color: '#9A8060' }}>{t('description')}</label>
              <textarea
                rows={3}
                {...form.register('description')}
                placeholder={t('descriptionPlaceholder')}
                className="w-full rounded-md px-3 py-2.5 text-sm outline-none transition-all resize-none"
                style={{ background: 'var(--background)', border: '1px solid var(--border-subtle)', color: 'var(--text-cream)' }}
                onFocus={e => (e.currentTarget.style.borderColor = '#C9A96E')}
                onBlur={e => (e.currentTarget.style.borderColor = 'var(--border-subtle)')}
              />
            </div>

            <div className="flex gap-3 pt-1">
              <button
                type="submit"
                disabled={loading}
                className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-all"
                style={{ background: loading ? '#8A6E42' : '#C9A96E', color: '#0C0C0C' }}
                onMouseEnter={e => !loading && ((e.currentTarget as HTMLElement).style.background = '#D4B87A')}
                onMouseLeave={e => !loading && ((e.currentTarget as HTMLElement).style.background = '#C9A96E')}
              >
                {loading && <Loader2 size={14} className="animate-spin" />}
                {loading ? t('submitting') : t('submit')}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-5 py-2 rounded-lg text-sm font-medium transition-all"
                style={{ background: 'transparent', border: '1px solid var(--border)', color: 'var(--muted-foreground)' }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = '#C9A96E')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
              >
                {t('cancel')}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Orders table / empty state */}
      {orders.length === 0 ? (
        <div
          className="rounded-xl flex flex-col items-center justify-center py-20 gap-4"
          style={{ background: 'var(--card)', border: '1px dashed var(--border)' }}
        >
          <div
            className="w-14 h-14 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(201,169,110,0.1)', border: '1px solid rgba(201,169,110,0.2)' }}
          >
            <ShoppingBag size={24} style={{ color: '#C9A96E' }} />
          </div>
          <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>{t('empty')}</p>
        </div>
      ) : (
        <div
          className="rounded-xl overflow-hidden"
          style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
        >
          {/* Table header */}
          <div
            className="grid px-5 py-3 text-xs font-medium uppercase tracking-wider"
            style={{
              gridTemplateColumns: '1.5fr 120px 120px 1fr',
              background: 'var(--surface)',
              borderBottom: '1px solid var(--border)',
              color: 'var(--muted-foreground)',
            }}
          >
            <span>{t('orderType')}</span>
            <span>{t('status')}</span>
            <span>{t('date')}</span>
            <span>{t('description')}</span>
          </div>

          {orders.map((order, i) => {
            const statusStyle = STATUS_STYLE[order.status] ?? STATUS_STYLE.CANCELLED
            return (
              <div
                key={order.id}
                className="grid items-center px-5 py-4 transition-colors"
                style={{
                  gridTemplateColumns: '1.5fr 120px 120px 1fr',
                  borderBottom: i < orders.length - 1 ? '1px solid var(--border)' : 'none',
                  background: 'transparent',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--accent)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                  {t(`types.${order.orderType.toLowerCase()}`)}
                </span>
                <span>
                  <span
                    className="px-2.5 py-1 rounded-full text-xs font-semibold"
                    style={{ background: statusStyle.bg, color: statusStyle.text }}
                  >
                    {order.status}
                  </span>
                </span>
                <span className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                  {new Date(order.createdAt).toLocaleDateString()}
                </span>
                <span className="text-sm truncate" style={{ color: 'var(--muted-foreground)' }}>
                  {order.description ?? '—'}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
