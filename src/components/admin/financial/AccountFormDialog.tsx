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
import { canEditEnteredBalances, openingBalanceEditBlockedMessage } from '@/lib/financial/opening-balance'
import { notifyFinancialAccountsChanged } from '@/lib/financial/events'
import { calculateYearToDateBalance, isCurrentYearProfitAccountName } from '@/lib/financial/year-to-date'
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
  openingDebitTotal?: number
  openingCreditTotal?: number
  openingBalanceTotal?: number
  yearToDateAmount?: number
  yearToDateDebit?: number
  yearToDateCredit?: number
  yearToDateAmountTotal?: number
  yearToDateDebitTotal?: number
  yearToDateCreditTotal?: number
  yearToDateBalance?: number
  yearToDateBalanceTotal?: number
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
type OpeningBalanceSide = 'DEBIT' | 'CREDIT'

function defaultOpeningPeriod() {
  return `${new Date().getUTCFullYear()}-01`
}

function amountField(value: number | null | undefined) {
  return value ? String(value) : ''
}

function displayAmount(value: number) {
  return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function normalBalanceSide(type: FinancialAccount['type']): OpeningBalanceSide {
  return ['LIABILITY', 'EQUITY', 'REVENUE'].includes(type) ? 'CREDIT' : 'DEBIT'
}

export function AccountFormDialog({ open, onOpenChange, account, companyId, accounts, onSaved }: Props) {
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [type, setType] = useState<FinancialAccount['type']>('ASSET')
  const [parentId, setParentId] = useState('NONE')
  const [sortOrder, setSortOrder] = useState('0')
  const [isSystem, setIsSystem] = useState(false)
  const [openingBalancePeriod, setOpeningBalancePeriod] = useState(defaultOpeningPeriod)
  const [openingBalanceAmount, setOpeningBalanceAmount] = useState('')
  const [openingBalanceSide, setOpeningBalanceSide] = useState<OpeningBalanceSide>('DEBIT')
  const [yearToDateDebit, setYearToDateDebit] = useState('')
  const [yearToDateCredit, setYearToDateCredit] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    const accountHasChildren = account ? accounts.some(item => item.parentId === account.id) : false
    const accountBalancesEditable = canEditEnteredBalances(account?.level ?? 1, accountHasChildren)
    setCode(account?.code ?? '')
    setName(account?.name ?? '')
    setType(account?.type ?? 'ASSET')
    setParentId(account?.parentId ?? 'NONE')
    setSortOrder(String(account?.sortOrder ?? 0))
    setIsSystem(account?.isSystem ?? false)
    setOpeningBalancePeriod(account?.openingBalancePeriod ?? defaultOpeningPeriod())
    setOpeningBalanceAmount(amountField(accountBalancesEditable
      ? Math.max(account?.openingDebit ?? 0, account?.openingCredit ?? 0)
      : account?.openingBalanceTotal ?? 0))
    setOpeningBalanceSide((account?.openingCredit ?? 0) > 0 ? 'CREDIT' : normalBalanceSide(account?.type ?? 'ASSET'))
    setYearToDateDebit(amountField(accountBalancesEditable ? account?.yearToDateDebit : account?.yearToDateDebitTotal))
    setYearToDateCredit(amountField(accountBalancesEditable ? account?.yearToDateCredit : account?.yearToDateCreditTotal))
  }, [account, accounts, open])

  const parentOptions = useMemo(() => {
    return flattenAccountHierarchy(accounts)
      .filter(candidate => {
        if (candidate.id === account?.id) return false
        if (candidate.level >= 4) return false
        if (account && isDescendantAccount(accounts, account.id, candidate.id)) return false
        return true
      })
  }, [account, accounts])

  const selectedParentLabel = useMemo(() => {
    if (parentId === 'NONE') return undefined
    const match = parentOptions.find(item => item.id === parentId)
    if (match) return match.label
    const fallback = accounts.find(item => item.id === parentId)
    return fallback ? `${fallback.code} - ${fallback.name}` : undefined
  }, [accounts, parentId, parentOptions])

  const selectedParent = parentId === 'NONE' ? null : accounts.find(item => item.id === parentId) ?? null
  const nextLevel = selectedParent ? selectedParent.level + 1 : 1
  const hasChildren = account ? accounts.some(item => item.parentId === account.id) : false
  const enteredBalancesEditable = canEditEnteredBalances(nextLevel, hasChildren)
  const openingBalanceBlockedMessage = openingBalanceEditBlockedMessage(nextLevel, hasChildren)
  const showYearToDateBalance = isCurrentYearProfitAccountName(name)
  const previewDebit = Number(yearToDateDebit || 0)
  const previewCredit = Number(yearToDateCredit || 0)
  const yearToDateBalancePreview = calculateYearToDateBalance({
    name,
    type,
    code,
    debit: Number.isFinite(previewDebit) ? previewDebit : 0,
    credit: Number.isFinite(previewCredit) ? previewCredit : 0,
  })

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

    const selectedParentForSave = parentId === 'NONE' ? null : accounts.find(item => item.id === parentId) ?? null
    if (parentId !== 'NONE' && !selectedParentForSave) {
      toast.error('上级科目不存在。')
      return
    }
    if (selectedParentForSave && selectedParentForSave.level >= 4) {
      toast.error('上级科目层级过深。')
      return
    }
    const saveLevel = selectedParentForSave ? selectedParentForSave.level + 1 : 1
    const saveHasChildren = account ? accounts.some(item => item.parentId === account.id) : false
    const openingBalanceValue = Number(openingBalanceAmount || 0)
    const yearToDateDebitValue = Number(yearToDateDebit || 0)
    const yearToDateCreditValue = Number(yearToDateCredit || 0)
    if (enteredBalancesEditable && (!Number.isFinite(openingBalanceValue) || !Number.isFinite(yearToDateDebitValue) || !Number.isFinite(yearToDateCreditValue))) {
      toast.error('期初余额和本年累计发生数必须是数字。')
      return
    }
    if (enteredBalancesEditable && (openingBalanceValue < 0 || yearToDateDebitValue < 0 || yearToDateCreditValue < 0)) {
      toast.error('期初余额和本年累计发生数不能为负数。')
      return
    }
    if ((openingBalanceValue > 0) && !canEditEnteredBalances(saveLevel, saveHasChildren)) {
      toast.error(openingBalanceEditBlockedMessage(saveLevel, saveHasChildren) || '此科目不支持录入期初余额。')
      return
    }
    const openingDebitAmount = enteredBalancesEditable && openingBalanceSide === 'DEBIT' ? openingBalanceValue : 0
    const openingCreditAmount = enteredBalancesEditable && openingBalanceSide === 'CREDIT' ? openingBalanceValue : 0

    setSaving(true)
    try {
      const payload: Record<string, unknown> = {
        code: cleanCode,
        name: cleanName,
        type,
        companyId,
        parentId: parentId === 'NONE' ? null : parentId,
        sortOrder: Number(sortOrder) || 0,
        isSystem,
      }
      if (enteredBalancesEditable) {
        payload.openingBalancePeriod = openingBalancePeriod
        payload.openingDebit = openingDebitAmount
        payload.openingCredit = openingCreditAmount
        payload.yearToDateDebit = yearToDateDebitValue
        payload.yearToDateCredit = yearToDateCreditValue
      }

      const res = await fetch(account ? `/api/admin/financial/accounts/${account.id}` : '/api/admin/financial/accounts', {
        method: account ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.toast || data.error || '保存科目失败。')

      toast.success(data.toast || (account ? '科目已更新。' : '科目已创建。'))
      notifyFinancialAccountsChanged(companyId)
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
                  <SelectValue placeholder="选择上级科目">
                    {selectedParentLabel}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent
                  alignItemWithTrigger={false}
                  className={`${selectContentClassName} min-w-80 max-h-72`}
                >
                  <SelectItem value="NONE" label="无上级科目">无上级科目</SelectItem>
                  {parentOptions.map(item => (
                    <SelectItem
                      key={item.id}
                      value={item.id}
                      label={item.label}
                      className="whitespace-normal *:whitespace-normal"
                    >
                      <span
                        className="block font-sans leading-snug"
                        style={{ paddingLeft: `${Math.max(0, item.level - 1) * 12}px` }}
                      >
                        {item.label}
                      </span>
                    </SelectItem>
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
              <h3 className="text-sm font-semibold text-[#FFF7E6]">期初及累计数</h3>
              <p className="mt-1 text-xs text-[#B8AD98]">
                {enteredBalancesEditable
                  ? '可填写或修改此科目的期初余额和本年累计发生数。'
                  : openingBalanceBlockedMessage}
              </p>
            </div>
            {enteredBalancesEditable ? (
              <div className="grid gap-4 sm:grid-cols-2">
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
                  <Label htmlFor="opening-balance" className={labelClassName}>期初余额</Label>
                  <Input
                    id="opening-balance"
                    type="number"
                    min={0}
                    step="0.01"
                    value={openingBalanceAmount}
                    onChange={event => setOpeningBalanceAmount(event.target.value)}
                    className={fieldClassName}
                  />
                </div>
                <div className="space-y-2">
                  <Label className={labelClassName}>期初方向</Label>
                  <Select value={openingBalanceSide} onValueChange={value => setOpeningBalanceSide(value as OpeningBalanceSide)}>
                    <SelectTrigger className={`w-full ${fieldClassName}`}>
                      <SelectValue placeholder="期初方向" />
                    </SelectTrigger>
                    <SelectContent className={selectContentClassName}>
                      <SelectItem value="DEBIT">借方</SelectItem>
                      <SelectItem value="CREDIT">贷方</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="year-to-date-debit" className={labelClassName}>本年累计发生数（借方）</Label>
                  <Input
                    id="year-to-date-debit"
                    type="number"
                    min={0}
                    step="0.01"
                    value={yearToDateDebit}
                    onChange={event => setYearToDateDebit(event.target.value)}
                    className={fieldClassName}
                  />
                </div>
                <div className="space-y-2 sm:col-start-2">
                  <Label htmlFor="year-to-date-credit" className={labelClassName}>本年累计发生数（贷方）</Label>
                  <Input
                    id="year-to-date-credit"
                    type="number"
                    min={0}
                    step="0.01"
                    value={yearToDateCredit}
                    onChange={event => setYearToDateCredit(event.target.value)}
                    className={fieldClassName}
                  />
                </div>
                {showYearToDateBalance && (
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="year-to-date-balance" className={labelClassName}>本年利润累计余额（贷方 - 借方）</Label>
                    <Input
                      id="year-to-date-balance"
                      readOnly
                      value={displayAmount(yearToDateBalancePreview)}
                      className={`${fieldClassName} opacity-80`}
                    />
                  </div>
                )}
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className={labelClassName}>期初余额（自动汇总）</Label>
                  <Input
                    readOnly
                    value={displayAmount(account?.openingBalanceTotal ?? 0)}
                    className={`${fieldClassName} opacity-80`}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="year-to-date-debit" className={labelClassName}>本年累计发生数（借方）</Label>
                  <Input
                    id="year-to-date-debit"
                    readOnly
                    value={displayAmount(account?.yearToDateDebitTotal ?? 0)}
                    className={`${fieldClassName} opacity-80`}
                  />
                </div>
                <div className="space-y-2 sm:col-start-2">
                  <Label htmlFor="year-to-date-credit" className={labelClassName}>本年累计发生数（贷方）</Label>
                  <Input
                    id="year-to-date-credit"
                    readOnly
                    value={displayAmount(account?.yearToDateCreditTotal ?? 0)}
                    className={`${fieldClassName} opacity-80`}
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="year-to-date-balance" className={labelClassName}>
                    {showYearToDateBalance ? '本年利润累计余额（贷方 - 借方）' : '本年累计余额（自动汇总）'}
                  </Label>
                  <Input
                    id="year-to-date-balance"
                    readOnly
                    value={displayAmount(account?.yearToDateBalanceTotal ?? 0)}
                    className={`${fieldClassName} opacity-80`}
                  />
                </div>
              </div>
            )}
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
