'use client'

import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { AccountFormDialog, type FinancialAccount } from '@/components/admin/financial/AccountFormDialog'
import { ACCOUNT_TYPE_COLORS } from '@/lib/financial/account-types'
import { Link } from '@/i18n/navigation'

export default function AdminFinancialAccountsPage() {
  const [accounts, setAccounts] = useState<FinancialAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingAccount, setEditingAccount] = useState<FinancialAccount | null>(null)
  const pageSize = 10

  useEffect(() => {
    fetchAccounts()
  }, [])

  async function fetchAccounts() {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/financial/accounts')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to fetch accounts')
      setAccounts(data.accounts || [])
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load accounts')
    } finally {
      setLoading(false)
    }
  }

  function openCreateDialog() {
    setEditingAccount(null)
    setDialogOpen(true)
  }

  function openEditDialog(account: FinancialAccount) {
    setEditingAccount(account)
    setDialogOpen(true)
  }

  async function deleteAccount(account: FinancialAccount) {
    if (!confirm(`Delete account ${account.code} - ${account.name}?`)) return

    try {
      const res = await fetch(`/api/admin/financial/accounts/${account.id}`, { method: 'DELETE' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.toast || data.error || 'Failed to delete account')
      toast.success(data.toast || 'Account deleted.')
      await fetchAccounts()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete account')
    }
  }

  const filtered = accounts.filter(a =>
    a.code.toLowerCase().includes(search.toLowerCase()) ||
    a.name.toLowerCase().includes(search.toLowerCase())
  )

  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize)
  const totalPages = Math.ceil(filtered.length / pageSize)

  return (
    <div className="p-6 space-y-6">
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-xs" style={{ color: '#7A7060' }}>
          <Link href="/admin/dashboard" className="hover:text-[#C9A96E]">Dashboard</Link>
          <span>/</span>
          <Link href="/admin/financial" className="hover:text-[#C9A96E]">Financial Accounting</Link>
          <span>/</span>
          <span style={{ color: 'var(--muted-foreground)' }}>Accounts</span>
        </div>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>Chart of Accounts</h1>
            <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>Manage your accounting accounts and hierarchy.</p>
          </div>
          <Button size="sm" onClick={openCreateDialog} style={{ background: '#C9A96E', color: '#0A0805' }}>
            <Plus size={15} className="mr-2" /> Add Account
          </Button>
        </div>
      </div>

      <Card className="rounded-lg border-[#2A2418] bg-card">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-4">
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by code or name..."
              className="max-w-sm"
              style={{ background: '#0E0E0A', border: '1px solid #2A2418' }}
            />
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="p-8 text-center" style={{ color: 'var(--muted-foreground)' }}>Loading...</div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center" style={{ color: '#5A5040' }}>No accounts found</div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Level</TableHead>
                    <TableHead>Sort Order</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginated.map(account => (
                    <TableRow key={account.id}>
                      <TableCell className="font-mono">{account.code}</TableCell>
                      <TableCell>{account.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline" style={{ borderColor: ACCOUNT_TYPE_COLORS[account.type], color: ACCOUNT_TYPE_COLORS[account.type] }}>
                          {account.type}
                        </Badge>
                      </TableCell>
                      <TableCell>{account.level}</TableCell>
                      <TableCell>{account.sortOrder}</TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => openEditDialog(account)}>
                          <Pencil size={15} className="text-muted-foreground" />
                        </Button>
                        {!account.isSystem && (
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 hover:text-red-500" onClick={() => deleteAccount(account)}>
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
                  Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, filtered.length)} of {filtered.length} accounts
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    style={{ borderColor: '#2A2418' }}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    style={{ borderColor: '#2A2418' }}
                  >
                    Next
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
        accounts={accounts}
        onSaved={fetchAccounts}
      />
    </div>
  )
}
