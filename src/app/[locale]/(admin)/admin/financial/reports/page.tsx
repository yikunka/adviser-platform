'use client'

import { useEffect } from 'react'
import { useRouter } from '@/i18n/navigation'

const STORAGE_KEY = 'adviser.financial.selectedCompanyId'

/** Redirect to the URL-based route. Menu links point here; actual page lives at [companyId]/reports. */
export default function FinancialReportsRedirect() {
  const router = useRouter()

  useEffect(() => {
    const companyId = window.localStorage.getItem(STORAGE_KEY)
    router.replace(companyId ? `/admin/financial/${companyId}/reports` : '/admin/financial')
  }, [router])

  return (
    <div className="p-6 text-sm" style={{ color: 'var(--muted-foreground)' }}>
      跳转中...
    </div>
  )
}
