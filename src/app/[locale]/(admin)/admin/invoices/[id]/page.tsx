'use client'

/* eslint-disable react-hooks/set-state-in-effect */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Link } from '@/i18n/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Download } from 'lucide-react'
import { InvoiceLineItemsEditor, type InvoiceLineDraft } from '@/components/admin/invoices/InvoiceLineItemsEditor'
import { computeTotals } from '@/lib/invoice/calc'

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
  subtotal: string
  taxRate: string
  taxAmount: string
  total: string
  notes?: string | null
  customerType: 'COMPANY' | 'INDIVIDUAL'
  company?: { id: string; nameEn: string; companyCode?: string | null; companyNumber?: string | null } | null
  keyPerson?: { id: string; nameEn: string; kycCode?: string | null; idType?: string | null; idNumber?: string | null } | null
  createdBy: { nameEn: string }
  lineItems: LineItem[]
}

type DraftFormState = {
  issueDate: string
  dueDate: string
  billToName: string
  billToAddress: string
  billToEmail: string
  notes: string
  lines: InvoiceLineDraft[]
}

const STATUS_COLOR: Record<string, string> = {
  DRAFT: 'bg-[rgba(120,113,108,0.15)] text-[#9A8060]',
  SENT: 'bg-[rgba(59,130,246,0.12)] text-[#3b82f6]',
  PAID: 'bg-[rgba(16,185,129,0.12)] text-[#10b981]',
  CANCELLED: 'bg-[rgba(239,68,68,0.12)] text-[#ef4444]',
}

function mapInvoiceToDraft(invoice: InvoiceDetail): DraftFormState {
  return {
    issueDate: invoice.issueDate.slice(0, 10),
    dueDate: invoice.dueDate?.slice(0, 10) ?? '',
    billToName: invoice.billToName,
    billToAddress: invoice.billToAddress ?? '',
    billToEmail: invoice.billToEmail ?? '',
    notes: invoice.notes ?? '',
    lines: invoice.lineItems.map(line => ({
      description: line.description,
      quantity: String(Number(line.quantity)),
      unitPrice: String(Number(line.unitPrice)),
    })),
  }
}

