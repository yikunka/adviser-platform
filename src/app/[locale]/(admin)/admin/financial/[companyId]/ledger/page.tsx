'use client'

/* eslint-disable react-hooks/set-state-in-effect */

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { Download, ExternalLink, Search } from 'lucide-react'
import { Link } from '@/i18n/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { AccountType } from '@prisma/client'
import { ACCOUNT_TYPE_COLORS, ACCOUNT_TYPE_LABELS, ACCOUNT_TYPE_OPTIONS } from '@/lib/financial/account-types'
import { formatAccountOptionLabel } from '@/lib/financial/account-tree'
import { FinancialBreadcrumbs } from '@/components/admin/financial/FinancialBreadcrumbs'
import { useFinancialCompany } from '@/components/admin/financial/FinancialCompanyContext'

type LedgerEntry = {
  id: string
  accountId: string
  accountCode: string
  accountName: string
  accountType: string
  lineNum: number
  date: string
  voucherNo: string
  entryId: string | null
  description: string
  debit: number
  credit: number
  balance: number
  balanceDebit: number
  balanceCredit: number
}

type LedgerAccountGroup = {
  accountId: string
  accountCode: string
  accountName: string
  accountType: string
  openingBalance: number
  openingBalanceDebit: number
  openingBalanceCredit: number
  openingDate: string | null
  openingPeriod: string | null
  entries: LedgerEntry[]
  totalDebit: number
  totalCredit: number
}

type LedgerAccount = {
  id: string
  code: string
  name: string
  type: string
  parentId: string | null
  level: number
  sortOrder: number
}

function formatAccountTypeLabel(type: string) {
  const label = ACCOUNT_TYPE_LABELS[type as AccountType]
  return label ? `${type} ${label}` : type
}

