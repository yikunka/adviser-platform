'use client'

/* eslint-disable react-hooks/set-state-in-effect */

import { useCallback, useEffect, useState } from 'react'
import { Eye, Pencil, Trash2, Plus, CheckCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { JournalEntryForm, type JournalEntryForForm } from '@/components/admin/financial/JournalEntryForm'
import { JournalViewModal, type JournalEntryDetails } from '@/components/admin/financial/JournalViewModal'
import { Link } from '@/i18n/navigation'

type JournalEntry = JournalEntryDetails & JournalEntryForForm & {
  id: string
  voucherNo: string
  date: string
  description: string
  groupId?: string | null
  company?: { id: string; nameEn: string; companyCode: string | null } | null
  group?: { id: string; name: string } | null
  status: 'DRAFT' | 'POSTED' | 'CANCELLED'
  totalAmount: number
  createdBy: string
  createdAt: string
}

type ScopeCompany = {
  id: string
  nameEn: string
  companyCode: string | null
  groupId: string | null
  group?: { id: string; name: string } | null
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: '#9CA3AF',
  POSTED: '#10b981',
  CANCELLED: '#ef4444',
}

export default function AdminFinancialJournalPage() {
  const [entries, setEntries] = useState<JournalEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterPeriod, setFilterPeriod] = useState('')
  const [filterStatus, setFilterStatus] = useState('ALL')
  const [filterGroupId, setFilterGroupId] = useState('ALL')
  const [filterCompanyId, setFilterCompanyId] = useState('ALL')
  const [groups, setGroups] = useState<{ id: string; name: string }[]>([])
  const [companies, setCompanies] = useState<ScopeCompany[]>([])
  const [page, setPage] = useState(1)
  const [formOpen, setFormOpen] = useState(false)
  const [viewOpen, setViewOpen] = useState(false)
  const [editingEntry, setEditingEntry] = useState<JournalEntry | null>(null)
  const [viewingEntry, setViewingEntry] = useState<JournalEntry | null>(null)
  const pageSize = 10

  const fetchEntries = useCallback(async () => {
    setLoading(true)
    try {
      let url = '/api/admin/financial/journal-entries'
      const params = new URLSearchParams()
      if (filterPeriod) params.append('period', filterPeriod)
      if (filterStatus !== 'ALL') params.append('status', filterStatus)
      if (filterGroupId !== 'ALL') params.append('groupId', filterGroupId)
      if (filterCompanyId !== 'ALL') params.append('companyId', filterCompanyId)
      if (params.toString()) url += '?' + params.toString()
      
      const res = await fetch(url)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to fetch entries')
      setEntries(data.entries || [])
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load journal entries')
    } finally {
      setLoading(false)
    }
  }, [filterPeriod, filterStatus, filterGroupId, filterCompanyId])

  useEffect(() => {
    fetchEntries()
  }, [fetchEntries])

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

  function openCreateForm() {
    setEditingEntry(null)
    setFormOpen(true)
  }

  function openEditForm(entry: JournalEntry) {
    setEditingEntry(entry)
    setFormOpen(true)
  }

  function openViewModal(entry: JournalEntry) {
    setViewingEntry(entry)
    setViewOpen(true)
  }

  async function postEntry(entry: JournalEntry) {
    if (!confirm(`Post journal entry ${entry.voucherNo}? This will create ledger entries and cannot be undone.`)) return

    try {
      const res = await fetch(`/api/admin/financial/journal-entries/${entry.id}/post`, { method: 'PUT' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.toast || data.error || 'Failed to post journal entry.')
      toast.success(data.toast || 'Journal entry posted.')
      await fetchEntries()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to post journal entry.')
    }
  }

  async function cancelEntry(entry: JournalEntry) {
    if (!confirm(`Cancel journal entry ${entry.voucherNo}?`)) return

    try {
      const res = await fetch(`/api/admin/financial/journal-entries/${entry.id}`, { method: 'DELETE' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.toast || data.error || 'Failed to cancel journal entry.')
      toast.success(data.toast || 'Journal entry cancelled.')
      await fetchEntries()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to cancel journal entry.')
    }
  }

  const filtered = entries.filter(e =>
    (e.voucherNo.toLowerCase().includes(search.toLowerCase()) ||
     e.description.toLowerCase().includes(search.toLowerCase())) &&
    (filterStatus === 'ALL' || e.status === filterStatus) &&
    (filterGroupId === 'ALL' || e.groupId === filterGroupId) &&
    (filterCompanyId === 'ALL' || e.companyId === filterCompanyId) &&
    (!filterPeriod || e.date.startsWith(filterPeriod))
  )

  const companyOptions = filterGroupId === 'ALL'
    ? companies
    : companies.filter(company => company.groupId === filterGroupId)

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
          <span style={{ color: 'var(--muted-foreground)' }}>Journal Entries</span>
        </div>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>Journal Entries</h1>
            <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>Create and manage accounting vouchers.</p>
          </div>
          <Button size="sm" onClick={openCreateForm} style={{ background: '#C9A96E', color: '#0A0805' }}>
            <Plus size={15} className="mr-2" /> New Entry
          </Button>
        </div>
      </div>

      <Card className="rounded-lg border-[#2A2418] bg-card">
        <CardHeader className="pb-4">
          <div className="flex flex-wrap items-center gap-4">
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search voucher no or description..."
              className="max-w-xs"
              style={{ background: '#0E0E0A', border: '1px solid #2A2418' }}
            />
            <Input
              type="month"
              value={filterPeriod}
              onChange={e => setFilterPeriod(e.target.value)}
              className="max-w-[160px]"
              style={{ background: '#0E0E0A', border: '1px solid #2A2418' }}
            />
            <Select value={filterStatus} onValueChange={value => setFilterStatus(value ?? 'ALL')}>
              <SelectTrigger className="w-[140px]" style={{ background: '#0E0E0A', border: '1px solid #2A2418' }}>
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Status</SelectItem>
                <SelectItem value="DRAFT">Pending</SelectItem>
                <SelectItem value="POSTED">Posted</SelectItem>
                <SelectItem value="CANCELLED">Cancelled</SelectItem>
              </SelectContent>
            </Select>
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
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="p-8 text-center" style={{ color: 'var(--muted-foreground)' }}>Loading...</div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center" style={{ color: '#5A5040' }}>No journal entries found</div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Voucher No</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Total Amount</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginated.map(entry => (
                    <TableRow key={entry.id}>
                      <TableCell className="font-mono">{entry.voucherNo}</TableCell>
                      <TableCell>{new Date(entry.date).toLocaleDateString()}</TableCell>
                      <TableCell className="max-w-[180px]">
                        <div className="truncate">{entry.company?.nameEn ?? 'Unassigned'}</div>
                        {entry.company?.companyCode ? (
                          <div className="text-xs text-muted-foreground">{entry.company.companyCode}</div>
                        ) : null}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">{entry.description}</TableCell>
                      <TableCell>
                        <Badge variant="outline" style={{ borderColor: STATUS_COLORS[entry.status], color: STATUS_COLORS[entry.status] }}>
                          {entry.status === 'DRAFT' ? 'PENDING' : entry.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">{entry.totalAmount.toLocaleString()}</TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => openViewModal(entry)}>
                          <Eye size={15} className="text-muted-foreground" />
                        </Button>
                        {entry.status === 'DRAFT' ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 hover:text-emerald-500"
                            title="Approve & Post"
                            onClick={() => postEntry(entry)}
                          >
                            <CheckCircle size={15} />
                          </Button>
                        ) : null}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => openEditForm(entry)}
                          disabled={entry.status !== 'DRAFT'}
                        >
                          <Pencil size={15} className="text-muted-foreground" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 hover:text-red-500"
                          onClick={() => cancelEntry(entry)}
                          disabled={entry.status === 'CANCELLED'}
                        >
                          <Trash2 size={15} />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <div className="flex items-center justify-between mt-4 px-2">
                <div className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                  Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, filtered.length)} of {filtered.length} entries
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

      <JournalEntryForm
        open={formOpen}
        onOpenChange={setFormOpen}
        entry={editingEntry}
        onSaved={fetchEntries}
      />
      <JournalViewModal
        open={viewOpen}
        onOpenChange={setViewOpen}
        entry={viewingEntry}
        onPosted={fetchEntries}
      />
    </div>
  )
}
