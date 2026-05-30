'use client'

import { Link } from '@/i18n/navigation'
import { useFinancialCompany } from '@/components/admin/financial/FinancialCompanyContext'

export function FinancialBreadcrumbs({ section }: { section: string }) {
  const company = useFinancialCompany()
  const companyLabel = company.companyCode
    ? `${company.companyCode} · ${company.nameEn}`
    : company.nameEn

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs" style={{ color: '#7A7060' }}>
      <Link href="/admin/dashboard" className="hover:text-[#C9A96E]">
        Dashboard
      </Link>
      <span>/</span>
      <Link href="/admin/financial" className="hover:text-[#C9A96E]">
        财务管理
      </Link>
      <span>/</span>
      <Link href="/admin/financial" className="hover:text-[#C9A96E]">
        {companyLabel}
      </Link>
      <span>/</span>
      <span style={{ color: 'var(--muted-foreground)' }}>{section}</span>
    </div>
  )
}
