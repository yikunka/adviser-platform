'use client'

/* eslint-disable react-hooks/set-state-in-effect */

import { useCallback, useEffect, useState } from 'react'
import { Link } from '@/i18n/navigation'
import { toast } from 'sonner'
import { Plus, Search, UserRound } from 'lucide-react'
import type { CosEmployeeRow } from '@/lib/cosmocoat/employees'
import { COS_EMPLOYEE_FIVE_ELEMENTS } from '@/lib/cosmocoat/employee-filters'
import { COS_EMPLOYEE_TYPE_LABELS } from '@/lib/cosmocoat/employee-labels'
import type { CosEmployeeType } from '@prisma/client'

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

const TYPE_OPTIONS: { value: CosEmployeeType | ''; label: string }[] = [
  { value: '', label: '全部类型' },
  { value: 'INTERNAL', label: COS_EMPLOYEE_TYPE_LABELS.INTERNAL },
  { value: 'SALES', label: COS_EMPLOYEE_TYPE_LABELS.SALES },
  { value: 'PRODUCTION', label: COS_EMPLOYEE_TYPE_LABELS.PRODUCTION },
  { value: 'TECHNICAL', label: COS_EMPLOYEE_TYPE_LABELS.TECHNICAL },
]

const FIVE_ELEMENT_OPTIONS = [
  { value: '', label: '全部五行' },
  ...COS_EMPLOYEE_FIVE_ELEMENTS.map(value => ({ value, label: value })),
]

const STATUS_OPTIONS = [
  { value: '', label: '全部状态' },
  { value: 'active', label: '活跃' },
  { value: 'inactive', label: '停用' },
] as const

function formatDate(value: string | null) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('zh-HK', { day: 'numeric', month: 'short', year: 'numeric' })
}

function parseDateParts(value: string | null) {
  const match = String(value ?? '').match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!match) return null

  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  }
}

function formatServiceYears(hireDate: string | null) {
  const parts = parseDateParts(hireDate)
  if (!parts) return '—'

  const today = new Date()
  let years = today.getFullYear() - parts.year
  const currentMonth = today.getMonth() + 1
  const hasReachedAnniversary = currentMonth > parts.month
    || (currentMonth === parts.month && today.getDate() >= parts.day)

  if (!hasReachedAnniversary) years -= 1

  return `${Math.max(0, years)}年`
}

function formatFiveElement(employee: CosEmployeeRow) {
  if (!employee.birthInfo) return '—'
  return `${employee.birthInfo.fiveElement}（${employee.birthInfo.sexagenaryYear}年）`
}

