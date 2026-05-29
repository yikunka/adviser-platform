'use client'

import { useState } from 'react'
import { CheckCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

export type JournalEntryDetails = {
  id: string
  voucherNo: string
  date: string
  description: string
  status: 'DRAFT' | 'POSTED' | 'CANCELLED'
  createdBy?: string | null
  createdAt?: string | null
  lines: {
    account?: { code: string; name: string } | null
    debit: number
    credit: number
  }[]
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  entry?: JournalEntryDetails | null
  onPosted?: () => void | Promise<void>
}

const STATUS_COLORS: Record<JournalEntryDetails['status'], string> = {
  DRAFT: '#9CA3AF',
  POSTED: '#10b981',
  CANCELLED: '#ef4444',
}
const modalContentClassName = 'financial-modal max-h-[92vh] overflow-y-auto border-[#2A2418] bg-[#11110E] text-[#FFF7E6] shadow-2xl ring-[#3A3428] sm:max-w-4xl'
const modalFooterClassName = 'border-[#2A2418] bg-[#16130E]'
const secondaryButtonClassName = 'border-[#3A3428] bg-[#0E0E0A] text-[#FFF7E6] hover:bg-[#1E1A12] hover:text-[#FFF7E6]'

function money(value: number) {
  return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function JournalViewModal({ open, onOpenChange, entry, onPosted }: Props) {
  const [posting, setPosting] = useState(false)
  const totalDebit = entry?.lines.reduce((sum, line) => sum + line.debit, 0) ?? 0
  const totalCredit = entry?.lines.reduce((sum, line) => sum + line.credit, 0) ?? 0

  async function postEntry() {
    if (!entry) return
    if (!confirm(`Post journal entry ${entry.voucherNo}? This will create ledger entries and cannot be undone.`)) return

    setPosting(true)
    try {
      const res = await fetch(`/api/admin/financial/journal-entries/${entry.id}/post`, { method: 'PUT' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.toast || data.error || 'Failed to post journal entry.')
      toast.success(data.toast || 'Journal entry posted.')
      onOpenChange(false)
      await onPosted?.()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to post journal entry.')
    } finally {
      setPosting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={modalContentClassName}>
        <DialogHeader>
          <DialogTitle className="text-[#FFF7E6]">{entry?.voucherNo ?? 'Journal Entry'}</DialogTitle>
          <DialogDescription className="text-[#B8AD98]">Journal voucher details.</DialogDescription>
        </DialogHeader>

        {entry ? (
          <div className="space-y-5">
            <div className="grid gap-3 rounded-lg border border-[#2A2418] bg-[#0E0E0A] p-4 sm:grid-cols-2">
              <div>
                <div className="text-xs text-[#B8AD98]">Voucher No</div>
                <div className="font-mono">{entry.voucherNo}</div>
              </div>
              <div>
                <div className="text-xs text-[#B8AD98]">Date</div>
                <div>{new Date(entry.date).toLocaleDateString()}</div>
              </div>
              <div className="sm:col-span-2">
                <div className="text-xs text-[#B8AD98]">Description</div>
                <div>{entry.description}</div>
              </div>
              <div>
                <div className="text-xs text-[#B8AD98]">Status</div>
                <Badge variant="outline" style={{ borderColor: STATUS_COLORS[entry.status], color: STATUS_COLORS[entry.status] }}>
                  {entry.status === 'DRAFT' ? 'PENDING' : entry.status}
                </Badge>
              </div>
            </div>

            <div className="overflow-x-auto rounded-lg border border-[#2A2418] bg-[#0B0B08]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Account Code</TableHead>
                    <TableHead>Account Name</TableHead>
                    <TableHead className="text-right">Debit</TableHead>
                    <TableHead className="text-right">Credit</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entry.lines.map((line, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-mono">{line.account?.code ?? '-'}</TableCell>
                      <TableCell>{line.account?.name ?? '-'}</TableCell>
                      <TableCell className="text-right">{money(line.debit)}</TableCell>
                      <TableCell className="text-right">{money(line.credit)}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow>
                    <TableCell colSpan={2} className="text-right font-medium">Totals</TableCell>
                    <TableCell className="text-right font-medium">{money(totalDebit)}</TableCell>
                    <TableCell className="text-right font-medium">{money(totalCredit)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>

            <div className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <span className="text-[#B8AD98]">Created By: </span>
                {entry.createdBy || 'System'}
              </div>
              <div>
                <span className="text-[#B8AD98]">Created At: </span>
                {entry.createdAt ? new Date(entry.createdAt).toLocaleString() : '-'}
              </div>
            </div>
          </div>
        ) : null}

        <DialogFooter className={modalFooterClassName}>
          {entry?.status === 'DRAFT' ? (
            <Button
              type="button"
              onClick={postEntry}
              disabled={posting}
              style={{ background: '#10b981', color: '#0A0805' }}
            >
              <CheckCircle size={15} className="mr-2" />
              {posting ? 'Posting...' : 'Approve & Post'}
            </Button>
          ) : null}
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className={secondaryButtonClassName}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
