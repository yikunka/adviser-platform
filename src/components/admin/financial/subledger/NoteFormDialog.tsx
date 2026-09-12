'use client'

/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useMemo, useState } from 'react'
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

export type SubNote = {
  id: string
  noteNo: string
  status: string
  party: { id: string; code: string; name: string }
  issueDate: string
  subtotal: number
  taxRate: number
  taxAmount: number
  total: number
  amountApplied: number
  remaining: number
  reason: string
  journalEntry: { id: string; voucherNo: string } | null
  allocations: Array<{ id: string; amount: number; docNo: string }>
}

function todayYmd() {
  return new Date().toISOString().slice(0, 10)
}

export function NoteFormDialog({
  open,
  onOpenChange,
  config,
  companyId,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  config: SideConfig
  companyId: string
  onSaved: () => void
}) {
  const [partyId, setPartyId] = useState('')
  const [issueDate, setIssueDate] = useState(todayYmd())
  const [subtotal, setSubtotal] = useState('')
  const [taxRate, setTaxRate] = useState('0')
  const [reason, setReason] = useState('')
  const [offsetAccountId, setOffsetAccountId] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setPartyId('')
    setIssueDate(todayYmd())
    setSubtotal('')
    setTaxRate('0')
    setReason('')
    setOffsetAccountId('')
  }, [open])

  async function save() {
    if (!partyId) {
      toast.error(`请选择${config.partyLabel}。`)
      return
    }
    if ((Number(subtotal) || 0) <= 0) {
      toast.error('金额必须大于零。')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/admin/financial/credit-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          partyId,
          kind: config.noteKind,
          issueDate,
          subtotal: Number(subtotal),
          taxRate: Number(taxRate) || 0,
          reason,
          offsetAccountId: offsetAccountId || null,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.toast || data.error || '保存失败。')
      toast.success(data.toast || '已创建。')
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
      <DialogContent className={`${financialModalContentClassName} max-w-lg`}>
        <DialogHeader>
          <DialogTitle>新增{config.noteLabel}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>{config.partyLabel} *</Label>
            <PartySelect companyId={companyId} role={config.partyRole} value={partyId} onChange={setPartyId} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>日期 *</Label>
              <Input type="date" value={issueDate} onChange={e => setIssueDate(e.target.value)} className={fieldClassName} style={inputStyle} />
            </div>
            <div className="space-y-1.5">
              <Label>金额（不含税）*</Label>
              <Input type="number" min="0" step="0.01" value={subtotal} onChange={e => setSubtotal(e.target.value)} className={fieldClassName} style={inputStyle} />
            </div>
            <div className="space-y-1.5">
              <Label>税率</Label>
              <Input type="number" min="0" max="1" step="0.01" value={taxRate} onChange={e => setTaxRate(e.target.value)} className={fieldClassName} style={inputStyle} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>冲减科目（留空用默认）</Label>
            <AccountCombobox
              value={offsetAccountId}
              companyId={companyId}
              onChange={setOffsetAccountId}
              inputClassName={accountPickerInputClassName}
            />
          </div>
          <div className="space-y-1.5">
            <Label>原因</Label>
            <Textarea value={reason} onChange={e => setReason(e.target.value)} rows={2} className={fieldClassName} style={inputStyle} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" style={{ borderColor: 'var(--border-subtle)' }} onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={() => void save()} disabled={saving} style={{ background: '#C9A96E', color: '#0A0805' }}>
            {saving ? '保存中...' : '创建（草稿）'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function NoteApplyDialog({
  open,
  onOpenChange,
  config,
  companyId,
  note,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  config: SideConfig
  companyId: string
  note: SubNote | null
  onSaved: () => void
}) {
  const [openDocs, setOpenDocs] = useState<SubDoc[]>([])
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open || !note) return
    setDrafts({})
    const params = new URLSearchParams({ companyId, partyId: note.party.id, openOnly: '1' })
    fetch(`${config.docsEndpoint}?${params}`)
      .then(async res => {
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || '载入未结单据失败')
        setOpenDocs((data[config.docsResponseKey] ?? []).map(config.normalizeDoc))
      })
      .catch(error => toast.error(error instanceof Error ? error.message : '载入未结单据失败'))
  }, [open, note, companyId, config])

  const allocated = useMemo(
    () => Object.values(drafts).reduce((sum, value) => sum + (Number(value) || 0), 0),
    [drafts],
  )

  async function save() {
    if (!note) return
    const allocations = Object.entries(drafts)
      .map(([targetId, value]) => ({ targetId, amount: Number(value) || 0 }))
      .filter(allocation => allocation.amount > 0)
    if (allocations.length === 0) {
      toast.error('请填写至少一笔核销金额。')
      return
    }
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/financial/credit-notes/${note.id}/apply`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ allocations }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.toast || data.error || '核销失败。')
      toast.success(data.toast || '已核销。')
      onOpenChange(false)
      onSaved()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '核销失败。')
    } finally {
      setSaving(false)
    }
  }

  if (!note) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`${financialModalContentClassName} max-w-xl`}>
        <DialogHeader>
          <DialogTitle>
            核销 {note.noteNo} <span className="text-sm font-normal" style={{ color: 'var(--muted-foreground)' }}>可用 {money(note.remaining)} · 本次 {money(allocated)}</span>
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-1.5 max-h-[50vh] overflow-y-auto">
          {openDocs.length === 0 ? (
            <div className="rounded-md border px-4 py-5 text-center text-sm" style={{ borderColor: 'var(--border-subtle)', color: '#5A5040' }}>
              该{config.partyLabel}暂无未结{config.docLabel}
            </div>
          ) : (
            openDocs.map(doc => (
              <div
                key={doc.id}
                className="grid grid-cols-[1fr_110px_130px] items-center gap-2 rounded-md border px-3 py-2 text-sm"
                style={{ borderColor: 'var(--border-subtle)' }}
              >
                <span className="font-mono">{doc.docNo}</span>
                <span className="text-right" style={{ color: '#f59e0b' }}>
                  未结 {money(doc.outstanding)}
                </span>
                <Input
                  type="number"
                  min="0"
                  max={doc.outstanding}
                  step="0.01"
                  placeholder="核销金额"
                  value={drafts[doc.id] ?? ''}
                  onChange={e => setDrafts(current => ({ ...current, [doc.id]: e.target.value }))}
                  className={fieldClassName}
                  style={inputStyle}
                />
              </div>
            ))
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" style={{ borderColor: 'var(--border-subtle)' }} onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={() => void save()} disabled={saving} style={{ background: '#C9A96E', color: '#0A0805' }}>
            {saving ? '核销中...' : '确认核销'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
