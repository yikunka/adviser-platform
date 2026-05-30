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
  groupId: string | null
  group?: { id: string; name: string } | null
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
  return `${company.companyCode ? `${company.companyCode} - ` : ''}${company.nameEn}${company.group?.name ? ` · ${company.group.name}` : ''}`
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

export function JournalEntryForm({ open, onOpenChange, entry, onSaved }: Props) {
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
    setCompanyId(entry?.companyId ?? 'NONE')
    setDescription(entry?.description ?? '')
    setLines(entry?.lines?.length
      ? entry.lines.map(line => ({
          accountId: line.accountId,
          description: line.description ?? '',
          debit: line.debit ? String(line.debit) : '',
          credit: line.credit ? String(line.credit) : '',
        }))
      : [blankLine(), blankLine()])
  }, [entry, open])

  useEffect(() => {
    if (!open) return
    setLoadingAccounts(true)
    Promise.all([
      fetch('/api/admin/financial/accounts').then(async res => {
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Failed to load accounts.')
        return data.accounts || []
      }),
      fetch('/api/admin/financial/scope').then(async res => {
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Failed to load companies.')
        return data.companies || []
      }),
    ])
      .then(([accountRows, companyRows]) => {
        setAccounts(accountRows)
        setCompanies(companyRows)
      })
      .catch(err => toast.error(err instanceof Error ? err.message : 'Failed to load accounts.'))
      .finally(() => setLoadingAccounts(false))
  }, [open])

  useEffect(() => {
    if (!open || entry || loadingAccounts || companyId !== 'NONE' || companies.length !== 1) return
    setCompanyId(companies[0]!.id)
  }, [companies, companyId, entry, loadingAccounts, open])

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
    ? 'Select a client company before saving.'
    : !totals.balanced
      ? 'Total debit must equal total credit before saving.'
      : ''

  function updateLine(index: number, patch: Partial<FormLine>) {
    setLines(current => current.map((line, lineIndex) => (lineIndex === index ? { ...line, ...patch } : line)))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!description.trim()) {
      toast.error('Description is required.')
      return
    }
    if (!hasCompany) {
      toast.error('Please select the client company before saving this journal entry.')
      return
    }
    if (!totals.balanced) {
      toast.error('Total debit must equal total credit.')
      return
    }

    const payloadLines = lines.map(line => ({
      accountId: line.accountId === 'NONE' ? '' : line.accountId,
      description: line.description,
      debit: numeric(line.debit),
      credit: numeric(line.credit),
    }))

    if (payloadLines.some(line => !line.accountId)) {
      toast.error('Select an account for every line.')
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
      if (!res.ok) throw new Error(data.toast || data.error || 'Failed to save journal entry.')

      toast.success(data.toast || (entry ? 'Journal entry updated.' : 'Journal entry created.'))
      onOpenChange(false)
      await onSaved()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save journal entry.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={modalContentClassName}>
        <DialogHeader>
          <DialogTitle className="text-[#FFF7E6]">{entry ? 'Edit Journal Entry' : 'New Journal Entry'}</DialogTitle>
          <DialogDescription className="text-[#B8AD98]">
            Entries are saved as Pending. Use Approve & Post to create ledger entries.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" style={{ borderColor: '#f59e0b', color: '#f59e0b' }}>
              Status: Pending
            </Badge>
            {!hasCompany && (
              <Badge variant="outline" style={{ borderColor: '#f59e0b', color: '#f59e0b' }}>
                Company required
              </Badge>
            )}
            {!totals.balanced && (
              <Badge variant="outline" style={{ borderColor: '#f59e0b', color: '#f59e0b' }}>
                Debit/Credit not balanced
              </Badge>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-[180px_minmax(220px,1fr)]">
            <div className="space-y-2">
              <Label className={labelClassName}>Date</Label>
              <DatePickerPopover
                value={entryDate}
                onChange={setEntryDate}
                className={`${fieldClassName} border`}
              />
            </div>
            <div className="space-y-2">
              <Label className={labelClassName}>Client Company</Label>
              <Select value={companyId} onValueChange={value => setCompanyId(value ?? 'NONE')}>
                <SelectTrigger className={`w-full ${fieldClassName}`}>
                  <SelectValue placeholder={loadingAccounts ? 'Loading...' : 'Select company'}>
                    {companyId !== 'NONE' ? selectedCompanyLabel(companies, companyId) : undefined}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className={selectContentClassName}>
                  <SelectItem value="NONE">Select company</SelectItem>
                  {companies.map(company => (
                    <SelectItem key={company.id} value={company.id}>
                      {company.companyCode ? `${company.companyCode} - ` : ''}{company.nameEn}
                      {company.group?.name ? ` · ${company.group.name}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {companies.length === 0 ? (
                <p className={warningTextClassName}>No accessible client companies. Create or assign a company before posting journals.</p>
              ) : companyId === 'NONE' ? (
                <p className={warningTextClassName}>Required. Financial reports and ledgers are scoped by company.</p>
              ) : null}
            </div>
          </div>
          <div className="space-y-2">
            <div className="space-y-2">
              <Label htmlFor="journal-description" className={labelClassName}>Description</Label>
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
              <span className="text-sm font-medium text-[#FFF7E6]">Line Items</span>
              {!totals.balanced && (
                <Badge variant="outline" style={{ borderColor: '#f59e0b', color: '#f59e0b' }}>
                  Difference: {(totals.debit - totals.credit).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
              Add Line
            </Button>
          </div>

          <div className="overflow-x-auto rounded-lg border border-[#2A2418] bg-[#0B0B08]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[260px]">Account</TableHead>
                  <TableHead className="min-w-[220px]">Line Description</TableHead>
                  <TableHead className="w-[140px] text-right">Debit</TableHead>
                  <TableHead className="w-[140px] text-right">Credit</TableHead>
                  <TableHead className="w-[48px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {lines.map((line, index) => (
                  <TableRow key={index}>
                    <TableCell>
                      <Select value={line.accountId} onValueChange={value => updateLine(index, { accountId: value ?? 'NONE' })}>
                        <SelectTrigger className={`w-full ${fieldClassName}`}>
                          <SelectValue placeholder={loadingAccounts ? 'Loading...' : 'Account'}>
                            {line.accountId !== 'NONE' ? selectedAccountLabel(accounts, line.accountId) : undefined}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent className={selectContentClassName}>
                          <SelectItem value="NONE">Select account</SelectItem>
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
                        placeholder="Optional"
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
                        aria-label="Remove line"
                      >
                        <Trash2 size={14} />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow>
                  <TableCell colSpan={2} className="text-right font-medium">Totals</TableCell>
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
              Cancel
            </Button>
            <Button type="submit" disabled={!canSubmit} style={{ background: '#C9A96E', color: '#0A0805' }}>
              <Save size={14} />
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
