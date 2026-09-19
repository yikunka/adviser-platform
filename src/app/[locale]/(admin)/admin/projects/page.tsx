'use client'

/* eslint-disable react-hooks/set-state-in-effect */

import { useCallback, useEffect, useState } from 'react'
import { FolderKanban, Plus, Search } from 'lucide-react'
import { toast } from 'sonner'
import { Link } from '@/i18n/navigation'
import { Button } from '@/components/ui/button'
import { useAdminPermission } from '@/components/admin/AdminPermissionContext'
import {
  PROJECT_COLLECTION_LABELS,
  PROJECT_INVOICING_LABELS,
  PROJECT_STATUS_LABELS,
  PROJECT_TYPE_LABELS,
  type ProjectCollectionStatus,
  type ProjectInvoicingStatus,
} from '@/lib/adviser/project-labels'
import { localDateIso, periodEndOneYearAfter } from '@/lib/adviser/project-period'

type ProjectRow = {
  id: string
  projectNumber: string
  title: string
  customerType: 'COMPANY' | 'INDIVIDUAL'
  projectType: keyof typeof PROJECT_TYPE_LABELS
  status: keyof typeof PROJECT_STATUS_LABELS
  startDate: string | null
  endDate: string | null
  autoRenew: boolean
  company: { id: string; nameEn: string; companyCode: string | null } | null
  keyPerson: { id: string; nameEn: string; kycCode: string | null } | null
  summary: {
    openTasks: number
    taskCount: number
    invoiceCount: number
    invoicingStatus: ProjectInvoicingStatus
    collectionStatus: ProjectCollectionStatus
    hasPeriod: boolean
  }
}

type CompanyOption = { id: string; nameEn: string; companyCode: string | null }
type PersonOption = { id: string; nameEn: string; kycCode: string | null }

const BILLING_COLOR: Record<ProjectInvoicingStatus | ProjectCollectionStatus, string> = {
  NOT_INVOICED: 'bg-[rgba(120,113,108,0.15)] text-[#9A8060]',
  PARTIAL: 'bg-[rgba(245,158,11,0.12)] text-[#f59e0b]',
  INVOICED: 'bg-[rgba(59,130,246,0.12)] text-[#3b82f6]',
  UNPAID: 'bg-[rgba(239,68,68,0.12)] text-[#ef4444]',
  PAID: 'bg-[rgba(16,185,129,0.12)] text-[#10b981]',
}

