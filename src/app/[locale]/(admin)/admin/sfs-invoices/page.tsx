'use client'

/* eslint-disable react-hooks/set-state-in-effect */

import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Link } from '@/i18n/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'

type InvoiceRow = {
  id: string
  invoiceNumber: string
  status: string
  issueDate: string
  dueDate?: string | null
  total: string
  currency: string
  billToName: string
  order?: { id: string; memorialName: string; sampleCode?: string | null; clientName: string } | null
}

const STATUS_COLOR: Record<string, string> = {
  DRAFT: 'bg-[rgba(120,113,108,0.15)] text-[#9A8060]',
  SENT: 'bg-[rgba(59,130,246,0.12)] text-[#3b82f6]',
  PAID: 'bg-[rgba(16,185,129,0.12)] text-[#10b981]',
  CANCELLED: 'bg-[rgba(239,68,68,0.12)] text-[#ef4444]',
}

export default function SfsInvoicesPage() {
  const t = useTranslations('admin.sfsInvoices')
  const [invoices, setInvoices] = useState<InvoiceRow[]>([])
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)

  const fetchInvoices = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page) })
      if (search) params.set('q', search)
      if (status) params.set('status', status)
      const res = await fetch(`/api/admin/sfs-invoices?${params}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed')
      setInvoices(json.invoices ?? [])
      setTotal(json.total ?? 0)
    } catch (err) {
      const detail = err instanceof Error && err.message !== 'Failed' ? ` ${err.message}` : ''
      toast.error(`${t('loadFailed')}${detail}`)
    } finally {
      setLoading(false)
    }
  }, [search, status, page, t])

  useEffect(() => {
    fetchInvoices()
  }, [fetchInvoices])

  const pages = Math.max(1, Math.ceil(total / 20))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>
          {t('title')}
        </h1>
        <Link href="/admin/sfs-invoices/new">
          <Button>{t('create')}</Button>
        </Link>
      </div>

      <div className="flex gap-2 flex-wrap">
        <Input
          placeholder={t('search')}
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1) }}
          className="max-w-xs"
        />
        <select
          value={status}
          onChange={e => { setStatus(e.target.value); setPage(1) }}
          className="max-w-xs rounded-md px-3 py-2 text-sm"
          style={{ background: 'var(--surface)', border: '1px solid var(--border-subtle)', color: 'var(--text-cream)' }}
        >
          <option value="">{t('allStatuses')}</option>
          {(['DRAFT', 'SENT', 'PAID', 'CANCELLED'] as const).map(s => (
            <option key={s} value={s}>{t(`statuses.${s}`)}</option>
          ))}
        </select>
      </div>

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead style={{ background: 'var(--surface-panel)', borderBottom: '1px solid var(--border-subtle)' }}>
              <tr>
                <th className="px-4 py-3 text-left font-medium" style={{ color: 'var(--muted-foreground)' }}>{t('invoiceNumber')}</th>
                <th className="px-4 py-3 text-left font-medium" style={{ color: 'var(--muted-foreground)' }}>{t('order')}</th>
                <th className="px-4 py-3 text-left font-medium" style={{ color: 'var(--muted-foreground)' }}>{t('billTo')}</th>
                <th className="px-4 py-3 text-left font-medium" style={{ color: 'var(--muted-foreground)' }}>{t('issueDate')}</th>
                <th className="px-4 py-3 text-left font-medium" style={{ color: 'var(--muted-foreground)' }}>{t('total')}</th>
                <th className="px-4 py-3 text-left font-medium" style={{ color: 'var(--muted-foreground)' }}>{t('status')}</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">
              {loading ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center" style={{ color: 'var(--muted-foreground)' }}>{t('loading')}</td></tr>
              ) : invoices.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center" style={{ color: 'var(--muted-foreground)' }}>{t('empty')}</td></tr>
              ) : invoices.map(inv => (
                <tr key={inv.id} className="hover:bg-[var(--surface-panel)]/50">
                  <td className="px-4 py-3 font-mono text-xs">{inv.invoiceNumber}</td>
                  <td className="px-4 py-3">
                    {inv.order ? (
                      <>
                        <div>{inv.order.memorialName}</div>
                        {inv.order.sampleCode && (
                          <div className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{inv.order.sampleCode}</div>
                        )}
                      </>
                    ) : (
                      <span style={{ color: 'var(--muted-foreground)' }}>—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">{inv.billToName}</td>
                  <td className="px-4 py-3">{new Date(inv.issueDate).toLocaleDateString()}</td>
                  <td className="px-4 py-3">{inv.currency} {Number(inv.total).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLOR[inv.status] ?? ''}`}>
                      {t(`statuses.${inv.status}` as 'statuses.DRAFT')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/admin/sfs-invoices/${inv.id}`}>
                      <Button variant="outline" size="sm">{t('view')}</Button>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {pages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>{t('prev')}</Button>
          <span className="text-sm" style={{ color: 'var(--muted-foreground)' }}>{page} / {pages}</span>
          <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage(p => p + 1)}>{t('next')}</Button>
        </div>
      )}
    </div>
  )
}