export default function AdminFinancialLedgerPage() {
  const company = useFinancialCompany()
  const [ledgerAccounts, setLedgerAccounts] = useState<LedgerAccountGroup[]>([])
  const [accounts, setAccounts] = useState<LedgerAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [filterAccountType, setFilterAccountType] = useState('ALL')
  const [filterPeriod, setFilterPeriod] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [voucherNo, setVoucherNo] = useState('')
  const [level1AccountId, setLevel1AccountId] = useState('ALL')
  const [level2AccountId, setLevel2AccountId] = useState('ALL')
  const [level3AccountId, setLevel3AccountId] = useState('ALL')
  const [accountCodeSearch, setAccountCodeSearch] = useState('')
  const [codeSearchAccountIds, setCodeSearchAccountIds] = useState<string[] | null>(null)

  const sortAccounts = useCallback((items: LedgerAccount[]) => (
    items.slice().sort((a, b) => a.sortOrder - b.sortOrder || a.code.localeCompare(b.code, undefined, { numeric: true }))
  ), [])

  const childAccountsByParent = useMemo(() => {
    const groups = new Map<string | null, LedgerAccount[]>()
    for (const account of accounts) {
      groups.set(account.parentId, [...(groups.get(account.parentId) ?? []), account])
    }
    for (const [parentId, items] of groups) {
      groups.set(parentId, sortAccounts(items))
    }
    return groups
  }, [accounts, sortAccounts])

  const level1Accounts = useMemo(() => sortAccounts(accounts.filter(account => account.level === 1)), [accounts, sortAccounts])
  const level2Accounts = useMemo(
    () => level1AccountId === 'ALL' ? [] : childAccountsByParent.get(level1AccountId) ?? [],
    [childAccountsByParent, level1AccountId],
  )
  const level3Accounts = useMemo(
    () => level2AccountId === 'ALL' ? [] : childAccountsByParent.get(level2AccountId) ?? [],
    [childAccountsByParent, level2AccountId],
  )

  const collectAccountDescendantIds = useCallback((accountId: string) => {
    const ids = new Set<string>()
    const visit = (id: string) => {
      ids.add(id)
      for (const child of childAccountsByParent.get(id) ?? []) {
        visit(child.id)
      }
    }
    visit(accountId)
    return Array.from(ids)
  }, [childAccountsByParent])

  const selectedAccountIds = useMemo(() => {
    const selectedId = level3AccountId !== 'ALL'
      ? level3AccountId
      : level2AccountId !== 'ALL'
        ? level2AccountId
        : level1AccountId !== 'ALL'
          ? level1AccountId
          : null
    if (!selectedId) return []
    return collectAccountDescendantIds(selectedId)
  }, [collectAccountDescendantIds, level1AccountId, level2AccountId, level3AccountId])

  const effectiveAccountIds = codeSearchAccountIds ?? selectedAccountIds

  const formatAccountOption = useCallback((account: LedgerAccount) => formatAccountOptionLabel(account.code, account.name), [])

  const fetchAccounts = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/financial/accounts?companyId=${company.id}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '载入会计科目失败')
      setAccounts(data.accounts || [])
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '载入会计科目失败')
    }
  }, [company.id])

  const fetchLedgers = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ companyId: company.id })
      if (filterAccountType !== 'ALL') params.append('accountType', filterAccountType)
      if (filterPeriod) params.append('period', filterPeriod)
      if (startDate) params.append('startDate', startDate)
      if (endDate) params.append('endDate', endDate)
      if (effectiveAccountIds.length > 0) params.append('accountIds', effectiveAccountIds.join(','))
      if (voucherNo) params.append('voucherNo', voucherNo)
      const res = await fetch(`/api/admin/financial/ledgers?${params}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '载入总账失败')
      if (Array.isArray(data.ledgerAccounts)) {
        setLedgerAccounts(data.ledgerAccounts)
      } else {
        setLedgerAccounts(groupLedgerEntries(data.ledgers || []))
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '载入总账失败')
    } finally {
      setLoading(false)
    }
  }, [company.id, effectiveAccountIds, endDate, filterAccountType, filterPeriod, startDate, voucherNo])

  const searchByAccountCode = useCallback(() => {
    const code = accountCodeSearch.trim()
    if (!code) {
      toast.error('请输入科目号')
      return
    }

    const matches = accounts.filter(account => account.code === code)
    if (matches.length === 0) {
      toast.error(`未找到科目号「${code}」`)
      return
    }
    if (matches.length > 1) {
      toast.error(`科目号「${code}」存在多个匹配，请使用级联选择器`)
      return
    }

    const account = matches[0]
    const ancestors: LedgerAccount[] = []
    let current: LedgerAccount | undefined = account
    while (current?.parentId) {
      const parent = accounts.find(item => item.id === current?.parentId)
      if (!parent) break
      ancestors.unshift(parent)
      current = parent
    }

    setLevel1AccountId(ancestors[0]?.id ?? account.id)
    setLevel2AccountId(ancestors[1]?.id ?? (account.level === 2 ? account.id : 'ALL'))
    setLevel3AccountId(ancestors[2]?.id ?? (account.level === 3 ? account.id : 'ALL'))
    setCodeSearchAccountIds(collectAccountDescendantIds(account.id))
  }, [accountCodeSearch, accounts, collectAccountDescendantIds])

  function clearCodeSearchFilter() {
    setCodeSearchAccountIds(null)
  }

  useEffect(() => {
    fetchAccounts()
  }, [fetchAccounts])

  useEffect(() => {
    fetchLedgers()
  }, [fetchLedgers])

  function exportToCSV() {
    const headers = ['科目编码', '科目名称', '日期', '凭证号', '摘要', '借方', '贷方', '余额借方', '余额贷方']
    const rows = ledgerAccounts.flatMap(group => [
      [
        group.accountCode,
        `"${group.accountName.replace(/"/g, '""')}"`,
        openingDateLabel(group),
        '',
        '期初余额',
        '0.00',
        '0.00',
        group.openingBalanceDebit.toFixed(2),
        group.openingBalanceCredit.toFixed(2),
      ],
      ...group.entries.map(l => [
        group.accountCode,
        `"${group.accountName.replace(/"/g, '""')}"`,
        l.date,
        l.voucherNo,
        `"${l.description.replace(/"/g, '""')}"`,
        l.debit.toFixed(2),
        l.credit.toFixed(2),
        l.balanceDebit.toFixed(2),
        l.balanceCredit.toFixed(2),
      ]),
    ])
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `ledger_${company.companyCode ?? company.id}_${new Date().toISOString().split('T')[0]}.csv`
    link.click()
  }

  return (
    <div className="p-6 space-y-6">
      <div className="space-y-2">
        <FinancialBreadcrumbs section="总分类账" />
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>
              总分类账
            </h1>
            <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
              {company.nameEn} · 按科目分组查看交易流水和余额。
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={exportToCSV}
            style={{ borderColor: 'var(--border-subtle)', color: 'var(--foreground)' }}
          >
            <Download size={15} className="mr-2" /> 导出 CSV
          </Button>
        </div>
      </div>

      <Card className="rounded-lg border-[var(--border-subtle)] bg-card">
        <CardHeader className="pb-4">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="flex flex-wrap items-end gap-3">
              <Select value={filterAccountType} onValueChange={value => setFilterAccountType(value ?? 'ALL')}>
                <SelectTrigger className="w-[180px]" style={{ background: 'var(--surface-input)', border: '1px solid var(--border-subtle)' }}>
                  <SelectValue placeholder="全部科目" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">全部科目</SelectItem>
                  {ACCOUNT_TYPE_OPTIONS.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {ACCOUNT_TYPE_LABELS[option.value] ?? option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                type="month"
                value={filterPeriod}
                onChange={e => setFilterPeriod(e.target.value)}
                className="w-[150px]"
                aria-label="期间"
                style={{ background: 'var(--surface-input)', border: '1px solid var(--border-subtle)' }}
              />
              <Input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="w-[150px]"
                aria-label="开始日期"
                style={{ background: 'var(--surface-input)', border: '1px solid var(--border-subtle)' }}
              />
              <Input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="w-[150px]"
                aria-label="结束日期"
                style={{ background: 'var(--surface-input)', border: '1px solid var(--border-subtle)' }}
              />
              <Input
                value={voucherNo}
                onChange={e => setVoucherNo(e.target.value)}
                placeholder="凭证号"
                className="w-[150px]"
                style={{ background: 'var(--surface-input)', border: '1px solid var(--border-subtle)' }}
              />
              <Button size="sm" onClick={fetchLedgers} style={{ background: '#C9A96E', color: '#0A0805' }}>
                筛选
              </Button>
            </div>

            <div className="ml-auto flex flex-col items-end gap-3">
              <div className="flex flex-wrap items-end gap-3">
              <Select
                value={level1AccountId}
                onValueChange={value => {
                  clearCodeSearchFilter()
                  setLevel1AccountId(value ?? 'ALL')
                  setLevel2AccountId('ALL')
                  setLevel3AccountId('ALL')
                }}
              >
                <SelectTrigger className="w-[190px]" style={{ background: 'var(--surface-input)', border: '1px solid var(--border-subtle)' }}>
                  <SelectValue placeholder="一级科目">
                    {selectedAccountLabel(accounts, level1AccountId, '全部一级科目')}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">全部一级科目</SelectItem>
                  {level1Accounts.map(account => (
                    <SelectItem key={account.id} value={account.id} label={formatAccountOption(account)}>
                      {formatAccountOption(account)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={level2AccountId}
                onValueChange={value => {
                  clearCodeSearchFilter()
                  setLevel2AccountId(value ?? 'ALL')
                  setLevel3AccountId('ALL')
                }}
                disabled={level1AccountId === 'ALL' || level2Accounts.length === 0}
              >
                <SelectTrigger className="w-[190px]" style={{ background: 'var(--surface-input)', border: '1px solid var(--border-subtle)' }}>
                  <SelectValue placeholder="二级科目">
                    {selectedAccountLabel(accounts, level2AccountId, '全部二级科目')}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">全部二级科目</SelectItem>
                  {level2Accounts.map(account => (
                    <SelectItem key={account.id} value={account.id} label={formatAccountOption(account)}>
                      {formatAccountOption(account)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={level3AccountId}
                onValueChange={value => {
                  clearCodeSearchFilter()
                  setLevel3AccountId(value ?? 'ALL')
                }}
                disabled={level2AccountId === 'ALL' || level3Accounts.length === 0}
              >
                <SelectTrigger className="w-[190px]" style={{ background: 'var(--surface-input)', border: '1px solid var(--border-subtle)' }}>
                  <SelectValue placeholder="三级科目">
                    {selectedAccountLabel(accounts, level3AccountId, '全部三级科目')}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">全部三级科目</SelectItem>
                  {level3Accounts.map(account => (
                    <SelectItem key={account.id} value={account.id} label={formatAccountOption(account)}>
                      {formatAccountOption(account)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              </div>
              <div className="flex items-end gap-2">
                <Input
                  value={accountCodeSearch}
                  onChange={e => setAccountCodeSearch(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      searchByAccountCode()
                    }
                  }}
                  placeholder="输入科目号，如 1001"
                  className="w-[190px]"
                  aria-label="科目号搜索"
                  style={{ background: 'var(--surface-input)', border: '1px solid var(--border-subtle)' }}
                />
                <Button
                  size="sm"
                  onClick={searchByAccountCode}
                  style={{ background: '#C9A96E', color: '#0A0805' }}
                >
                  <Search size={15} className="mr-1.5" />
                  搜索科目
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="p-8 text-center" style={{ color: 'var(--muted-foreground)' }}>
              载入中...
            </div>
          ) : ledgerAccounts.length === 0 ? (
            <div className="p-8 text-center" style={{ color: '#5A5040' }}>
              暂无总账记录
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>日期</TableHead>
                  <TableHead>凭证号</TableHead>
                  <TableHead>摘要</TableHead>
                  <TableHead>借方</TableHead>
                  <TableHead>贷方</TableHead>
                  <TableHead className="text-right">余额借方</TableHead>
                  <TableHead className="text-right">余额贷方</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ledgerAccounts.map(group => (
                  <Fragment key={group.accountId}>
                    <TableRow className="bg-[var(--surface-footer)] hover:bg-[var(--surface-footer)]">
                      <TableCell colSpan={7}>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <span className="font-mono text-sm text-[#C9A96E]">{group.accountCode}</span>
                            <span className="font-semibold">{group.accountName}</span>
                            {group.accountType ? (
                              <span
                                className="inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium"
                                style={{
                                  color: ACCOUNT_TYPE_COLORS[group.accountType as AccountType] ?? 'var(--muted-foreground)',
                                  background: `${ACCOUNT_TYPE_COLORS[group.accountType as AccountType] ?? '#888888'}20`,
                                }}
                              >
                                {formatAccountTypeLabel(group.accountType)}
                              </span>
                            ) : null}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            本期借方 {formatMoney(group.totalDebit)}
                            {' · '}
                            本期贷方 {formatMoney(group.totalCredit)}
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                    <TableRow className="bg-[var(--surface-input)]">
                      <TableCell className="text-muted-foreground">{openingDateLabel(group) || '-'}</TableCell>
                      <TableCell className="text-muted-foreground">-</TableCell>
                      <TableCell className="font-medium text-[#C9A96E]">期初余额</TableCell>
                      <TableCell className="text-right font-mono">0.00</TableCell>
                      <TableCell className="text-right font-mono">0.00</TableCell>
                      <TableCell className="text-right font-mono">{formatMoney(group.openingBalanceDebit)}</TableCell>
                      <TableCell className="text-right font-mono">{formatMoney(group.openingBalanceCredit)}</TableCell>
                    </TableRow>
                    {group.entries.map((entry, idx) => (
                      <TableRow key={entry.id} style={{ background: idx % 2 === 0 ? 'transparent' : 'var(--surface-input)' }}>
                        <TableCell>{new Date(entry.date).toLocaleDateString('zh-HK')}</TableCell>
                        <TableCell className="font-mono">
                          <div className="flex items-center gap-1">
                            <span>{entry.voucherNo}</span>
                            {entry.entryId ? (
                              <Link
                                href={`/admin/financial/${company.id}/journal?entryId=${entry.entryId}`}
                                className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                                title="查看会计凭证"
                                aria-label={`查看凭证 ${entry.voucherNo}`}
                              >
                                <ExternalLink size={13} />
                              </Link>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell className="max-w-[260px] truncate">{entry.description}</TableCell>
                        <TableCell className="text-right">
                          {formatMoney(entry.debit)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatMoney(entry.credit)}
                        </TableCell>
                        <TableCell className="text-right font-medium">{formatMoney(entry.balanceDebit)}</TableCell>
                        <TableCell className="text-right font-medium">{formatMoney(entry.balanceCredit)}</TableCell>
                      </TableRow>
                    ))}
                  </Fragment>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function formatMoney(value: number) {
  return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function openingDateLabel(group: LedgerAccountGroup) {
  if (group.openingDate) return new Date(group.openingDate).toLocaleDateString('zh-HK')
  return group.openingPeriod ?? ''
}

function selectedAccountLabel(accounts: LedgerAccount[], accountId: string, allLabel: string) {
  if (accountId === 'ALL') return allLabel
  const account = accounts.find(item => item.id === accountId)
  return account ? formatAccountOptionLabel(account.code, account.name) : '未知科目'
}

function groupLedgerEntries(entries: LedgerEntry[]): LedgerAccountGroup[] {
  const sorted = entries.slice().sort((a, b) => (
    a.accountCode.localeCompare(b.accountCode, undefined, { numeric: true })
    || new Date(a.date).getTime() - new Date(b.date).getTime()
    || a.voucherNo.localeCompare(b.voucherNo, undefined, { numeric: true })
    || a.lineNum - b.lineNum
  ))

  return sorted.reduce<LedgerAccountGroup[]>((groups, entry) => {
    const current = groups[groups.length - 1]
    if (current && current.accountId === entry.accountId) {
      current.entries.push(entry)
      current.totalDebit += entry.debit
      current.totalCredit += entry.credit
      return groups
    }

    groups.push({
      accountId: entry.accountId,
      accountCode: entry.accountCode,
      accountName: entry.accountName,
      accountType: entry.accountType,
      openingBalance: 0,
      openingBalanceDebit: 0,
      openingBalanceCredit: 0,
      openingDate: null,
      openingPeriod: null,
      entries: [entry],
      totalDebit: entry.debit,
      totalCredit: entry.credit,
    })
    return groups
  }, [])
}