const STATUS_COLOR: Record<string, string> = {
  ACTIVE: 'bg-[rgba(16,185,129,0.12)] text-[#10b981]',
  COMPLETED: 'bg-[rgba(59,130,246,0.12)] text-[#3b82f6]',
  EXPIRED: 'bg-[rgba(245,158,11,0.12)] text-[#f59e0b]',
  CANCELLED: 'bg-[rgba(239,68,68,0.12)] text-[#ef4444]',
  RENEWED: 'bg-[rgba(120,113,108,0.15)] text-[#9A8060]',
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

function clientLabel(project: ProjectRow) {
  if (project.customerType === 'INDIVIDUAL' && project.keyPerson) {
    return `${project.keyPerson.kycCode ? `${project.keyPerson.kycCode} · ` : ''}${project.keyPerson.nameEn}`
  }
  if (project.company) {
    return `${project.company.companyCode ? `${project.company.companyCode} · ` : ''}${project.company.nameEn}`
  }
  return '—'
}

export default function ProjectsPage() {
  const canCreate = useAdminPermission('projects.create')
  const [projects, setProjects] = useState<ProjectRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [projectType, setProjectType] = useState('')
  const [loading, setLoading] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [companies, setCompanies] = useState<CompanyOption[]>([])
  const [keyPersons, setKeyPersons] = useState<PersonOption[]>([])
  const [draft, setDraft] = useState({
    customerType: 'COMPANY' as 'COMPANY' | 'INDIVIDUAL',
    companyId: '',
    keyPersonId: '',
    title: '',
    projectType: 'CORPORATE_SECRETARIAL' as keyof typeof PROJECT_TYPE_LABELS,
    hasPeriod: true,
    startDate: localDateIso(),
    endDate: periodEndOneYearAfter(localDateIso()),
    autoRenew: true,
    notes: '',
  })

  const fetchProjects = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page) })
      if (search.trim()) params.set('q', search.trim())
      if (status) params.set('status', status)
      if (projectType) params.set('projectType', projectType)
      const res = await fetch(`/api/admin/projects?${params}`)
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || '载入项目失败。')
      setProjects(Array.isArray(json.projects) ? json.projects : [])
      setTotal(typeof json.total === 'number' ? json.total : 0)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '载入项目失败。')
    } finally {
      setLoading(false)
    }
  }, [page, search, status, projectType])

  useEffect(() => {
    fetchProjects()
  }, [fetchProjects])

  useEffect(() => {
    if (!createOpen) return
    fetch('/api/admin/projects/customers')
      .then(res => res.json())
      .then(json => {
        setCompanies(Array.isArray(json.companies) ? json.companies : [])
        setKeyPersons(Array.isArray(json.keyPersons) ? json.keyPersons : [])
      })
      .catch(() => toast.error('载入客户列表失败。'))
  }, [createOpen])

  async function createProject() {
    if (draft.customerType === 'COMPANY' && !draft.companyId) {
      toast.error('请选择客户公司。')
      return
    }
    if (draft.customerType === 'INDIVIDUAL' && !draft.keyPersonId) {
      toast.error('请选择自然人客户。')
      return
    }
    if (!draft.title.trim()) {
      toast.error('请填写项目名称。')
      return
    }
    if (draft.hasPeriod && (!draft.startDate || !draft.endDate)) {
      toast.error('有服务周期时请填写开始与结束日期。')
      return
    }
    setCreating(true)
    try {
      const res = await fetch('/api/admin/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerType: draft.customerType,
          companyId: draft.customerType === 'COMPANY' ? draft.companyId : null,
          keyPersonId: draft.customerType === 'INDIVIDUAL' ? draft.keyPersonId : null,
          title: draft.title,
          projectType: draft.projectType,
          hasPeriod: draft.hasPeriod,
          startDate: draft.hasPeriod ? draft.startDate : null,
          endDate: draft.hasPeriod ? draft.endDate : null,
          autoRenew: draft.hasPeriod ? draft.autoRenew : false,
          notes: draft.notes,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || '创建项目失败。')
      toast.success(json.toast || '项目已创建。')
      setCreateOpen(false)
      setDraft(current => ({
        ...current,
        companyId: '',
        keyPersonId: '',
        title: '',
        notes: '',
        hasPeriod: true,
        startDate: localDateIso(),
        endDate: periodEndOneYearAfter(localDateIso()),
        autoRenew: true,
      }))
      await fetchProjects()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '创建项目失败。')
    } finally {
      setCreating(false)
    }
  }

  const pageCount = Math.max(1, Math.ceil(total / 20))

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>项目管理</h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--muted-foreground)' }}>
            按公司或自然人客户管理服务项目；可设一年周期，也可登记无时限的一次性工作。
          </p>
        </div>
        {canCreate && (
          <Button onClick={() => setCreateOpen(true)}>
            <Plus size={16} className="mr-2" /> 新建项目
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3 p-3" style={card}>
        <div className="flex min-w-[220px] flex-1 items-center gap-2">
          <Search size={16} style={{ color: 'var(--muted-foreground)' }} />
          <input
            className="w-full bg-transparent text-sm outline-none"
            style={{ color: 'var(--foreground)' }}
            placeholder="搜索项目号、项目、公司或自然人…"
            value={search}
            onChange={e => { setPage(1); setSearch(e.target.value) }}
          />
        </div>
        <select
          className="rounded-lg px-3 py-2 text-sm outline-none"
          style={inputStyle()}
          value={status}
          onChange={e => { setPage(1); setStatus(e.target.value) }}
        >
          <option value="">全部状态</option>
          {Object.entries(PROJECT_STATUS_LABELS).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
        <select
          className="rounded-lg px-3 py-2 text-sm outline-none"
          style={inputStyle()}
          value={projectType}
          onChange={e => { setPage(1); setProjectType(e.target.value) }}
        >
          <option value="">全部类型</option>
          {Object.entries(PROJECT_TYPE_LABELS).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
      </div>

      <div className="overflow-hidden" style={card}>
        {loading ? (
          <p className="p-6 text-sm" style={{ color: 'var(--muted-foreground)' }}>载入中…</p>
        ) : projects.length === 0 ? (
          <div className="flex flex-col items-center gap-2 p-10 text-center">
            <FolderKanban size={28} style={{ color: 'var(--muted-foreground)' }} />
            <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>暂无项目。</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-left text-sm">
              <thead style={{ background: 'var(--surface-modal)', color: 'var(--muted-foreground)' }}>
                <tr>
                  <th className="px-4 py-3 font-medium whitespace-nowrap">项目号</th>
                  <th className="px-4 py-3 font-medium">客户</th>
                  <th className="px-4 py-3 font-medium">项目</th>
                  <th className="px-4 py-3 font-medium whitespace-nowrap">类型</th>
                  <th className="px-4 py-3 font-medium whitespace-nowrap">周期</th>
                  <th className="px-4 py-3 font-medium whitespace-nowrap">状态</th>
                  <th className="px-4 py-3 font-medium whitespace-nowrap">开票</th>
                  <th className="px-4 py-3 font-medium whitespace-nowrap">收款</th>
                  <th className="px-4 py-3 font-medium whitespace-nowrap">工作</th>
                </tr>
              </thead>
              <tbody>
                {projects.map(project => (
                  <tr key={project.id} className="align-top" style={{ borderTop: '1px solid var(--border)' }}>
                    <td className="px-4 py-3 font-mono text-xs font-semibold whitespace-nowrap" style={{ color: '#C9A96E' }}>
                      <Link href={`/admin/projects/${project.id}`} className="hover:underline">
                        {project.projectNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-3" style={{ color: 'var(--muted-foreground)' }}>
                      <div>{clientLabel(project)}</div>
                      <div className="mt-0.5 text-xs opacity-70">
                        {project.customerType === 'INDIVIDUAL' ? '自然人' : '公司'}
                      </div>
                    </td>
                    <td className="px-4 py-3" style={{ color: 'var(--muted-foreground)' }}>
                      {project.title}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap" style={{ color: 'var(--muted-foreground)' }}>
                      {PROJECT_TYPE_LABELS[project.projectType]}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-xs leading-5" style={{ color: 'var(--muted-foreground)' }}>
                      {project.summary.hasPeriod ? (
                        <>
                          <div>{dateOnly(project.startDate)}</div>
                          <div>至 {dateOnly(project.endDate)}</div>
                        </>
                      ) : '一次性'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-xs ${STATUS_COLOR[project.status] ?? ''}`}>
                        {PROJECT_STATUS_LABELS[project.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-xs ${BILLING_COLOR[project.summary.invoicingStatus]}`}>
                        {PROJECT_INVOICING_LABELS[project.summary.invoicingStatus]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-xs ${BILLING_COLOR[project.summary.collectionStatus]}`}>
                        {PROJECT_COLLECTION_LABELS[project.summary.collectionStatus]}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-xs leading-5" style={{ color: 'var(--muted-foreground)' }}>
                      <div>待办 {project.summary.openTasks}</div>
                      <div>共 {project.summary.taskCount}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between text-sm" style={{ color: 'var(--muted-foreground)' }}>
        <span>共 {total} 条</span>
        {pageCount > 1 && (
          <div className="flex gap-2">
            <Button variant="outline" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>上一页</Button>
            <span className="px-2 py-2">{page} / {pageCount}</span>
            <Button variant="outline" disabled={page >= pageCount} onClick={() => setPage(p => p + 1)}>下一页</Button>
          </div>
        )}
      </div>

      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg space-y-4 p-5" style={card}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold" style={{ color: 'var(--foreground)' }}>新建项目</h2>
              <button type="button" onClick={() => setCreateOpen(false)} style={{ color: 'var(--muted-foreground)' }}>关闭</button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs" style={{ color: 'var(--muted-foreground)' }}>客户类型</label>
                <select
                  className={inputClass}
                  style={inputStyle()}
                  value={draft.customerType}
                  onChange={e => setDraft(d => ({
                    ...d,
                    customerType: e.target.value as 'COMPANY' | 'INDIVIDUAL',
                    companyId: '',
                    keyPersonId: '',
                  }))}
                >
                  <option value="COMPANY">公司</option>
                  <option value="INDIVIDUAL">自然人</option>
                </select>
              </div>
              {draft.customerType === 'COMPANY' ? (
                <div>
                  <label className="mb-1 block text-xs" style={{ color: 'var(--muted-foreground)' }}>客户公司</label>
                  <select
                    className={inputClass}
                    style={inputStyle()}
                    value={draft.companyId}
                    onChange={e => setDraft(d => ({ ...d, companyId: e.target.value }))}
                  >
                    <option value="">选择公司</option>
                    {companies.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.companyCode ? `${c.companyCode} — ` : ''}{c.nameEn}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="mb-1 block text-xs" style={{ color: 'var(--muted-foreground)' }}>自然人客户</label>
                  <select
                    className={inputClass}
                    style={inputStyle()}
                    value={draft.keyPersonId}
                    onChange={e => setDraft(d => ({ ...d, keyPersonId: e.target.value }))}
                  >
                    <option value="">选择已通过 KYC 的自然人</option>
                    {keyPersons.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.kycCode ? `${p.kycCode} — ` : ''}{p.nameEn}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="mb-1 block text-xs" style={{ color: 'var(--muted-foreground)' }}>项目名称</label>
                <input
                  className={inputClass}
                  style={inputStyle()}
                  value={draft.title}
                  onChange={e => setDraft(d => ({ ...d, title: e.target.value }))}
                  placeholder="例如：2026 企业管理服务"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs" style={{ color: 'var(--muted-foreground)' }}>项目类型</label>
                <select
                  className={inputClass}
                  style={inputStyle()}
                  value={draft.projectType}
                  onChange={e => setDraft(d => ({ ...d, projectType: e.target.value as typeof draft.projectType }))}
                >
                  {Object.entries(PROJECT_TYPE_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>
              <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--foreground)' }}>
                <input
                  type="checkbox"
                  checked={draft.hasPeriod}
                  onChange={e => setDraft(d => {
                    const startDate = e.target.checked
                      ? (d.startDate || localDateIso())
                      : d.startDate
                    return {
                      ...d,
                      hasPeriod: e.target.checked,
                      autoRenew: e.target.checked ? d.autoRenew : false,
                      startDate,
                      endDate: e.target.checked ? periodEndOneYearAfter(startDate) : d.endDate,
                    }
                  })}
                />
                有服务周期（取消勾选 = 一次性、无时限）
              </label>
              {draft.hasPeriod && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-xs" style={{ color: 'var(--muted-foreground)' }}>开始日期</label>
                      <input
                        type="date"
                        className={inputClass}
                        style={inputStyle()}
                        value={draft.startDate}
                        onChange={e => setDraft(d => ({
                          ...d,
                          startDate: e.target.value,
                          endDate: periodEndOneYearAfter(e.target.value),
                        }))}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs" style={{ color: 'var(--muted-foreground)' }}>结束日期</label>
                      <input
                        type="date"
                        className={inputClass}
                        style={inputStyle()}
                        value={draft.endDate}
                        onChange={e => setDraft(d => ({ ...d, endDate: e.target.value }))}
                      />
                    </div>
                  </div>
                  <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--foreground)' }}>
                    <input
                      type="checkbox"
                      checked={draft.autoRenew}
                      onChange={e => setDraft(d => ({ ...d, autoRenew: e.target.checked }))}
                    />
                    到期提醒续期（默认一年一期）
                  </label>
                </>
              )}
              <div>
                <label className="mb-1 block text-xs" style={{ color: 'var(--muted-foreground)' }}>备注</label>
                <textarea
                  className={inputClass}
                  style={inputStyle()}
                  rows={3}
                  value={draft.notes}
                  onChange={e => setDraft(d => ({ ...d, notes: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setCreateOpen(false)}>取消</Button>
              <Button onClick={createProject} disabled={creating}>{creating ? '创建中…' : '创建'}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
