'use client'

import { useEffect } from 'react'
import { useRouter } from '@/i18n/navigation'
import { resolveStoredFinancialCompanyId } from '@/lib/financial/selected-company'

const STORAGE_KEY = 'adviser.financial.selectedCompanyId'

export function FinancialRouteRedirect({ section }: { section: 'accounts' | 'journal' | 'ledger' | 'reports' }) {
  const router = useRouter()

  useEffect(() => {
    let cancelled = false

    async function redirectToSection() {
      const storedCompanyId = window.localStorage.getItem(STORAGE_KEY)
      if (!storedCompanyId) {
        router.replace('/admin/financial')
        return
      }

      try {
        const res = await fetch('/api/admin/financial/scope')
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || '载入财务公司失败')

        const companyId = resolveStoredFinancialCompanyId(data.companies ?? [], storedCompanyId)
        if (cancelled) return

        if (companyId) {
          window.localStorage.setItem(STORAGE_KEY, companyId)
          router.replace(`/admin/financial/${companyId}/${section}`)
          return
        }

        window.localStorage.removeItem(STORAGE_KEY)
        router.replace('/admin/financial')
      } catch {
        if (cancelled) return
        router.replace('/admin/financial')
      }
    }

    redirectToSection()
    return () => {
      cancelled = true
    }
  }, [router, section])

  return (
    <div className="p-6 text-sm" style={{ color: 'var(--muted-foreground)' }}>
      跳转中...
    </div>
  )
}
