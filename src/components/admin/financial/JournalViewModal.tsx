'use client'

import { useState } from 'react'
import { CheckCircle, Pencil, Printer } from 'lucide-react'
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
import { formatJournalLineAccountLevels, type AccountLevelRef } from '@/lib/financial/account-hierarchy'

export type JournalEntryDetails = {
  id: string
  voucherNo: string
  date: string
  description: string
  status: 'DRAFT' | 'POSTED' | 'CANCELLED'
  createdBy?: string | null
  createdAt?: string | null
  company?: { id: string; nameEn: string; companyCode: string | null } | null
  lines: {
    description?: string
    accountId?: string
    account?: {
      code: string
      name: string
      level?: number
      levelChain?: AccountLevelRef[]
    } | null
    debit: number
    credit: number
  }[]
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  entry?: JournalEntryDetails | null
  onPosted?: () => void | Promise<void>
  onPrint?: (entry: JournalEntryDetails) => void
  onEdit?: (entry: JournalEntryDetails) => void
  readOnly?: boolean
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

export function JournalViewModal({ open, onOpenChange, entry, onPosted, onPrint, onEdit, readOnly = false }: Props) {
  const [posting, setPosting] = useState(false)
  const totalDebit = entry?.lines.reduce((sum, line) => sum + line.debit, 0) ?? 0
  const totalCredit = entry?.lines.reduce((sum, line) => sum + line.credit, 0) ?? 0

  async function postEntry() {
    if (!entry) return
    if (!confirm(`确定审核并过账日记账 ${entry.voucherNo}？过账后会生成总账记录，不能撤销。`)) return

    setPosting(true)
    try {
      const res = await fetch(`/api/admin/financial/journal-entries/${entry.id}/post`, { method: 'PUT' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.toast || data.error || '日记账过账失败。')
      toast.success(data.toast || '日记账已过账。')
      onOpenChange(false)
      await onPosted?.()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '日记账过账失败。')
    } finally {
      setPosting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={modalContentClassName}>
        <DialogHeader>
          <DialogTitle className="text-[#FFF7E6]">{entry?.voucherNo ?? '日记账'}</DialogTitle>
          <DialogDescription className="text-[#B8AD98]">日记账凭证详情。</DialogDescription>
        </DialogHeader>

        {entry ? (
          <div className="space-y-5">
            <div className="grid gap-3 rounded-lg border border-[#2A2418] bg-[#0E0E0A] p-4 sm:grid-cols-2">
              <div>
                <div className="text-xs text-[#B8AD98]">凭证号</div>
                <div className="font-mono">{entry.voucherNo}</div>
              </div>
              <div>
                <div className="text-xs text-[#B8AD98]">日期</div>
                <div>{new Date(entry.date).toLocaleDateString('zh-HK')}</div>
              </div>
              <div className="sm:col-span-2">
                <div className="text-xs text-[#B8AD98]">摘要</div>
                <div>{entry.description}</div>
              </div>
              <div>
                <div className="text-xs text-[#B8AD98]">状态</div>
                <Badge variant="outline" style={{ borderColor: STATUS_COLORS[entry.status], color: STATUS_COLORS[entry.status] }}>
                  {entry.status === 'DRAFT' ? '待过账' : entry.status === 'POSTED' ? '已过账' : '已取消'}
                </Badge>
              </div>
            </div>

            <div className="overflow-x-auto rounded-lg border border-[#2A2418] bg-[#0B0B08]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>行摘要</TableHead>
                    <TableHead>一级科目</TableHead>
                    <TableHead>二级科目</TableHead>
                    <TableHead>三级科目</TableHead>
                    <TableHead className="text-right">借方</TableHead>
                    <TableHead className="text-right">贷方</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entry.lines.map((line, index) => {
                    const accountLevels = formatJournalLineAccountLevels(line.account ?? undefined)
                    return (
                    <TableRow key={index}>
                      <TableCell className="max-w-[200px]">{line.description || '-'}</TableCell>
                      <TableCell>{accountLevels.level1}</TableCell>
                      <TableCell>{accountLevels.level2}</TableCell>
                      <TableCell>{accountLevels.level3}</TableCell>
                      <TableCell className="text-right">{money(line.debit)}</TableCell>
                      <TableCell className="text-right">{money(line.credit)}</TableCell>
                    </TableRow>
                    )
                  })}
                  <TableRow>
                    <TableCell colSpan={4} className="text-right font-medium">合计</TableCell>
                    <TableCell className="text-right font-medium">{money(totalDebit)}</TableCell>
                    <TableCell className="text-right font-medium">{money(totalCredit)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>

            <div className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <span className="text-[#B8AD98]">创建人：</span>
                {entry.createdBy || '系统'}
              </div>
              <div>
                <span className="text-[#B8AD98]">创建时间：</span>
                {entry.createdAt ? new Date(entry.createdAt).toLocaleString('zh-HK') : '-'}
              </div>
            </div>
          </div>
        ) : null}

        <DialogFooter className={modalFooterClassName}>
          {!readOnly && (entry?.status === 'DRAFT' || entry?.status === 'CANCELLED') ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => onEdit?.(entry)}
              className={secondaryButtonClassName}
            >
              <Pencil size={15} className="mr-2" />
              {entry.status === 'CANCELLED' ? '重新编辑' : '编辑'}
            </Button>
          ) : null}
          {entry ? (
            <Button type="button" variant="outline" onClick={() => onPrint?.(entry)} className={secondaryButtonClassName}>
              <Printer size={15} className="mr-2" />
              打印凭证
            </Button>
          ) : null}
          {!readOnly && entry?.status === 'DRAFT' ? (
            <Button
              type="button"
              onClick={postEntry}
              disabled={posting}
              style={{ background: '#10b981', color: '#0A0805' }}
            >
              <CheckCircle size={15} className="mr-2" />
              {posting ? '过账中...' : '审核并过账'}
            </Button>
          ) : null}
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className={secondaryButtonClassName}>
            关闭
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
