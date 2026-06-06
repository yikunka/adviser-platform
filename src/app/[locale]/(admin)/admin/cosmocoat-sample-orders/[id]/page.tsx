'use client'

/* eslint-disable react-hooks/set-state-in-effect */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { Link, useRouter } from '@/i18n/navigation'
import { toast } from 'sonner'
import { ArrowLeft, CheckCircle2, PlayCircle, Plus, Save, Search, X } from 'lucide-react'
import { formatPercent, formatWeight } from '@/lib/cosmocoat/recipes'
import type { SampleOrderRow } from '@/lib/cosmocoat/sample-orders'

type CustomerOption = { id: string; code: string; name: string }
type ProcessKitOption = { id: string; code: string; name: string; status: string }
type ColorFormulaOption = { id: string; code: string; name: string; categoryLabel: string; targetColor: string }

type ProcessKitLine = {
  key: string
  processKitId: string
  code: string
  name: string
  quantityKg: string
  notes: string
}

type ColorFormulaLine = {
  key: string
  colorFormulaId: string
  code: string
  name: string
  categoryLabel: string
  quantityKg: string
  notes: string
}

const card: React.CSSProperties = {
  background: 'var(--card)',
  border: '1px solid var(--border)',
  borderRadius: '0.75rem',
}

const th: React.CSSProperties = {
  textAlign: 'left',
  padding: '0.6rem 0.75rem',
  fontWeight: 500,
  fontSize: '0.8125rem',
  color: 'var(--muted-foreground)',
  background: '#111108',
  borderBottom: '1px solid #2A2418',
  whiteSpace: 'nowrap',
}

const td: React.CSSProperties = {
  padding: '0.6rem 0.75rem',
  fontSize: '0.8125rem',
  color: 'var(--muted-foreground)',
  borderBottom: '1px solid #1E1C15',
}

const STATUS_LABEL = {
  DRAFT: '草稿',
  IN_PROGRESS: '进行中',
  COMPLETED: '已完成',
} as const

function inputStyle(): React.CSSProperties {
  return {
    background: '#0E0E0A',
    border: '1px solid #2A2418',
    color: 'var(--foreground)',
  }
}

