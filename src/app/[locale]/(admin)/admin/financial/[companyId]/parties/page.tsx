'use client'

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
import { Textarea } from '@/components/ui/textarea'
import { FinancialBreadcrumbs } from '@/components/admin/financial/FinancialBreadcrumbs'
import { useFinancialCompany } from '@/components/admin/financial/FinancialCompanyContext'
import { inputStyle } from '@/components/admin/financial/subledger/config'

type Party = {
  id: string
  code: string
  name: string
  nameZh: string | null
  isCustomer: boolean
  isSupplier: boolean
  isEmployee: boolean
  email: string | null
  phone: string | null
  address: string | null
  taxNumber: string | null
  paymentTermsDays: number
  notes: string
  isActive: boolean
}

const emptyForm = {
  code: '',
  name: '',
  nameZh: '',
  isCustomer: true,
  isSupplier: false,
  isEmployee: false,
  email: '',
  phone: '',
  address: '',
  taxNumber: '',
  paymentTermsDays: '30',
  notes: '',
}

export default function AdminFinancialPartiesPage() {
  const company = useFinancialCompany()
  const [parties, setParties] = useState<Party[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Party | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  const fetchParties = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ companyId: company.id, includeInactive: '1' })
      if (roleFilter !== 'all') params.set('role', roleFilter)
      if (search.trim()) params.set('search', search.trim())
      const res = await fetch(`/api/admin/financial/parties?${params}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '载入往来单位失败')
      setParties(data.parties ?? [])
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '载入往来单位失败')
    } finally {
      setLoading(false)
    }
  }, [company.id, roleFilter, search])

  useEffect(() => {
    const timer = setTimeout(() => void fetchParties(), search.trim() ? 250 : 0)
    return () => clearTimeout(timer)
  }, [fetchParties, search])

  function openForm(party: Party | null) {
    setEditing(party)
    setForm(
      party
        ? {
            code: party.code,
            name: party.name,
            nameZh: party.nameZh ?? '',
            isCustomer: party.isCustomer,
            isSupplier: party.isSupplier,
            isEmployee: party.isEmployee,
            email: party.email ?? '',
            phone: party.phone ?? '',
            address: party.address ?? '',
            taxNumber: party.taxNumber ?? '',
            paymentTermsDays: String(party.paymentTermsDays),
            notes: party.notes,
          }
        : emptyForm,
    )
    setFormOpen(true)
  }

  async function save() {
    if (!form.code.trim() || !form.name.trim()) {
      toast.error('编号和名称必填。')
      return
    }
    if (!form.isCustomer && !form.isSupplier && !form.isEmployee) {
      toast.error('至少选择一个角色。')
      return
    }
    setSaving(true)
    try {
      const payload = {
        ...(editing ? {} : { companyId: company.id }),
        code: form.code.trim(),
        name: form.name.trim(),
        nameZh: form.nameZh.trim() || null,
        isCustomer: form.isCustomer,
        isSupplier: form.isSupplier,
        isEmployee: form.isEmployee,
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        address: form.address.trim() || null,
        taxNumber: form.taxNumber.trim() || null,
        paymentTermsDays: Number(form.paymentTermsDays) || 30,
        notes: form.notes,
      }
      const res = await fetch(
        editing ? `/api/admin/financial/parties/${editing.id}` : '/api/admin/financial/parties',
        {
          method: editing ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
      )
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.toast || data.error || '保存失败。')
      toast.success(data.toast || '已保存。')
      setFormOpen(false)
      await fetchParties()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '保存失败。')
    } finally {
      setSaving(false)
    }
  }

  async function remove(party: Party) {
    if (!confirm(`确定删除往来单位 ${party.name}？已有业务单据时将改为停用。`)) return
    try {
      const res = await fetch(`/api/admin/financial/parties/${party.id}`, { method: 'DELETE' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.toast || data.error || '删除失败。')
      toast.success(data.toast || '已删除。')
      await fetchParties()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '删除失败。')
    }
  }

  function roleBadges(party: Party) {
    return (
      <div className="flex gap-1">
        {party.isCustomer ? (
          <Badge variant="outline" style={{ borderColor: '#38bdf8', color: '#38bdf8' }}>客户</Badge>
        ) : null}
        {party.isSupplier ? (
          <Badge variant="outline" style={{ borderColor: '#f59e0b', color: '#f59e0b' }}>供应商</Badge>
        ) : null}
        {party.isEmployee ? (
          <Badge variant="outline" style={{ borderColor: '#10b981', color: '#10b981' }}>员工</Badge>
        ) : null}
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="space-y-2">
        <FinancialBreadcrumbs section="往来单位" />
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>往来单位</h1>
            <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
              {company.nameEn} · 客户、供应商与员工主数据，供应收/应付模块使用。
            </p>
          </div>
          <Button size="sm" onClick={() => openForm(null)} style={{ background: '#C9A96E', color: '#0A0805' }}>
            <Plus size={15} className="mr-2" /> 新增往来单位
          </Button>
        </div>
      </div>

      <Card className="rounded-lg border-[#2A2418] bg-card">
        <CardHeader className="pb-4">
          <div className="flex flex-wrap items-center gap-4">
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="搜索编号或名称..."
              className="max-w-xs"
              style={inputStyle}
            />
            <Select value={roleFilter} onValueChange={value => setRoleFilter(value ?? 'all')}>
              <SelectTrigger className="w-[140px]" style={inputStyle}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部角色</SelectItem>
                <SelectItem value="customer">客户</SelectItem>
                <SelectItem value="supplier">供应商</SelectItem>
                <SelectItem value="employee">员工</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="p-8 text-center" style={{ color: 'var(--muted-foreground)' }}>载入中...</div>
          ) : parties.length === 0 ? (
            <div className="p-8 text-center" style={{ color: '#5A5040' }}>暂无往来单位</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>编号</TableHead>
                  <TableHead>名称</TableHead>
                  <TableHead>角色</TableHead>
                  <TableHead>联系方式</TableHead>
                  <TableHead>账期</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {parties.map(party => (
                  <TableRow key={party.id}>
                    <TableCell className="font-mono">{party.code}</TableCell>
                    <TableCell>
                      {party.name}
                      {party.nameZh ? (
                        <span className="ml-2 text-xs" style={{ color: 'var(--muted-foreground)' }}>{party.nameZh}</span>
                      ) : null}
                    </TableCell>
                    <TableCell>{roleBadges(party)}</TableCell>
                    <TableCell className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                      {[party.email, party.phone].filter(Boolean).join(' · ') || '-'}
                    </TableCell>
                    <TableCell>{party.paymentTermsDays} 天</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        style={party.isActive ? { borderColor: '#10b981', color: '#10b981' } : { borderColor: '#9CA3AF', color: '#9CA3AF' }}
                      >
                        {party.isActive ? '启用' : '停用'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => openForm(party)}>
                        <Pencil size={15} className="text-muted-foreground" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0 hover:text-red-500" onClick={() => void remove(party)}>
                        <Trash2 size={15} />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-xl max-h-[88vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? `编辑 ${editing.code}` : '新增往来单位'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>编号 *（如 C0001 / S0001）</Label>
                <Input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} style={inputStyle} />
              </div>
              <div className="space-y-1.5">
                <Label>账期（天）</Label>
                <Input
                  type="number"
                  min="0"
                  max="365"
                  value={form.paymentTermsDays}
                  onChange={e => setForm(f => ({ ...f, paymentTermsDays: e.target.value }))}
                  style={inputStyle}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>名称 *</Label>
                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} style={inputStyle} />
              </div>
              <div className="space-y-1.5">
                <Label>中文名称</Label>
                <Input value={form.nameZh} onChange={e => setForm(f => ({ ...f, nameZh: e.target.value }))} style={inputStyle} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>角色 *</Label>
              <div className="flex gap-4 text-sm">
                {([
                  ['isCustomer', '客户'],
                  ['isSupplier', '供应商'],
                  ['isEmployee', '员工'],
                ] as const).map(([key, label]) => (
                  <label key={key} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form[key]}
                      onChange={e => setForm(f => ({ ...f, [key]: e.target.checked }))}
                    />
                    {label}
                  </label>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>邮箱</Label>
                <Input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} style={inputStyle} />
              </div>
              <div className="space-y-1.5">
                <Label>电话</Label>
                <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} style={inputStyle} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>地址</Label>
                <Input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} style={inputStyle} />
              </div>
              <div className="space-y-1.5">
                <Label>税号</Label>
                <Input value={form.taxNumber} onChange={e => setForm(f => ({ ...f, taxNumber: e.target.value }))} style={inputStyle} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>备注</Label>
              <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} style={inputStyle} />
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
    </div>
  )
}
