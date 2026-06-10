'use client'

/* eslint-disable react-hooks/set-state-in-effect */

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { Download } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ACCOUNT_TYPE_OPTIONS } from '@/lib/financial/account-types'
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

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  ASSET: '流动资产',
  NON_CURRENT_ASSET: '长期资产',
  LIABILITY: '流动负债',
  NON_CURRENT_LIABILITY: '长期负债',
  EQUITY: '权益',
  REVENUE: '收入',
  CGS: '销售成本',
  EXPENSE: '费用',
  CURRENT_ACCOUNT: '往来科目',
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

  const selectedAccountIds = useMemo(() => {
    const selectedId = level3AccountId !== 'ALL'
      ? level3AccountId
      : level2AccountId !== 'ALL'
        ? level2AccountId
        : level1AccountId !== 'ALL'
          ? level1AccountId
          : null
    if (!selectedId) return []

    const ids = new Set<string>()
    const visit = (accountId: string) => {
      ids.add(accountId)
      for (const child of childAccountsByParent.get(accountId) ?? []) {
        visit(child.id)
      }
    }
    visit(selectedId)
    return Array.from(ids)
  }, [childAccountsByParent, level1AccountId, level2AccountId, level3AccountId])

  const formatAccountOption = useCallback((account: LedgerAccount) => `${account.code} - ${account.name}`, [])

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
      if (selectedAccountIds.length > 0) params.append('accountIds', selectedAccountIds.join(','))
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
  }, [company.id, endDate, filterAccountType, filterPeriod, selectedAccountIds, startDate, voucherNo])

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
            style={{ borderColor: '#2A2418', color: 'var(--foreground)' }}
          >
            <Download size={15} className="mr-2" /> 导出 CSV
          </Button>
        </div>
      </div>

      <Card className="rounded-lg border-[#2A2418] bg-card">
        <CardHeader className="pb-4">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="flex flex-wrap items-end gap-3">
              <Select value={filterAccountType} onValueChange={value => setFilterAccountType(value ?? 'ALL')}>
                <SelectTrigger className="w-[180px]" style={{ background: '#0E0E0A', border: '1px solid #2A2418' }}>
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
                style={{ background: '#0E0E0A', border: '1px solid #2A2418' }}
              />
              <Input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="w-[150px]"
                aria-label="开始日期"
                style={{ background: '#0E0E0A', border: '1px solid #2A2418' }}
              />
              <Input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="w-[150px]"
                aria-label="结束日期"
                style={{ background: '#0E0E0A', border: '1px solid #2A2418' }}
              />
              <Input
                value={voucherNo}
                onChange={e => setVoucherNo(e.target.value)}
                placeholder="凭证号"
                className="w-[150px]"
                style={{ background: '#0E0E0A', border: '1px solid #2A2418' }}
              />
              <Button size="sm" onClick={fetchLedgers} style={{ background: '#C9A96E', color: '#0A0805' }}>
                筛选
              </Button>
            </div>

            <div className="ml-auto flex flex-wrap items-end gap-3">
              <Select
                value={level1AccountId}
                onValueChange={value => {
                  setLevel1AccountId(value ?? 'ALL')
                  setLevel2AccountId('ALL')
                  setLevel3AccountId('ALL')
                }}
              >
                <SelectTrigger className="w-[190px]" style={{ background: '#0E0E0A', border: '1px solid #2A2418' }}>
                  <SelectValue placeholder="一级科目" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">全部一级科目</SelectItem>
                  {level1Accounts.map(account => (
                    <SelectItem key={account.id} value={account.id}>
                      {formatAccountOption(account)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={level2AccountId}
                onValueChange={value => {
                  setLevel2AccountId(value ?? 'ALL')
                  setLevel3AccountId('ALL')
                }}
                disabled={level1AccountId === 'ALL' || level2Accounts.length === 0}
              >
                <SelectTrigger className="w-[190px]" style={{ background: '#0E0E0A', border: '1px solid #2A2418' }}>
                  <SelectValue placeholder="二级科目" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">全部二级科目</SelectItem>
                  {level2Accounts.map(account => (
                    <SelectItem key={account.id} value={account.id}>
                      {formatAccountOption(account)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={level3AccountId}
                onValueChange={value => setLevel3AccountId(value ?? 'ALL')}
                disabled={level2AccountId === 'ALL' || level3Accounts.length === 0}
              >
                <SelectTrigger className="w-[190px]" style={{ background: '#0E0E0A', border: '1px solid #2A2418' }}>
                  <SelectValue placeholder="三级科目" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">全部三级科目</SelectItem>
                  {level3Accounts.map(account => (
                    <SelectItem key={account.id} value={account.id}>
                      {formatAccountOption(account)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
                    <TableRow className="bg-[#16130E] hover:bg-[#16130E]">
                      <TableCell colSpan={7}>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <span className="font-mono text-sm text-[#C9A96E]">{group.accountCode}</span>
                            <span className="ml-2 font-semibold">{group.accountName}</span>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            本期借方 {formatMoney(group.totalDebit)}
                            {' · '}
                            本期贷方 {formatMoney(group.totalCredit)}
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                    <TableRow className="bg-[#0E0E0A]">
                      <TableCell className="text-muted-foreground">{openingDateLabel(group) || '-'}</TableCell>
                      <TableCell className="text-muted-foreground">-</TableCell>
                      <TableCell className="font-medium text-[#C9A96E]">期初余额</TableCell>
                      <TableCell className="text-right font-mono">0.00</TableCell>
                      <TableCell className="text-right font-mono">0.00</TableCell>
                      <TableCell className="text-right font-mono">{formatMoney(group.openingBalanceDebit)}</TableCell>
                      <TableCell className="text-right font-mono">{formatMoney(group.openingBalanceCredit)}</TableCell>
                    </TableRow>
                    {group.entries.map((entry, idx) => (
                      <TableRow key={entry.id} style={{ background: idx % 2 === 0 ? 'transparent' : '#0E0E0A' }}>
                        <TableCell>{new Date(entry.date).toLocaleDateString('zh-HK')}</TableCell>
                        <TableCell className="font-mono">{entry.voucherNo}</TableCell>
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
