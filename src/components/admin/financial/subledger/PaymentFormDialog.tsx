'use client'

/* eslint-disable react-hooks/set-state-in-effect */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PartySelect } from '@/components/admin/financial/subledger/PartySelect'
import {
  fieldClassName,
  financialModalContentClassName,
  inputStyle,
  money,
  selectContentClassName,
  selectItemClassName,
  type SideConfig,
  type SubDoc,
} from '@/components/admin/financial/subledger/config'

const METHOD_LABELS: Record<string, string> = {
  BANK_TRANSFER: '银行转账',
  CASH: '现金',
  CHEQUE: '支票',
  CARD: '银行卡',
  OTHER: '其他',
}

type BankAccountOption = { id: string; name: string; bankName: string }

function todayYmd() {
  return new Date().toISOString().slice(0, 10)
}

export function PaymentFormDialog({
  open,
  onOpenChange,
  config,
  companyId,
  presetDoc,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  config: SideConfig
  companyId: string
  /** 从单据行点「收款/付款」时预选的单据 */
  presetDoc: SubDoc | null
  onSaved: () => void
}) {
  const [partyId, setPartyId] = useState('')
  const [paymentDate, setPaymentDate] = useState(todayYmd())
  const [method, setMethod] = useState('BANK_TRANSFER')
  const [bankAccountId, setBankAccountId] = useState('')
  const [bankAccounts, setBankAccounts] = useState<BankAccountOption[]>([])
  const [amount, setAmount] = useState('')
  const [reference, setReference] = useState('')
  const [openDocs, setOpenDocs] = useState<SubDoc[]>([])
  const [allocationDrafts, setAllocationDrafts] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setPartyId(presetDoc?.partyId ?? '')
    setPaymentDate(todayYmd())
    setMethod('BANK_TRANSFER')
    setBankAccountId('')
    setAmount(presetDoc ? String(presetDoc.outstanding) : '')
    setReference('')
    setOpenDocs([])
    setAllocationDrafts(presetDoc ? { [presetDoc.id]: String(presetDoc.outstanding) } : {})

    fetch(`/api/admin/financial/bank-accounts?companyId=${companyId}`)
      .then(async res => {
        const data = await res.json()
        if (res.ok) setBankAccounts((data.bankAccounts ?? []).filter((account: { isActive: boolean }) => account.isActive))
      })
      .catch(() => {})
  }, [open, presetDoc, companyId])

  const loadOpenDocs = useCallback(
    async (selectedPartyId: string) => {
      if (!selectedPartyId) {
        setOpenDocs([])
        return
      }
      try {
        const params = new URLSearchParams({ companyId, partyId: selectedPartyId, openOnly: '1' })
        const res = await fetch(`${config.docsEndpoint}?${params}`)
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || '载入未结单据失败')
        const docs = (data[config.docsResponseKey] ?? []).map(config.normalizeDoc) as SubDoc[]
        setOpenDocs(docs)
      } catch (error) {
        toast.error(error instanceof Error ? error.message : '载入未结单据失败')
      }
    },
    [companyId, config],
  )

  useEffect(() => {
    if (open && partyId) void loadOpenDocs(partyId)
  }, [open, partyId, loadOpenDocs])

  const allocatedTotal = useMemo(
    () => Object.values(allocationDrafts).reduce((sum, value) => sum + (Number(value) || 0), 0),
    [allocationDrafts],
  )
  const amountNumber = Number(amount) || 0
  const unallocated = Math.round((amountNumber - allocatedTotal) * 100) / 100

  function autoAllocate() {
    let remaining = amountNumber
    const next: Record<string, string> = {}
    for (const doc of openDocs) {
      if (remaining <= 0) break
      const portion = Math.min(remaining, doc.outstanding)
      if (portion > 0) {
        next[doc.id] = String(Math.round(portion * 100) / 100)
        remaining = Math.round((remaining - portion) * 100) / 100
      }
    }
    setAllocationDrafts(next)
  }

  async function save() {
    if (!partyId) {
      toast.error(`请选择${config.partyLabel}。`)
      return
    }
    if (amountNumber <= 0) {
      toast.error('金额必须大于零。')
      return
    }
    if (unallocated < -0.005) {
      toast.error('核销合计超过本次金额。')
      return
    }

    setSaving(true)
    try {
      const allocations = Object.entries(allocationDrafts)
        .map(([targetId, value]) => ({ targetId, amount: Number(value) || 0 }))
        .filter(allocation => allocation.amount > 0)

      const res = await fetch('/api/admin/financial/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          partyId,
          direction: config.paymentsDirection,
          paymentDate,
          method,
          bankAccountId: bankAccountId || null,
          amount: amountNumber,
          reference,
          allocations,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.toast || data.error || '保存失败。')
      toast.success(data.toast || '已登记。')
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
      <DialogContent className={`${financialModalContentClassName} max-w-2xl max-h-[88vh] overflow-y-auto`}>
        <DialogHeader>
          <DialogTitle>登记{config.payLabel}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{config.partyLabel} *</Label>
              <PartySelect
                companyId={companyId}
                role={config.partyRole}
                value={partyId}
                onChange={id => {
                  setPartyId(id)
                  setAllocationDrafts({})
                }}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{config.payLabel}日期 *</Label>
              <Input type="date" value={paymentDate} onChange={e => setPaymentDate(e.target.value)} className={fieldClassName} style={inputStyle} />
            </div>
          </div>

          <div className="grid sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>金额 *</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                className={fieldClassName}
                style={inputStyle}
              />
            </div>
            <div className="space-y-1.5">
              <Label>方式</Label>
              <Select value={method} onValueChange={value => setMethod(value ?? 'BANK_TRANSFER')}>
                <SelectTrigger className={`w-full ${fieldClassName}`} style={inputStyle}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className={selectContentClassName}>
                  {Object.entries(METHOD_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value} className={selectItemClassName}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>银行账户（可选）</Label>
              <Select value={bankAccountId || 'NONE'} onValueChange={value => setBankAccountId(value === 'NONE' ? '' : value ?? '')}>
                <SelectTrigger className={`w-full ${fieldClassName}`} style={inputStyle}>
                  <SelectValue placeholder="默认科目" />
                </SelectTrigger>
                <SelectContent className={selectContentClassName}>
                  <SelectItem value="NONE" className={selectItemClassName}>默认科目（按方式映射）</SelectItem>
                  {bankAccounts.map(account => (
                    <SelectItem key={account.id} value={account.id} className={selectItemClassName}>
                      {account.name}
                      {account.bankName ? ` · ${account.bankName}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>参考号 / 摘要</Label>
            <Input value={reference} onChange={e => setReference(e.target.value)} className={fieldClassName} style={inputStyle} />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>
                核销未结{config.docLabel}
                <span className="ml-2 text-xs" style={{ color: unallocated < 0 ? '#ef4444' : 'var(--muted-foreground)' }}>
                  本次 {money(amountNumber)} · 已分配 {money(allocatedTotal)} · 未分配 {money(unallocated)}
                </span>
              </Label>
              <Button size="sm" variant="outline" style={{ borderColor: '#2A2418' }} onClick={autoAllocate} disabled={openDocs.length === 0}>
                按到期顺序自动分配
              </Button>
            </div>
            {openDocs.length === 0 ? (
              <div className="rounded-md border px-4 py-5 text-center text-sm" style={{ borderColor: '#2A2418', color: '#5A5040' }}>
                {partyId ? `该${config.partyLabel}暂无未结${config.docLabel}（可登记为预${config.payLabel}）` : `请先选择${config.partyLabel}`}
              </div>
            ) : (
              <div className="space-y-1.5">
                {openDocs.map(doc => (
                  <div
                    key={doc.id}
                    className="grid grid-cols-[1fr_110px_110px_130px] items-center gap-2 rounded-md border px-3 py-2 text-sm"
                    style={{ borderColor: '#2A2418' }}
                  >
                    <div>
                      <span className="font-mono">{doc.docNo}</span>
                      <span className="ml-2 text-xs" style={{ color: 'var(--muted-foreground)' }}>
                        到期 {doc.dueDate ?? '-'}
                      </span>
                    </div>
                    <div className="text-right">{money(doc.total)}</div>
                    <div className="text-right" style={{ color: '#f59e0b' }}>
                      未结 {money(doc.outstanding)}
                    </div>
                    <Input
                      type="number"
                      min="0"
                      max={doc.outstanding}
                      step="0.01"
                      placeholder="核销金额"
                      value={allocationDrafts[doc.id] ?? ''}
                      onChange={e =>
                        setAllocationDrafts(current => ({ ...current, [doc.id]: e.target.value }))
                      }
                      className={fieldClassName}
                      style={inputStyle}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" style={{ borderColor: '#2A2418' }} onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={() => void save()} disabled={saving} style={{ background: '#C9A96E', color: '#0A0805' }}>
            {saving ? '保存中...' : `登记${config.payLabel}并过账`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