export default function InvoiceDetailPage() {
  const t = useTranslations('admin.invoices')
  const params = useParams()
  const id = params.id as string
  const [invoice, setInvoice] = useState<InvoiceDetail | null>(null)
  const [draft, setDraft] = useState<DraftFormState | null>(null)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/invoices/${id}`)
      const json = await res.json()
      if (!res.ok) throw new Error()
      setInvoice(json)
      setDraft(mapInvoiceToDraft(json))
    } catch {
      toast.error(t('loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [id, t])

  useEffect(() => { load() }, [load])

  async function updateStatus(status: string) {
    setUpdating(true)
    try {
      const res = await fetch(`/api/admin/invoices/${id}`, {
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
    window.open(`/api/admin/invoices/${id}/pdf`, '_blank')
  }

  const totals = useMemo(() => {
    if (!draft) return { subtotal: 0, taxAmount: 0, total: 0 }
    const parsed = draft.lines
      .filter(line => line.description.trim())
      .map(line => ({
        description: line.description.trim(),
        quantity: parseFloat(line.quantity) || 0,
        unitPrice: parseFloat(line.unitPrice) || 0,
      }))
      .filter(line => line.quantity > 0)
    if (parsed.length === 0) return { subtotal: 0, taxAmount: 0, total: 0 }
    return computeTotals(parsed, 0)
  }, [draft])

  function updateDraftField(patch: Partial<Omit<DraftFormState, 'lines'>>) {
    setDraft(current => (current ? { ...current, ...patch } : current))
  }

  function updateLine(index: number, patch: Partial<InvoiceLineDraft>) {
    setDraft(current => (
      current
        ? { ...current, lines: current.lines.map((line, lineIndex) => (lineIndex === index ? { ...line, ...patch } : line)) }
        : current
    ))
  }

  async function saveDraftChanges() {
    if (!invoice || !draft) return

    const lineItems = draft.lines
      .filter(line => line.description.trim())
      .map(line => ({
        description: line.description.trim(),
        quantity: parseFloat(line.quantity) || 0,
        unitPrice: parseFloat(line.unitPrice) || 0,
      }))
      .filter(line => line.quantity > 0 && line.description)

    if (lineItems.length === 0) {
      toast.error(t('linesRequired'))
      return
    }

    setUpdating(true)
    try {
      const res = await fetch(`/api/admin/invoices/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          issueDate: draft.issueDate,
          dueDate: draft.dueDate || null,
          billToName: draft.billToName || invoice.billToName,
          billToAddress: draft.billToAddress || null,
          billToEmail: draft.billToEmail || null,
          notes: draft.notes || null,
          lineItems,
        }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) throw new Error(json?.error ?? 'Failed')
      setInvoice(json)
      setDraft(mapInvoiceToDraft(json))
      toast.success(t('updated'))
    } catch {
      toast.error(t('updateFailed'))
    } finally {
      setUpdating(false)
    }
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
          <Link href="/admin/invoices">
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
          {invoice.status === 'DRAFT' && (
            <Button disabled={updating} onClick={saveDraftChanges}>{t('saveChanges')}</Button>
          )}
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
          <p><span className="font-medium">{t('customerType')}:</span> {invoice.customerType === 'COMPANY' ? t('companyCustomer') : t('individualCustomer')}</p>
          {invoice.company && (
            <p><span className="font-medium">{t('company')}:</span> {invoice.company.nameEn}
              {invoice.company.companyCode && ` (${invoice.company.companyCode})`}
            </p>
          )}
          {invoice.keyPerson && (
            <p><span className="font-medium">{t('kycIdentity')}:</span> {invoice.keyPerson.nameEn}
              {invoice.keyPerson.kycCode && ` (${invoice.keyPerson.kycCode})`}
            </p>
          )}
          <p><span className="font-medium">{t('billTo')}:</span> {invoice.billToName}</p>
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

      {invoice.status === 'DRAFT' && draft ? (
        <Card>
          <CardHeader><CardTitle>{t('editDraft')}</CardTitle></CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-sm font-medium block mb-1">{t('billToName')}</label>
                <Input value={draft.billToName} onChange={e => updateDraftField({ billToName: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">{t('billToEmail')}</label>
                <Input
                  type="email"
                  value={draft.billToEmail}
                  onChange={e => updateDraftField({ billToEmail: e.target.value })}
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">{t('billToAddress')}</label>
              <Input value={draft.billToAddress} onChange={e => updateDraftField({ billToAddress: e.target.value })} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-sm font-medium block mb-1">{t('issueDate')}</label>
                <Input type="date" value={draft.issueDate} onChange={e => updateDraftField({ issueDate: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">{t('dueDate')}</label>
                <Input type="date" value={draft.dueDate} onChange={e => updateDraftField({ dueDate: e.target.value })} />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">{t('notes')}</label>
              <Textarea
                rows={4}
                value={draft.notes}
                onChange={e => updateDraftField({ notes: e.target.value })}
                className="min-h-24 resize-y"
              />
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader><CardTitle>{t('lineItems')}</CardTitle></CardHeader>
        <CardContent className={invoice.status === 'DRAFT' ? 'space-y-3' : 'p-0'}>
          {invoice.status === 'DRAFT' && draft ? (
            <>
              <InvoiceLineItemsEditor
                amountLabel={t('amount')}
                currency={invoice.currency}
                addLineLabel={t('addLine')}
                removeLineLabel={t('removeLine')}
                descriptionLabel={t('description')}
                quantityLabel={t('quantity')}
                unitPriceLabel={t('unitPrice')}
                lines={draft.lines}
                onAddLine={() => setDraft(current => (current ? { ...current, lines: [...current.lines, { description: '', quantity: '1', unitPrice: '0' }] } : current))}
                onRemoveLine={index => setDraft(current => (
                  current ? { ...current, lines: current.lines.filter((_, lineIndex) => lineIndex !== index) } : current
                ))}
                onUpdateLine={updateLine}
              />
              <div className="pt-4 border-t text-sm space-y-1" style={{ borderColor: '#2A2418' }}>
                <div className="flex justify-between"><span>{t('subtotal')}</span><span>{invoice.currency} {totals.subtotal.toFixed(2)}</span></div>
                <div className="flex justify-between"><span>{t('tax')}</span><span>{invoice.currency} {totals.taxAmount.toFixed(2)}</span></div>
                <div className="flex justify-between font-semibold"><span>{t('total')}</span><span>{invoice.currency} {totals.total.toFixed(2)}</span></div>
              </div>
            </>
          ) : (
            <>
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
                      <td className="px-4 py-3 whitespace-pre-wrap">{line.description}</td>
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
            </>
          )}
        </CardContent>
      </Card>

      {invoice.status !== 'DRAFT' && invoice.notes && (
        <Card>
          <CardHeader><CardTitle>{t('notes')}</CardTitle></CardHeader>
          <CardContent className="text-sm whitespace-pre-wrap">{invoice.notes}</CardContent>
        </Card>
      )}
    </div>
  )
}
