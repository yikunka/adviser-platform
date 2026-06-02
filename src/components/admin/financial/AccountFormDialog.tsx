'use client'

/* eslint-disable react-hooks/set-state-in-effect */

import { FormEvent, useEffect, useMemo, useState } from 'react'
import { Save } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ACCOUNT_TYPE_OPTIONS } from '@/lib/financial/account-types'
import { flattenAccountHierarchy, isDescendantAccount } from '@/lib/financial/account-tree'
import type { AccountType } from '@prisma/client'

export type FinancialAccount = {
  id: string
  code: string
  name: string
  type: AccountType
  companyId?: string | null
  level: number
  sortOrder: number
  parentId: string | null
  isSystem: boolean
  notes?: string
  openingBalancePeriod?: string | null
  openingDebit?: number
  openingCredit?: number
  openingBalance?: number
  openingBalanceTotal?: number
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  account?: FinancialAccount | null
  companyId: string
  accounts: FinancialAccount[]
  onSaved: () => void | Promise<void>
}

const modalContentClassName = 'financial-modal max-h-[90vh] overflow-y-auto border-[#2A2418] bg-[#11110E] text-[#FFF7E6] shadow-2xl ring-[#3A3428] sm:max-w-xl'
const modalFooterClassName = 'mt-4 border-[#2A2418] bg-[#16130E]'
const labelClassName = 'text-[#EADDC3]'
const fieldClassName = 'border-[#2A2418] bg-[#0E0E0A] text-[#FFF7E6] placeholder:text-[#9F927B]'
const selectContentClassName = 'financial-select-content border-[#2A2418] bg-[#11110E] text-[#FFF7E6]'
const secondaryButtonClassName = 'border-[#3A3428] bg-[#0E0E0A] text-[#FFF7E6] hover:bg-[#1E1A12] hover:text-[#FFF7E6]'

function defaultOpeningPeriod() {
  return `${new Date().getUTCFullYear()}-01`
}

function amountField(value: number | null | undefined) {
  return value ? String(value) : ''
}

