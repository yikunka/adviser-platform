'use client'

import { useTranslations } from 'next-intl'

type Props = {
  value: string | null
  loading?: boolean
}

export function SfsInvoiceNumberDisplay({ value, loading }: Props) {
  const t = useTranslations('admin.sfsInvoices')

  return (
    <div className="text-right shrink-0">
      <div className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>
        {t('invoiceNumber')}
      </div>
      <div className="text-lg font-mono font-semibold tracking-wide" style={{ color: 'var(--foreground)' }}>
        {loading ? '…' : (value ?? '—')}
      </div>
    </div>
  )
}
