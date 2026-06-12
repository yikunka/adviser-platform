'use client'

/* eslint-disable react-hooks/set-state-in-effect */

import { useCallback, useEffect, useState } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { FinancialBreadcrumbs } from '@/components/admin/financial/FinancialBreadcrumbs'
import { useFinancialCompany } from '@/components/admin/financial/FinancialCompanyContext'
import { inputStyle, money } from '@/components/admin/financial/subledger/config'
import { DIMENSION_LABELS, type DimensionType } from '@/lib/financial/dimension-types'

type Dimension = { id: string; code: string; name: string; isActive: boolean }

function DimensionTab({ companyId, type }: { companyId: string; type: DimensionType }) {
  const label = DIMENSION_LABELS[type]
  const [rows, setRows] = useState<Dimension[]>([])
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Dimension | null>(null)
  const [form, setForm] = useState({ code: '', name: '' })
  const [saving, setSaving] = useState(false)

  const fetchRows = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/financial/dimensions?type=${type}&companyId=${companyId}&includeInactive=1`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '载入失败')
      setRows(data.dimensions ?? [])
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '载入失败')
    } finally {
      setLoading(false)
    }
  }, [companyId, type])

  useEffect(() => {
    void fetchRows()
  }, [fetchRows])

  function openForm(row: Dimension | null) {
    setEditing(row)
    setForm(row ? { code: row.code, name: row.name } : { code: '', name: '' })
    setFormOpen(true)
  }

  async function save() {
    if (!form.code.trim() || !form.name.trim()) {
      toast.error('编号和名称必填。')
      return
    }
    setSaving(true)
    try {
      const res = await fetch(
        editing
          ? `/api/admin/financial/dimensions/${editing.id}?type=${type}`
          : `/api/admin/financial/dimensions?type=${type}`,
        {
          method: editing ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(editing ? form : { companyId, ...form }),
        },
      )
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.toast || data.error || '保存失败')
      toast.success(data.toast || '已保存')
      setFormOpen(false)
      await fetchRows()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  async function remove(row: Dimension) {
    if (!confirm(`确定删除${label} ${row.name}？已被凭证引用时将改为停用。`)) return
    try {
      const res = await fetch(`/api/admin/financial/dimensions/${row.id}?type=${type}`, { method: 'DELETE' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.toast || data.error || '删除失败')
      toast.success(data.toast || '已删除')
      await fetchRows()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '删除失败')
    }
  }

  return (
    <Card className="rounded-lg border-[#2A2418] bg-card">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
            {label}用于凭证分录的辅助核算归集，可在日记账录入时按行选择。
          </p>
          <Button size="sm" onClick={() => openForm(null)} style={{ background: '#C9A96E', color: '#0A0805' }}>
            <Plus size={15} className="mr-2" /> 新增{label}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="p-8 text-center" style={{ color: 'var(--muted-foreground)' }}>载入中...</div>
        ) : rows.length === 0 ? (
          <div className="p-8 text-center" style={{ color: '#5A5040' }}>暂无{label}</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>编号</TableHead>
                <TableHead>名称</TableHead>
                <TableHead>状态</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(row => (
                <TableRow key={row.id}>
                  <TableCell className="font-mono">{row.code}</TableCell>
                  <TableCell>{row.name}</TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      style={row.isActive ? { borderColor: '#10b981', color: '#10b981' } : { borderColor: '#9CA3AF', color: '#9CA3AF' }}
                    >
                      {row.isActive ? '启用' : '停用'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => openForm(row)}>
                      <Pencil size={15} className="text-muted-foreground" />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 hover:text-red-500" onClick={() => void remove(row)}>
                      <Trash2 size={15} />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editing ? `编辑${label}` : `新增${label}`}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>编号 *</Label>
              <Input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} style={inputStyle} />
            </div>
            <div className="space-y-1.5">
              <Label>名称 *</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} style={inputStyle} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" style={{ borderColor: '#2A2418' }} onClick={() => setFormOpen(false)}>
              取消
            </Button>
            <Button onClick={() => void save()} disabled={saving} style={{ background: '#C9A96E', color: '#0A0805' }}>
              {saving ? '保存中...' : '保存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}

type PlRow = {
  dimensionId: string | null
  dimensionCode: string
  dimensionName: string
  revenue: number
  costOfSales: number
  expense: number
  profit: number
}

function DimensionPlTab({ companyId }: { companyId: string }) {
  const [type, setType] = useState<DimensionType>('cost-center')
  const [period, setPeriod] = useState('')
  const [rows, setRows] = useState<PlRow[]>([])
  const [totals, setTotals] = useState<PlRow | null>(null)
  const [loading, setLoading] = useState(false)

  const fetchReport = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ companyId, type })
      if (period) params.set('period', period)
      const res = await fetch(`/api/admin/financial/reports/dimension-pl?${params}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '生成报表失败')
      setRows(data.report.rows ?? [])
      setTotals({ ...data.report.totals, dimensionId: 'T', dimensionCode: '', dimensionName: '合计' })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '生成报表失败')
    } finally {
      setLoading(false)
    }
  }, [companyId, type, period])

  useEffect(() => {
    void fetchReport()
  }, [fetchReport])

  return (
    <Card className="rounded-lg border-[#2A2418] bg-card">
      <CardHeader className="pb-4">
        <div className="flex flex-wrap items-center gap-3">
          <Select value={type} onValueChange={value => setType((value as DimensionType) ?? 'cost-center')}>
            <SelectTrigger className="w-[150px]" style={inputStyle}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="cost-center">按成本中心</SelectItem>
              <SelectItem value="project">按项目</SelectItem>
            </SelectContent>
          </Select>
          <Input
            type="month"
            value={period}
            onChange={e => setPeriod(e.target.value)}
            className="max-w-[160px]"
            style={inputStyle}
            placeholder="全部期间"
          />
          {period ? (
            <Button size="sm" variant="outline" style={{ borderColor: '#2A2418' }} onClick={() => setPeriod('')}>
              清除期间
            </Button>
          ) : null}
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="p-8 text-center" style={{ color: 'var(--muted-foreground)' }}>生成中...</div>
        ) : rows.length === 0 ? (
          <div className="p-8 text-center" style={{ color: '#5A5040' }}>暂无已过账损益数据</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>维度</TableHead>
                <TableHead className="text-right">收入</TableHead>
                <TableHead className="text-right">主营成本</TableHead>
                <TableHead className="text-right">费用</TableHead>
                <TableHead className="text-right">利润</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(row => (
                <TableRow key={row.dimensionId ?? 'unassigned'}>
                  <TableCell>
                    {row.dimensionCode ? (
                      <span className="font-mono text-xs mr-2" style={{ color: 'var(--muted-foreground)' }}>{row.dimensionCode}</span>
                    ) : null}
                    {row.dimensionName}
                  </TableCell>
                  <TableCell className="text-right">{money(row.revenue)}</TableCell>
                  <TableCell className="text-right">{money(row.costOfSales)}</TableCell>
                  <TableCell className="text-right">{money(row.expense)}</TableCell>
                  <TableCell className="text-right font-medium" style={{ color: row.profit >= 0 ? '#10b981' : '#ef4444' }}>
                    {money(row.profit)}
                  </TableCell>
                </TableRow>
              ))}
              {totals ? (
                <TableRow>
                  <TableCell className="font-semibold">合计</TableCell>
                  <TableCell className="text-right font-semibold">{money(totals.revenue)}</TableCell>
                  <TableCell className="text-right font-semibold">{money(totals.costOfSales)}</TableCell>
                  <TableCell className="text-right font-semibold">{money(totals.expense)}</TableCell>
                  <TableCell className="text-right font-semibold" style={{ color: '#C9A96E' }}>{money(totals.profit)}</TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}

export default function AdminFinancialDimensionsPage() {
  const company = useFinancialCompany()

  return (
    <div className="p-6 space-y-6">
      <div className="space-y-2">
        <FinancialBreadcrumbs section="辅助核算维度" />
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>辅助核算维度</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
            {company.nameEn} · 成本中心、项目主数据与维度损益分析。
          </p>
        </div>
      </div>

      <Tabs defaultValue="cost-center">
        <TabsList>
          <TabsTrigger value="cost-center">成本中心</TabsTrigger>
          <TabsTrigger value="project">项目</TabsTrigger>
          <TabsTrigger value="pl">维度损益</TabsTrigger>
        </TabsList>
        <TabsContent value="cost-center">
          <DimensionTab companyId={company.id} type="cost-center" />
        </TabsContent>
        <TabsContent value="project">
          <DimensionTab companyId={company.id} type="project" />
        </TabsContent>
        <TabsContent value="pl">
          <DimensionPlTab companyId={company.id} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
