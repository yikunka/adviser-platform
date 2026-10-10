'use client'

/* eslint-disable react-hooks/set-state-in-effect */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Link, useRouter } from '@/i18n/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Download } from 'lucide-react'
import { computeTotals } from '@/lib/invoice/calc'
import { SfsInvoiceNumberDisplay } from '../components/SfsInvoiceNumberDisplay'

type LineItem = {
  id: string
  description: string
  quantity: string
  weight?: string | null
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

type LineRow = { description: string; quantity: string; weight: string; unitPrice: string }

const emptyLine = (): LineRow => ({ description: '', quantity: '1', weight: '', unitPrice: '0' })

const STATUS_COLOR: Record<string, string> = {
  DRAFT: 'bg-[rgba(120,113,108,0.15)] text-[#9A8060]',
  SENT: 'bg-[rgba(59,130,246,0.12)] text-[#3b82f6]',
  PAID: 'bg-[rgba(16,185,129,0.12)] text-[#10b981]',
  CANCELLED: 'bg-[rgba(239,68,68,0.12)] text-[#ef4444]',
}

function toDateInput(iso: string) {
  return new Date(iso).toISOString().slice(0, 10)
}

function hydrateForm(invoice: InvoiceDetail) {
  return {
    billToName: invoice.billToName,
    billToAddress: invoice.billToAddress ?? '',
    billToEmail: invoice.billToEmail ?? '',
    billToPhone: invoice.billToPhone ?? '',
    issueDate: toDateInput(invoice.issueDate),
    notes: invoice.notes ?? '',
    lines: invoice.lineItems.length
      ? invoice.lineItems.map(line => ({
          description: line.description,
          quantity: String(Number(line.quantity)),
          weight: line.weight != null && line.weight !== '' ? String(Number(line.weight)) : '',
          unitPrice: String(Number(line.unitPrice)),
        }))
      : [emptyLine()],
  }
}

export default function SfsInvoiceDetailPage() {
  const t = useTranslations('admin.sfsInvoices')
  const params = useParams()
  const router = useRouter()
  const id = params.id as string
  const [invoice, setInvoice] = useState<InvoiceDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const [billToName, setBillToName] = useState('')
  const [billToAddress, setBillToAddress] = useState('')
  const [billToEmail, setBillToEmail] = useState('')
  const [billToPhone, setBillToPhone] = useState('')
  const [issueDate, setIssueDate] = useState('')
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState<LineRow[]>([emptyLine()])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/sfs-invoices/${id}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed')
      setInvoice(json)
      const form = hydrateForm(json)
      setBillToName(form.billToName)
      setBillToAddress(form.billToAddress)
      setBillToEmail(form.billToEmail)
      setBillToPhone(form.billToPhone)
      setIssueDate(form.issueDate)
      setNotes(form.notes)
      setLines(form.lines)
    } catch (err) {
      const detail = err instanceof Error && err.message !== 'Failed' ? ` ${err.message}` : ''
      toast.error(`${t('loadFailed')}${detail}`)
    } finally {
      setLoading(false)
    }
  }, [id, t])

  useEffect(() => { load() }, [load])

  const isDraft = invoice?.status === 'DRAFT'

  const totals = useMemo(() => {
    const parsed = lines
      .filter(l => l.description.trim())
      .map(l => ({
        description: l.description,
        quantity: parseFloat(l.quantity) || 0,
        unitPrice: parseFloat(l.unitPrice) || 0,
      }))
      .filter(l => l.quantity > 0)
    if (parsed.length === 0) return { subtotal: 0, taxAmount: 0, total: 0 }
    return computeTotals(parsed, 0)
  }, [lines])

  function updateLine(i: number, patch: Partial<LineRow>) {
    setLines(prev => prev.map((row, idx) => (idx === i ? { ...row, ...patch } : row)))
  }

  function buildLineItems() {
    return lines
      .filter(l => l.description.trim())
      .map(l => {
        const weightRaw = l.weight.trim()
        const weight = weightRaw ? parseFloat(weightRaw) : null
        return {
          description: l.description.trim(),
          quantity: parseFloat(l.quantity) || 0,
          weight: weight != null && !Number.isNaN(weight) ? weight : null,
          unitPrice: parseFloat(l.unitPrice) || 0,
        }
      })
      .filter(l => l.quantity > 0 && l.description)
  }

  async function saveContent(nextStatus?: 'SENT') {
    if (!billToName.trim()) {
      toast.error(t('billToRequired'))
      return
    }
    const lineItems = buildLineItems()
    if (lineItems.length === 0) {
      toast.error(t('linesRequired'))
      return
    }

    setSaving(true)
    try {
      const res = await fetch(`/api/admin/sfs-invoices/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          issueDate,
          billToName: billToName.trim(),
          billToAddress: billToAddress || null,
          billToEmail: billToEmail || null,
          billToPhone: billToPhone || null,
          notes: notes || null,
          taxRate: 0,
          lineItems,
          ...(nextStatus ? { status: nextStatus } : {}),
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(typeof json.error === 'string' ? json.error : 'Failed')
      toast.success(t('updated'))
      await load()
    } catch (err) {
      const detail = err instanceof Error && err.message !== 'Failed' ? ` ${err.message}` : ''
      toast.error(`${t('updateFailed')}${detail}`)
    } finally {
      setSaving(false)
    }
  }

  async function updateStatus(status: string) {
    setUpdating(true)
    try {
      const res = await fetch(`/api/admin/sfs-invoices/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(typeof json.error === 'string' ? json.error : 'Failed')
      toast.success(t('updated'))
      await load()
    } catch (err) {
      const detail = err instanceof Error && err.message !== 'Failed' ? ` ${err.message}` : ''
      toast.error(`${t('updateFailed')}${detail}`)
    } finally {
      setUpdating(false)
    }
  }

  async function deleteDraft() {
    if (!window.confirm(t('confirmDelete'))) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/admin/sfs-invoices/${id}`, { method: 'DELETE' })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(typeof json.error === 'string' ? json.error : 'Failed')
      toast.success(t('deleted'))
      router.push('/admin/sfs-invoices')
    } catch (err) {
      const detail = err instanceof Error && err.message !== 'Failed' ? ` ${err.message}` : ''
      toast.error(`${t('deleteFailed')}${detail}`)
    } finally {
      setDeleting(false)
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
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/admin/sfs-invoices">
            <Button variant="outline" size="sm">{t('back')}</Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>
              {t('detailTitle')}
            </h1>
            <span className={`inline-flex mt-1 px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLOR[invoice.status] ?? ''}`}>
              {t(`statuses.${invoice.status}` as 'statuses.DRAFT')}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <SfsInvoiceNumberDisplay value={invoice.invoiceNumber} />
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" onClick={downloadPdf}>
              <Download size={14} className="mr-1" />
              {t('downloadPdf')}
            </Button>
            {isDraft && (
              <>
                <Button disabled={saving || updating} onClick={() => void saveContent()}>
                  {saving ? t('saving') : t('saveChanges')}
                </Button>
                <Button disabled={saving || updating} onClick={() => void saveContent('SENT')}>
                  {t('markSent')}
                </Button>
                <Button variant="outline" disabled={deleting || saving || updating} onClick={() => void deleteDraft()}>
                  {deleting ? t('deleting') : t('deleteDraft')}
                </Button>
              </>
            )}
            {invoice.status === 'SENT' && (
              <Button disabled={updating} onClick={() => void updateStatus('PAID')}>{t('markPaid')}</Button>
            )}
            {(invoice.status === 'DRAFT' || invoice.status === 'SENT') && (
              <Button variant="outline" disabled={updating || saving} onClick={() => void updateStatus('CANCELLED')}>
                {t('cancel')}
              </Button>
            )}
          </div>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle>{t('clientSection')}</CardTitle></CardHeader>
        <CardContent className="space-y-4 text-sm">
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

          {isDraft ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-sm font-medium block mb-1">{t('billToName')}</label>
                  <Input value={billToName} onChange={e => setBillToName(e.target.value)} />
                </div>
                <div>
                  <label className="text-sm font-medium block mb-1">{t('billToPhone')}</label>
                  <Input value={billToPhone} onChange={e => setBillToPhone(e.target.value)} />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-sm font-medium block mb-1">{t('billToEmail')}</label>
                  <Input type="email" value={billToEmail} onChange={e => setBillToEmail(e.target.value)} />
                </div>
                <div>
                  <label className="text-sm font-medium block mb-1">{t('billToAddress')}</label>
                  <Input value={billToAddress} onChange={e => setBillToAddress(e.target.value)} />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-sm font-medium block mb-1">{t('issueDate')}</label>
                  <Input type="date" value={issueDate} onChange={e => setIssueDate(e.target.value)} />
                </div>
              </div>
            </>
          ) : (
            <>
              <p><span className="font-medium">{t('billTo')}:</span> {invoice.billToName}</p>
              {invoice.billToPhone && <p style={{ color: 'var(--muted-foreground)' }}>{invoice.billToPhone}</p>}
              {invoice.billToAddress && <p style={{ color: 'var(--muted-foreground)' }}>{invoice.billToAddress}</p>}
              {invoice.billToEmail && <p style={{ color: 'var(--muted-foreground)' }}>{invoice.billToEmail}</p>}
              <p><span className="font-medium">{t('issueDate')}:</span> {new Date(invoice.issueDate).toLocaleDateString()}</p>
            </>
          )}

          <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
            {t('createdBy')}: {invoice.createdBy.nameEn}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{t('lineItems')}</CardTitle>
          {isDraft && (
            <Button type="button" variant="outline" size="sm" onClick={() => setLines(l => [...l, emptyLine()])}>
              {t('addLine')}
            </Button>
          )}
        </CardHeader>
        <CardContent className={isDraft ? 'space-y-3' : 'p-0'}>
          {isDraft ? (
            <>
              {lines.map((line, i) => (
                <div key={i} className="grid gap-2 sm:grid-cols-12 items-end">
                  <div className="sm:col-span-4">
                    <Input
                      placeholder={t('description')}
                      value={line.description}
                      onChange={e => updateLine(i, { description: e.target.value })}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder={t('quantity')}
                      value={line.quantity}
                      onChange={e => updateLine(i, { quantity: e.target.value })}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder={t('weight')}
                      value={line.weight}
                      onChange={e => updateLine(i, { weight: e.target.value })}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder={t('unitPrice')}
                      value={line.unitPrice}
                      onChange={e => updateLine(i, { unitPrice: e.target.value })}
                    />
                  </div>
                  <div className="sm:col-span-1 text-sm py-2" style={{ color: 'var(--muted-foreground)' }}>
                    {invoice.currency} {((parseFloat(line.quantity) || 0) * (parseFloat(line.unitPrice) || 0)).toFixed(2)}
                  </div>
                  <div className="sm:col-span-1">
                    {lines.length > 1 && (
                      <Button type="button" variant="ghost" size="sm" onClick={() => setLines(l => l.filter((_, idx) => idx !== i))}>
                        ×
                      </Button>
                    )}
                  </div>
                </div>
              ))}
              <div className="pt-4 border-t text-sm space-y-1" style={{ borderColor: 'var(--border-subtle)' }}>
                <div className="flex justify-between font-semibold"><span>{t('total')}</span><span>{invoice.currency} {totals.total.toFixed(2)}</span></div>
              </div>
            </>
          ) : (
            <>
              <table className="w-full text-sm">
                <thead style={{ background: 'var(--surface-panel)', borderBottom: '1px solid var(--border-subtle)' }}>
                  <tr>
                    <th className="px-4 py-3 text-left">{t('description')}</th>
                    <th className="px-4 py-3 text-right">{t('quantity')}</th>
                    <th className="px-4 py-3 text-right">{t('weight')}</th>
                    <th className="px-4 py-3 text-right">{t('unitPrice')}</th>
                    <th className="px-4 py-3 text-right">{t('amount')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-subtle)]">
                  {invoice.lineItems.map(line => (
                    <tr key={line.id}>
                      <td className="px-4 py-3">{line.description}</td>
                      <td className="px-4 py-3 text-right">{Number(line.quantity)}</td>
                      <td className="px-4 py-3 text-right">
                        {line.weight != null && line.weight !== '' ? Number(line.weight) : '—'}
                      </td>
                      <td className="px-4 py-3 text-right">{invoice.currency} {Number(line.unitPrice).toFixed(2)}</td>
                      <td className="px-4 py-3 text-right">{invoice.currency} {Number(line.amount).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="px-4 py-4 text-sm space-y-1 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                <div className="flex justify-between font-semibold text-base">
                  <span>{t('total')}</span>
                  <span>{invoice.currency} {Number(invoice.total).toFixed(2)}</span>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>{t('notes')}</CardTitle></CardHeader>
        <CardContent>
          {isDraft ? (
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              className="w-full rounded-md px-3 py-2 text-sm"
              style={{ background: 'var(--surface)', border: '1px solid var(--border-subtle)', color: 'var(--text-cream)' }}
            />
          ) : (
            <p className="text-sm whitespace-pre-wrap">{invoice.notes || '—'}</p>
          )}
        </CardContent>
      </Card>

      {isDraft && (
        <div className="flex gap-2 justify-end">
          <Button variant="outline" disabled={saving || updating} onClick={() => void saveContent()}>
            {saving ? t('saving') : t('saveChanges')}
          </Button>
          <Button disabled={saving || updating} onClick={() => void saveContent('SENT')}>
            {t('saveAndSend')}
          </Button>
        </div>
      )}
    </div>
  )
}