function newKey() {
  return `line-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

function formatDatetime(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>{label}</label>
      {children}
    </div>
  )
}

function ProgressSteps({ status, startedAt, completedAt }: { status: SampleOrderRow['status']; startedAt: string | null; completedAt: string | null }) {
  const steps = [
    { key: 'DRAFT', label: '草稿' },
    { key: 'IN_PROGRESS', label: '进行中' },
    { key: 'COMPLETED', label: '已完成' },
  ] as const
  const activeIndex = status === 'DRAFT' ? 0 : status === 'IN_PROGRESS' ? 1 : 2

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        {steps.map((step, index) => (
          <div key={step.key} className="flex items-center gap-2 flex-1">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold shrink-0"
              style={{
                background: index <= activeIndex ? '#C9A96E' : '#1E1C15',
                color: index <= activeIndex ? '#0A0805' : '#756A58',
              }}
            >
              {index + 1}
            </div>
            <span className="text-sm" style={{ color: index <= activeIndex ? 'var(--foreground)' : 'var(--muted-foreground)' }}>
              {step.label}
            </span>
            {index < steps.length - 1 && (
              <div className="flex-1 h-px mx-2" style={{ background: index < activeIndex ? '#C9A96E' : '#2A2418' }} />
            )}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-4 text-xs" style={{ color: 'var(--muted-foreground)' }}>
        <div>开始时间：{formatDatetime(startedAt)}</div>
        <div>完成时间：{formatDatetime(completedAt)}</div>
      </div>
    </div>
  )
}

export default function AdminCosmoCoatSampleOrderDetailPage() {
  const params = useParams()
  const router = useRouter()
  const orderId = params.id as string
  const isNew = orderId === 'new'

  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [order, setOrder] = useState<SampleOrderRow | null>(null)
  const [customerId, setCustomerId] = useState('')
  const [notes, setNotes] = useState('')
  const [processKitLines, setProcessKitLines] = useState<ProcessKitLine[]>([])
  const [colorFormulaLines, setColorFormulaLines] = useState<ColorFormulaLine[]>([])

  const [customers, setCustomers] = useState<CustomerOption[]>([])
  const [kitOptions, setKitOptions] = useState<ProcessKitOption[]>([])
  const [formulaOptions, setFormulaOptions] = useState<ColorFormulaOption[]>([])
  const [kitSearch, setKitSearch] = useState('')
  const [formulaSearch, setFormulaSearch] = useState('')

  const isReadOnly = !isNew && order?.status === 'COMPLETED'
  const status = order?.status ?? 'DRAFT'

  const fetchCustomers = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/cosmocoat/sample-orders/picker/customers?limit=200')
      const data = await res.json()
      if (!res.ok) return
      setCustomers((data.customers ?? []).map((c: CustomerOption) => ({ id: c.id, code: c.code, name: c.name })))
    } catch {
      // silent
    }
  }, [])

  const fetchKitOptions = useCallback(async (q: string) => {
    try {
      const params = new URLSearchParams({ limit: '50' })
      if (q.trim()) params.set('q', q.trim())
      const res = await fetch(`/api/admin/cosmocoat/sample-orders/picker/process-kits?${params}`)
      const data = await res.json()
      if (!res.ok) return
      setKitOptions((data.items ?? []).map((kit: ProcessKitOption) => ({
        id: kit.id,
        code: kit.code,
        name: kit.name,
        status: kit.status,
      })))
    } catch {
      // silent
    }
  }, [])

  const fetchFormulaOptions = useCallback(async (q: string) => {
    try {
      const params = new URLSearchParams({ limit: '50' })
      if (q.trim()) params.set('q', q.trim())
      const res = await fetch(`/api/admin/cosmocoat/sample-orders/picker/color-formulas?${params}`)
      const data = await res.json()
      if (!res.ok) return
      setFormulaOptions((data.items ?? []).map((f: ColorFormulaOption) => ({
        id: f.id,
        code: f.code,
        name: f.name,
        categoryLabel: f.categoryLabel,
        targetColor: f.targetColor,
      })))
    } catch {
      // silent
    }
  }, [])

  const fetchOrder = useCallback(async () => {
    if (isNew) return
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/cosmocoat/sample-orders/${orderId}`)
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? '加载失败')
        return
      }
      const loaded = data.order as SampleOrderRow
      setOrder(loaded)
      setCustomerId(loaded.customer.id)
      setNotes(loaded.notes)
      setProcessKitLines(loaded.processKits.map(line => ({
        key: line.id,
        processKitId: line.processKitId,
        code: line.processKit.code,
        name: line.processKit.name,
        quantityKg: String(line.quantityKg),
        notes: line.notes,
      })))
      setColorFormulaLines(loaded.colorFormulas.map(line => ({
        key: line.id,
        colorFormulaId: line.colorFormulaId,
        code: line.colorFormula.code,
        name: line.colorFormula.name,
        categoryLabel: line.colorFormula.categoryLabel,
        quantityKg: String(line.quantityKg),
        notes: line.notes,
      })))
    } catch {
      toast.error('加载失败')
    } finally {
      setLoading(false)
    }
  }, [isNew, orderId])

  useEffect(() => { fetchCustomers() }, [fetchCustomers])
  useEffect(() => { fetchOrder() }, [fetchOrder])
  useEffect(() => {
    const timer = setTimeout(() => fetchKitOptions(kitSearch), kitSearch ? 300 : 0)
    return () => clearTimeout(timer)
  }, [fetchKitOptions, kitSearch])
  useEffect(() => {
    const timer = setTimeout(() => fetchFormulaOptions(formulaSearch), formulaSearch ? 300 : 0)
    return () => clearTimeout(timer)
  }, [fetchFormulaOptions, formulaSearch])

  const selectedKitIds = useMemo(() => new Set(processKitLines.map(l => l.processKitId)), [processKitLines])
  const selectedFormulaIds = useMemo(() => new Set(colorFormulaLines.map(l => l.colorFormulaId)), [colorFormulaLines])

  function addProcessKit(kit: ProcessKitOption) {
    if (selectedKitIds.has(kit.id)) {
      toast.error('该工艺书已添加')
      return
    }
    setProcessKitLines(prev => [...prev, {
      key: newKey(),
      processKitId: kit.id,
      code: kit.code,
      name: kit.name,
      quantityKg: '1',
      notes: '',
    }])
  }

  function addColorFormula(formula: ColorFormulaOption) {
    if (selectedFormulaIds.has(formula.id)) {
      toast.error('该调色配方已添加')
      return
    }
    setColorFormulaLines(prev => [...prev, {
      key: newKey(),
      colorFormulaId: formula.id,
      code: formula.code,
      name: formula.name,
      categoryLabel: formula.categoryLabel,
      quantityKg: '1',
      notes: '',
    }])
  }

  function buildPayload(extra?: { status?: SampleOrderRow['status'] }) {
    const processKits = processKitLines.map((line, index) => ({
      processKitId: line.processKitId,
      quantityKg: Number(line.quantityKg),
      sortOrder: index,
      notes: line.notes,
    }))
    const colorFormulas = colorFormulaLines.map((line, index) => ({
      colorFormulaId: line.colorFormulaId,
      quantityKg: Number(line.quantityKg),
      sortOrder: processKitLines.length + index,
      notes: line.notes,
    }))
    return {
      customerId,
      notes,
      processKits,
      colorFormulas,
      ...extra,
    }
  }

  async function save(extra?: { status?: SampleOrderRow['status'] }) {
    if (!customerId) {
      toast.error('请选择客户')
      return
    }
    if (processKitLines.length === 0 && colorFormulaLines.length === 0) {
      toast.error('请至少添加一条工艺书或调色配方')
      return
    }
    for (const line of processKitLines) {
      if (!line.quantityKg || Number(line.quantityKg) <= 0) {
        toast.error(`工艺书「${line.name}」数量无效`)
        return
      }
    }
    for (const line of colorFormulaLines) {
      if (!line.quantityKg || Number(line.quantityKg) <= 0) {
        toast.error(`调色配方「${line.name}」数量无效`)
        return
      }
    }

    setSaving(true)
    try {
      const payload = buildPayload(extra)
      const res = isNew
        ? await fetch('/api/admin/cosmocoat/sample-orders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
        : await fetch(`/api/admin/cosmocoat/sample-orders/${orderId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? '保存失败')
        return
      }
      toast.success(extra?.status === 'IN_PROGRESS' ? '已开始打样' : extra?.status === 'COMPLETED' ? '已标记完成' : '已保存')
      if (isNew) {
        router.replace(`/admin/cosmocoat-sample-orders/${data.order.id}`)
      } else {
        setOrder(data.order)
      }
    } catch {
      toast.error('保存失败')
    } finally {
      setSaving(false)
    }
  }

  async function updateStatus(next: SampleOrderRow['status']) {
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/cosmocoat/sample-orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? '状态更新失败')
        return
      }
      setOrder(data.order)
      toast.success(next === 'IN_PROGRESS' ? '已开始打样' : '已标记完成')
    } catch {
      toast.error('状态更新失败')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="p-6 text-sm" style={{ color: 'var(--muted-foreground)' }}>加载中...</div>
  }

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/admin/cosmocoat-sample-orders" className="p-2 rounded-lg hover:bg-[#111108]">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>
              {isNew ? '新建打样单' : order?.code ?? '打样单详情'}
            </h1>
            {!isNew && (
              <p className="text-sm mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                状态：{STATUS_LABEL[status]}
              </p>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {!isReadOnly && (
            <button
              type="button"
              disabled={saving}
              onClick={() => save()}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
              style={{ background: '#C9A96E', color: '#0A0805' }}
            >
              <Save size={15} /> 保存
            </button>
          )}
          {!isNew && status === 'DRAFT' && (
            <button
              type="button"
              disabled={saving}
              onClick={() => save({ status: 'IN_PROGRESS' })}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
              style={{ background: '#38bdf822', color: '#38bdf8', border: '1px solid #38bdf844' }}
            >
              <PlayCircle size={15} /> 开始打样
            </button>
          )}
          {!isNew && status === 'IN_PROGRESS' && (
            <button
              type="button"
              disabled={saving}
              onClick={() => updateStatus('COMPLETED')}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
              style={{ background: '#10b98122', color: '#10b981', border: '1px solid #10b98144' }}
            >
              <CheckCircle2 size={15} /> 标记完成
            </button>
          )}
        </div>
      </div>

      {!isNew && order && (
        <div style={card} className="p-5">
          <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--foreground)' }}>进度追踪</h2>
          <ProgressSteps status={order.status} startedAt={order.startedAt} completedAt={order.completedAt} />
        </div>
      )}

      <div style={card} className="p-5 space-y-4">
        <h2 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>基本信息</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="客户 *">
            <select
              value={customerId}
              disabled={isReadOnly}
              onChange={e => setCustomerId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none disabled:opacity-60"
              style={inputStyle()}
            >
              <option value="">选择客户...</option>
              {customers.map(c => (
                <option key={c.id} value={c.id}>{c.code} · {c.name}</option>
              ))}
            </select>
          </Field>
          <Field label="备注">
            <textarea
              value={notes}
              disabled={isReadOnly}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-y disabled:opacity-60"
              style={inputStyle()}
              placeholder="打样要求、交付说明等"
            />
          </Field>
        </div>
      </div>

      <div style={card} className="p-5 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>工艺书明细</h2>
          {!isReadOnly && <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>从现有工艺书中选择并填写打样数量（kg）</span>}
        </div>

        {!isReadOnly && (
          <div className="space-y-2">
            <div className="relative max-w-md">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--muted-foreground)' }} />
              <input
                value={kitSearch}
                onChange={e => setKitSearch(e.target.value)}
                placeholder="搜索工艺书编号或名称..."
                className="w-full pl-8 pr-3 py-2 rounded-lg text-sm outline-none"
                style={inputStyle()}
              />
            </div>
            {kitOptions.length > 0 && (
              <div className="border rounded-lg overflow-hidden" style={{ borderColor: '#2A2418' }}>
                {kitOptions.filter(k => !selectedKitIds.has(k.id)).slice(0, 8).map(kit => (
                  <button
                    key={kit.id}
                    type="button"
                    onClick={() => addProcessKit(kit)}
                    className="w-full flex items-center justify-between px-3 py-2 text-left text-sm hover:bg-[#111108] border-b last:border-b-0"
                    style={{ borderColor: '#1E1C15', color: 'var(--foreground)' }}
                  >
                    <span><span className="font-mono text-xs opacity-70 mr-2">{kit.code}</span>{kit.name}</span>
                    <Plus size={14} style={{ color: '#C9A96E' }} />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {processKitLines.length === 0 ? (
          <p className="text-sm py-4 text-center" style={{ color: '#5A5040' }}>尚未添加工艺书</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th style={th}>工艺书</th>
                  <th style={th}>数量 (kg)</th>
                  <th style={th}>备注</th>
                  {!isReadOnly && <th style={{ ...th, width: 48 }} />}
                </tr>
              </thead>
              <tbody>
                {processKitLines.map(line => (
                  <tr key={line.key}>
                    <td style={{ ...td, color: 'var(--foreground)' }}>
                      <span className="font-mono text-xs mr-2 opacity-70">{line.code}</span>
                      {line.name}
                    </td>
                    <td style={td}>
                      <input
                        type="number"
                        min="0.001"
                        step="0.001"
                        disabled={isReadOnly}
                        value={line.quantityKg}
                        onChange={e => setProcessKitLines(prev => prev.map(row => row.key === line.key ? { ...row, quantityKg: e.target.value } : row))}
                        className="w-28 px-2 py-1 rounded text-sm outline-none disabled:opacity-60"
                        style={inputStyle()}
                      />
                    </td>
                    <td style={td}>
                      <input
                        disabled={isReadOnly}
                        value={line.notes}
                        onChange={e => setProcessKitLines(prev => prev.map(row => row.key === line.key ? { ...row, notes: e.target.value } : row))}
                        className="w-full min-w-[160px] px-2 py-1 rounded text-sm outline-none disabled:opacity-60"
                        style={inputStyle()}
                      />
                    </td>
                    {!isReadOnly && (
                      <td style={td}>
                        <button
                          type="button"
                          onClick={() => setProcessKitLines(prev => prev.filter(row => row.key !== line.key))}
                          className="p-1 rounded hover:bg-[#1E1C15]"
                        >
                          <X size={14} />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div style={card} className="p-5 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>调色配方明细</h2>
          {!isReadOnly && <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>从现有调色配方中选择并填写打样数量（kg）</span>}
        </div>

        {!isReadOnly && (
          <div className="space-y-2">
            <div className="relative max-w-md">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--muted-foreground)' }} />
              <input
                value={formulaSearch}
                onChange={e => setFormulaSearch(e.target.value)}
                placeholder="搜索调色配方编号或名称..."
                className="w-full pl-8 pr-3 py-2 rounded-lg text-sm outline-none"
                style={inputStyle()}
              />
            </div>
            {formulaOptions.length > 0 && (
              <div className="border rounded-lg overflow-hidden" style={{ borderColor: '#2A2418' }}>
                {formulaOptions.filter(f => !selectedFormulaIds.has(f.id)).slice(0, 8).map(formula => (
                  <button
                    key={formula.id}
                    type="button"
                    onClick={() => addColorFormula(formula)}
                    className="w-full flex items-center justify-between px-3 py-2 text-left text-sm hover:bg-[#111108] border-b last:border-b-0"
                    style={{ borderColor: '#1E1C15', color: 'var(--foreground)' }}
                  >
                    <span>
                      <span className="font-mono text-xs opacity-70 mr-2">{formula.code}</span>
                      {formula.name}
                      {formula.targetColor && <span className="text-xs ml-2 opacity-60">· {formula.targetColor}</span>}
                    </span>
                    <Plus size={14} style={{ color: '#C9A96E' }} />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {colorFormulaLines.length === 0 ? (
          <p className="text-sm py-4 text-center" style={{ color: '#5A5040' }}>尚未添加调色配方</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th style={th}>调色配方</th>
                  <th style={th}>类别</th>
                  <th style={th}>数量 (kg)</th>
                  <th style={th}>备注</th>
                  {!isReadOnly && <th style={{ ...th, width: 48 }} />}
                </tr>
              </thead>
              <tbody>
                {colorFormulaLines.map(line => (
                  <tr key={line.key}>
                    <td style={{ ...td, color: 'var(--foreground)' }}>
                      <span className="font-mono text-xs mr-2 opacity-70">{line.code}</span>
                      {line.name}
                    </td>
                    <td style={td}>{line.categoryLabel || '—'}</td>
                    <td style={td}>
                      <input
                        type="number"
                        min="0.001"
                        step="0.001"
                        disabled={isReadOnly}
                        value={line.quantityKg}
                        onChange={e => setColorFormulaLines(prev => prev.map(row => row.key === line.key ? { ...row, quantityKg: e.target.value } : row))}
                        className="w-28 px-2 py-1 rounded text-sm outline-none disabled:opacity-60"
                        style={inputStyle()}
                      />
                    </td>
                    <td style={td}>
                      <input
                        disabled={isReadOnly}
                        value={line.notes}
                        onChange={e => setColorFormulaLines(prev => prev.map(row => row.key === line.key ? { ...row, notes: e.target.value } : row))}
                        className="w-full min-w-[160px] px-2 py-1 rounded text-sm outline-none disabled:opacity-60"
                        style={inputStyle()}
                      />
                    </td>
                    {!isReadOnly && (
                      <td style={td}>
                        <button
                          type="button"
                          onClick={() => setColorFormulaLines(prev => prev.filter(row => row.key !== line.key))}
                          className="p-1 rounded hover:bg-[#1E1C15]"
                        >
                          <X size={14} />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {!isNew && order && (order.processKits.length > 0 || order.colorFormulas.length > 0) && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold" style={{ color: 'var(--foreground)' }}>工艺参数与配方内容</h2>

          {order.processKits.map(line => (
            <div key={line.id} style={card} className="p-5 space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="font-medium" style={{ color: 'var(--foreground)' }}>
                    工艺书 · {line.processKit.code} · {line.processKit.name}
                  </h3>
                  <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
                    打样数量：{formatWeight(line.quantityKg)} kg
                  </p>
                </div>
                <Link
                  href={`/admin/cosmocoat-process-kits/${line.processKitId}`}
                  className="text-xs underline"
                  style={{ color: '#C9A96E' }}
                >
                  打开工艺书
                </Link>
              </div>

              {line.processKit.performanceStandards.length > 0 && (
                <div>
                  <p className="text-xs font-medium mb-2" style={{ color: 'var(--muted-foreground)' }}>性能测试标准</p>
                  <div className="flex flex-wrap gap-1.5">
                    {line.processKit.performanceStandards.map(std => (
                      <span key={std} className="px-2 py-0.5 rounded text-xs" style={{ background: '#111108', color: 'var(--foreground)' }}>
                        {std}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {line.processKit.products.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr>
                        <th style={th}>产品</th>
                        <th style={th}>IR 时间</th>
                        <th style={th}>IR 温度</th>
                        <th style={th}>UV 能量</th>
                        <th style={th}>膜厚</th>
                        <th style={th}>喷涂粘度</th>
                      </tr>
                    </thead>
                    <tbody>
                      {line.processKit.products.map(product => (
                        <tr key={product.id}>
                          <td style={{ ...td, color: 'var(--foreground)' }}>{product.productName}</td>
                          <td style={td}>{product.irMinutes || '—'}</td>
                          <td style={td}>{product.irTemperature || '—'}</td>
                          <td style={td}>{product.uvEnergy || '—'}</td>
                          <td style={td}>{product.filmThickness || '—'}</td>
                          <td style={td}>{product.sprayViscosity || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {line.processKit.processFlowDocument && (
                <div>
                  <p className="text-xs font-medium mb-2" style={{ color: 'var(--muted-foreground)' }}>完整工艺流程</p>
                  <pre className="text-xs whitespace-pre-wrap rounded-lg p-3 font-sans leading-relaxed" style={{ background: '#0E0E0A', color: 'var(--foreground)' }}>
                    {line.processKit.processFlowDocument}
                  </pre>
                </div>
              )}
            </div>
          ))}

          {order.colorFormulas.map(line => (
            <div key={line.id} style={card} className="p-5 space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="font-medium" style={{ color: 'var(--foreground)' }}>
                    调色配方 · {line.colorFormula.code} · {line.colorFormula.name}
                  </h3>
                  <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
                    目标色：{line.colorFormula.targetColor || '—'} · 打样数量：{formatWeight(line.quantityKg)} kg
                    {line.colorFormula.factoryProduct && (
                      <> · 适用产品：{line.colorFormula.factoryProduct.productCode} · {line.colorFormula.factoryProduct.name}</>
                    )}
                  </p>
                </div>
                <Link
                  href={`/admin/cosmocoat-color-formulas/${line.colorFormulaId}`}
                  className="text-xs underline"
                  style={{ color: '#C9A96E' }}
                >
                  打开调色配方
                </Link>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr>
                      <th style={th}>序号</th>
                      <th style={th}>生产编号</th>
                      <th style={th}>原料/产品名称</th>
                      <th style={th}>用量 (kg)</th>
                      <th style={th}>占比</th>
                    </tr>
                  </thead>
                  <tbody>
                    {line.scaledItems.map((item, index) => (
                      <tr key={item.id}>
                        <td style={td}>{index + 1}</td>
                        <td style={td}>{item.productionCode || '—'}</td>
                        <td style={{ ...td, color: 'var(--foreground)' }}>{item.name || '—'}</td>
                        <td style={td}>{formatWeight(item.scaledQuantity)}</td>
                        <td style={td}>{item.scaledPercentage != null ? formatPercent(item.scaledPercentage) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
