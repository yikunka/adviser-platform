'use client'

/* eslint-disable react-hooks/set-state-in-effect */

import { FormEvent, type KeyboardEvent as ReactKeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Plus, Printer, Save, Trash2 } from 'lucide-react'
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
import { AccountCombobox } from '@/components/admin/financial/AccountCombobox'

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
  voucherNo?: string
  entryDate?: string
  date: string
  description: string
  companyId?: string | null
  company?: { id: string; nameEn: string; companyCode: string | null } | null
  status: 'DRAFT' | 'POSTED' | 'CANCELLED'
  sourceType?: 'MANUAL' | 'CLOSING' | null
  totalAmount?: number
  createdBy?: string | null
  createdAt?: string | null
  lines: {
    accountId: string
    description: string
    debit: number
    credit: number
    account?: { code: string; name: string } | null
  }[]
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  entry?: JournalEntryForForm | null
  /** When set, journal is locked to this client company (TCSP company workspace). */
  fixedCompanyId?: string
  onSaved: (entry?: JournalEntryForForm, options?: { print?: boolean }) => void | Promise<void>
  /** Called after F1 save-and-continue so parent clears edit mode. */
  onContinued?: () => void
}

const modalContentClassName = 'financial-modal max-h-[96vh] w-[min(96vw,83rem)] overflow-y-auto border-[var(--border-subtle)] bg-[var(--surface-modal)] text-[var(--text-bright)] shadow-2xl ring-[var(--border-strong)] sm:max-w-[83rem]'
const modalFooterClassName = 'border-[var(--border-subtle)] bg-[var(--surface-footer)]'
const labelClassName = 'text-[#EADDC3]'
const fieldClassName = 'border-[var(--border-subtle)] bg-[var(--surface-input)] text-[var(--text-bright)] placeholder:text-[var(--text-placeholder)]'
const lineFieldClassName = `${fieldClassName} h-14 min-h-14 py-3 text-base`
const lineTableCellClassName = 'py-4 align-middle'
const selectContentClassName = 'financial-select-content border-[var(--border-subtle)] bg-[var(--surface-modal)] text-[var(--text-bright)]'
const secondaryButtonClassName = 'border-[var(--border-strong)] bg-[var(--surface-input)] text-[var(--text-bright)] hover:bg-[var(--surface-panel)] hover:text-[var(--text-bright)]'
const warningTextClassName = 'text-xs text-[#f59e0b]'
const sourceTypeOptionClassName = 'flex cursor-pointer items-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-input)] px-3 py-2 text-sm text-[#EADDC3] has-checked:border-[#C9A96E] has-checked:bg-[#C9A96E1F] has-checked:text-[var(--text-bright)]'

