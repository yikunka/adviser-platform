'use client'

/* eslint-disable react-hooks/set-state-in-effect */

import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Link, useRouter } from '@/i18n/navigation'
import { toast } from 'sonner'
import { BookOpen, ClipboardCheck, Pencil, Plus, Search, Trash2 } from 'lucide-react'

type ProcessKitRow = {
  id: string
  code: string
  name: string
  description: string | null
  status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED'
  productCount: number
  testCount: number
  createdByName: string | null
  createdAt: string
  updatedAt: string
}

type PendingChangeRequest = {
  id: string
  kitId: string
  action: 'UPDATE' | 'DELETE'
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  createdAt: string
  requestNote: string
  kit: {
    id: string
    code: string
    name: string
    status: string
  }
  requestedBy: { id: string; nameEn: string | null; email: string }
  changeSummary: string[]
  changeDiff: Array<{
    section: string
    label: string
    before: string
    after: string
  }>
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

function inputStyle(): React.CSSProperties {
  return {
    background: '#0E0E0A',
    border: '1px solid #2A2418',
    color: 'var(--foreground)',
  }
}

function actionLabel(action: PendingChangeRequest['action']) {
  return action === 'DELETE' ? '删除工艺书' : '修改工艺书'
}

function requesterLabel(request: PendingChangeRequest) {
  return request.requestedBy.nameEn?.trim() || request.requestedBy.email
}

function PendingApprovalsPanel({
  items,
  onReviewed,
}: {
  items: PendingChangeRequest[]
  onReviewed: () => void
}) {
  const [reviewingId, setReviewingId] = useState<string | null>(null)
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({})

  async function reviewRequest(request: PendingChangeRequest, action: 'APPROVE' | 'REJECT') {
    const confirmText = action === 'APPROVE'
      ? `确定批准「${request.kit.name}」的${actionLabel(request.action)}请求？`
      : `确定驳回「${request.kit.name}」的${actionLabel(request.action)}请求？`
    if (!window.confirm(confirmText)) return

    setReviewingId(request.id)
    try {
      const res = await fetch(`/api/admin/cosmocoat/process-kit-change-requests/${request.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, reviewNote: reviewNotes[request.id] ?? '' }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? '审批失败')
        return
      }
      toast.success(action === 'APPROVE' ? '已批准' : '已驳回')
      setReviewNotes(prev => {
        const next = { ...prev }
        delete next[request.id]
        return next
      })
      onReviewed()
    } catch {
      toast.error('审批失败')
    } finally {
      setReviewingId(null)
    }
  }

  if (items.length === 0) return null

  return (
    <div style={card} className="p-4 space-y-4">
      <div className="flex items-center gap-2">
        <ClipboardCheck size={18} style={{ color: '#C9A96E' }} />
        <h2 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
          待审批变更（{items.length}）
        </h2>
      </div>
      <div className="space-y-3">
        {items.map(request => (
          <div key={request.id} className="rounded-lg p-4 space-y-3" style={{ background: '#111108', border: '1px solid #2A2418' }}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className="inline-flex px-2 py-0.5 rounded-md text-xs font-medium"
                    style={{
                      background: request.action === 'DELETE' ? 'rgba(239,68,68,0.12)' : 'rgba(201,169,110,0.12)',
                      color: request.action === 'DELETE' ? '#ef4444' : '#C9A96E',
                    }}
                  >
                    {actionLabel(request.action)}
                  </span>
                  <Link href={`/admin/cosmocoat-process-kits/${request.kit.id}`} className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                    {request.kit.code} · {request.kit.name}
                  </Link>
                </div>
                <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                  提交人：{requesterLabel(request)} · {new Date(request.createdAt).toLocaleString('zh-CN')}
                </p>
                {request.requestNote && (
                  <p className="text-xs" style={{ color: '#9A8060' }}>说明：{request.requestNote}</p>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={reviewingId === request.id}
                  onClick={() => reviewRequest(request, 'APPROVE')}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-50"
                  style={{ background: '#4A9F52', color: '#fff' }}
                >
                  批准
                </button>
                <button
                  type="button"
                  disabled={reviewingId === request.id}
                  onClick={() => reviewRequest(request, 'REJECT')}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-50"
                  style={{ border: '1px solid rgba(239,68,68,0.35)', color: '#ef4444' }}
                >
                  驳回
                </button>
              </div>
            </div>

            {request.changeSummary.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {request.changeSummary.map(item => (
                  <span
                    key={item}
                    className="rounded-md px-2 py-1 text-xs"
                    style={{ background: 'rgba(201,169,110,0.1)', color: '#C9A96E', border: '1px solid rgba(201,169,110,0.2)' }}
                  >
                    {item}
                  </span>
                ))}
              </div>
            )}

            {request.changeDiff.length > 0 && (
              <div className="overflow-x-auto rounded-lg" style={{ border: '1px solid #2A2418' }}>
                <table className="w-full text-xs">
                  <thead>
                    <tr>
                      <th style={{ ...th, padding: '0.5rem 0.75rem', fontSize: '0.75rem' }}>分类</th>
                      <th style={{ ...th, padding: '0.5rem 0.75rem', fontSize: '0.75rem' }}>变更项</th>
                      <th style={{ ...th, padding: '0.5rem 0.75rem', fontSize: '0.75rem' }}>变更前</th>
                      <th style={{ ...th, padding: '0.5rem 0.75rem', fontSize: '0.75rem' }}>变更后</th>
                    </tr>
                  </thead>
                  <tbody>
                    {request.changeDiff.map((line, index) => (
                      <tr key={`${line.section}-${line.label}-${index}`}>
                        <td style={{ ...td, padding: '0.5rem 0.75rem', fontSize: '0.75rem', color: '#C9A96E', whiteSpace: 'nowrap' }}>
                          {line.section}
                        </td>
                        <td style={{ ...td, padding: '0.5rem 0.75rem', fontSize: '0.75rem', color: 'var(--foreground)', minWidth: 140 }}>
                          {line.label}
                        </td>
                        <td style={{ ...td, padding: '0.5rem 0.75rem', fontSize: '0.75rem', whiteSpace: 'pre-wrap', minWidth: 180 }}>
                          {line.before}
                        </td>
                        <td style={{ ...td, padding: '0.5rem 0.75rem', fontSize: '0.75rem', whiteSpace: 'pre-wrap', minWidth: 180 }}>
                          {line.after}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <input
              value={reviewNotes[request.id] ?? ''}
              onChange={e => setReviewNotes(prev => ({ ...prev, [request.id]: e.target.value }))}
              placeholder="审批备注（可选）"
              className="w-full rounded-lg px-3 py-2 text-xs outline-none"
              style={inputStyle()}
            />
          </div>
        ))}
      </div>
    </div>
  )
}

function StatusBadge({ status, label }: { status: ProcessKitRow['status']; label: string }) {
  const colors: Record<ProcessKitRow['status'], { bg: string; text: string }> = {
    DRAFT: { bg: 'rgba(148, 163, 184, 0.15)', text: '#94a3b8' },
    ACTIVE: { bg: 'rgba(16, 185, 129, 0.15)', text: '#10b981' },
    ARCHIVED: { bg: 'rgba(245, 158, 11, 0.15)', text: '#f59e0b' },
  }
  const c = colors[status]
  return (
    <span
      className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium"
      style={{ background: c.bg, color: c.text }}
    >
      {label}
    </span>
  )
}

export default function AdminCosmoCoatProcessKitsPage() {
  const t = useTranslations('admin.processKits')
  const router = useRouter()
  const [items, setItems] = useState<ProcessKitRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [canDirectEdit, setCanDirectEdit] = useState(false)
  const [pendingChangeRequests, setPendingChangeRequests] = useState<PendingChangeRequest[]>([])

  const statusLabel = useCallback((status: ProcessKitRow['status']) => {
    return t(`statuses.${status}`)
  }, [t])

  const fetchItems = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: '50' })
      if (search.trim()) params.set('q', search.trim())
      if (statusFilter) params.set('status', statusFilter)
      const res = await fetch(`/api/admin/cosmocoat/process-kits?${params}`)
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? t('loadFailed'))
        return
      }
      setItems(data.items ?? [])
      setTotal(data.total ?? 0)
      setTotalPages(data.totalPages ?? 1)
      setCanDirectEdit(Boolean(data.canDirectEdit))
      setPendingChangeRequests(data.pendingChangeRequests ?? [])
    } catch {
      toast.error(t('loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [page, search, statusFilter, t])

  useEffect(() => {
    const timer = setTimeout(fetchItems, search ? 300 : 0)
    return () => clearTimeout(timer)
  }, [fetchItems, search])

  useEffect(() => {
    setPage(1)
  }, [search, statusFilter])

  async function deleteKit(kit: ProcessKitRow) {
    if (!window.confirm(t('deleteConfirm', { name: kit.name }))) return
    setDeletingId(kit.id)
    try {
      const res = await fetch(`/api/admin/cosmocoat/process-kits/${kit.id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? t('deleteFailed'))
        return
      }
      toast.success(res.status === 202 ? '删除审批已提交' : t('deleted'))
      fetchItems()
    } catch {
      toast.error(t('deleteFailed'))
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>{t('title')}</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>{t('subtitle')}</p>
        </div>
        <Link
          href="/admin/cosmocoat-process-kits/new"
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
          style={{ background: '#C9A96E', color: '#0A0805' }}
        >
          <Plus size={15} /> {t('create')}
        </Link>
      </div>

      <div style={card} className="p-4 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--muted-foreground)' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t('search')}
            className="w-full pl-8 pr-3 py-2 rounded-lg text-sm outline-none"
            style={inputStyle()}
          />
        </div>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="rounded-lg px-3 py-2 text-sm outline-none min-w-[140px]"
          style={inputStyle()}
        >
          <option value="">{t('allStatuses')}</option>
          <option value="DRAFT">{t('statuses.DRAFT')}</option>
          <option value="ACTIVE">{t('statuses.ACTIVE')}</option>
          <option value="ARCHIVED">{t('statuses.ARCHIVED')}</option>
        </select>
      </div>

      {canDirectEdit && (
        <PendingApprovalsPanel items={pendingChangeRequests} onReviewed={fetchItems} />
      )}

      <div style={{ ...card, overflow: 'hidden' }}>
        {loading ? (
          <div className="py-16 text-center text-sm" style={{ color: 'var(--muted-foreground)' }}>{t('loading')}</div>
        ) : items.length === 0 ? (
          <div className="py-16 text-center space-y-3">
            <BookOpen size={32} className="mx-auto" style={{ color: '#5A5040' }} />
            <p className="text-sm" style={{ color: '#5A5040' }}>{t('empty')}</p>
            <Link
              href="/admin/cosmocoat-process-kits/new"
              className="inline-flex px-4 py-2 rounded-lg text-sm font-medium"
              style={{ background: '#C9A96E', color: '#0A0805' }}
            >
              {t('create')}
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th style={th}>{t('code')}</th>
                  <th style={th}>{t('name')}</th>
                  <th style={th}>{t('status')}</th>
                  <th style={th}>{t('productCount')}</th>
                  <th style={th}>{t('testCount')}</th>
                  <th style={th}>{t('createdBy')}</th>
                  <th style={th}>{t('updatedAt')}</th>
                  <th style={{ ...th, textAlign: 'right' }}>{t('actions')}</th>
                </tr>
              </thead>
              <tbody>
                {items.map(kit => (
                  <tr
                    key={kit.id}
                    className="cursor-pointer transition-colors hover:bg-[#111108]"
                    onClick={() => router.push(`/admin/cosmocoat-process-kits/${kit.id}`)}
                  >
                    <td style={{ ...td, color: 'var(--foreground)', fontWeight: 500, fontFamily: 'monospace', fontSize: '0.8125rem' }}>
                      {kit.code}
                    </td>
                    <td style={{ ...td, color: 'var(--foreground)' }}>{kit.name}</td>
                    <td style={td}>
                      <StatusBadge status={kit.status} label={statusLabel(kit.status)} />
                    </td>
                    <td style={td}>{kit.productCount}</td>
                    <td style={td}>{kit.testCount}</td>
                    <td style={td}>{kit.createdByName || '—'}</td>
                    <td style={td}>{new Date(kit.updatedAt).toLocaleDateString()}</td>
                    <td style={{ ...td, textAlign: 'right' }}>
                      <div className="flex items-center justify-end gap-1">
                        <Link
                          href={`/admin/cosmocoat-process-kits/${kit.id}`}
                          onClick={e => e.stopPropagation()}
                          className="p-1.5 rounded-md inline-flex"
                          style={{ color: 'var(--muted-foreground)' }}
                        >
                          <Pencil size={14} />
                        </Link>
                        <button
                          type="button"
                          onClick={e => { e.stopPropagation(); deleteKit(kit) }}
                          disabled={deletingId === kit.id}
                          className="p-1.5 rounded-md disabled:opacity-40"
                          style={{ color: '#ef4444' }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {!loading && total > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs" style={{ color: '#5A5040' }}>
          <span>{t('totalCount', { count: total })}</span>
          <div className="flex items-center gap-2">
            <button type="button" disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1.5 rounded-md disabled:opacity-40" style={{ border: '1px solid #2A2418' }}>{t('prev')}</button>
            <span>{page} / {totalPages}</span>
            <button type="button" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="px-3 py-1.5 rounded-md disabled:opacity-40" style={{ border: '1px solid #2A2418' }}>{t('next')}</button>
          </div>
        </div>
      )}
    </div>
  )
}
