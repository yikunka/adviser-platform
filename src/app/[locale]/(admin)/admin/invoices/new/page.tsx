'use client'

import { useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Link, useRouter } from '@/i18n/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { InvoiceLineItemsEditor, type InvoiceLineDraft } from '@/components/admin/invoices/InvoiceLineItemsEditor'
import { computeTotals } from '@/lib/invoice/calc'

type CustomerType = 'COMPANY' | 'INDIVIDUAL'
type CustomerOption = {
  type: CustomerType
  id: string
  label: string
  subtitle?: string | null
  billToName: string
  billToAddress?: string | null
  billToEmail?: string | null
}

const emptyLine = (): InvoiceLineDraft => ({ description: '', quantity: '1', unitPrice: '0' })

export default function NewInvoicePage() {
  const t = useTranslations('admin.invoices')
  const router = useRouter()
  const [customers, setCustomers] = useState<CustomerOption[]>([])
  const [customerType, setCustomerType] = useState<CustomerType>('COMPANY')
  const [customerId, setCustomerId] = useState('')
  const [billToName, setBillToName] = useState('')
  const [billToAddress, setBillToAddress] = useState('')
  const [billToEmail, setBillToEmail] = useState('')
  const [issueDate, setIssueDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [dueDate, setDueDate] = useState('')
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState<InvoiceLineDraft[]>([emptyLine()])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/admin/invoices/customers')
      .then(r => r.json())
      .then(json => setCustomers(json.customers ?? []))
      .catch(() => toast.error(t('loadFailed')))
  }, [t])

  const customerOptions = useMemo(
    () => customers.filter(customer => customer.type === customerType),
    [customerType, customers],
  )

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

  function updateLine(i: number, patch: Partial<InvoiceLineDraft>) {
    setLines(prev => prev.map((row, idx) => (idx === i ? { ...row, ...patch } : row)))
  }

  function selectCustomer(nextCustomerId: string) {
    setCustomerId(nextCustomerId)
    const customer = customers.find(c => c.type === customerType && c.id === nextCustomerId)
    if (!customer) return
    setBillToName(customer.billToName)
    setBillToAddress(customer.billToAddress ?? '')
    setBillToEmail(customer.billToEmail ?? '')
  }

  async function handleSubmit(status: 'DRAFT' | 'SENT') {
    if (!customerId) {
      toast.error(t('customerRequired'))
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
          customerType,
          companyId: customerType === 'COMPANY' ? customerId : null,
          keyPersonId: customerType === 'INDIVIDUAL' ? customerId : null,
          issueDate,
          dueDate: dueDate || null,
          taxRate: 0,
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
            <label className="text-sm font-medium block mb-1">{t('customerType')}</label>
            <select
              value={customerType}
              onChange={e => {
                setCustomerType(e.target.value as CustomerType)
                setCustomerId('')
                setBillToName('')
                setBillToAddress('')
                setBillToEmail('')
              }}
              className="w-full rounded-md px-3 py-2 text-sm"
              style={{ background: '#0A0A0A', border: '1px solid #2A2418', color: '#F0EAD8' }}
            >
              <option value="COMPANY">{t('companyCustomer')}</option>
              <option value="INDIVIDUAL">{t('individualCustomer')}</option>
            </select>
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">{t('customer')}</label>
            <select
              value={customerId}
              onChange={e => selectCustomer(e.target.value)}
              className="w-full rounded-md px-3 py-2 text-sm"
              style={{ background: '#0A0A0A', border: '1px solid #2A2418', color: '#F0EAD8' }}
            >
              <option value="">
                {customerType === 'COMPANY' ? t('selectCompany') : t('selectIndividual')}
              </option>
              {customerOptions.map(customer => (
                <option key={`${customer.type}:${customer.id}`} value={customer.id}>
                  {customer.subtitle ? `${customer.label} — ${customer.subtitle}` : customer.label}
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
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-sm font-medium block mb-1">{t('issueDate')}</label>
              <Input type="date" value={issueDate} onChange={e => setIssueDate(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">{t('dueDate')}</label>
              <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('lineItems')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <InvoiceLineItemsEditor
            amountLabel={t('amount')}
            currency="HKD"
            addLineLabel={t('addLine')}
            removeLineLabel={t('removeLine')}
            descriptionLabel={t('description')}
            quantityLabel={t('quantity')}
            unitPriceLabel={t('unitPrice')}
            lines={lines}
            onAddLine={() => setLines(current => [...current, emptyLine()])}
            onRemoveLine={index => setLines(current => current.filter((_, currentIndex) => currentIndex !== index))}
            onUpdateLine={updateLine}
          />
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
          <Textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={3}
            className="min-h-24 resize-y"
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
