'use client'

/* eslint-disable react-hooks/set-state-in-effect */

import { FormEvent, useEffect, useMemo, useState } from 'react'
import { Plus, Save, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DatePickerPopover } from '@/components/ui/date-picker-popover'
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'

type Account = {
  id: string
  code: string
  name: string
  type: string
}

type ScopeCompany = {
  id: string
  nameEn: string
  companyCode: string | null
}

type FormLine = {
  accountId: string
  description: string
  debit: string
  credit: string
}

export type JournalEntryForForm = {
  id: string
  entryDate?: string
  date: string
  description: string
  companyId?: string | null
  status: 'DRAFT' | 'POSTED' | 'CANCELLED'
  lines: {
    accountId: string
    description: string
    debit: number
    credit: number
  }[]
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  entry?: JournalEntryForForm | null
  /** When set, journal is locked to this client company (TCSP company workspace). */
  fixedCompanyId?: string
  onSaved: () => void | Promise<void>
}

const modalContentClassName = 'financial-modal max-h-[92vh] overflow-y-auto border-[#2A2418] bg-[#11110E] text-[#FFF7E6] shadow-2xl ring-[#3A3428] sm:max-w-5xl'
const modalFooterClassName = 'border-[#2A2418] bg-[#16130E]'
const labelClassName = 'text-[#EADDC3]'
const fieldClassName = 'border-[#2A2418] bg-[#0E0E0A] text-[#FFF7E6] placeholder:text-[#9F927B]'
const selectContentClassName = 'financial-select-content border-[#2A2418] bg-[#11110E] text-[#FFF7E6]'
const secondaryButtonClassName = 'border-[#3A3428] bg-[#0E0E0A] text-[#FFF7E6] hover:bg-[#1E1A12] hover:text-[#FFF7E6]'
const warningTextClassName = 'text-xs text-[#f59e0b]'

function selectedCompanyLabel(companies: ScopeCompany[], id: string) {
  const company = companies.find(row => row.id === id)
  if (!company) return ''
  return `${company.companyCode ? `${company.companyCode} - ` : ''}${company.nameEn}`
}

function selectedAccountLabel(accounts: Account[], id: string) {
  const account = accounts.find(row => row.id === id)
  if (!account) return ''
  return `${account.code} - ${account.name}`
}

function todayYmd() {
  return new Date().toISOString().slice(0, 10)
}

function blankLine(): FormLine {
  return { accountId: 'NONE', description: '', debit: '', credit: '' }
}

function numeric(value: string) {
  return Number(value || 0)
}

