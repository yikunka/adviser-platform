import { getTranslations } from 'next-intl/server'
import Link from 'next/link'

export default async function AdminCosmocoatPage() {
  const t = await getTranslations('admin.cosmocoatHub')

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>
          {t('title')}
        </h1>
        <p className="text-sm mt-2" style={{ color: 'var(--muted-foreground)' }}>
          {t('desc')}
        </p>
      </div>
      <Link
        href="/cosmocoat"
        className="inline-flex items-center gap-2 px-5 py-3 rounded-lg text-sm font-semibold transition-opacity hover:opacity-90"
        style={{ background: '#ff2200', color: '#fff' }}
      >
        {t('openSite')}
      </Link>
    </div>
  )
}
