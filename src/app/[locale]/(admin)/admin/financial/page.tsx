'use client'

import { FinancialCompanyDashboard } from '@/components/admin/financial/FinancialCompanyDashboard'
import { FinancialCompanySelector } from '@/components/admin/financial/FinancialCompanySelector'
import { useFinancialWorkspace } from '@/components/admin/financial/FinancialCompanyContext'

export default function AdminFinancialSelectCompanyPage() {
  const { company, loading } = useFinancialWorkspace()

  return (
    <div className="p-6 space-y-5">
      <FinancialCompanySelector />
      {loading ? null : company ? (
        <FinancialCompanyDashboard />
      ) : (
        <div className="rounded-lg border border-[#2A2418] bg-card p-8 text-center text-sm text-muted-foreground">
          Select a client company above to open its financial workspace.
        </div>
      )}
    </div>
  )
}
