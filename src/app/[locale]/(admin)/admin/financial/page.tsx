'use client'

import { FinancialCompanyDashboard } from '@/components/admin/financial/FinancialCompanyDashboard'
import { FinancialCompanySelector } from '@/components/admin/financial/FinancialCompanySelector'
import { useFinancialWorkspace } from '@/components/admin/financial/FinancialCompanyContext'
import { FinancialReportGroupsPanel } from '@/components/admin/financial/FinancialReportGroupsPanel'

function previousCalendarMonth(now = new Date()) {
  const date = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function formatPeriod(period: string) {
  const [year, month] = period.split('-')
  return `${year}年${month}月`
}

function monthsBehind(period: string | null | undefined, duePeriod: string) {
  if (!period) return null
  const [year, month] = period.split('-').map(Number)
  const [dueYear, dueMonth] = duePeriod.split('-').map(Number)
  return (dueYear - year) * 12 + (dueMonth - month)
}

export default function AdminFinancialSelectCompanyPage() {
  const { company, companies, loading, setSelectedCompanyId } = useFinancialWorkspace()
  const duePeriod = previousCalendarMonth()
  const rows = [...companies].sort((a, b) => {
    const aPeriod = a.lastBookedPeriod ?? ''
    const bPeriod = b.lastBookedPeriod ?? ''
    if (!aPeriod && bPeriod) return -1
    if (aPeriod && !bPeriod) return 1
    if (aPeriod !== bPeriod) return aPeriod.localeCompare(bPeriod)
    return (a.companyCode ?? a.nameEn).localeCompare(b.companyCode ?? b.nameEn)
  })

  return (
    <div className="p-6 space-y-5">
      <FinancialCompanySelector />
      <section className="rounded-lg border border-[var(--border-subtle)] bg-card overflow-hidden">
        <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
          <h2 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>做帐进度</h2>
          <p className="mt-1 text-xs" style={{ color: 'var(--muted-foreground)' }}>
            已开启财务管理的公司，最后已过账月份。应做到 {formatPeriod(duePeriod)}；未做帐或落后的公司排在前面。
          </p>
        </div>
        <table className="w-full text-sm">
          <thead style={{ background: 'var(--surface-panel)', color: 'var(--muted-foreground)' }}>
            <tr>
              <th className="px-4 py-2 text-left font-medium">公司代码</th>
              <th className="px-4 py-2 text-left font-medium">公司名称</th>
              <th className="px-4 py-2 text-left font-medium">财务负责人</th>
              <th className="px-4 py-2 text-left font-medium">最后做帐月份</th>
              <th className="px-4 py-2 text-left font-medium">状态</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="px-4 py-6 text-center" style={{ color: 'var(--muted-foreground)' }}>载入中…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-6 text-center" style={{ color: 'var(--muted-foreground)' }}>没有已开启财务管理的公司。</td></tr>
            ) : rows.map(row => {
              const behind = monthsBehind(row.lastBookedPeriod, duePeriod)
              const overdue = !row.lastBookedPeriod || (behind != null && behind > 0)
              return (
                <tr
                  key={row.id}
                  className="cursor-pointer hover:bg-[var(--surface-panel)]"
                  style={{ borderTop: '1px solid var(--border-subtle)' }}
                  onClick={() => setSelectedCompanyId(row.id)}
                >
                  <td className="px-4 py-2 font-semibold" style={{ color: '#C9A96E' }}>{row.companyCode ?? '—'}</td>
                  <td className="px-4 py-2" style={{ color: 'var(--foreground)' }}>{row.nameEn}</td>
                  <td className="px-4 py-2" style={{ color: 'var(--muted-foreground)' }}>{row.financialManagerName ?? '—'}</td>
                  <td className="px-4 py-2" style={{ color: 'var(--foreground)' }}>
                    {row.lastBookedPeriod ? formatPeriod(row.lastBookedPeriod) : '—'}
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className="rounded-full px-2 py-0.5 text-xs font-medium"
                      style={{
                        background: overdue ? 'rgba(239,68,68,0.12)' : 'rgba(16,185,129,0.12)',
                        color: overdue ? '#ef4444' : '#10b981',
                      }}
                    >
                      {!row.lastBookedPeriod
                        ? '未做帐'
                        : behind != null && behind > 0
                          ? `落后 ${behind} 个月`
                          : '已更新'}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </section>
      {loading ? null : company ? (
        <FinancialCompanyDashboard />
      ) : (
        <div className="rounded-lg border border-[var(--border-subtle)] bg-card p-8 text-center text-sm text-muted-foreground">
          请先在上方选择客户公司，再进入财务工作台。
        </div>
      )}
      <FinancialReportGroupsPanel />
    </div>
  )
}
