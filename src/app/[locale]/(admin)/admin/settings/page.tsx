'use client'

import { useParams, usePathname } from 'next/navigation'
import { useRouter } from '@/i18n/navigation'

const cardStyle: React.CSSProperties = {
  background: 'var(--card)',
  border: '1px solid var(--border)',
  borderRadius: '0.75rem',
  padding: '1.5rem',
}

export default function AdminSettingsPage() {
  const params = useParams()
  const pathname = usePathname()
  const router = useRouter()
  const locale = (params.locale as string) ?? 'zh'
  const nextLocale = locale === 'zh' ? 'en' : 'zh'

  function switchLanguage() {
    const pathWithoutLocale = pathname.replace(/^\/(zh|en)/, '') || '/'
    router.push(pathWithoutLocale, { locale: nextLocale })
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>Settings</h1>

      <div style={cardStyle} className="space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>Language</h2>
            <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
              Choose the display language for the admin console.
            </p>
          </div>
          <div className="inline-flex rounded-lg p-1" style={{ background: '#0E0E0A', border: '1px solid #2A2418' }}>
            {[
              { key: 'zh', label: '中文' },
              { key: 'en', label: 'EN' },
            ].map(option => {
              const active = locale === option.key
              return (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => {
                    if (!active) switchLanguage()
                  }}
                  className="min-w-16 rounded-md px-4 py-2 text-sm font-medium transition-all"
                  style={{
                    background: active ? '#C9A96E' : 'transparent',
                    color: active ? '#0A0805' : 'var(--muted-foreground)',
                  }}
                >
                  {option.label}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Platform info */}
      <div style={cardStyle} className="space-y-4">
        <h2 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>Platform</h2>
        <div className="grid sm:grid-cols-2 gap-4 text-sm">
          {[
            ['Application', '6AM Advisory Platform'],
            ['Version', '1.0.0'],
            ['Environment', process.env.NODE_ENV ?? 'production'],
          ].map(([label, value]) => (
            <div key={label} className="flex justify-between py-2 border-b border-[#2A2418]">
              <span style={{ color: 'var(--muted-foreground)' }}>{label}</span>
              <span style={{ color: 'var(--foreground)' }}>{value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
