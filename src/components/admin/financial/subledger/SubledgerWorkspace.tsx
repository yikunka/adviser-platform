'use client'

/* eslint-disable react-hooks/set-state-in-effect */

import { useCallback, useEffect, useState } from 'react'
import { Ban, CheckCircle, HandCoins, Link2, Pencil, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { FinancialBreadcrumbs } from '@/components/admin/financial/FinancialBreadcrumbs'
import { useFinancialCompany } from '@/components/admin/financial/FinancialCompanyContext'
import { DocFormDialog } from '@/components/admin/financial/subledger/DocFormDialog'
import { NoteApplyDialog, NoteFormDialog, type SubNote } from '@/components/admin/financial/subledger/NoteFormDialog'
import { PaymentFormDialog } from '@/components/admin/financial/subledger/PaymentFormDialog'
import {
  inputStyle,
  money,
  SIDE_CONFIG,
  STATUS_COLORS,
  type SubDoc,
  type SubledgerSide,
} from '@/components/admin/financial/subledger/config'

type SubPayment = {
  id: string
  paymentNo: string
  status: string
  party: { id: string; code: string; name: string }
  paymentDate: string
  method: string
  bankAccount: { id: string; name: string } | null
  amount: number
  amountAllocated: number
  unallocated: number
  reference: string
  journalEntry: { id: string; voucherNo: string } | null
  allocations: Array<{ id: string; amount: number; docNo: string }>
}

type AgingReport = {
  asOf: string
  parties: Array<{
    partyId: string
    partyName: string
    partyCode: string
    buckets: { notDue: number; d1to30: number; d31to60: number; d61to90: number; d90plus: number }
    total: number
  }>
  totals: { notDue: number; d1to30: number; d31to60: number; d61to90: number; d90plus: number; total: number }
}

const METHOD_LABELS: Record<string, string> = {
  BANK_TRANSFER: '银行转账',
  CASH: '现金',
  CHEQUE: '支票',
  CARD: '银行卡',
  OTHER: '其他',
}

function statusBadge(status: string, labels: Record<string, string>) {
  const color = STATUS_COLORS[status] ?? '#9CA3AF'
  return (
    <Badge variant="outline" style={{ borderColor: color, color }}>
      {labels[status] ?? status}
    </Badge>
  )
}

export function SubledgerWorkspace({ side }: { side: SubledgerSide }) {
  const config = SIDE_CONFIG[side]
  const company = useFinancialCompany()

  const [docs, setDocs] = useState<SubDoc[]>([])
  const [payments, setPayments] = useState<SubPayment[]>([])
  const [notes, setNotes] = useState<SubNote[]>([])
  const [aging, setAging] = useState<AgingReport | null>(null)
  const [agingAsOf, setAgingAsOf] = useState(new Date().toISOString().slice(0, 10))
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const [docFormOpen, setDocFormOpen] = useState(false)
  const [editingDoc, setEditingDoc] = useState<SubDoc | null>(null)
  const [paymentFormOpen, setPaymentFormOpen] = useState(false)
  const [paymentPresetDoc, setPaymentPresetDoc] = useState<SubDoc | null>(null)
  const [noteFormOpen, setNoteFormOpen] = useState(false)
  const [applyNote, setApplyNote] = useState<SubNote | null>(null)
  const [applyOpen, setApplyOpen] = useState(false)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const base = { companyId: company.id }
      const [docsRes, paymentsRes, notesRes, agingRes] = await Promise.all([
        fetch(`${config.docsEndpoint}?${new URLSearchParams(base)}`),
        fetch(`/api/admin/financial/payments?${new URLSearchParams({ ...base, direction: config.paymentsDirection })}`),
        fetch(`/api/admin/financial/credit-notes?${new URLSearchParams({ ...base, kind: config.noteKind })}`),
        fetch(`/api/admin/financial/reports/aging?${new URLSearchParams({ ...base, side, asOf: agingAsOf })}`),
      ])
      const [docsData, paymentsData, notesData, agingData] = await Promise.all([
        docsRes.json(),
        paymentsRes.json(),
        notesRes.json(),
        agingRes.json(),
      ])
      if (!docsRes.ok) throw new Error(docsData.error || '载入单据失败')
      setDocs((docsData[config.docsResponseKey] ?? []).map(config.normalizeDoc))
      if (paymentsRes.ok) setPayments(paymentsData.payments ?? [])
      if (notesRes.ok) setNotes(notesData.notes ?? [])
      if (agingRes.ok) setAging(agingData.report ?? null)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '载入失败')
    } finally {
      setLoading(false)
    }
  }, [company.id, config, side, agingAsOf])

  useEffect(() => {
    void fetchAll()
  }, [fetchAll])

  async function action(url: string, method: string, confirmText: string, body?: unknown) {
    if (!confirm(confirmText)) return
    try {
      const res = await fetch(url, {
        method,
        ...(body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.toast || data.error || '操作失败。')
      toast.success(data.toast || '操作成功。')
      await fetchAll()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '操作失败。')
    }
  }

  const filteredDocs = docs.filter(
    doc =>
      doc.docNo.toLowerCase().includes(search.toLowerCase())
      || doc.partyName.toLowerCase().includes(search.toLowerCase()),
  )

  return (
    <div className="p-6 space-y-6">
      <div className="space-y-2">
        <FinancialBreadcrumbs section={config.title} />
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>
              {config.title}
            </h1>
            <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
              {company.nameEn} · {config.subtitle}
            </p>
          </div>
        </div>
      </div>

      <Tabs defaultValue="docs">
        <TabsList>
          <TabsTrigger value="docs">{config.docTabLabel}</TabsTrigger>
          <TabsTrigger value="payments">{config.payTabLabel}</TabsTrigger>
          <TabsTrigger value="notes">{config.noteTabLabel}</TabsTrigger>
          <TabsTrigger value="aging">账龄分析</TabsTrigger>
        </TabsList>

        {/* ── 单据 ── */}
        <TabsContent value="docs">
          <Card className="rounded-lg border-[#2A2418] bg-card">
            <CardHeader className="pb-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <Input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder={`搜索单号或${config.partyLabel}...`}
                  className="max-w-xs"
                  style={inputStyle}
                />
                <Button
                  size="sm"
                  onClick={() => {
                    setEditingDoc(null)
                    setDocFormOpen(true)
                  }}
                  style={{ background: '#C9A96E', color: '#0A0805' }}
                >
                  <Plus size={15} className="mr-2" /> 新增{config.docLabel}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="p-8 text-center" style={{ color: 'var(--muted-foreground)' }}>载入中...</div>
              ) : filteredDocs.length === 0 ? (
                <div className="p-8 text-center" style={{ color: '#5A5040' }}>暂无{config.docLabel}</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>单号</TableHead>
                      <TableHead>{config.partyLabel}</TableHead>
                      <TableHead>{config.docDateLabel}</TableHead>
                      <TableHead>到期日</TableHead>
                      <TableHead className="text-right">金额</TableHead>
                      <TableHead className="text-right">未结</TableHead>
                      <TableHead>状态</TableHead>
                      <TableHead>凭证</TableHead>
                      <TableHead className="text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredDocs.map(doc => (
                      <TableRow key={doc.id}>
                        <TableCell className="font-mono">{doc.docNo}</TableCell>
                        <TableCell className="max-w-[160px] truncate">{doc.partyName}</TableCell>
                        <TableCell>{doc.date}</TableCell>
                        <TableCell>{doc.dueDate ?? '-'}</TableCell>
                        <TableCell className="text-right font-medium">{money(doc.total)}</TableCell>
                        <TableCell className="text-right" style={{ color: doc.outstanding > 0 ? '#f59e0b' : undefined }}>
                          {money(doc.outstanding)}
                        </TableCell>
                        <TableCell>{statusBadge(doc.displayStatus, config.statusLabels)}</TableCell>
                        <TableCell className="font-mono text-xs">{doc.journalEntry?.voucherNo ?? '-'}</TableCell>
                        <TableCell className="text-right space-x-1">
                          {doc.status === 'DRAFT' ? (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 hover:text-emerald-500"
                                title={config.postVerb}
                                onClick={() =>
                                  void action(
                                    `${config.docsEndpoint}/${doc.id}/post`,
                                    'PUT',
                                    `确定${config.postVerb} ${doc.docNo}？将自动生成已过账凭证。`,
                                  )
                                }
                              >
                                <CheckCircle size={15} />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0"
                                title="编辑"
                                onClick={() => {
                                  setEditingDoc(doc)
                                  setDocFormOpen(true)
                                }}
                              >
                                <Pencil size={15} className="text-muted-foreground" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 hover:text-red-500"
                                title="删除草稿"
                                onClick={() =>
                                  void action(`${config.docsEndpoint}/${doc.id}`, 'DELETE', `确定删除草稿 ${doc.docNo}？`)
                                }
                              >
                                <Trash2 size={15} />
                              </Button>
                            </>
                          ) : doc.status !== 'VOIDED' ? (
                            <>
                              {doc.outstanding > 0 ? (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0 hover:text-[#C9A96E]"
                                  title={`登记${config.payLabel}`}
                                  onClick={() => {
                                    setPaymentPresetDoc(doc)
                                    setPaymentFormOpen(true)
                                  }}
                                >
                                  <HandCoins size={15} />
                                </Button>
                              ) : null}
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 hover:text-red-500"
                                title="作废（红冲）"
                                onClick={() =>
                                  void action(
                                    `${config.docsEndpoint}/${doc.id}/void`,
                                    'PUT',
                                    `确定作废 ${doc.docNo}？将生成红冲凭证。`,
                                    {},
                                  )
                                }
                              >
                                <Ban size={15} />
                              </Button>
                            </>
                          ) : null}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── 收/付款 ── */}
        <TabsContent value="payments">
          <Card className="rounded-lg border-[#2A2418] bg-card">
            <CardHeader className="pb-4">
              <div className="flex justify-end">
                <Button
                  size="sm"
                  onClick={() => {
                    setPaymentPresetDoc(null)
                    setPaymentFormOpen(true)
                  }}
                  style={{ background: '#C9A96E', color: '#0A0805' }}
                >
                  <Plus size={15} className="mr-2" /> 登记{config.payLabel}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {payments.length === 0 ? (
                <div className="p-8 text-center" style={{ color: '#5A5040' }}>暂无{config.payLabel}记录</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>单号</TableHead>
                      <TableHead>{config.partyLabel}</TableHead>
                      <TableHead>日期</TableHead>
                      <TableHead>方式</TableHead>
                      <TableHead className="text-right">金额</TableHead>
                      <TableHead className="text-right">已核销</TableHead>
                      <TableHead>核销单据</TableHead>
                      <TableHead>状态</TableHead>
                      <TableHead className="text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payments.map(payment => (
                      <TableRow key={payment.id}>
                        <TableCell className="font-mono">{payment.paymentNo}</TableCell>
                        <TableCell className="max-w-[160px] truncate">{payment.party.name}</TableCell>
                        <TableCell>{payment.paymentDate}</TableCell>
                        <TableCell>{METHOD_LABELS[payment.method] ?? payment.method}</TableCell>
                        <TableCell className="text-right font-medium">{money(payment.amount)}</TableCell>
                        <TableCell className="text-right">{money(payment.amountAllocated)}</TableCell>
                        <TableCell className="max-w-[180px] truncate font-mono text-xs">
                          {payment.allocations.map(allocation => allocation.docNo).join(', ') || '-'}
                        </TableCell>
                        <TableCell>
                          {statusBadge(payment.status, { POSTED: '已过账', VOIDED: '已作废' })}
                        </TableCell>
                        <TableCell className="text-right">
                          {payment.status === 'POSTED' ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 hover:text-red-500"
                              title="作废（红冲并回滚核销）"
                              onClick={() =>
                                void action(
                                  `/api/admin/financial/payments/${payment.id}/void`,
                                  'PUT',
                                  `确定作废 ${payment.paymentNo}？将红冲凭证并回滚核销。`,
                                  {},
                                )
                              }
                            >
                              <Ban size={15} />
                            </Button>
                          ) : null}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── 贷项/借项 ── */}
        <TabsContent value="notes">
          <Card className="rounded-lg border-[#2A2418] bg-card">
            <CardHeader className="pb-4">
              <div className="flex justify-end">
                <Button size="sm" onClick={() => setNoteFormOpen(true)} style={{ background: '#C9A96E', color: '#0A0805' }}>
                  <Plus size={15} className="mr-2" /> 新增{config.noteLabel}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {notes.length === 0 ? (
                <div className="p-8 text-center" style={{ color: '#5A5040' }}>暂无{config.noteLabel}</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>单号</TableHead>
                      <TableHead>{config.partyLabel}</TableHead>
                      <TableHead>日期</TableHead>
                      <TableHead className="text-right">金额</TableHead>
                      <TableHead className="text-right">已核销</TableHead>
                      <TableHead>状态</TableHead>
                      <TableHead className="text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {notes.map(note => (
                      <TableRow key={note.id}>
                        <TableCell className="font-mono">{note.noteNo}</TableCell>
                        <TableCell className="max-w-[160px] truncate">{note.party.name}</TableCell>
                        <TableCell>{note.issueDate}</TableCell>
                        <TableCell className="text-right font-medium">{money(note.total)}</TableCell>
                        <TableCell className="text-right">{money(note.amountApplied)}</TableCell>
                        <TableCell>
                          {statusBadge(note.status, { DRAFT: '草稿', POSTED: '已过账', VOIDED: '已作废' })}
                        </TableCell>
                        <TableCell className="text-right space-x-1">
                          {note.status === 'DRAFT' ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 hover:text-emerald-500"
                              title="过账"
                              onClick={() =>
                                void action(
                                  `/api/admin/financial/credit-notes/${note.id}/post`,
                                  'PUT',
                                  `确定过账 ${note.noteNo}？`,
                                )
                              }
                            >
                              <CheckCircle size={15} />
                            </Button>
                          ) : null}
                          {note.status === 'POSTED' && note.remaining > 0 ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 hover:text-[#C9A96E]"
                              title={`核销到${config.docLabel}`}
                              onClick={() => {
                                setApplyNote(note)
                                setApplyOpen(true)
                              }}
                            >
                              <Link2 size={15} />
                            </Button>
                          ) : null}
                          {note.status !== 'VOIDED' ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 hover:text-red-500"
                              title={note.status === 'DRAFT' ? '删除草稿' : '作废（红冲）'}
                              onClick={() =>
                                void action(
                                  `/api/admin/financial/credit-notes/${note.id}/void`,
                                  'PUT',
                                  note.status === 'DRAFT' ? `确定删除草稿 ${note.noteNo}？` : `确定作废 ${note.noteNo}？`,
                                  {},
                                )
                              }
                            >
                              {note.status === 'DRAFT' ? <Trash2 size={15} /> : <Ban size={15} />}
                            </Button>
                          ) : null}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── 账龄 ── */}
        <TabsContent value="aging">
          <Card className="rounded-lg border-[#2A2418] bg-card">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <span className="text-sm" style={{ color: 'var(--muted-foreground)' }}>截止日期</span>
                <Input
                  type="date"
                  value={agingAsOf}
                  onChange={e => setAgingAsOf(e.target.value)}
                  className="max-w-[170px]"
                  style={inputStyle}
                />
              </div>
            </CardHeader>
            <CardContent>
              {!aging || aging.parties.length === 0 ? (
                <div className="p-8 text-center" style={{ color: '#5A5040' }}>
                  暂无未结{config.docLabel}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{config.partyLabel}</TableHead>
                      <TableHead className="text-right">未到期</TableHead>
                      <TableHead className="text-right">1-30 天</TableHead>
                      <TableHead className="text-right">31-60 天</TableHead>
                      <TableHead className="text-right">61-90 天</TableHead>
                      <TableHead className="text-right">90 天以上</TableHead>
                      <TableHead className="text-right">合计</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {aging.parties.map(row => (
                      <TableRow key={row.partyId}>
                        <TableCell>
                          <span className="font-mono text-xs mr-2" style={{ color: 'var(--muted-foreground)' }}>
                            {row.partyCode}
                          </span>
                          {row.partyName}
                        </TableCell>
                        <TableCell className="text-right">{money(row.buckets.notDue)}</TableCell>
                        <TableCell className="text-right">{money(row.buckets.d1to30)}</TableCell>
                        <TableCell className="text-right">{money(row.buckets.d31to60)}</TableCell>
                        <TableCell className="text-right" style={{ color: '#f59e0b' }}>
                          {money(row.buckets.d61to90)}
                        </TableCell>
                        <TableCell className="text-right" style={{ color: '#ef4444' }}>
                          {money(row.buckets.d90plus)}
                        </TableCell>
                        <TableCell className="text-right font-semibold">{money(row.total)}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow>
                      <TableCell className="font-semibold">合计</TableCell>
                      <TableCell className="text-right font-semibold">{money(aging.totals.notDue)}</TableCell>
                      <TableCell className="text-right font-semibold">{money(aging.totals.d1to30)}</TableCell>
                      <TableCell className="text-right font-semibold">{money(aging.totals.d31to60)}</TableCell>
                      <TableCell className="text-right font-semibold">{money(aging.totals.d61to90)}</TableCell>
                      <TableCell className="text-right font-semibold">{money(aging.totals.d90plus)}</TableCell>
                      <TableCell className="text-right font-semibold" style={{ color: '#C9A96E' }}>
                        {money(aging.totals.total)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <DocFormDialog
        open={docFormOpen}
        onOpenChange={setDocFormOpen}
        config={config}
        companyId={company.id}
        editing={editingDoc}
        onSaved={() => void fetchAll()}
      />
      <PaymentFormDialog
        open={paymentFormOpen}
        onOpenChange={setPaymentFormOpen}
        config={config}
        companyId={company.id}
        presetDoc={paymentPresetDoc}
        onSaved={() => void fetchAll()}
      />
      <NoteFormDialog
        open={noteFormOpen}
        onOpenChange={setNoteFormOpen}
        config={config}
        companyId={company.id}
        onSaved={() => void fetchAll()}
      />
      <NoteApplyDialog
        open={applyOpen}
        onOpenChange={setApplyOpen}
        config={config}
        companyId={company.id}
        note={applyNote}
        onSaved={() => void fetchAll()}
      />
    </div>
  )
}