export default function AdminCosmoCoatEmployeesPage() {
  const [employees, setEmployees] = useState<CosEmployeeRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [employeeType, setEmployeeType] = useState<CosEmployeeType | ''>('')
  const [fiveElement, setFiveElement] = useState('')
  const [status, setStatus] = useState('')

  const fetchEmployees = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page) })
      if (search.trim()) params.set('q', search.trim())
      if (employeeType) params.set('employeeType', employeeType)
      if (fiveElement) params.set('fiveElement', fiveElement)
      if (status) params.set('status', status)
      const res = await fetch(`/api/admin/cosmocoat/employees?${params}`)
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? '加载员工列表失败')
        return
      }
      setEmployees(data.employees ?? [])
      setTotal(data.total ?? 0)
      setTotalPages(data.totalPages ?? 1)
    } catch {
      toast.error('加载员工列表失败')
    } finally {
      setLoading(false)
    }
  }, [page, search, employeeType, fiveElement, status])

  useEffect(() => {
    const timer = setTimeout(fetchEmployees, search ? 300 : 0)
    return () => clearTimeout(timer)
  }, [fetchEmployees, search])

  useEffect(() => {
    setPage(1)
  }, [search, employeeType, fiveElement, status])

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>员工管理</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
            共 {total} 位员工 · 管理内务、销售、生产与技术人员档案
          </p>
        </div>
        <Link
          href="/admin/cosmocoat-employees/new"
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
          style={{ background: '#C9A96E', color: '#0A0805' }}
        >
          <Plus size={16} />
          新建员工
        </Link>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative w-full max-w-md">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--muted-foreground)' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="搜索员工编码、姓名、电话、邮箱..."
            className="w-full rounded-lg pl-9 pr-3 py-2.5 text-sm outline-none"
            style={{ background: '#0E0E0A', border: '1px solid #2A2418', color: 'var(--foreground)' }}
          />
        </div>
        <select
          value={employeeType}
          onChange={e => setEmployeeType(e.target.value as CosEmployeeType | '')}
          className="rounded-lg px-3 py-2.5 text-sm outline-none"
          style={{ background: '#0E0E0A', border: '1px solid #2A2418', color: 'var(--foreground)' }}
        >
          {TYPE_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <select
          value={fiveElement}
          onChange={e => setFiveElement(e.target.value)}
          className="rounded-lg px-3 py-2.5 text-sm outline-none"
          style={{ background: '#0E0E0A', border: '1px solid #2A2418', color: 'var(--foreground)' }}
        >
          {FIVE_ELEMENT_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <select
          value={status}
          onChange={e => setStatus(e.target.value)}
          className="rounded-lg px-3 py-2.5 text-sm outline-none"
          style={{ background: '#0E0E0A', border: '1px solid #2A2418', color: 'var(--foreground)' }}
        >
          {STATUS_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      <div style={card}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                {['员工编码', '姓名', '员工类型', '职位', '电话', '状态', '入职日期', '工龄', '五行', '更新时间'].map(h => (
                  <th key={h} style={th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center" style={{ color: 'var(--muted-foreground)' }}>加载中...</td>
                </tr>
              ) : employees.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <UserRound size={28} style={{ color: '#C9A96E', opacity: 0.45 }} />
                      <span style={{ color: 'var(--muted-foreground)' }}>
                        {search || employeeType || fiveElement || status ? '没有匹配的员工记录' : '暂无员工，点击「新建员工」添加'}
                      </span>
                    </div>
                  </td>
                </tr>
              ) : employees.map(employee => (
                <tr key={employee.id} className="hover:bg-[#1A1A12]/50 align-top">
                  <td style={td}>
                    <Link
                      href={`/admin/cosmocoat-employees/${employee.id}`}
                      className="font-medium underline-offset-4 hover:underline"
                      style={{ color: '#C9A96E' }}
                    >
                      {employee.code}
                    </Link>
                  </td>
                  <td style={{ ...td, color: 'var(--foreground)' }}>{employee.name}</td>
                  <td style={td}>{COS_EMPLOYEE_TYPE_LABELS[employee.employeeType]}</td>
                  <td style={td}>{employee.position ?? '—'}</td>
                  <td style={td}>{employee.phone ?? '—'}</td>
                  <td style={td}>
                    <span
                      className="inline-block px-2 py-0.5 rounded text-xs"
                      style={{
                        background: employee.isActive ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.12)',
                        color: employee.isActive ? '#10b981' : '#ef4444',
                      }}
                    >
                      {employee.isActive ? '在职' : '停用'}
                    </span>
                  </td>
                  <td style={td}>{formatDate(employee.hireDate)}</td>
                  <td style={td}>{formatServiceYears(employee.hireDate)}</td>
                  <td style={td}>{formatFiveElement(employee)}</td>
                  <td style={td}>{formatDate(employee.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t" style={{ borderColor: '#2A2418' }}>
            <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>第 {page} / {totalPages} 页</span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage(p => p - 1)}
                className="px-3 py-1.5 rounded text-xs disabled:opacity-40"
                style={{ border: '1px solid #2A2418', color: 'var(--foreground)' }}
              >
                上一页
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage(p => p + 1)}
                className="px-3 py-1.5 rounded text-xs disabled:opacity-40"
                style={{ border: '1px solid #2A2418', color: 'var(--foreground)' }}
              >
                下一页
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
