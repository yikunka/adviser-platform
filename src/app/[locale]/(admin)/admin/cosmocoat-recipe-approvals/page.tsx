'use client'

/* eslint-disable react-hooks/set-state-in-effect */

import type { CSSProperties } from 'react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ClipboardCheck, History, Loader2, Search } from 'lucide-react'
import { toast } from 'sonner'
import { Link } from '@/i18n/navigation'

type ChangeRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED'
type StatusFilter = 'ALL' | ChangeRequestStatus

type RecipeChangeRequest = {
  id: string
  recipeId: string
  action: 'UPDATE' | 'DELETE'
  status: ChangeRequestStatus
  createdAt: string
  updatedAt: string
  reviewedAt: string | null
  requestNote: string
  reviewNote: string
  recipe: {
    id: string
    code: string
    name: string
    category: { id: string; code: string; name: string }
  }
  requestedBy: { id: string; nameEn: string | null; email: string }
  reviewedBy: { id: string; nameEn: string | null; email: string } | null
  changeSummary: string[]
  changeDiff: Array<{
    section: string
    label: string
    before: string
    after: string
  }>
}

const card: CSSProperties = {
  background: 'var(--card)',
  border: '1px solid var(--border)',
  borderRadius: '0.75rem',
}

const th: CSSProperties = {
  textAlign: 'left',
  padding: '0.5rem 0.75rem',
  fontWeight: 500,
  fontSize: '0.75rem',
  color: 'var(--muted-foreground)',
  background: '#111108',
  borderBottom: '1px solid #2A2418',
  whiteSpace: 'nowrap',
}

const td: CSSProperties = {
  padding: '0.5rem 0.75rem',
  fontSize: '0.75rem',
  color: 'var(--muted-foreground)',
  borderBottom: '1px solid #1E1C15',
}

function inputStyle(): CSSProperties {
  return {
    background: '#0E0E0A',
    border: '1px solid #2A2418',
    color: 'var(--foreground)',
  }
}

function actionLabel(action: RecipeChangeRequest['action']) {
  return action === 'DELETE' ? '删除工艺书' : '更新工艺书'
}

function statusLabel(status: ChangeRequestStatus) {
  if (status === 'APPROVED') return '已批准'
  if (status === 'REJECTED') return '已驳回'
  return '待审批'
}

function statusStyle(status: ChangeRequestStatus) {
  if (status === 'APPROVED') {
    return { background: 'rgba(74,159,82,0.14)', color: '#4A9F52', border: '1px solid rgba(74,159,82,0.28)' }
  }
  if (status === 'REJECTED') {
    return { background: 'rgba(239,68,68,0.12)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.24)' }
  }
  return { background: 'rgba(201,169,110,0.12)', color: '#C9A96E', border: '1px solid rgba(201,169,110,0.22)' }
}

function requesterLabel(person: { nameEn: string | null; email: string }) {
  return person.nameEn?.trim() || person.email
}