function selectedCompanyLabel(companies: ScopeCompany[], id: string) {
  const company = companies.find(row => row.id === id)
  if (!company) return ''
  return `${company.companyCode ? `${company.companyCode} - ` : ''}${company.nameEn}`
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

function resetFormForNextEntry(
  setDescription: (v: string) => void,
  setLines: (v: FormLine[]) => void,
) {
  setDescription('')
  setLines([blankLine(), blankLine()])
}

export function JournalEntryForm({ open, onOpenChange, entry, fixedCompanyId, onSaved, onContinued }: Props) {
  const isReopeningCancelled = entry?.status === 'CANCELLED'
  const lastSavedEntryDateRef = useRef<string | null>(null)
  const lineFirstFieldRefs = useRef<(HTMLElement | null)[]>([])
  const pendingFocusLineIndex = useRef<number | null>(null)
  const [companies, setCompanies] = useState<ScopeCompany[]>([])
  const [entryDate, setEntryDate] = useState(todayYmd())
  const [companyId, setCompanyId] = useState('NONE')
  const [description, setDescription] = useState('')
  const [sourceType, setSourceType] = useState<'MANUAL' | 'CLOSING'>('MANUAL')
  const [lines, setLines] = useState<FormLine[]>([blankLine(), blankLine()])
  const [saving, setSaving] = useState(false)
  const [loadingScope, setLoadingScope] = useState(false)

  useEffect(() => {
    if (!open) return
    if (entry) {
      setEntryDate((entry.entryDate ?? entry.date).slice(0, 10))
    } else {
      setEntryDate(lastSavedEntryDateRef.current ?? todayYmd())
    }
    setCompanyId(entry?.companyId ?? fixedCompanyId ?? 'NONE')
    setDescription(entry?.description ?? '')
    setSourceType((entry?.sourceType === 'CLOSING' ? 'CLOSING' : 'MANUAL'))
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
    if (!open || fixedCompanyId) return
    setLoadingScope(true)
    fetch('/api/admin/financial/scope')
      .then(async res => {
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || '载入客户公司失败。')
        return data.companies || []
      })
      .then(companyRows => setCompanies(companyRows))
      .catch(err => toast.error(err instanceof Error ? err.message : '载入客户公司失败。'))
      .finally(() => setLoadingScope(false))
  }, [fixedCompanyId, open])

  useEffect(() => {
    if (!open || fixedCompanyId) return
    if (!entry && loadingScope) return
    if (companyId !== 'NONE' || companies.length !== 1) return
    setCompanyId(companies[0]!.id)
  }, [companies, companyId, entry, fixedCompanyId, loadingScope, open])

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

  const focusLineRow = useCallback((index: number) => {
    lineFirstFieldRefs.current[index]?.focus()
  }, [])

  const saveEntry = useCallback(
    async (options?: { continue?: boolean; print?: boolean }) => {
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
        const res = await fetch(
          entry ? `/api/admin/financial/journal-entries/${entry.id}` : '/api/admin/financial/journal-entries',
          {
            method: entry ? 'PATCH' : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ entryDate, companyId, description, sourceType, lines: payloadLines }),
          },
        )
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data.toast || data.error || '保存日记账失败。')

        lastSavedEntryDateRef.current = entryDate

        toast.success(
          data.toast ||
            (options?.continue ? '日记账已保存，可继续录入下一张。' : entry ? '日记账已更新。' : '日记账已创建。'),
        )

        const savedEntry = data.entry as JournalEntryForForm | undefined

        if (options?.continue) {
          onContinued?.()
          resetFormForNextEntry(setDescription, setLines)
          await onSaved(savedEntry, { print: false })
        } else {
          onOpenChange(false)
          await onSaved(savedEntry, { print: options?.print })
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : '保存日记账失败。')
      } finally {
        setSaving(false)
      }
    },
    [
      companyId,
      description,
      entry,
      entryDate,
      hasCompany,
      lines,
      onContinued,
      onOpenChange,
      onSaved,
      sourceType,
      totals.balanced,
    ],
  )

  const handleLineKeyDown = useCallback(
    (lineIndex: number, event: ReactKeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'ArrowUp') {
        event.preventDefault()
        if (lineIndex > 0) focusLineRow(lineIndex - 1)
        return
      }

      if (event.key === 'ArrowDown') {
        event.preventDefault()
        if (lineIndex < lines.length - 1) {
          focusLineRow(lineIndex + 1)
        } else {
          pendingFocusLineIndex.current = lines.length
          setLines(current => [...current, blankLine()])
        }
        return
      }

      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault()
        if (lineIndex < lines.length - 1) {
          focusLineRow(lineIndex + 1)
        } else if (!saving) {
          void saveEntry()
        }
      }
    },
    [focusLineRow, lines.length, saveEntry, saving],
  )

  const handleCreditKeyDown = useCallback(
    (lineIndex: number, event: ReactKeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Tab' && !event.shiftKey && lineIndex === lines.length - 1) {
        event.preventDefault()
        pendingFocusLineIndex.current = lines.length
        setLines(current => [...current, blankLine()])
        return
      }

      handleLineKeyDown(lineIndex, event)
    },
    [handleLineKeyDown, lines.length],
  )

  useEffect(() => {
    if (pendingFocusLineIndex.current === null) return
    const index = pendingFocusLineIndex.current
    pendingFocusLineIndex.current = null
    focusLineRow(index)
  }, [focusLineRow, lines.length])

  useEffect(() => {
    if (!open) return

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== 'F1') return
      event.preventDefault()
      if (saving) return
      void saveEntry({ continue: true })
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, saveEntry, saving])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await saveEntry()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={modalContentClassName}>
        <DialogHeader>
          <DialogTitle className="text-[var(--text-bright)]">
            {isReopeningCancelled ? '重新编辑已取消日记账' : entry ? '编辑日记账' : '新增日记账'}
          </DialogTitle>
          <DialogDescription className="text-[var(--text-dim)]">
            {isReopeningCancelled
              ? '保存后凭证将恢复为待过账，可继续审核并过账生成总账记录。'
              : '保存后状态为待过账，使用审核并过账生成总账记录。'}
            分录行内按 ↑/↓ 切换行（末行 ↓ 新增一行），Enter 确认并跳到下一行（末行 Enter 保存）。F1 保存并清空表单继续录入，日期保留为上一条分录日期。科目列通过树形弹窗选择，并支持编码或名称模糊搜索。
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" style={{ borderColor: '#f59e0b', color: '#f59e0b' }}>
              {isReopeningCancelled ? '状态：保存后恢复待过账' : '状态：待过账'}
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

          <div className="grid gap-4 sm:grid-cols-[180px_160px_minmax(260px,1fr)]">
            <div className="space-y-2">
              <Label className={labelClassName}>日期</Label>
              <DatePickerPopover
                value={entryDate}
                onChange={setEntryDate}
                className={`${fieldClassName} border`}
              />
            </div>
            <div className="space-y-2">
              <Label className={labelClassName}>分录类型</Label>
              <div className="grid gap-2">
                <label className={sourceTypeOptionClassName}>
                  <input
                    type="radio"
                    name="journal-source-type"
                    value="MANUAL"
                    checked={sourceType === 'MANUAL'}
                    onChange={() => setSourceType('MANUAL')}
                    className="accent-[#C9A96E]"
                  />
                  手工录入
                </label>
                <label className={sourceTypeOptionClassName}>
                  <input
                    type="radio"
                    name="journal-source-type"
                    value="CLOSING"
                    checked={sourceType === 'CLOSING'}
                    onChange={() => setSourceType('CLOSING')}
                    className="accent-[#C9A96E]"
                  />
                  期末结转
                </label>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="journal-description" className={labelClassName}>摘要</Label>
              <Textarea
                id="journal-description"
                value={description}
                onChange={event => setDescription(event.target.value)}
                required
                rows={2}
                className={`${fieldClassName} min-h-10`}
              />
            </div>
            {!fixedCompanyId ? (
              <div className="space-y-2 sm:col-span-2">
                <Label className={labelClassName}>客户公司</Label>
                <Select value={companyId} onValueChange={value => setCompanyId(value ?? 'NONE')}>
                  <SelectTrigger className={`w-full ${fieldClassName}`}>
                    <SelectValue placeholder={loadingScope ? '载入中...' : '选择公司'}>
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

          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-[var(--text-bright)]">分录明细</span>
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

          <div className="overflow-x-auto rounded-lg border border-[var(--border-subtle)] bg-[#0B0B08]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[220px]">行摘要</TableHead>
                  <TableHead className="min-w-[320px]">科目</TableHead>
                  <TableHead className="w-[160px] text-right">借方</TableHead>
                  <TableHead className="w-[160px] text-right">贷方</TableHead>
                  <TableHead className="w-[48px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {lines.map((line, index) => (
                  <TableRow key={index} className="align-middle">
                    <TableCell className={lineTableCellClassName}>
                      <Input
                        ref={el => {
                          lineFirstFieldRefs.current[index] = el
                        }}
                        value={line.description}
                        onChange={event => updateLine(index, { description: event.target.value })}
                        onKeyDown={event => handleLineKeyDown(index, event)}
                        placeholder="可选"
                        className={lineFieldClassName}
                      />
                    </TableCell>
                    <TableCell className={lineTableCellClassName}>
                      <AccountCombobox
                        value={line.accountId === 'NONE' ? '' : line.accountId}
                        companyId={fixedCompanyId ?? (companyId === 'NONE' ? '' : companyId)}
                        onChange={accountId => updateLine(index, { accountId: accountId || 'NONE' })}
                        inputClassName={lineFieldClassName}
                        disabled={!hasCompany}
                        onInputKeyDown={event => handleLineKeyDown(index, event)}
                        dialogMode
                        dialogTitle={`选择第 ${index + 1} 行科目`}
                      />
                    </TableCell>
                    <TableCell className={lineTableCellClassName}>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={line.debit}
                        onChange={event => updateLine(index, { debit: event.target.value, credit: event.target.value ? '' : line.credit })}
                        onKeyDown={event => handleLineKeyDown(index, event)}
                        className={`text-right ${lineFieldClassName}`}
                      />
                    </TableCell>
                    <TableCell className={lineTableCellClassName}>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={line.credit}
                        onChange={event => updateLine(index, { credit: event.target.value, debit: event.target.value ? '' : line.debit })}
                        onKeyDown={event => handleCreditKeyDown(index, event)}
                        className={`text-right ${lineFieldClassName}`}
                      />
                    </TableCell>
                    <TableCell className={lineTableCellClassName}>
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
            <Button
              type="button"
              variant="outline"
              disabled={!canSubmit}
              onClick={() => void saveEntry({ print: true })}
              className={secondaryButtonClassName}
            >
              <Printer size={14} />
              {saving ? '保存中...' : '保存并打印'}
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
