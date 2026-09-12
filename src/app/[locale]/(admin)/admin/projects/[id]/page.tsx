'use client'

/* eslint-disable react-hooks/set-state-in-effect */

import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import {
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  Link2,
  Plus,
  RefreshCw,
  Trash2,
  Unlink,
} from 'lucide-react'
import { toast } from 'sonner'
import { Link, useRouter } from '@/i18n/navigation'
import { Button } from '@/components/ui/button'
import { useAdminPermission } from '@/components/admin/AdminPermissionContext'
import {
  INVOICE_PAYMENT_LABELS,
  PROJECT_STATUS_LABELS,
  PROJECT_TYPE_LABELS,
  TASK_STATUS_LABELS,
} from '@/lib/adviser/project-labels'

type Task = {
  id: string
  title: string
  status: 'OPEN' | 'DONE' | 'CANCELLED'
  notes: string | null
  registeredAt: string
  completedAt: string | null
  createdBy?: { nameEn: string | null } | null
  completedBy?: { nameEn: string | null } | null
}

type LinkedInvoice = {
  id: string
  createdAt: string
  invoice: {
    id: string
    invoiceNumber: string
    status: string
    issueDate: string
    dueDate: string | null
    currency: string
    total: string
    billToName: string
  }
}

type ProjectDetail = {
  id: string
  projectNumber: string
  title: string
  customerType: 'COMPANY' | 'INDIVIDUAL'
  projectType: keyof typeof PROJECT_TYPE_LABELS
  status: keyof typeof PROJECT_STATUS_LABELS
  startDate: string | null
  endDate: string | null
  autoRenew: boolean
  notes: string | null
  company: { id: string; nameEn: string; companyCode: string | null } | null
  keyPerson: { id: string; nameEn: string; kycCode: string | null } | null
  renewedFrom?: { id: string; title: string; projectNumber?: string } | null
  renewedTo?: { id: string; title: string; projectNumber?: string } | null
  tasks: Task[]
  invoices: LinkedInvoice[]
  summary: {
    openTasks: number
    taskCount: number
    invoiceCount: number
    paidCount: number
    unpaidCount: number
    hasPeriod: boolean
  }
}

type CandidateInvoice = LinkedInvoice['invoice']

const STATUS_COLOR: Record<string, string> = {
  ACTIVE: 'bg-[rgba(16,185,129,0.12)] text-[#10b981]',
  COMPLETED: 'bg-[rgba(59,130,246,0.12)] text-[#3b82f6]',
  EXPIRED: 'bg-[rgba(245,158,11,0.12)] text-[#f59e0b]',
  CANCELLED: 'bg-[rgba(239,68,68,0.12)] text-[#ef4444]',
  RENEWED: 'bg-[rgba(120,113,108,0.15)] text-[#9A8060]',
  OPEN: 'bg-[rgba(245,158,11,0.12)] text-[#f59e0b]',
  DONE: 'bg-[rgba(16,185,129,0.12)] text-[#10b981]',
  DRAFT: 'bg-[rgba(120,113,108,0.15)] text-[#9A8060]',
  SENT: 'bg-[rgba(59,130,246,0.12)] text-[#3b82f6]',
  PAID: 'bg-[rgba(16,185,129,0.12)] text-[#10b981]',
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
    border: '1px solid var(--border-subtle)',
    color: 'var(--foreground)',
  }
}

function dateOnly(value: string | null | undefined) {
  return value ? value.slice(0, 10) : ''
}

function clientLabel(project: ProjectDetail) {
  if (project.customerType === 'INDIVIDUAL' && project.keyPerson) {
    return `${project.keyPerson.kycCode ? `${project.keyPerson.kycCode} · ` : ''}${project.keyPerson.nameEn}`
  }
  if (project.company) {
    return `${project.company.companyCode ? `${project.company.companyCode} · ` : ''}${project.company.nameEn}`
  }
  return '—'
}

