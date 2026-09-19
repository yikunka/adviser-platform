'use client'

import { FinancialCompanyDashboard } from '@/components/admin/financial/FinancialCompanyDashboard'
import { FinancialCompanySelector } from '@/components/admin/financial/FinancialCompanySelector'
import { useFinancialWorkspace } from '@/components/admin/financial/FinancialCompanyContext'
import { FinancialReportGroupsPanel } from '@/components/admin/financial/FinancialReportGroupsPanel'

export default function AdminFinancialSelectCompanyPage() {
  const { company, loading } = useFinancialWorkspace()

  return (
    <div className="p-6 space-y-5">
      <FinancialCompanySelector />
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