function RequestCard({
  item,
  canReview,
  reviewingId,
  reviewNote,
  onReviewNoteChange,
  onReview,
}: {
  item: RecipeChangeRequest
  canReview: boolean
  reviewingId: string | null
  reviewNote: string
  onReviewNoteChange: (value: string) => void
  onReview: (item: RecipeChangeRequest, action: 'APPROVE' | 'REJECT') => void
}) {
  const reviewed = item.status !== 'PENDING'
  const actor = item.reviewedBy ? requesterLabel(item.reviewedBy) : '—'

  return (
    <div className="rounded-xl p-4 space-y-4" style={{ background: '#111108', border: '1px solid #2A2418' }}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex rounded-md px-2 py-0.5 text-xs font-medium" style={statusStyle(item.status)}>
              {statusLabel(item.status)}
            </span>
            <span
              className="inline-flex rounded-md px-2 py-0.5 text-xs font-medium"
              style={{
                background: item.action === 'DELETE' ? 'rgba(239,68,68,0.12)' : 'rgba(59,130,246,0.12)',
                color: item.action === 'DELETE' ? '#ef4444' : '#60a5fa',
              }}
            >
              {actionLabel(item.action)}
            </span>
            <Link href={`/admin/cosmocoat-recipes/${item.recipe.id}`} className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
              {item.recipe.code} · {item.recipe.name}
            </Link>
            <span className="text-xs" style={{ color: '#7A7060' }}>
              {item.recipe.category.code} {item.recipe.category.name}
            </span>
          </div>
          <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
            申请人：{requesterLabel(item.requestedBy)} · {new Date(item.createdAt).toLocaleString('zh-CN')}
          </p>
          {item.requestNote && (
            <p className="text-xs" style={{ color: '#9A8060' }}>申请说明：{item.requestNote}</p>
          )}
          {reviewed && (
            <p className="text-xs" style={{ color: '#7A7060' }}>
              审批记录：{actor} · {item.reviewedAt ? new Date(item.reviewedAt).toLocaleString('zh-CN') : '—'}
            </p>
          )}
          {reviewed && item.reviewNote && (
            <p className="text-xs" style={{ color: '#9A8060' }}>审批备注：{item.reviewNote}</p>
          )}
        </div>

        {canReview && item.status === 'PENDING' && (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={reviewingId === item.id}
              onClick={() => onReview(item, 'APPROVE')}
              className="rounded-lg px-3 py-1.5 text-xs font-medium disabled:opacity-50"
              style={{ background: '#4A9F52', color: '#fff' }}
            >
              批准
            </button>
            <button
              type="button"
              disabled={reviewingId === item.id}
              onClick={() => onReview(item, 'REJECT')}
              className="rounded-lg px-3 py-1.5 text-xs font-medium disabled:opacity-50"
              style={{ border: '1px solid rgba(239,68,68,0.35)', color: '#ef4444' }}
            >
              驳回
            </button>
          </div>
        )}
      </div>

      {item.changeSummary.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {item.changeSummary.map(summary => (
            <span
              key={summary}
              className="rounded-md px-2 py-1 text-xs"
              style={{ background: 'rgba(201,169,110,0.1)', color: '#C9A96E', border: '1px solid rgba(201,169,110,0.2)' }}
            >
              {summary}
            </span>
          ))}
        </div>
      )}

      {item.changeDiff.length > 0 ? (
        <div className="overflow-x-auto rounded-lg" style={{ border: '1px solid #2A2418' }}>
          <table className="w-full text-xs">
            <thead>
              <tr>
                <th style={th}>分类</th>
                <th style={th}>变更项</th>
                <th style={th}>变更前</th>
                <th style={th}>变更后</th>
              </tr>
            </thead>
            <tbody>
              {item.changeDiff.map((line, index) => (
                <tr key={`${line.section}-${line.label}-${index}`}>
                  <td style={{ ...td, color: '#C9A96E', whiteSpace: 'nowrap' }}>{line.section}</td>
                  <td style={{ ...td, color: 'var(--foreground)', minWidth: 140 }}>{line.label}</td>
                  <td style={{ ...td, whiteSpace: 'pre-wrap', minWidth: 220 }}>{line.before}</td>
                  <td style={{ ...td, whiteSpace: 'pre-wrap', minWidth: 220 }}>{line.after}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-lg px-3 py-2 text-xs" style={{ background: '#0E0E0A', color: '#7A7060', border: '1px solid #2A2418' }}>
          暂无可展示的差异明细
        </div>
      )}

      {canReview && item.status === 'PENDING' && (
        <input
          value={reviewNote}
          onChange={e => onReviewNoteChange(e.target.value)}
          placeholder="审批备注（可选）"
          className="w-full rounded-lg px-3 py-2 text-xs outline-none"
          style={inputStyle()}
        />
      )}
    </div>
  )
}

export default function AdminCosmoCoatRecipeApprovalsPage() {
  const [items, setItems] = useState<RecipeChangeRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL')
  const [search, setSearch] = useState('')
  const [canReview, setCanReview] = useState(false)
  const [reviewingId, setReviewingId] = useState<string | null>(null)
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({})

  const fetchItems = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        status: 'ALL',
        limit: '200',
      })
      const res = await fetch(`/api/admin/cosmocoat/recipe-change-requests?${params}`)
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? '加载审批列表失败')
        return
      }
      setItems(data.items ?? [])
      setCanReview(Boolean(data.canReview))
    } catch {
      toast.error('加载审批列表失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchItems()
  }, [fetchItems])

  const filteredItems = useMemo(() => {
    const keyword = search.trim().toLowerCase()
    return items.filter(item => {
      if (statusFilter !== 'ALL' && item.status !== statusFilter) return false
      if (!keyword) return true
      const haystack = [
        item.recipe.code,
        item.recipe.name,
        item.recipe.category.code,
        item.recipe.category.name,
        requesterLabel(item.requestedBy),
        item.requestedBy.email,
        item.requestNote,
        item.reviewNote,
        item.changeSummary.join(' '),
        item.changeDiff.map(line => `${line.section} ${line.label} ${line.before} ${line.after}`).join(' '),
      ].join(' ').toLowerCase()
      return haystack.includes(keyword)
    })
  }, [items, search, statusFilter])

  const counts = useMemo(() => ({
    ALL: items.length,
    PENDING: items.filter(item => item.status === 'PENDING').length,
    APPROVED: items.filter(item => item.status === 'APPROVED').length,
    REJECTED: items.filter(item => item.status === 'REJECTED').length,
  }), [items])

  async function reviewRequest(item: RecipeChangeRequest, action: 'APPROVE' | 'REJECT') {
    const confirmText = action === 'APPROVE'
      ? `确定批准「${item.recipe.name}」的${actionLabel(item.action)}请求？`
      : `确定驳回「${item.recipe.name}」的${actionLabel(item.action)}请求？`
    if (!window.confirm(confirmText)) return

    setReviewingId(item.id)
    try {
      const res = await fetch(`/api/admin/cosmocoat/recipe-change-requests/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, reviewNote: reviewNotes[item.id] ?? '' }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? '审批失败')
        return
      }
      toast.success(action === 'APPROVE' ? '已批准' : '已驳回')
      setReviewNotes(prev => {
        const next = { ...prev }
        delete next[item.id]
        return next
      })
      await fetchItems()
    } catch {
      toast.error('审批失败')
    } finally {
      setReviewingId(null)
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>待审批工艺书变更</h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--muted-foreground)' }}>
            集中查看所有非超级管理员提交的配方更新/删除请求，逐条比对材料、批次、成本与工艺/QC 变更，并保留审批记录。
          </p>
        </div>
        <Link
          href="/admin/cosmocoat-recipes"
          className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm"
          style={{ border: '1px solid #2A2418', color: 'var(--muted-foreground)' }}
        >
          <History size={15} />
          返回配方管理
        </Link>
      </div>

      <div style={card} className="p-4 space-y-4">
        <div className="flex flex-wrap gap-2">
          {([
            ['ALL', '全部'],
            ['PENDING', '待审批'],
            ['APPROVED', '已批准'],
            ['REJECTED', '已驳回'],
          ] as Array<[StatusFilter, string]>).map(([value, label]) => {
            const active = statusFilter === value
            return (
              <button
                key={value}
                type="button"
                onClick={() => setStatusFilter(value)}
                className="rounded-lg px-3 py-2 text-sm"
                style={{
                  background: active ? '#C9A96E' : '#0E0E0A',
                  color: active ? '#0A0805' : 'var(--foreground)',
                  border: active ? '1px solid #C9A96E' : '1px solid #2A2418',
                }}
              >
                {label}（{counts[value]}）
              </button>
            )
          })}
        </div>

        <div className="relative max-w-md">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--muted-foreground)' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="搜索编号、名称、申请人、备注或差异内容..."
            className="w-full rounded-lg py-2 pl-9 pr-3 text-sm outline-none"
            style={inputStyle()}
          />
        </div>
      </div>

      <div style={card} className="p-4">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm" style={{ color: 'var(--muted-foreground)' }}>
            <Loader2 size={16} className="animate-spin" />
            加载中...
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="space-y-3 py-16 text-center">
            <ClipboardCheck size={32} className="mx-auto" style={{ color: '#5A5040' }} />
            <p className="text-sm" style={{ color: '#5A5040' }}>
              {items.length === 0 ? '当前没有工艺书变更请求。' : '没有匹配当前搜索条件的记录。'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredItems.map(item => (
              <RequestCard
                key={item.id}
                item={item}
                canReview={canReview}
                reviewingId={reviewingId}
                reviewNote={reviewNotes[item.id] ?? ''}
                onReviewNoteChange={value => setReviewNotes(prev => ({ ...prev, [item.id]: value }))}
                onReview={reviewRequest}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
