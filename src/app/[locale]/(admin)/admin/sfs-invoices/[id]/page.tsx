'use client'

/* eslint-disable react-hooks/set-state-in-effect */

import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Link } from '@/i18n/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Download } from 'lucide-react'

type LineItem = {
  id: string
  description: string
  quantity: string
  unitPrice: string
  amount: string
}

type InvoiceDetail = {
  id: string
  invoiceNumber: string
  status: string
  issueDate: string
  dueDate?: string | null
  currency: string
  billToName: string
  billToAddress?: string | null
  billToEmail?: string | null
  billToPhone?: string | null
  subtotal: string
  taxRate: string
  taxAmount: string
  total: string
  notes?: string | null
  order?: { id: string; memorialName: string; sampleCode?: string | null; clientName: string } | null
  createdBy: { nameEn: string }
  lineItems: LineItem[]
}

const STATUS_COLOR: Record<string, string> = {
  DRAFT: 'bg-[rgba(120,113,108,0.15)] text-[#9A8060]',
  SENT: 'bg-[rgba(59,130,246,0.12)] text-[#3b82f6]',
  PAID: 'bg-[rgba(16,185,129,0.12)] text-[#10b981]',
  CANCELLED: 'bg-[rgba(239,68,68,0.12)] text-[#ef4444]',
}

export default function SfsInvoiceDetailPage() {
  const t = useTranslations('admin.sfsInvoices')
  const params = useParams()
  const id = params.id as string
  const [invoice, setInvoice] = useState<InvoiceDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/sfs-invoices/${id}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed')
      setInvoice(json)
    } catch (err) {
      const detail = err instanceof Error && err.message !== 'Failed' ? ` ${err.message}` : ''
      toast.error(`${t('loadFailed')}${detail}`)
    } finally {
      setLoading(false)
    }
  }, [id, t])

  useEffect(() => { load() }, [load])

  async function updateStatus(status: string) {
    setUpdating(true)
    try {
      const res = await fetch(`/api/admin/sfs-invoices/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) throw new Error()
      toast.success(t('updated'))
      await load()
    } catch {
      toast.error(t('updateFailed'))
    } finally {
      setUpdating(false)
    }
  }

  function downloadPdf() {
    window.open(`/api/admin/sfs-invoices/${id}/pdf`, '_blank')
  }

  if (loading) {
    return <p style={{ color: 'var(--muted-foreground)' }}>{t('loading')}</p>
  }
  if (!invoice) {
    return <p style={{ color: 'var(--muted-foreground)' }}>{t('notFound')}</p>
  }

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/admin/sfs-invoices">
            <Button variant="outline" size="sm">{t('back')}</Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold font-mono" style={{ color: 'var(--foreground)' }}>
              {invoice.invoiceNumber}
            </h1>
            <span className={`inline-flex mt-1 px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLOR[invoice.status] ?? ''}`}>
              {t(`statuses.${invoice.status}` as 'statuses.DRAFT')}
            </span>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={downloadPdf}>
            <Download size={14} className="mr-1" />
            {t('downloadPdf')}
          </Button>
          {invoice.status === 'DRAFT' && (
            <Button disabled={updating} onClick={() => updateStatus('SENT')}>{t('markSent')}</Button>
          )}
          {invoice.status === 'SENT' && (
            <Button disabled={updating} onClick={() => updateStatus('PAID')}>{t('markPaid')}</Button>
          )}
          {(invoice.status === 'DRAFT' || invoice.status === 'SENT') && (
            <Button variant="outline" disabled={updating} onClick={() => updateStatus('CANCELLED')}>
              {t('cancel')}
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle>{t('clientSection')}</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          {invoice.order && (
            <p>
              <span className="font-medium">{t('order')}:</span>{' '}
              {invoice.order.memorialName}
              {invoice.order.sampleCode && ` (${invoice.order.sampleCode})`}
              {' — '}
              <Link href={`/admin/sfs-orders/${invoice.order.id}`} className="underline" style={{ color: '#C9A96E' }}>
                {t('viewOrder')}
              </Link>
            </p>
          )}
          <p><span className="font-medium">{t('billTo')}:</span> {invoice.billToName}</p>
          {invoice.billToPhone && <p style={{ color: 'var(--muted-foreground)' }}>{invoice.billToPhone}</p>}
          {invoice.billToAddress && <p style={{ color: 'var(--muted-foreground)' }}>{invoice.billToAddress}</p>}
          {invoice.billToEmail && <p style={{ color: 'var(--muted-foreground)' }}>{invoice.billToEmail}</p>}
          <p><span className="font-medium">{t('issueDate')}:</span> {new Date(invoice.issueDate).toLocaleDateString()}</p>
          {invoice.dueDate && (
            <p><span className="font-medium">{t('dueDate')}:</span> {new Date(invoice.dueDate).toLocaleDateString()}</p>
          )}
          <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
            {t('createdBy')}: {invoice.createdBy.nameEn}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>{t('lineItems')}</CardTitle></CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead style={{ background: '#1A1A12', borderBottom: '1px solid #2A2418' }}>
              <tr>
                <th className="px-4 py-3 text-left">{t('description')}</th>
                <th className="px-4 py-3 text-right">{t('quantity')}</th>
                <th className="px-4 py-3 text-right">{t('unitPrice')}</th>
                <th className="px-4 py-3 text-right">{t('amount')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2A2418]">
              {invoice.lineItems.map(line => (
                <tr key={line.id}>
                  <td className="px-4 py-3">{line.description}</td>
                  <td className="px-4 py-3 text-right">{Number(line.quantity)}</td>
                  <td className="px-4 py-3 text-right">{invoice.currency} {Number(line.unitPrice).toFixed(2)}</td>
                  <td className="px-4 py-3 text-right">{invoice.currency} {Number(line.amount).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-4 py-4 text-sm space-y-1 border-t" style={{ borderColor: '#2A2418' }}>
            <div className="flex justify-between"><span>{t('subtotal')}</span><span>{invoice.currency} {Number(invoice.subtotal).toFixed(2)}</span></div>
            <div className="flex justify-between">
              <span>{t('tax')} ({(Number(invoice.taxRate) * 100).toFixed(1)}%)</span>
              <span>{invoice.currency} {Number(invoice.taxAmount).toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-semibold text-base">
              <span>{t('total')}</span>
              <span>{invoice.currency} {Number(invoice.total).toFixed(2)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {invoice.notes && (
        <Card>
          <CardHeader><CardTitle>{t('notes')}</CardTitle></CardHeader>
          <CardContent className="text-sm whitespace-pre-wrap">{invoice.notes}</CardContent>
        </Card>
      )}
    </div>
  )
}
