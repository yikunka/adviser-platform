'use client'

import { useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Link, useRouter } from '@/i18n/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { computeTotals } from '@/lib/invoice/calc'

type CompanyOption = { id: string; nameEn: string; companyCode?: string | null }
type LineRow = { description: string; quantity: string; unitPrice: string }

const emptyLine = (): LineRow => ({ description: '', quantity: '1', unitPrice: '0' })

export default function NewInvoicePage() {
  const t = useTranslations('admin.invoices')
  const router = useRouter()
  const [companies, setCompanies] = useState<CompanyOption[]>([])
  const [companyId, setCompanyId] = useState('')
  const [billToName, setBillToName] = useState('')
  const [billToAddress, setBillToAddress] = useState('')
  const [billToEmail, setBillToEmail] = useState('')
  const [issueDate, setIssueDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [dueDate, setDueDate] = useState('')
  const [taxRatePct, setTaxRatePct] = useState('0')
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState<LineRow[]>([emptyLine()])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/admin/invoices/companies')
      .then(r => r.json())
      .then(json => setCompanies(json.companies ?? []))
      .catch(() => toast.error(t('loadFailed')))
  }, [t])

  useEffect(() => {
    if (!companyId) return
    fetch(`/api/admin/invoices/company/${companyId}/billing`)
      .then(r => r.json())
      .then(json => {
        if (json.billToName) setBillToName(json.billToName)
        setBillToAddress(json.billToAddress ?? '')
        setBillToEmail(json.billToEmail ?? '')
      })
      .catch(() => {})
  }, [companyId])

  const taxRate = useMemo(() => Math.max(0, parseFloat(taxRatePct) || 0) / 100, [taxRatePct])

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
    return computeTotals(parsed, taxRate)
  }, [lines, taxRate])

  function updateLine(i: number, patch: Partial<LineRow>) {
    setLines(prev => prev.map((row, idx) => (idx === i ? { ...row, ...patch } : row)))
  }

  async function handleSubmit(status: 'DRAFT' | 'SENT') {
    if (!companyId) {
      toast.error(t('companyRequired'))
      return
    }
    const lineItems = lines
      .filter(l => l.description.trim())
      .map(l => ({
        description: l.description.trim(),
        quantity: parseFloat(l.quantity) || 0,
        unitPrice: parseFloat(l.unitPrice) || 0,
      }))
      .filter(l => l.quantity > 0 && l.description)
    if (lineItems.length === 0) {
      toast.error(t('linesRequired'))
      return
    }

    setSaving(true)
    try {
      const res = await fetch('/api/admin/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          issueDate,
          dueDate: dueDate || null,
          taxRate,
          billToName: billToName || undefined,
          billToAddress: billToAddress || null,
          billToEmail: billToEmail || null,
          notes: notes || null,
          status,
          lineItems,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed')
      toast.success(t('created'))
      router.push(`/admin/invoices/${json.id}`)
    } catch {
      toast.error(t('createFailed'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="flex items-center gap-3">
        <Link href="/admin/invoices">
          <Button variant="outline" size="sm">{t('back')}</Button>
        </Link>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>{t('createTitle')}</h1>
      </div>

      <Card>
        <CardHeader><CardTitle>{t('clientSection')}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium block mb-1">{t('company')}</label>
            <select
              value={companyId}
              onChange={e => setCompanyId(e.target.value)}
              className="w-full rounded-md px-3 py-2 text-sm"
              style={{ background: '#0A0A0A', border: '1px solid #2A2418', color: '#F0EAD8' }}
            >
              <option value="">{t('selectCompany')}</option>
              {companies.map(c => (
                <option key={c.id} value={c.id}>
                  {c.companyCode ? `${c.companyCode} — ` : ''}{c.nameEn}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-sm font-medium block mb-1">{t('billToName')}</label>
              <Input value={billToName} onChange={e => setBillToName(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">{t('billToEmail')}</label>
              <Input type="email" value={billToEmail} onChange={e => setBillToEmail(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">{t('billToAddress')}</label>
            <Input value={billToAddress} onChange={e => setBillToAddress(e.target.value)} />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="text-sm font-medium block mb-1">{t('issueDate')}</label>
              <Input type="date" value={issueDate} onChange={e => setIssueDate(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">{t('dueDate')}</label>
              <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">{t('taxRate')}</label>
              <Input type="number" min="0" step="0.1" value={taxRatePct} onChange={e => setTaxRatePct(e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{t('lineItems')}</CardTitle>
          <Button type="button" variant="outline" size="sm" onClick={() => setLines(l => [...l, emptyLine()])}>
            {t('addLine')}
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {lines.map((line, i) => (
            <div key={i} className="grid gap-2 sm:grid-cols-12 items-end">
              <div className="sm:col-span-5">
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
                  placeholder={t('unitPrice')}
                  value={line.unitPrice}
                  onChange={e => updateLine(i, { unitPrice: e.target.value })}
                />
              </div>
              <div className="sm:col-span-2 text-sm py-2" style={{ color: 'var(--muted-foreground)' }}>
                HKD {((parseFloat(line.quantity) || 0) * (parseFloat(line.unitPrice) || 0)).toFixed(2)}
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
          <div className="pt-4 border-t text-sm space-y-1" style={{ borderColor: '#2A2418' }}>
            <div className="flex justify-between"><span>{t('subtotal')}</span><span>HKD {totals.subtotal.toFixed(2)}</span></div>
            <div className="flex justify-between"><span>{t('tax')}</span><span>HKD {totals.taxAmount.toFixed(2)}</span></div>
            <div className="flex justify-between font-semibold"><span>{t('total')}</span><span>HKD {totals.total.toFixed(2)}</span></div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <label className="text-sm font-medium block mb-1">{t('notes')}</label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={3}
            className="w-full rounded-md px-3 py-2 text-sm"
            style={{ background: '#0A0A0A', border: '1px solid #2A2418', color: '#F0EAD8' }}
          />
        </CardContent>
      </Card>

      <div className="flex gap-2 justify-end">
        <Button variant="outline" disabled={saving} onClick={() => handleSubmit('DRAFT')}>{t('saveDraft')}</Button>
        <Button disabled={saving} onClick={() => handleSubmit('SENT')}>{t('saveAndSend')}</Button>
      </div>
    </div>
  )
}
