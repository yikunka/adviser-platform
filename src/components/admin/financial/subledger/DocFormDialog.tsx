'use client'

/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useMemo, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { AccountCombobox } from '@/components/admin/financial/AccountCombobox'
import { PartySelect } from '@/components/admin/financial/subledger/PartySelect'
import {
  accountPickerInputClassName,
  fieldClassName,
  financialModalContentClassName,
  inputStyle,
  money,
  type SideConfig,
  type SubDoc,
} from '@/components/admin/financial/subledger/config'

type LineDraft = {
  description: string
  quantity: string
  unitPrice: string
  accountId: string
}

const emptyLine = (): LineDraft => ({ description: '', quantity: '1', unitPrice: '', accountId: '' })

function todayYmd() {
  return new Date().toISOString().slice(0, 10)
}

export function DocFormDialog({
  open,
  onOpenChange,
  config,
  companyId,
  editing,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  config: SideConfig
  companyId: string
  editing: SubDoc | null
  onSaved: () => void
}) {
  const [partyId, setPartyId] = useState('')
  const [date, setDate] = useState(todayYmd())
  const [dueDate, setDueDate] = useState('')
  const [supplierRef, setSupplierRef] = useState('')
  const [taxRate, setTaxRate] = useState('0')
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState<LineDraft[]>([emptyLine()])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    if (editing) {
      setPartyId(editing.partyId)
      setDate(editing.date)
      setDueDate(editing.dueDate ?? '')
      setSupplierRef(editing.supplierRef)
      setTaxRate(String(editing.taxRate))
      setNotes(editing.notes)
      setLines(
        editing.lines.map(line => ({
          description: line.description,
          quantity: String(line.quantity),
          unitPrice: String(line.unitPrice),
          accountId: line.accountId ?? '',
        })),
      )
    } else {
      setPartyId('')
      setDate(todayYmd())
      setDueDate('')
      setSupplierRef('')
      setTaxRate('0')
      setNotes('')
      setLines([emptyLine()])
    }
  }, [open, editing])

  const totals = useMemo(() => {
    const subtotal = lines.reduce((sum, line) => {
      const amount = (Number(line.quantity) || 0) * (Number(line.unitPrice) || 0)
      return sum + Math.round(amount * 100) / 100
    }, 0)
    const rate = Number(taxRate) || 0
    const taxAmount = Math.round(subtotal * rate * 100) / 100
    return { subtotal, taxAmount, total: Math.round((subtotal + taxAmount) * 100) / 100 }
  }, [lines, taxRate])

  function updateLine(index: number, patch: Partial<LineDraft>) {
    setLines(current => current.map((line, i) => (i === index ? { ...line, ...patch } : line)))
  }

  async function save() {
    if (!partyId) {
      toast.error(`请选择${config.partyLabel}。`)
      return
    }
    const validLines = lines.filter(line => line.description.trim() && Number(line.quantity) > 0)
    if (validLines.length === 0) {
      toast.error('请至少填写一行有效明细。')
      return
    }

    setSaving(true)
    try {
      const payload = {
        companyId,
        partyId,
        [config.docDateField]: date,
        dueDate: dueDate || null,
        ...(config.hasSupplierRef ? { supplierRef } : {}),
        taxRate: Number(taxRate) || 0,
        notes,
        lines: validLines.map(line => ({
          description: line.description.trim(),
          quantity: Number(line.quantity),
          unitPrice: Number(line.unitPrice) || 0,
          [config.lineAccountField]: line.accountId || null,
        })),
      }
      const res = await fetch(editing ? `${config.docsEndpoint}/${editing.id}` : config.docsEndpoint, {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.toast || data.error || '保存失败。')
      toast.success(data.toast || '已保存。')
      onOpenChange(false)
      onSaved()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '保存失败。')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`${financialModalContentClassName} max-w-3xl max-h-[88vh] overflow-y-auto`}>
        <DialogHeader>
          <DialogTitle>{editing ? `编辑${config.docLabel} ${editing.docNo}` : `新增${config.docLabel}`}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{config.partyLabel} *</Label>
              <PartySelect
                companyId={companyId}
                role={config.partyRole}
                value={partyId}
                onChange={setPartyId}
                placeholder={`选择${config.partyLabel}`}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{config.docDateLabel} *</Label>
                <Input type="date" value={date} onChange={e => setDate(e.target.value)} className={fieldClassName} style={inputStyle} />
              </div>
              <div className="space-y-1.5">
                <Label>到期日</Label>
                <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className={fieldClassName} style={inputStyle} />
              </div>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            {config.hasSupplierRef ? (
              <div className="space-y-1.5">
                <Label>供应商发票号</Label>
                <Input value={supplierRef} onChange={e => setSupplierRef(e.target.value)} className={fieldClassName} style={inputStyle} />
              </div>
            ) : null}
            <div className="space-y-1.5">
              <Label>税率（如 0.1 表示 10%）</Label>
              <Input
                type="number"
                min="0"
                max="1"
                step="0.01"
                value={taxRate}
                onChange={e => setTaxRate(e.target.value)}
                className={fieldClassName}
                style={inputStyle}
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>明细行 *</Label>
              <Button size="sm" variant="outline" style={{ borderColor: '#2A2418' }} onClick={() => setLines(c => [...c, emptyLine()])}>
                <Plus size={14} className="mr-1" /> 加一行
              </Button>
            </div>
            <div className="space-y-2">
              {lines.map((line, index) => (
                <div key={index} className="grid grid-cols-[1fr_90px_120px_1fr_36px] gap-2 items-center">
                  <Input
                    placeholder="描述"
                    value={line.description}
                    onChange={e => updateLine(index, { description: e.target.value })}
                    className={fieldClassName}
                    style={inputStyle}
                  />
                  <Input
                    type="number"
                    min="0"
                    step="any"
                    placeholder="数量"
                    value={line.quantity}
                    onChange={e => updateLine(index, { quantity: e.target.value })}
                    className={fieldClassName}
                    style={inputStyle}
                  />
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="单价"
                    value={line.unitPrice}
                    onChange={e => updateLine(index, { unitPrice: e.target.value })}
                    className={fieldClassName}
                    style={inputStyle}
                  />
                  <AccountCombobox
                    value={line.accountId}
                    companyId={companyId}
                    onChange={accountId => updateLine(index, { accountId })}
                    placeholder={config.lineAccountLabel}
                    inputClassName={accountPickerInputClassName}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 hover:text-red-500"
                    disabled={lines.length === 1}
                    onClick={() => setLines(c => c.filter((_, i) => i !== index))}
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>备注</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className={fieldClassName} style={inputStyle} />
          </div>

          <div className="rounded-md border px-4 py-3 text-sm space-y-1" style={{ borderColor: '#2A2418' }}>
            <div className="flex justify-between">
              <span style={{ color: 'var(--muted-foreground)' }}>小计</span>
              <span>{money(totals.subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span style={{ color: 'var(--muted-foreground)' }}>税额</span>
              <span>{money(totals.taxAmount)}</span>
            </div>
            <div className="flex justify-between font-semibold" style={{ color: '#C9A96E' }}>
              <span>合计</span>
              <span>{money(totals.total)}</span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" style={{ borderColor: '#2A2418' }} onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={() => void save()} disabled={saving} style={{ background: '#C9A96E', color: '#0A0805' }}>
            {saving ? '保存中...' : editing ? '保存修改' : `创建${config.docLabel}（草稿）`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
