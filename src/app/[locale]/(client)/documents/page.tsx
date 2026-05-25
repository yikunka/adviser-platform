'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { FolderOpen, Download, Loader2 } from 'lucide-react'

type Doc = {
  id: string
  name: string
  type: string
  createdAt: string
  company?: { nameEn: string } | null
}

const DOC_TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  CI:        { bg: 'rgba(59,130,246,0.12)',  text: '#60a5fa' },
  BR:        { bg: 'rgba(59,130,246,0.12)',  text: '#60a5fa' },
  AA:        { bg: 'rgba(59,130,246,0.12)',  text: '#60a5fa' },
  NNC1:      { bg: 'rgba(59,130,246,0.12)',  text: '#60a5fa' },
  ROD:       { bg: 'rgba(201,169,110,0.15)', text: '#C9A96E' },
  ROM:       { bg: 'rgba(201,169,110,0.15)', text: '#C9A96E' },
  ROSC:      { bg: 'rgba(201,169,110,0.15)', text: '#C9A96E' },
  DDR:       { bg: 'rgba(99,102,241,0.15)',  text: '#818cf8' },
  NAR1:      { bg: 'rgba(16,185,129,0.12)',  text: '#10b981' },
  KYC:       { bg: 'rgba(245,158,11,0.12)',  text: '#f59e0b' },
  CORPORATE: { bg: 'rgba(99,102,241,0.12)', text: '#818cf8' },
}

export default function DocumentsPage() {
  const t = useTranslations('documents')
  const [docs, setDocs] = useState<Doc[]>([])
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/documents')
      .then(r => r.json())
      .then(setDocs)
      .finally(() => setLoading(false))
  }, [])

  async function download(docId: string, name: string) {
    setDownloading(docId)
    try {
      const res = await fetch(`/api/documents/${docId}/download`)
      const json = await res.json()
      if (!res.ok) { toast.error(t('downloadFailed')); return }
      const a = document.createElement('a')
      a.href = json.url
      a.download = name
      a.click()
    } finally {
      setDownloading(null)
    }
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold" style={{ color: 'var(--foreground)' }}>{t('title')}</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>{t('subtitle', { defaultValue: 'Download your company documents' })}</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20" style={{ color: 'var(--muted-foreground)' }}>
          <Loader2 size={22} className="animate-spin" />
        </div>
      ) : docs.length === 0 ? (
        <div
          className="rounded-xl flex flex-col items-center justify-center py-20 gap-4"
          style={{ background: 'var(--card)', border: '1px dashed var(--border)' }}
        >
          <div
            className="w-14 h-14 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(201,169,110,0.1)', border: '1px solid rgba(201,169,110,0.2)' }}
          >
            <FolderOpen size={24} style={{ color: '#C9A96E' }} />
          </div>
          <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>{t('empty')}</p>
        </div>
      ) : (
        <div
          className="rounded-xl overflow-hidden"
          style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
        >
          {/* Table header */}
          <div
            className="grid px-5 py-3 text-xs font-medium uppercase tracking-wider"
            style={{
              gridTemplateColumns: '1fr 100px 160px 120px 80px',
              background: '#0A0A0A',
              borderBottom: '1px solid var(--border)',
              color: 'var(--muted-foreground)',
            }}
          >
            <span>{t('name')}</span>
            <span>{t('type')}</span>
            <span>{t('company')}</span>
            <span>{t('date')}</span>
            <span />
          </div>

          {/* Rows */}
          {docs.map((doc, i) => {
            const typeColor = DOC_TYPE_COLORS[doc.type] ?? { bg: 'rgba(120,113,108,0.15)', text: '#9A8060' }
            return (
              <div
                key={doc.id}
                className="grid cursor-pointer items-center px-5 py-3.5 transition-colors"
                style={{
                  gridTemplateColumns: '1fr 100px 160px 120px 80px',
                  borderBottom: i < docs.length - 1 ? '1px solid var(--border)' : 'none',
                  background: 'transparent',
                }}
                role="button"
                tabIndex={0}
                onClick={() => download(doc.id, doc.name)}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') download(doc.id, doc.name)
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--accent)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <span className="text-sm font-medium truncate pr-4" style={{ color: 'var(--foreground)' }}>
                  {doc.name}
                </span>
                <span>
                  <span
                    className="px-2 py-0.5 rounded text-xs font-semibold"
                    style={{ background: typeColor.bg, color: typeColor.text }}
                  >
                    {doc.type}
                  </span>
                </span>
                <span className="text-sm truncate" style={{ color: 'var(--muted-foreground)' }}>
                  {doc.company?.nameEn ?? '—'}
                </span>
                <span className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                  {new Date(doc.createdAt).toLocaleDateString()}
                </span>
                <span className="flex justify-end">
                  <button
                    disabled={downloading === doc.id}
                    onClick={e => {
                      e.stopPropagation()
                      download(doc.id, doc.name)
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all"
                    style={{
                      background: downloading === doc.id ? 'rgba(201,169,110,0.1)' : 'transparent',
                      border: '1px solid',
                      borderColor: downloading === doc.id ? '#C9A96E' : 'var(--border)',
                      color: downloading === doc.id ? '#C9A96E' : 'var(--muted-foreground)',
                    }}
                    onMouseEnter={e => {
                      if (downloading !== doc.id) {
                        (e.currentTarget as HTMLElement).style.borderColor = '#C9A96E'
                        ;(e.currentTarget as HTMLElement).style.color = '#C9A96E'
                      }
                    }}
                    onMouseLeave={e => {
                      if (downloading !== doc.id) {
                        (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'
                        ;(e.currentTarget as HTMLElement).style.color = 'var(--muted-foreground)'
                      }
                    }}
                  >
                    {downloading === doc.id
                      ? <Loader2 size={12} className="animate-spin" />
                      : <Download size={12} />
                    }
                    {downloading === doc.id ? '...' : t('download')}
                  </button>
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
