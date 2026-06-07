'use client'

/* eslint-disable react-hooks/set-state-in-effect */

import { useCallback, useEffect, useState } from 'react'
import { Link, useRouter } from '@/i18n/navigation'
import { toast } from 'sonner'
import { FlaskConical, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { formatWeight } from '@/lib/cosmocoat/recipes'

type SampleOrderRow = {
  id: string
  code: string
  status: 'DRAFT' | 'IN_PROGRESS' | 'COMPLETED'
  notes: string
  referenceImageUrl: string | null
  startedAt: string | null
  completedAt: string | null
  createdAt: string
  customer: { id: string; code: string; name: string; phone: string | null }
  processKitCount: number
  colorFormulaCount: number
  totalQuantityKg: number
}

const card: React.CSSProperties = {
  background: 'var(--card)',
  border: '1px solid var(--border)',
  borderRadius: '0.75rem',
}

const th: React.CSSProperties = {
  textAlign: 'left',
  padding: '0.75rem 1rem',
  fontWeight: 500,
  fontSize: '0.8125rem',
  color: 'var(--muted-foreground)',
  background: '#111108',
  borderBottom: '1px solid #2A2418',
  whiteSpace: 'nowrap',
}

const td: React.CSSProperties = {
  padding: '0.75rem 1rem',
  fontSize: '0.875rem',
  color: 'var(--muted-foreground)',
  borderBottom: '1px solid #1E1C15',
}

const STATUS_LABEL: Record<SampleOrderRow['status'], string> = {
  DRAFT: '草稿',
  IN_PROGRESS: '进行中',
  COMPLETED: '已完成',
}

const STATUS_STYLE: Record<SampleOrderRow['status'], { bg: string; text: string }> = {
  DRAFT: { bg: 'rgba(148,163,184,0.15)', text: '#94a3b8' },
  IN_PROGRESS: { bg: 'rgba(56,189,248,0.15)', text: '#38bdf8' },
  COMPLETED: { bg: 'rgba(16,185,129,0.15)', text: '#10b981' },
}

function inputStyle(): React.CSSProperties {
  return {
    background: '#0E0E0A',
    border: '1px solid #2A2418',
    color: 'var(--foreground)',
  }
}

export default function AdminCosmoCoatSampleOrdersPage() {
  const router = useRouter()
  const [items, setItems] = useState<SampleOrderRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const fetchItems = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: '50' })
      if (search.trim()) params.set('q', search.trim())
      if (statusFilter) params.set('status', statusFilter)
      const res = await fetch(`/api/admin/cosmocoat/sample-orders?${params}`)
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? '加载失败')
        return
      }
      setItems(data.items ?? [])
      setTotal(data.total ?? 0)
      setTotalPages(data.totalPages ?? 1)
    } catch {
      toast.error('加载失败')
    } finally {
      setLoading(false)
    }
  }, [page, search, statusFilter])

  useEffect(() => {
    const timer = setTimeout(fetchItems, search ? 300 : 0)
    return () => clearTimeout(timer)
  }, [fetchItems, search])

  useEffect(() => {
    setPage(1)
  }, [search, statusFilter])

  async function deleteOrder(order: SampleOrderRow) {
    if (!window.confirm(`确定删除打样单「${order.code}」？`)) return
    setDeletingId(order.id)
    try {
      const res = await fetch(`/api/admin/cosmocoat/sample-orders/${order.id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? '删除失败')
        return
      }
      toast.success('已删除')
      fetchItems()
    } catch {
      toast.error('删除失败')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>打样单管理</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
            关联客户，从工艺书与调色配方中选择打样项目并填写数量（kg），跟踪打样进度。
          </p>
        </div>
        <Link
          href="/admin/cosmocoat-sample-orders/new"
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
          style={{ background: '#C9A96E', color: '#0A0805' }}
        >
          <Plus size={15} /> 新建打样单
        </Link>
      </div>

      <div style={card} className="p-4 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--muted-foreground)' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="搜索打样单号、客户..."
            className="w-full pl-8 pr-3 py-2 rounded-lg text-sm outline-none"
            style={inputStyle()}
          />
        </div>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="px-3 py-2 rounded-lg text-sm outline-none"
          style={inputStyle()}
        >
          <option value="">全部状态</option>
          <option value="DRAFT">草稿</option>
          <option value="IN_PROGRESS">进行中</option>
          <option value="COMPLETED">已完成</option>
        </select>
      </div>

      <div style={{ ...card, overflow: 'hidden' }}>
        {loading ? (
          <div className="py-16 text-center text-sm" style={{ color: 'var(--muted-foreground)' }}>加载中...</div>
        ) : items.length === 0 ? (
          <div className="py-16 text-center space-y-3">
            <FlaskConical size={32} className="mx-auto" style={{ color: '#5A5040' }} />
            <p className="text-sm" style={{ color: '#5A5040' }}>暂无打样单，点击「新建打样单」开始。</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th style={th}>打样单号</th>
                  <th style={th}>参考样品</th>
                  <th style={th}>客户</th>
                  <th style={th}>工艺书</th>
                  <th style={th}>调色配方</th>
                  <th style={th}>合计重量</th>
                  <th style={th}>状态</th>
                  <th style={th}>创建时间</th>
                  <th style={{ ...th, textAlign: 'right' }}>操作</th>
                </tr>
              </thead>
              <tbody>
                {items.map(order => (
                  <tr
                    key={order.id}
                    className="cursor-pointer transition-colors hover:bg-[#111108]"
                    onClick={() => router.push(`/admin/cosmocoat-sample-orders/${order.id}`)}
                  >
                    <td style={{ ...td, color: 'var(--foreground)', fontWeight: 500 }}>{order.code}</td>
                    <td style={td} onClick={e => e.stopPropagation()}>
                      {order.referenceImageUrl ? (
                        <img
                          src={order.referenceImageUrl}
                          alt={`${order.code} 参考样品`}
                          className="h-10 w-10 rounded object-cover border"
                          style={{ borderColor: '#2A2418' }}
                        />
                      ) : (
                        <span className="text-xs" style={{ color: '#5A5040' }}>—</span>
                      )}
                    </td>
                    <td style={td}>
                      <span className="font-mono text-xs mr-1.5 opacity-70">{order.customer.code}</span>
                      {order.customer.name}
                    </td>
                    <td style={td}>{order.processKitCount}</td>
                    <td style={td}>{order.colorFormulaCount}</td>
                    <td style={td}>{formatWeight(order.totalQuantityKg)} kg</td>
                    <td style={td}>
                      <span
                        className="inline-flex px-2 py-0.5 rounded text-xs font-medium"
                        style={{ background: STATUS_STYLE[order.status].bg, color: STATUS_STYLE[order.status].text }}
                      >
                        {STATUS_LABEL[order.status]}
                      </span>
                    </td>
                    <td style={td}>{new Date(order.createdAt).toLocaleDateString('zh-CN')}</td>
                    <td style={{ ...td, textAlign: 'right' }} onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <Link
                          href={`/admin/cosmocoat-sample-orders/${order.id}`}
                          className="p-1.5 rounded hover:bg-[#1E1C15]"
                          title="编辑"
                        >
                          <Pencil size={14} />
                        </Link>
                        {order.status !== 'IN_PROGRESS' && (
                          <button
                            type="button"
                            className="p-1.5 rounded hover:bg-[#1E1C15] disabled:opacity-40"
                            disabled={deletingId === order.id}
                            onClick={() => deleteOrder(order)}
                            title="删除"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm" style={{ color: 'var(--muted-foreground)' }}>
          <span>共 {total} 条</span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage(p => p - 1)}
              className="px-3 py-1 rounded disabled:opacity-40"
              style={inputStyle()}
            >
              上一页
            </button>
            <span>{page} / {totalPages}</span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage(p => p + 1)}
              className="px-3 py-1 rounded disabled:opacity-40"
              style={inputStyle()}
            >
              下一页
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
