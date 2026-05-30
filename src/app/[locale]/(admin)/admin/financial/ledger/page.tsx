'use client'

/* eslint-disable react-hooks/set-state-in-effect */

import { useCallback, useEffect, useState } from 'react'
import { Download } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ACCOUNT_TYPE_OPTIONS } from '@/lib/financial/account-types'
import { Link } from '@/i18n/navigation'

type LedgerEntry = {
  id: string
  accountCode: string
  accountName: string
  company?: { id: string; nameEn: string; companyCode: string | null } | null
  group?: { id: string; name: string } | null
  date: string
  voucherNo: string
  description: string
  debit: number
  credit: number
  balance: number
}

type ScopeCompany = {
  id: string
  nameEn: string
  companyCode: string | null
  groupId: string | null
}

export default function AdminFinancialLedgerPage() {
  const [ledgers, setLedgers] = useState<LedgerEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [filterAccountType, setFilterAccountType] = useState('ALL')
  const [filterPeriod, setFilterPeriod] = useState('')
  const [filterGroupId, setFilterGroupId] = useState('ALL')
  const [filterCompanyId, setFilterCompanyId] = useState('ALL')
  const [groups, setGroups] = useState<{ id: string; name: string }[]>([])
  const [companies, setCompanies] = useState<ScopeCompany[]>([])
  const [voucherNo, setVoucherNo] = useState('')

  const fetchLedgers = useCallback(async () => {
    setLoading(true)
    try {
      let url = '/api/admin/financial/ledgers'
      const params = new URLSearchParams()
      if (filterAccountType !== 'ALL') params.append('accountType', filterAccountType)
      if (filterPeriod) params.append('period', filterPeriod)
      if (filterGroupId !== 'ALL') params.append('groupId', filterGroupId)
      if (filterCompanyId !== 'ALL') params.append('companyId', filterCompanyId)
      if (voucherNo) params.append('voucherNo', voucherNo)
      if (params.toString()) url += '?' + params.toString()
      
      const res = await fetch(url)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to fetch ledgers')
      setLedgers(data.ledgers || [])
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load ledger entries')
    } finally {
      setLoading(false)
    }
  }, [filterAccountType, filterPeriod, filterGroupId, filterCompanyId, voucherNo])

  useEffect(() => {
    fetchLedgers()
  }, [fetchLedgers])

  useEffect(() => {
    fetch('/api/admin/financial/scope')
      .then(async res => {
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Failed to load financial scope')
        setGroups(data.groups || [])
        setCompanies(data.companies || [])
      })
      .catch(error => toast.error(error instanceof Error ? error.message : 'Failed to load financial scope'))
  }, [])

  const companyOptions = filterGroupId === 'ALL'
    ? companies
    : companies.filter(company => company.groupId === filterGroupId)

  function exportToCSV() {
    const headers = ['Date', 'Voucher No', 'Description', 'Debit', 'Credit', 'Balance']
    const rows = ledgers.map(l => [
      l.date,
      l.voucherNo,
      `"${l.description.replace(/"/g, '""')}"`,
      l.debit.toFixed(2),
      l.credit.toFixed(2),
      l.balance.toFixed(2)
    ])
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `ledger_${new Date().toISOString().split('T')[0]}.csv`
    link.click()
  }

  return (
    <div className="p-6 space-y-6">
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-xs" style={{ color: '#7A7060' }}>
          <Link href="/admin/dashboard" className="hover:text-[#C9A96E]">Dashboard</Link>
          <span>/</span>
          <Link href="/admin/financial" className="hover:text-[#C9A96E]">Financial Accounting</Link>
          <span>/</span>
          <span style={{ color: 'var(--muted-foreground)' }}>General Ledger</span>
        </div>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>General Ledger</h1>
            <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>View detailed account activity with running balances.</p>
          </div>
          <Button variant="outline" size="sm" onClick={exportToCSV} style={{ borderColor: '#2A2418', color: 'var(--foreground)' }}>
            <Download size={15} className="mr-2" /> Export CSV
          </Button>
        </div>
      </div>

      <Card className="rounded-lg border-[#2A2418] bg-card">
        <CardHeader className="pb-4">
          <div className="flex flex-wrap items-center gap-4">
            <Select value={filterAccountType} onValueChange={value => setFilterAccountType(value ?? 'ALL')}>
              <SelectTrigger className="w-[180px]" style={{ background: '#0E0E0A', border: '1px solid #2A2418' }}>
                <SelectValue placeholder="All Accounts" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Accounts</SelectItem>
                {ACCOUNT_TYPE_OPTIONS.map(option => (
                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="month"
              value={filterPeriod}
              onChange={e => setFilterPeriod(e.target.value)}
              className="max-w-[160px]"
              style={{ background: '#0E0E0A', border: '1px solid #2A2418' }}
            />
            <Select
              value={filterGroupId}
              onValueChange={value => {
                setFilterGroupId(value ?? 'ALL')
                setFilterCompanyId('ALL')
              }}
            >
              <SelectTrigger className="w-[190px]" style={{ background: '#0E0E0A', border: '1px solid #2A2418' }}>
                <SelectValue placeholder="Entity Group" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Groups</SelectItem>
                {groups.map(group => (
                  <SelectItem key={group.id} value={group.id}>{group.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterCompanyId} onValueChange={value => setFilterCompanyId(value ?? 'ALL')}>
              <SelectTrigger className="w-[220px]" style={{ background: '#0E0E0A', border: '1px solid #2A2418' }}>
                <SelectValue placeholder="Client Company" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Companies</SelectItem>
                {companyOptions.map(company => (
                  <SelectItem key={company.id} value={company.id}>
                    {company.companyCode ? `${company.companyCode} - ` : ''}{company.nameEn}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              value={voucherNo}
              onChange={e => setVoucherNo(e.target.value)}
              placeholder="Voucher No"
              className="max-w-[160px]"
              style={{ background: '#0E0E0A', border: '1px solid #2A2418' }}
            />
            <Button size="sm" onClick={fetchLedgers} style={{ background: '#C9A96E', color: '#0A0805' }}>
              Filter
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="p-8 text-center" style={{ color: 'var(--muted-foreground)' }}>Loading...</div>
          ) : ledgers.length === 0 ? (
            <div className="p-8 text-center" style={{ color: '#5A5040' }}>No ledger entries found</div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Voucher No</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Debit</TableHead>
                    <TableHead>Credit</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ledgers.map((entry, idx) => (
                    <TableRow key={entry.id} style={{ background: idx % 2 === 0 ? 'transparent' : '#0E0E0A' }}>
                      <TableCell>{new Date(entry.date).toLocaleDateString()}</TableCell>
                      <TableCell className="font-mono">{entry.voucherNo}</TableCell>
                      <TableCell className="max-w-[180px]">
                        <div className="truncate">{entry.company?.nameEn ?? 'Unassigned'}</div>
                        {entry.company?.companyCode ? (
                          <div className="text-xs text-muted-foreground">{entry.company.companyCode}</div>
                        ) : null}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">{entry.description}</TableCell>
                      <TableCell className="text-right">{entry.debit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                      <TableCell className="text-right">{entry.credit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                      <TableCell className="text-right font-medium" style={{ color: entry.balance >= 0 ? 'var(--foreground)' : '#ef4444' }}>
                        {entry.balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