export function JournalEntryForm({ open, onOpenChange, entry, fixedCompanyId, onSaved }: Props) {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [companies, setCompanies] = useState<ScopeCompany[]>([])
  const [entryDate, setEntryDate] = useState(todayYmd())
  const [companyId, setCompanyId] = useState('NONE')
  const [description, setDescription] = useState('')
  const [lines, setLines] = useState<FormLine[]>([blankLine(), blankLine()])
  const [saving, setSaving] = useState(false)
  const [loadingAccounts, setLoadingAccounts] = useState(false)

  useEffect(() => {
    if (!open) return
    setEntryDate((entry?.entryDate ?? entry?.date ?? todayYmd()).slice(0, 10))
    setCompanyId(entry?.companyId ?? fixedCompanyId ?? 'NONE')
    setDescription(entry?.description ?? '')
    setLines(entry?.lines?.length
      ? entry.lines.map(line => ({
          accountId: line.accountId,
          description: line.description ?? '',
          debit: line.debit ? String(line.debit) : '',
          credit: line.credit ? String(line.credit) : '',
        }))
      : [blankLine(), blankLine()])
  }, [entry, fixedCompanyId, open])

  useEffect(() => {
    if (!open) return
    const accountCompanyId = fixedCompanyId ?? (companyId === 'NONE' ? '' : companyId)
    setLoadingAccounts(true)
    Promise.all([
      accountCompanyId
        ? fetch(`/api/admin/financial/accounts?companyId=${accountCompanyId}`).then(async res => {
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || '载入会计科目失败。')
            return data.accounts || []
          })
        : Promise.resolve([]),
      fixedCompanyId
        ? Promise.resolve([])
        : fetch('/api/admin/financial/scope').then(async res => {
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || '载入客户公司失败。')
            return data.companies || []
          }),
    ])
      .then(([accountRows, companyRows]) => {
        setAccounts(accountRows)
        if (!fixedCompanyId) setCompanies(companyRows)
      })
      .catch(err => toast.error(err instanceof Error ? err.message : '载入会计科目失败。'))
      .finally(() => setLoadingAccounts(false))
  }, [companyId, fixedCompanyId, open])

  useEffect(() => {
    if (!open || fixedCompanyId) return
    if (!entry && loadingAccounts) return
    if (companyId !== 'NONE' || companies.length !== 1) return
    setCompanyId(companies[0]!.id)
  }, [companies, companyId, entry, fixedCompanyId, loadingAccounts, open])

  const totals = useMemo(() => {
    const debit = lines.reduce((sum, line) => sum + numeric(line.debit), 0)
    const credit = lines.reduce((sum, line) => sum + numeric(line.credit), 0)
    return {
      debit,
      credit,
      balanced: Math.abs(debit - credit) < 0.005 && debit > 0,
    }
  }, [lines])

  const hasCompany = companyId !== 'NONE'
  const canSubmit = hasCompany && totals.balanced && !saving
  const saveBlockedReason = !hasCompany
    ? '保存前请选择客户公司。'
    : !totals.balanced
      ? '借方合计必须等于贷方合计。'
      : ''

  function updateLine(index: number, patch: Partial<FormLine>) {
    setLines(current => current.map((line, lineIndex) => (lineIndex === index ? { ...line, ...patch } : line)))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!description.trim()) {
      toast.error('请填写摘要。')
      return
    }
    if (!hasCompany) {
      toast.error('保存日记账前请选择客户公司。')
      return
    }
    if (!totals.balanced) {
      toast.error('借方合计必须等于贷方合计。')
      return
    }

    const payloadLines = lines.map(line => ({
      accountId: line.accountId === 'NONE' ? '' : line.accountId,
      description: line.description,
      debit: numeric(line.debit),
      credit: numeric(line.credit),
    }))

    if (payloadLines.some(line => !line.accountId)) {
      toast.error('每一行都需要选择会计科目。')
      return
    }

    setSaving(true)
    try {
      const res = await fetch(entry ? `/api/admin/financial/journal-entries/${entry.id}` : '/api/admin/financial/journal-entries', {
        method: entry ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entryDate, companyId, description, lines: payloadLines }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.toast || data.error || '保存日记账失败。')

      toast.success(data.toast || (entry ? '日记账已更新。' : '日记账已创建。'))
      onOpenChange(false)
      await onSaved()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '保存日记账失败。')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={modalContentClassName}>
        <DialogHeader>
          <DialogTitle className="text-[#FFF7E6]">{entry ? '编辑日记账' : '新增日记账'}</DialogTitle>
          <DialogDescription className="text-[#B8AD98]">
            保存后状态为待过账，使用审核并过账生成总账记录。
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" style={{ borderColor: '#f59e0b', color: '#f59e0b' }}>
              状态：待过账
            </Badge>
            {!hasCompany && (
              <Badge variant="outline" style={{ borderColor: '#f59e0b', color: '#f59e0b' }}>
                需要选择公司
              </Badge>
            )}
            {!totals.balanced && (
              <Badge variant="outline" style={{ borderColor: '#f59e0b', color: '#f59e0b' }}>
                借贷不平衡
              </Badge>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-[180px_minmax(220px,1fr)]">
            <div className="space-y-2">
              <Label className={labelClassName}>日期</Label>
              <DatePickerPopover
                value={entryDate}
                onChange={setEntryDate}
                className={`${fieldClassName} border`}
              />
            </div>
            {!fixedCompanyId ? (
              <div className="space-y-2">
                <Label className={labelClassName}>客户公司</Label>
                <Select value={companyId} onValueChange={value => setCompanyId(value ?? 'NONE')}>
                  <SelectTrigger className={`w-full ${fieldClassName}`}>
                    <SelectValue placeholder={loadingAccounts ? '载入中...' : '选择公司'}>
                      {companyId !== 'NONE' ? selectedCompanyLabel(companies, companyId) : undefined}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className={selectContentClassName}>
                    <SelectItem value="NONE">选择公司</SelectItem>
                    {companies.map(company => (
                      <SelectItem key={company.id} value={company.id}>
                        {company.companyCode ? `${company.companyCode} - ` : ''}{company.nameEn}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {companies.length === 0 ? (
                  <p className={warningTextClassName}>
                    暂无可访问客户公司。请先创建或分配公司后再录入日记账。
                  </p>
                ) : companyId === 'NONE' ? (
                  <p className={warningTextClassName}>必填。财务报表和总账会按公司隔离。</p>
                ) : null}
              </div>
            ) : null}
          </div>
          <div className="space-y-2">
            <div className="space-y-2">
              <Label htmlFor="journal-description" className={labelClassName}>摘要</Label>
              <Textarea
                id="journal-description"
                value={description}
                onChange={event => setDescription(event.target.value)}
                required
                rows={3}
                className={fieldClassName}
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-[#FFF7E6]">分录明细</span>
              {!totals.balanced && (
                <Badge variant="outline" style={{ borderColor: '#f59e0b', color: '#f59e0b' }}>
                  差额：{(totals.debit - totals.credit).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </Badge>
              )}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setLines(current => [...current, blankLine()])}
              className={secondaryButtonClassName}
            >
              <Plus size={14} />
              新增行
            </Button>
          </div>

          <div className="overflow-x-auto rounded-lg border border-[#2A2418] bg-[#0B0B08]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[260px]">科目</TableHead>
                  <TableHead className="min-w-[220px]">行摘要</TableHead>
                  <TableHead className="w-[140px] text-right">借方</TableHead>
                  <TableHead className="w-[140px] text-right">贷方</TableHead>
                  <TableHead className="w-[48px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {lines.map((line, index) => (
                  <TableRow key={index}>
                    <TableCell>
                      <Select value={line.accountId} onValueChange={value => updateLine(index, { accountId: value ?? 'NONE' })}>
                        <SelectTrigger className={`w-full ${fieldClassName}`}>
                          <SelectValue placeholder={loadingAccounts ? '载入中...' : '科目'}>
                            {line.accountId !== 'NONE' ? selectedAccountLabel(accounts, line.accountId) : undefined}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent className={selectContentClassName}>
                          <SelectItem value="NONE">选择科目</SelectItem>
                          {accounts.map(account => (
                            <SelectItem key={account.id} value={account.id}>
                              {account.code} - {account.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Input
                        value={line.description}
                        onChange={event => updateLine(index, { description: event.target.value })}
                        placeholder="可选"
                        className={fieldClassName}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={line.debit}
                        onChange={event => updateLine(index, { debit: event.target.value, credit: event.target.value ? '' : line.credit })}
                        className={`text-right ${fieldClassName}`}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={line.credit}
                        onChange={event => updateLine(index, { credit: event.target.value, debit: event.target.value ? '' : line.debit })}
                        className={`text-right ${fieldClassName}`}
                      />
                    </TableCell>
                    <TableCell>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setLines(current => current.filter((_, lineIndex) => lineIndex !== index))}
                        disabled={lines.length <= 2}
                        aria-label="删除行"
                      >
                        <Trash2 size={14} />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow>
                  <TableCell colSpan={2} className="text-right font-medium">合计</TableCell>
                  <TableCell className="text-right font-medium">{totals.debit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                  <TableCell className="text-right font-medium">{totals.credit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                  <TableCell />
                </TableRow>
              </TableBody>
            </Table>
          </div>

          <DialogFooter className={modalFooterClassName}>
            {saveBlockedReason && (
              <span className="mr-auto self-center text-xs text-[#f59e0b]">{saveBlockedReason}</span>
            )}
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving} className={secondaryButtonClassName}>
              取消
            </Button>
            <Button type="submit" disabled={!canSubmit} style={{ background: '#C9A96E', color: '#0A0805' }}>
              <Save size={14} />
              {saving ? '保存中...' : '保存'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
