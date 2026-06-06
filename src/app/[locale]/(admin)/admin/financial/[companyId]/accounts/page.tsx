'use client'

/* eslint-disable react-hooks/set-state-in-effect */

import { useCallback, useEffect, useState } from 'react'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { AccountFormDialog, type FinancialAccount } from '@/components/admin/financial/AccountFormDialog'
import { ACCOUNT_TYPE_COLORS, ACCOUNT_TYPE_LABELS } from '@/lib/financial/account-types'
import { FinancialBreadcrumbs } from '@/components/admin/financial/FinancialBreadcrumbs'
import { useFinancialCompany } from '@/components/admin/financial/FinancialCompanyContext'

export default function AdminFinancialAccountsPage() {
  const company = useFinancialCompany()
  const [accounts, setAccounts] = useState<FinancialAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingAccount, setEditingAccount] = useState<FinancialAccount | null>(null)
  const pageSize = 10

  const fetchAccounts = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/financial/accounts?companyId=${company.id}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to fetch accounts')
      setAccounts(data.accounts || [])
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '载入会计科目失败')
    } finally {
      setLoading(false)
    }
  }, [company.id])

  useEffect(() => {
    fetchAccounts()
  }, [fetchAccounts])

  function openCreateDialog() {
    setEditingAccount(null)
    setDialogOpen(true)
  }

  function openEditDialog(account: FinancialAccount) {
    setEditingAccount(account)
    setDialogOpen(true)
  }

  async function deleteAccount(account: FinancialAccount) {
    if (!confirm(`确定删除科目 ${account.code} - ${account.name}？`)) return

    try {
      const res = await fetch(`/api/admin/financial/accounts/${account.id}`, { method: 'DELETE' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.toast || data.error || '删除科目失败')
      toast.success(data.toast || '科目已删除。')
      await fetchAccounts()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '删除科目失败')
    }
  }

  const filtered = accounts.filter(
    a =>
      a.code.toLowerCase().includes(search.toLowerCase()) ||
      a.name.toLowerCase().includes(search.toLowerCase()),
  )

  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize)
  const totalPages = Math.ceil(filtered.length / pageSize)
  const formatBalance = (value: number | null | undefined) =>
    Number(value ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  return (
    <div className="p-6 space-y-6">
      <div className="space-y-2">
        <FinancialBreadcrumbs section="会计科目" />
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>
              会计科目
            </h1>
            <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
              {company.nameEn} · 管理会计科目和层级结构。
            </p>
          </div>
          <Button size="sm" onClick={openCreateDialog} style={{ background: '#C9A96E', color: '#0A0805' }}>
            <Plus size={15} className="mr-2" /> 新增科目
          </Button>
        </div>
      </div>

      <Card className="rounded-lg border-[#2A2418] bg-card">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-4">
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="按编码或名称搜索..."
              className="max-w-sm"
              style={{ background: '#0E0E0A', border: '1px solid #2A2418' }}
            />
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="p-8 text-center" style={{ color: 'var(--muted-foreground)' }}>
              载入中...
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center" style={{ color: '#5A5040' }}>
              暂无会计科目
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>编码</TableHead>
                    <TableHead>名称</TableHead>
                    <TableHead>类型</TableHead>
                    <TableHead>层级</TableHead>
                    <TableHead className="text-right">期初余额</TableHead>
                    <TableHead className="text-right">本年借方累计</TableHead>
                    <TableHead className="text-right">本年贷方累计</TableHead>
                    <TableHead className="text-right">本年累计余额</TableHead>
                    <TableHead>排序</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginated.map(account => (
                    <TableRow key={account.id}>
                      <TableCell className="font-mono">{account.code}</TableCell>
                      <TableCell>{account.name}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          style={{
                            borderColor: ACCOUNT_TYPE_COLORS[account.type],
                            color: ACCOUNT_TYPE_COLORS[account.type],
                          }}
                        >
                          {ACCOUNT_TYPE_LABELS[account.type]}
                        </Badge>
                      </TableCell>
                      <TableCell>{account.level}</TableCell>
                      <TableCell className="text-right font-mono">
                        {formatBalance(account.openingBalanceTotal ?? account.openingBalance)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatBalance(account.yearToDateDebitTotal ?? account.yearToDateDebit)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatBalance(account.yearToDateCreditTotal ?? account.yearToDateCredit)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatBalance(account.yearToDateBalanceTotal ?? account.yearToDateBalance)}
                      </TableCell>
                      <TableCell>{account.sortOrder}</TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => openEditDialog(account)}
                        >
                          <Pencil size={15} className="text-muted-foreground" />
                        </Button>
                        {!account.isSystem && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 hover:text-red-500"
                            onClick={() => deleteAccount(account)}
                          >
                            <Trash2 size={15} />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <div className="flex items-center justify-between mt-4 px-2">
                <div className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                  显示第 {(page - 1) * pageSize + 1} 至 {Math.min(page * pageSize, filtered.length)} 项，共{' '}
                  {filtered.length} 个科目
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    style={{ borderColor: '#2A2418' }}
                  >
                    上一页
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    style={{ borderColor: '#2A2418' }}
                  >
                    下一页
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <AccountFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        account={editingAccount}
        companyId={company.id}
        accounts={accounts}
        onSaved={fetchAccounts}
      />
    </div>
  )
}
