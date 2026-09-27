'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { JournalViewModal, type JournalEntryDetails } from '@/components/admin/financial/JournalViewModal'
import { formatReportAmount } from '@/lib/financial/utils'
import type { ReportDrillDownMode } from '@/lib/financial/report-drill-down'

type MatchedLine = {
  entryId: string
  voucherNo: string
  entryDate: string
  description: string
  accountCode: string
  accountName: string
  debit: number
  credit: number
  companyName: string | null
}

type DrillDownPayload = {
  account: { id: string; code: string; name: string; accountIds: string[] } | null
  mode: ReportDrillDownMode
  period: string
  periods: string[]
  vouchers: JournalEntryDetails[]
  matchedLines: MatchedLine[]
  totalDebit: number
  totalCredit: number
  message: string | null
}

export type ReportDrillTarget = {
  accountId: string
  code: string
  name: string
  mode?: ReportDrillDownMode
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  period: string
  scopeParams: Record<string, string>
  target: ReportDrillTarget | null
}

function money(value: number) {
  return formatReportAmount(value)
}

export function ReportDrillDownDialog({ open, onOpenChange, period, scopeParams, target }: Props) {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<DrillDownPayload | null>(null)
  const [viewEntry, setViewEntry] = useState<JournalEntryDetails | null>(null)

  const load = useCallback(async () => {
    if (!target) return
    setLoading(true)
    setData(null)
    try {
      const params = new URLSearchParams({
        period,
        accountId: target.accountId,
        mode: target.mode ?? 'period',
        ...scopeParams,
      })
      const res = await fetch(`/api/admin/financial/reports/drill-down?${params}`)
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || '载入凭证穿透失败')
      setData(json.drillDown as DrillDownPayload)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '载入凭证穿透失败')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [period, scopeParams, target])

  useEffect(() => {
    if (!open || !target) return
    void load()
  }, [open, target, load])

  const modeLabel = (target?.mode ?? 'period') === 'ytd' ? '本年度累计' : '本期'
  const titleAccount = target
    ? `${target.code} ${target.name}`
    : data?.account
      ? `${data.account.code} ${data.account.name}`
      : '科目'

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="financial-modal max-h-[92vh] overflow-y-auto border-[var(--border-subtle)] bg-[var(--surface-modal)] text-[var(--text-bright)] shadow-2xl sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>报表穿透 · {titleAccount}</DialogTitle>
            <DialogDescription>
              期间 {period} · {modeLabel} · 已过账凭证分录
            </DialogDescription>
          </DialogHeader>

          {loading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">正在载入相关凭证…</p>
          ) : !data ? (
            <p className="py-8 text-center text-sm text-muted-foreground">暂无数据</p>
          ) : (
            <div className="space-y-4">
              {data.message ? (
                <p className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-input)] px-4 py-3 text-sm text-muted-foreground">
                  {data.message}
                </p>
              ) : null}

              <div className="flex flex-wrap items-center gap-2 text-sm">
                <Badge variant="outline" className="border-[var(--border-subtle)] text-[#C9A96E]">
                  {modeLabel}
                </Badge>
                {data.mode === 'ytd' && data.periods.length > 1 ? (
                  <span className="text-muted-foreground">
                    覆盖期间 {data.periods[0]} ～ {data.periods[data.periods.length - 1]}
                  </span>
                ) : null}
                <span className="ml-auto font-mono text-muted-foreground">
                  借方合计 {money(data.totalDebit)} · 贷方合计 {money(data.totalCredit)}
                </span>
              </div>

              {data.matchedLines.length === 0 && !data.message ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  该科目在所选期间没有已过账分录（期初/导入余额不会出现在此列表）。
                </p>
              ) : data.matchedLines.length > 0 ? (
                <div className="overflow-x-auto rounded-lg border border-[var(--border-subtle)]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>日期</TableHead>
                        <TableHead>凭证号</TableHead>
                        <TableHead>摘要</TableHead>
                        <TableHead>科目</TableHead>
                        <TableHead className="text-right">借方</TableHead>
                        <TableHead className="text-right">贷方</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.matchedLines.map((line, index) => (
                        <TableRow
                          key={`${line.entryId}-${line.accountCode}-${index}`}
                          className="cursor-pointer hover:bg-[var(--surface-input)]"
                          onClick={() => {
                            const entry = data.vouchers.find(item => item.id === line.entryId) ?? null
                            if (!entry) {
                              toast.error('找不到完整凭证详情')
                              return
                            }
                            setViewEntry(entry)
                          }}
                        >
                          <TableCell>{new Date(line.entryDate).toLocaleDateString('zh-HK')}</TableCell>
                          <TableCell className="font-mono text-[#C9A96E]">{line.voucherNo}</TableCell>
                          <TableCell className="max-w-[220px] truncate">
                            {line.description}
                            {line.companyName ? (
                              <span className="mt-0.5 block text-xs text-muted-foreground">{line.companyName}</span>
                            ) : null}
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {line.accountCode} {line.accountName}
                          </TableCell>
                          <TableCell className="text-right font-mono">{money(line.debit)}</TableCell>
                          <TableCell className="text-right font-mono">{money(line.credit)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : null}

              <p className="text-xs text-muted-foreground">点击一行可打开完整会计凭证。</p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <JournalViewModal
        open={!!viewEntry}
        onOpenChange={openModal => {
          if (!openModal) setViewEntry(null)
        }}
        entry={viewEntry}
        readOnly
      />
    </>
  )
}
