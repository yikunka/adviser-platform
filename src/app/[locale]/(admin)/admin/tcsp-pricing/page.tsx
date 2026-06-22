'use client'

/* eslint-disable react-hooks/set-state-in-effect */

import { useCallback, useEffect, useState } from 'react'
import { Edit3, Plus, Save, Search, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { useAdminPermission } from '@/components/admin/AdminPermissionContext'
import {
  TCSP_CUSTOMER_LEVELS,
  TCSP_JURISDICTIONS,
  TCSP_SERVICE_CATEGORIES,
  tcspCustomerLevelLabel,
} from '@/lib/adviser/tcsp-pricing'

type TcspPrice = {
  id: string
  jurisdiction: string
  customerLevel: string
  serviceCategory: string
  serviceName: string
  currency: string
  amount: string
  notes: string | null
  updatedAt: string
}

type PriceDraft = {
  jurisdiction: string
  customerLevel: string
  serviceCategory: string
  serviceName: string
  currency: string
  amount: string
  notes: string
}

const emptyDraft: PriceDraft = {
  jurisdiction: 'HK',
  customerLevel: 'STANDARD',
  serviceCategory: '公司注册',
  serviceName: '',
  currency: 'HKD',
  amount: '',
  notes: '',
}

const card: React.CSSProperties = {
  background: 'var(--card)',
  border: '1px solid var(--border)',
  borderRadius: '0.75rem',
}

const inputClass = 'w-full rounded-lg px-3 py-2.5 text-sm outline-none'

function inputStyle(): React.CSSProperties {
  return {
    background: '#0F0D08',
    border: '1px solid #2A2418',
    color: 'var(--foreground)',
  }
}

function priceToDraft(price: TcspPrice): PriceDraft {
  return {
    jurisdiction: price.jurisdiction,
    customerLevel: price.customerLevel,
    serviceCategory: price.serviceCategory,
    serviceName: price.serviceName,
    currency: price.currency,
    amount: price.amount,
    notes: price.notes ?? '',
  }
}

function payloadFromDraft(draft: PriceDraft) {
  return {
    jurisdiction: draft.jurisdiction,
    customerLevel: draft.customerLevel,
    serviceCategory: draft.serviceCategory,
    serviceName: draft.serviceName,
    currency: draft.currency,
    amount: Number(draft.amount),
    notes: draft.notes,
  }
}

function SelectField({
  value,
  onChange,
  children,
}: {
  value: string
  onChange: (value: string) => void
  children: React.ReactNode
}) {
  return (
    <select value={value} onChange={event => onChange(event.target.value)} className={inputClass} style={inputStyle()}>
      {children}
    </select>
  )
}

function PriceFields({
  value,
  onChange,
}: {
  value: PriceDraft
  onChange: (next: PriceDraft) => void
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="space-y-1.5">
        <span className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>司法管辖区</span>
        <SelectField value={value.jurisdiction} onChange={next => onChange({ ...value, jurisdiction: next })}>
          {TCSP_JURISDICTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
        </SelectField>
      </label>
      <label className="space-y-1.5">
        <span className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>客户级别</span>
        <SelectField value={value.customerLevel} onChange={next => onChange({ ...value, customerLevel: next })}>
          {TCSP_CUSTOMER_LEVELS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
        </SelectField>
      </label>
      <label className="space-y-1.5">
        <span className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>服务分类</span>
        <SelectField value={value.serviceCategory} onChange={next => onChange({ ...value, serviceCategory: next })}>
          {TCSP_SERVICE_CATEGORIES.map(option => <option key={option} value={option}>{option}</option>)}
        </SelectField>
      </label>
      <label className="space-y-1.5">
        <span className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>服务项</span>
        <input value={value.serviceName} onChange={event => onChange({ ...value, serviceName: event.target.value })} className={inputClass} style={inputStyle()} />
      </label>
      <label className="space-y-1.5">
        <span className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>币种</span>
        <input value={value.currency} onChange={event => onChange({ ...value, currency: event.target.value.toUpperCase() })} maxLength={3} className={inputClass} style={inputStyle()} />
      </label>
      <label className="space-y-1.5">
        <span className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>金额</span>
        <input type="number" min="0" step="0.01" value={value.amount} onChange={event => onChange({ ...value, amount: event.target.value })} className={inputClass} style={inputStyle()} />
      </label>
      <label className="space-y-1.5 sm:col-span-2">
        <span className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>备注</span>
        <textarea value={value.notes} onChange={event => onChange({ ...value, notes: event.target.value })} className={`${inputClass} min-h-20 resize-y`} style={inputStyle()} />
      </label>
    </div>
  )
}

export default function TcspPricingPage() {
  const canCreate = useAdminPermission('tcspPricing.create')
  const canEdit = useAdminPermission('tcspPricing.edit')
  const canDelete = useAdminPermission('tcspPricing.delete')
  const [prices, setPrices] = useState<TcspPrice[]>([])
  const [search, setSearch] = useState('')
  const [jurisdiction, setJurisdiction] = useState('')
  const [customerLevel, setCustomerLevel] = useState('')
  const [loading, setLoading] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [draft, setDraft] = useState<PriceDraft>(emptyDraft)
  const [creating, setCreating] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState<PriceDraft>(emptyDraft)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const fetchPrices = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search.trim()) params.set('q', search.trim())
      if (jurisdiction) params.set('jurisdiction', jurisdiction)
      if (customerLevel) params.set('customerLevel', customerLevel)
      const res = await fetch(`/api/admin/tcsp-pricing${params.size ? `?${params}` : ''}`)
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || '载入价格配置失败。')
      setPrices(Array.isArray(json.prices) ? json.prices : [])
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '载入价格配置失败。')
    } finally {
      setLoading(false)
    }
  }, [customerLevel, jurisdiction, search])

  useEffect(() => {
    fetchPrices()
  }, [fetchPrices])

  async function createPrice() {
    if (!draft.serviceName.trim()) {
      toast.error('请填写服务项名称。')
      return
    }
    if (!Number.isFinite(Number(draft.amount))) {
      toast.error('请填写有效金额。')
      return
    }
    setCreating(true)
    try {
      const res = await fetch('/api/admin/tcsp-pricing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payloadFromDraft(draft)),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || '新增价格配置失败。')
      toast.success(json.toast || '价格配置已新增。')
      setCreateOpen(false)
      setDraft(emptyDraft)
      await fetchPrices()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '新增价格配置失败。')
    } finally {
      setCreating(false)
    }
  }

  async function savePrice(price: TcspPrice) {
    if (!Number.isFinite(Number(editDraft.amount))) {
      toast.error('请填写有效金额。')
      return
    }
    setSavingId(price.id)
    try {
      const res = await fetch(`/api/admin/tcsp-pricing/${price.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payloadFromDraft(editDraft)),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || '保存价格配置失败。')
      setPrices(current => current.map(row => row.id === price.id ? json.price : row))
      setEditingId(null)
      toast.success(json.toast || '价格配置已更新。')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '保存价格配置失败。')
    } finally {
      setSavingId(null)
    }
  }

  async function deletePrice(price: TcspPrice) {
    if (!window.confirm(`删除「${price.serviceName}」的价格配置？`)) return
    setDeletingId(price.id)
    try {
      const res = await fetch(`/api/admin/tcsp-pricing/${price.id}`, { method: 'DELETE' })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || '删除价格配置失败。')
      setPrices(current => current.filter(row => row.id !== price.id))
      toast.success(json.toast || '价格配置已删除。')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '删除价格配置失败。')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>TCSP服务价格单</h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--muted-foreground)' }}>
            按司法管辖区、客户级别和服务项目维护差异化报价。
          </p>
        </div>
        {canCreate && (
          <Button onClick={() => setCreateOpen(true)}>
            <Plus size={16} className="mr-2" /> 新增价格
          </Button>
        )}
      </div>

      <div className="grid gap-3 rounded-lg p-3 md:grid-cols-[1fr_180px_180px]" style={card}>
        <div className="flex items-center gap-2 rounded-lg px-3 py-2" style={{ background: '#0F0D08', border: '1px solid #2A2418' }}>
          <Search size={16} style={{ color: 'var(--muted-foreground)' }} />
          <input
            value={search}
            onChange={event => setSearch(event.target.value)}
            placeholder="搜索服务分类、服务项或备注..."
            className="flex-1 bg-transparent text-sm outline-none"
            style={{ color: 'var(--foreground)' }}
          />
        </div>
        <SelectField value={jurisdiction} onChange={setJurisdiction}>
          <option value="">全部司法管辖区</option>
          {TCSP_JURISDICTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
        </SelectField>
        <SelectField value={customerLevel} onChange={setCustomerLevel}>
          <option value="">全部客户级别</option>
          {TCSP_CUSTOMER_LEVELS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
        </SelectField>
      </div>

      <div className="overflow-hidden rounded-lg" style={card}>
        <table className="w-full text-left text-sm">
          <thead style={{ background: '#111108', color: 'var(--muted-foreground)' }}>
            <tr>
              <th className="px-4 py-3 font-medium">维度</th>
              <th className="px-4 py-3 font-medium">服务</th>
              <th className="px-4 py-3 text-right font-medium">价格</th>
              <th className="px-4 py-3 font-medium">备注</th>
              <th className="px-4 py-3 text-right font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {prices.map(price => {
              const editing = editingId === price.id
              return (
                <tr key={price.id} style={{ borderTop: '1px solid #1E1C15' }}>
                  {editing ? (
                    <td colSpan={4} className="px-4 py-4 align-top">
                      <PriceFields value={editDraft} onChange={setEditDraft} />
                    </td>
                  ) : (
                    <>
                      <td className="px-4 py-3 align-top">
                        <p className="font-medium" style={{ color: 'var(--foreground)' }}>{price.jurisdiction}</p>
                        <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{tcspCustomerLevelLabel(price.customerLevel)}</p>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <p className="font-medium" style={{ color: 'var(--foreground)' }}>{price.serviceName}</p>
                        <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{price.serviceCategory}</p>
                      </td>
                      <td className="px-4 py-3 text-right align-top font-mono" style={{ color: 'var(--foreground)' }}>
                        {price.currency} {Number(price.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3 align-top">
                        <p className="max-w-md whitespace-pre-wrap" style={{ color: 'var(--muted-foreground)' }}>{price.notes || '—'}</p>
                      </td>
                    </>
                  )}
                  <td className="px-4 py-3 align-top">
                    <div className="flex justify-end gap-2">
                      {editing ? (
                        <>
                          <Button size="sm" onClick={() => savePrice(price)} disabled={savingId === price.id}>
                            <Save size={14} className="mr-1" /> {savingId === price.id ? '保存中' : '保存'}
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => setEditingId(null)}>
                            <X size={14} />
                          </Button>
                        </>
                      ) : (
                        <>
                          {canEdit && (
                            <Button variant="outline" size="sm" onClick={() => { setEditingId(price.id); setEditDraft(priceToDraft(price)) }}>
                              <Edit3 size={14} className="mr-1" /> 编辑
                            </Button>
                          )}
                          {canDelete && (
                            <Button variant="outline" size="sm" onClick={() => deletePrice(price)} disabled={deletingId === price.id}>
                              <Trash2 size={14} className="mr-1" /> {deletingId === price.id ? '删除中' : '删除'}
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
            {!loading && prices.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-sm" style={{ color: 'var(--muted-foreground)' }}>
                  暂无价格配置。
                </td>
              </tr>
            )}
            {loading && (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-sm" style={{ color: 'var(--muted-foreground)' }}>
                  载入中...
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: 'rgba(0,0,0,0.55)' }}>
          <div className="w-full max-w-2xl rounded-lg p-5 shadow-xl" style={{ ...card, background: '#0A0805' }}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>新增价格配置</h2>
                <p className="mt-1 text-xs" style={{ color: 'var(--muted-foreground)' }}>
                  同一司法管辖区、客户级别、服务分类和服务项只能有一条价格。
                </p>
              </div>
              <button type="button" onClick={() => setCreateOpen(false)} className="rounded-md p-1.5" style={{ color: 'var(--muted-foreground)' }}>
                <X size={16} />
              </button>
            </div>
            <div className="mt-5">
              <PriceFields value={draft} onChange={setDraft} />
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setCreateOpen(false)}>取消</Button>
              <Button onClick={createPrice} disabled={creating}>
                <Plus size={15} className="mr-2" /> {creating ? '新增中...' : '新增价格'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