export default function ProjectDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const projectId = params.id
  const canEdit = useAdminPermission('projects.edit')
  const canCreate = useAdminPermission('projects.create')
  const canDelete = useAdminPermission('projects.delete')

  const [project, setProject] = useState<ProjectDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [taskTitle, setTaskTitle] = useState('')
  const [taskNotes, setTaskNotes] = useState('')
  const [addingTask, setAddingTask] = useState(false)
  const [linkOpen, setLinkOpen] = useState(false)
  const [candidates, setCandidates] = useState<CandidateInvoice[]>([])
  const [linkingId, setLinkingId] = useState<string | null>(null)
  const [renewing, setRenewing] = useState(false)
  const [paymentBusyId, setPaymentBusyId] = useState<string | null>(null)

  const fetchProject = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/projects/${projectId}`)
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || '载入项目失败。')
      setProject(json.project)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '载入项目失败。')
      setProject(null)
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    fetchProject()
  }, [fetchProject])

  async function saveMeta(patch: Partial<{
    title: string
    status: string
    hasPeriod: boolean
    startDate: string | null
    endDate: string | null
    autoRenew: boolean
    notes: string | null
    projectType: string
  }>) {
    if (!project) return
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/projects/${project.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || '保存失败。')
      setProject(json.project)
      toast.success(json.toast || '已保存。')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '保存失败。')
    } finally {
      setSaving(false)
    }
  }

  async function addTask() {
    if (!taskTitle.trim()) {
      toast.error('请填写工作事项。')
      return
    }
    setAddingTask(true)
    try {
      const res = await fetch(`/api/admin/projects/${projectId}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: taskTitle, notes: taskNotes || null }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || '登记失败。')
      toast.success(json.toast || '已登记。')
      setTaskTitle('')
      setTaskNotes('')
      await fetchProject()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '登记失败。')
    } finally {
      setAddingTask(false)
    }
  }

  async function updateTask(taskId: string, status: 'OPEN' | 'DONE' | 'CANCELLED') {
    try {
      const res = await fetch(`/api/admin/projects/${projectId}/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || '更新失败。')
      toast.success(json.toast || '已更新。')
      await fetchProject()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '更新失败。')
    }
  }

  async function deleteTask(taskId: string) {
    if (!window.confirm('删除该工作事项？')) return
    try {
      const res = await fetch(`/api/admin/projects/${projectId}/tasks/${taskId}`, { method: 'DELETE' })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || '删除失败。')
      toast.success(json.toast || '已删除。')
      await fetchProject()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '删除失败。')
    }
  }

  async function openLinkDialog() {
    setLinkOpen(true)
    try {
      const res = await fetch(`/api/admin/projects/${projectId}/invoices`)
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || '载入发票失败。')
      setCandidates(Array.isArray(json.invoices) ? json.invoices : [])
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '载入发票失败。')
    }
  }

  async function linkInvoice(invoiceId: string) {
    setLinkingId(invoiceId)
    try {
      const res = await fetch(`/api/admin/projects/${projectId}/invoices`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoiceId }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || '关联失败。')
      toast.success(json.toast || '已关联。')
      setLinkOpen(false)
      await fetchProject()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '关联失败。')
    } finally {
      setLinkingId(null)
    }
  }

  async function unlinkInvoice(linkId: string) {
    if (!window.confirm('取消关联该发票？')) return
    try {
      const res = await fetch(`/api/admin/projects/${projectId}/invoices/${linkId}`, { method: 'DELETE' })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || '取消关联失败。')
      toast.success(json.toast || '已取消关联。')
      await fetchProject()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '取消关联失败。')
    }
  }

  async function setInvoicePaid(linkId: string, paid: boolean) {
    setPaymentBusyId(linkId)
    try {
      const res = await fetch(`/api/admin/projects/${projectId}/invoices/${linkId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paid }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || '更新收款状态失败。')
      toast.success(json.toast || (paid ? '已确认收款。' : '已取消收款确认。'))
      await fetchProject()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '更新收款状态失败。')
    } finally {
      setPaymentBusyId(null)
    }
  }

  async function renewProject() {
    if (!window.confirm('创建下一期项目？当前项目将标记为已续期。')) return
    setRenewing(true)
    try {
      const res = await fetch(`/api/admin/projects/${projectId}/renew`, { method: 'POST' })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || '续期失败。')
      toast.success(json.toast || '已创建下一期。')
      router.push(`/admin/projects/${json.project.id}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '续期失败。')
    } finally {
      setRenewing(false)
    }
  }

  async function deleteProject() {
    if (!project) return
    if (!window.confirm(`删除项目「${project.title}」？关联与工作事项会一并删除。`)) return
    try {
      const res = await fetch(`/api/admin/projects/${project.id}`, { method: 'DELETE' })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || '删除失败。')
      toast.success(json.toast || '已删除。')
      router.push('/admin/projects')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '删除失败。')
    }
  }

  if (loading) {
    return <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>载入中…</p>
  }
  if (!project) {
    return (
      <div className="space-y-3">
        <p style={{ color: 'var(--muted-foreground)' }}>项目不存在或无权访问。</p>
        <Link href="/admin/projects" className="text-sm underline">返回列表</Link>
      </div>
    )
  }

  const canRenew = canCreate && !project.renewedTo && project.status !== 'CANCELLED' && project.summary.hasPeriod

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <Link href="/admin/projects" className="inline-flex items-center gap-1 text-sm" style={{ color: 'var(--muted-foreground)' }}>
            <ArrowLeft size={14} /> 返回项目管理
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>{project.title}</h1>
            <span className="rounded-md px-2 py-0.5 font-mono text-xs" style={{ border: '1px solid var(--border)', color: 'var(--muted-foreground)' }}>
              {project.projectNumber}
            </span>
            <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_COLOR[project.status] ?? ''}`}>
              {PROJECT_STATUS_LABELS[project.status]}
            </span>
          </div>
          <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
            {project.customerType === 'INDIVIDUAL' ? '自然人' : '公司'}
            {' · '}
            {clientLabel(project)}
            {' · '}
            {PROJECT_TYPE_LABELS[project.projectType]}
            {' · '}
            {project.summary.hasPeriod
              ? `${dateOnly(project.startDate)} → ${dateOnly(project.endDate)}`
              : '一次性（无时限）'}
          </p>
          {(project.renewedFrom || project.renewedTo) && (
            <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
              {project.renewedFrom && (
                <>上一期：<Link href={`/admin/projects/${project.renewedFrom.id}`} className="underline">{project.renewedFrom.title}</Link></>
              )}
              {project.renewedFrom && project.renewedTo ? ' · ' : null}
              {project.renewedTo && (
                <>下一期：<Link href={`/admin/projects/${project.renewedTo.id}`} className="underline">{project.renewedTo.title}</Link></>
              )}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {canRenew && (
            <Button variant="outline" onClick={renewProject} disabled={renewing}>
              <RefreshCw size={16} className="mr-2" />
              {renewing ? '续期中…' : '创建下一期'}
            </Button>
          )}
          {canDelete && (
            <Button variant="outline" onClick={deleteProject}>
              <Trash2 size={16} className="mr-2" /> 删除
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
          <div className="space-y-3 p-4 lg:col-span-1" style={card}>
          <h2 className="font-semibold" style={{ color: 'var(--foreground)' }}>项目信息</h2>
          <div>
            <label className="mb-1 block text-xs" style={{ color: 'var(--muted-foreground)' }}>项目号</label>
            <div className="font-mono text-sm" style={{ color: 'var(--foreground)' }}>{project.projectNumber}</div>
          </div>
          <div>
            <label className="mb-1 block text-xs" style={{ color: 'var(--muted-foreground)' }}>客户</label>
            <div className="text-sm" style={{ color: 'var(--foreground)' }}>
              {project.customerType === 'INDIVIDUAL' ? '自然人' : '公司'} · {clientLabel(project)}
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs" style={{ color: 'var(--muted-foreground)' }}>名称</label>
            <input
              className={inputClass}
              style={inputStyle()}
              defaultValue={project.title}
              disabled={!canEdit || saving}
              onBlur={e => {
                const value = e.target.value.trim()
                if (value && value !== project.title) void saveMeta({ title: value })
              }}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs" style={{ color: 'var(--muted-foreground)' }}>类型</label>
            <select
              className={inputClass}
              style={inputStyle()}
              value={project.projectType}
              disabled={!canEdit || saving}
              onChange={e => void saveMeta({ projectType: e.target.value })}
            >
              {Object.entries(PROJECT_TYPE_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs" style={{ color: 'var(--muted-foreground)' }}>状态</label>
            <select
              className={inputClass}
              style={inputStyle()}
              value={project.status}
              disabled={!canEdit || saving}
              onChange={e => void saveMeta({ status: e.target.value })}
            >
              {Object.entries(PROJECT_STATUS_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--foreground)' }}>
            <input
              type="checkbox"
              checked={project.summary.hasPeriod}
              disabled={!canEdit || saving}
              onChange={e => {
                if (e.target.checked) {
                  const start = dateOnly(project.startDate) || new Date().toISOString().slice(0, 10)
                  const endBase = new Date(`${start}T00:00:00`)
                  endBase.setFullYear(endBase.getFullYear() + 1)
                  void saveMeta({
                    hasPeriod: true,
                    startDate: start,
                    endDate: endBase.toISOString().slice(0, 10),
                    autoRenew: true,
                  })
                } else {
                  void saveMeta({ hasPeriod: false, startDate: null, endDate: null, autoRenew: false })
                }
              }}
            />
            有服务周期（取消 = 一次性、无时限）
          </label>
          {project.summary.hasPeriod && (
            <>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-xs" style={{ color: 'var(--muted-foreground)' }}>开始</label>
                  <input
                    type="date"
                    className={inputClass}
                    style={inputStyle()}
                    value={dateOnly(project.startDate)}
                    disabled={!canEdit || saving}
                    onChange={e => void saveMeta({ hasPeriod: true, startDate: e.target.value })}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs" style={{ color: 'var(--muted-foreground)' }}>结束</label>
                  <input
                    type="date"
                    className={inputClass}
                    style={inputStyle()}
                    value={dateOnly(project.endDate)}
                    disabled={!canEdit || saving}
                    onChange={e => void saveMeta({ hasPeriod: true, endDate: e.target.value })}
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--foreground)' }}>
                <input
                  type="checkbox"
                  checked={project.autoRenew}
                  disabled={!canEdit || saving}
                  onChange={e => void saveMeta({ autoRenew: e.target.checked })}
                />
                到期提醒续期
              </label>
            </>
          )}
          <div>
            <label className="mb-1 block text-xs" style={{ color: 'var(--muted-foreground)' }}>备注</label>
            <textarea
              className={inputClass}
              style={inputStyle()}
              rows={4}
              defaultValue={project.notes ?? ''}
              disabled={!canEdit || saving}
              onBlur={e => {
                const value = e.target.value.trim() || null
                if (value !== (project.notes ?? null)) void saveMeta({ notes: value })
              }}
            />
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm" style={{ color: 'var(--muted-foreground)' }}>
            <div>待办工作：{project.summary.openTasks}</div>
            <div>关联发票：{project.summary.invoiceCount}</div>
            <div>已收款：{project.summary.paidCount}</div>
            <div>未收款：{project.summary.unpaidCount}</div>
          </div>
        </div>

        <div className="space-y-4 lg:col-span-2">
          <div className="space-y-3 p-4" style={card}>
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-semibold" style={{ color: 'var(--foreground)' }}>工作事项</h2>
            </div>
            {canEdit && (
              <div className="space-y-2 rounded-lg p-3" style={{ border: '1px solid var(--border)' }}>
                <input
                  className={inputClass}
                  style={inputStyle()}
                  placeholder="登记需要做的工作…"
                  value={taskTitle}
                  onChange={e => setTaskTitle(e.target.value)}
                />
                <textarea
                  className={inputClass}
                  style={inputStyle()}
                  rows={2}
                  placeholder="备注（可选）"
                  value={taskNotes}
                  onChange={e => setTaskNotes(e.target.value)}
                />
                <Button onClick={addTask} disabled={addingTask}>
                  <Plus size={16} className="mr-2" />
                  {addingTask ? '登记中…' : '登记工作'}
                </Button>
              </div>
            )}
            {project.tasks.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>暂无工作事项。</p>
            ) : (
              <ul className="space-y-2">
                {project.tasks.map(task => (
                  <li key={task.id} className="rounded-lg p-3" style={{ border: '1px solid var(--border)' }}>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium" style={{ color: 'var(--foreground)' }}>{task.title}</span>
                          <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_COLOR[task.status] ?? ''}`}>
                            {TASK_STATUS_LABELS[task.status]}
                          </span>
                        </div>
                        {task.notes && (
                          <p className="mt-1 text-sm" style={{ color: 'var(--muted-foreground)' }}>{task.notes}</p>
                        )}
                        <p className="mt-1 text-xs" style={{ color: 'var(--muted-foreground)' }}>
                          登记于 {dateOnly(task.registeredAt)}
                          {task.completedAt ? ` · 完成于 ${dateOnly(task.completedAt)}` : ''}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {canEdit && task.status === 'OPEN' && (
                          <Button size="sm" variant="outline" onClick={() => updateTask(task.id, 'DONE')}>
                            <CheckCircle2 size={14} className="mr-1" /> 完成
                          </Button>
                        )}
                        {canEdit && task.status === 'DONE' && (
                          <Button size="sm" variant="outline" onClick={() => updateTask(task.id, 'OPEN')}>重开</Button>
                        )}
                        {canDelete && (
                          <Button size="sm" variant="outline" onClick={() => deleteTask(task.id)}>
                            <Trash2 size={14} />
                          </Button>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="space-y-3 p-4" style={card}>
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-semibold" style={{ color: 'var(--foreground)' }}>关联发票 / 收款</h2>
              {canEdit && (
                <Button variant="outline" onClick={openLinkDialog}>
                  <Link2 size={16} className="mr-2" /> 关联发票
                </Button>
              )}
            </div>
            {project.invoices.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>尚未关联发票。</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--muted-foreground)' }}>
                      <th className="px-2 py-2 text-left font-medium">发票</th>
                      <th className="px-2 py-2 text-left font-medium">金额</th>
                      <th className="px-2 py-2 text-center font-medium">已收款</th>
                      <th className="px-2 py-2 text-left font-medium">状态</th>
                      <th className="px-2 py-2 text-left font-medium">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {project.invoices.map(link => {
                      const canTogglePaid = link.invoice.status === 'SENT' || link.invoice.status === 'PAID'
                      const isPaid = link.invoice.status === 'PAID'
                      return (
                        <tr key={link.id} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td className="px-2 py-2">
                            <div className="font-medium" style={{ color: 'var(--foreground)' }}>
                              {link.invoice.invoiceNumber}
                            </div>
                            <div className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                              {link.invoice.billToName}
                            </div>
                          </td>
                          <td className="px-2 py-2 whitespace-nowrap">{link.invoice.currency} {link.invoice.total}</td>
                          <td className="px-2 py-2 text-center">
                            <input
                              type="checkbox"
                              className="h-4 w-4 accent-[var(--primary)]"
                              checked={isPaid}
                              disabled={!canEdit || !canTogglePaid || paymentBusyId === link.id}
                              title={
                                canTogglePaid
                                  ? (isPaid ? '取消收款确认' : '确认已收款')
                                  : '草稿或已取消发票不可在此勾选'
                              }
                              onChange={e => void setInvoicePaid(link.id, e.target.checked)}
                            />
                          </td>
                          <td className="px-2 py-2">
                            <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_COLOR[link.invoice.status] ?? ''}`}>
                              {INVOICE_PAYMENT_LABELS[link.invoice.status] ?? link.invoice.status}
                            </span>
                          </td>
                          <td className="px-2 py-2">
                            <div className="flex flex-wrap gap-2">
                              <Link
                                href={`/admin/invoices/${link.invoice.id}`}
                                className="inline-flex h-7 items-center gap-1 rounded-[min(var(--radius-md),12px)] border border-border bg-background px-2.5 text-[0.8rem] hover:bg-muted"
                              >
                                <ExternalLink size={14} />
                                打开发票
                              </Link>
                              {canEdit && (
                                <Button size="sm" variant="outline" onClick={() => unlinkInvoice(link.id)}>
                                  <Unlink size={14} />
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {linkOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg space-y-4 p-5" style={card}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold" style={{ color: 'var(--foreground)' }}>关联本客户发票</h2>
              <button type="button" onClick={() => setLinkOpen(false)} style={{ color: 'var(--muted-foreground)' }}>关闭</button>
            </div>
            {candidates.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>没有可关联的发票（需属于同一客户且尚未关联）。</p>
            ) : (
              <ul className="max-h-80 space-y-2 overflow-y-auto">
                {candidates.map(inv => (
                  <li key={inv.id} className="flex items-center justify-between gap-2 rounded-lg p-3" style={{ border: '1px solid var(--border)' }}>
                    <div>
                      <div className="font-medium" style={{ color: 'var(--foreground)' }}>{inv.invoiceNumber}</div>
                      <div className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                        {inv.currency} {inv.total} · {INVOICE_PAYMENT_LABELS[inv.status] ?? inv.status}
                      </div>
                    </div>
                    <Button size="sm" disabled={linkingId === inv.id} onClick={() => linkInvoice(inv.id)}>
                      {linkingId === inv.id ? '关联中…' : '关联'}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