export function AccountFormDialog({ open, onOpenChange, account, companyId, accounts, onSaved }: Props) {
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [type, setType] = useState<FinancialAccount['type']>('ASSET')
  const [parentId, setParentId] = useState('NONE')
  const [sortOrder, setSortOrder] = useState('0')
  const [isSystem, setIsSystem] = useState(false)
  const [openingBalancePeriod, setOpeningBalancePeriod] = useState(defaultOpeningPeriod)
  const [openingDebit, setOpeningDebit] = useState('')
  const [openingCredit, setOpeningCredit] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setCode(account?.code ?? '')
    setName(account?.name ?? '')
    setType(account?.type ?? 'ASSET')
    setParentId(account?.parentId ?? 'NONE')
    setSortOrder(String(account?.sortOrder ?? 0))
    setIsSystem(account?.isSystem ?? false)
    setOpeningBalancePeriod(account?.openingBalancePeriod ?? defaultOpeningPeriod())
    setOpeningDebit(amountField(account?.openingDebit))
    setOpeningCredit(amountField(account?.openingCredit))
  }, [account, open])

  const parentOptions = useMemo(() => {
    return flattenAccountHierarchy(accounts)
      .filter(candidate => {
        if (candidate.id === account?.id) return false
        if (candidate.level >= 4) return false
        if (account && isDescendantAccount(accounts, account.id, candidate.id)) return false
        return true
      })
  }, [account, accounts])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const cleanCode = code.trim()
    const cleanName = name.trim()

    if (!cleanCode || !cleanName) {
      toast.error('请填写科目编码和名称。')
      return
    }

    const duplicate = accounts.find(item => item.code.toLowerCase() === cleanCode.toLowerCase() && item.id !== account?.id)
    if (duplicate) {
      toast.error('科目编码已存在。')
      return
    }

    const selectedParent = parentId === 'NONE' ? null : accounts.find(item => item.id === parentId) ?? null
    if (parentId !== 'NONE' && !selectedParent) {
      toast.error('上级科目不存在。')
      return
    }
    if (selectedParent && selectedParent.level >= 4) {
      toast.error('上级科目层级过深。')
      return
    }
    const openingDebitAmount = Number(openingDebit || 0)
    const openingCreditAmount = Number(openingCredit || 0)
    if (!Number.isFinite(openingDebitAmount) || !Number.isFinite(openingCreditAmount)) {
      toast.error('期初余额必须是数字。')
      return
    }
    if (openingDebitAmount > 0 && openingCreditAmount > 0) {
      toast.error('期初余额只能填写借方或贷方其中一项。')
      return
    }

    setSaving(true)
    try {
      const res = await fetch(account ? `/api/admin/financial/accounts/${account.id}` : '/api/admin/financial/accounts', {
        method: account ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: cleanCode,
          name: cleanName,
          type,
          companyId,
          parentId: parentId === 'NONE' ? null : parentId,
          sortOrder: Number(sortOrder) || 0,
          isSystem,
          openingBalancePeriod,
          openingDebit: openingDebitAmount,
          openingCredit: openingCreditAmount,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.toast || data.error || '保存科目失败。')

      toast.success(data.toast || (account ? '科目已更新。' : '科目已创建。'))
      onOpenChange(false)
      await onSaved()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '保存科目失败。')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={modalContentClassName}>
        <DialogHeader>
          <DialogTitle className="text-[#FFF7E6]">{account ? '编辑科目' : '新增科目'}</DialogTitle>
          <DialogDescription className="text-[#B8AD98]">维护会计科目的结构和期初余额。</DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="account-code" className={labelClassName}>编码</Label>
              <Input id="account-code" value={code} onChange={event => setCode(event.target.value)} required className={fieldClassName} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="account-name" className={labelClassName}>名称</Label>
              <Input id="account-name" value={name} onChange={event => setName(event.target.value)} required className={fieldClassName} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label className={labelClassName}>类型</Label>
              <Select value={type} onValueChange={value => setType(value as FinancialAccount['type'])}>
                <SelectTrigger className={`w-full ${fieldClassName}`}>
                  <SelectValue placeholder="类型" />
                </SelectTrigger>
                <SelectContent className={selectContentClassName}>
                  {ACCOUNT_TYPE_OPTIONS.map(item => (
                    <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className={labelClassName}>上级科目</Label>
              <Select value={parentId} onValueChange={value => setParentId(value ?? 'NONE')}>
                <SelectTrigger className={`w-full ${fieldClassName}`}>
                  <SelectValue placeholder="上级科目" />
                </SelectTrigger>
                <SelectContent className={selectContentClassName}>
                  <SelectItem value="NONE">无上级科目</SelectItem>
                  {parentOptions.map(item => (
                    <SelectItem key={item.id} value={item.id}>{item.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="sort-order" className={labelClassName}>排序</Label>
              <Input id="sort-order" type="number" min={0} value={sortOrder} onChange={event => setSortOrder(event.target.value)} className={fieldClassName} />
            </div>
            <label className="flex items-center gap-2 pt-7 text-sm text-[#EADDC3]">
              <input
                type="checkbox"
                checked={isSystem}
                onChange={event => setIsSystem(event.target.checked)}
                className="size-4 accent-[#C9A96E]"
              />
              系统科目
            </label>
          </div>

          <div className="rounded-lg border border-[#2A2418] bg-[#0E0E0A] p-4">
            <div className="mb-3">
              <h3 className="text-sm font-semibold text-[#FFF7E6]">期初余额</h3>
              <p className="mt-1 text-xs text-[#B8AD98]">
                可填写或修改此科目的年初余额。借方和贷方只能填写一项。
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="opening-period" className={labelClassName}>期初期间</Label>
                <Input
                  id="opening-period"
                  type="month"
                  value={openingBalancePeriod}
                  onChange={event => setOpeningBalancePeriod(event.target.value)}
                  className={fieldClassName}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="opening-debit" className={labelClassName}>期初借方</Label>
                <Input
                  id="opening-debit"
                  type="number"
                  min={0}
                  step="0.01"
                  value={openingDebit}
                  onChange={event => setOpeningDebit(event.target.value)}
                  className={fieldClassName}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="opening-credit" className={labelClassName}>期初贷方</Label>
                <Input
                  id="opening-credit"
                  type="number"
                  min={0}
                  step="0.01"
                  value={openingCredit}
                  onChange={event => setOpeningCredit(event.target.value)}
                  className={fieldClassName}
                />
              </div>
            </div>
          </div>

          <DialogFooter className={modalFooterClassName}>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving} className={secondaryButtonClassName}>
              取消
            </Button>
            <Button type="submit" disabled={saving} style={{ background: '#C9A96E', color: '#0A0805' }}>
              <Save size={14} />
              {saving ? '保存中...' : '保存'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
