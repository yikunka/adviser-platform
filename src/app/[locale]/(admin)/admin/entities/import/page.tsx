'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import Papa from 'papaparse'
import { Link } from '@/i18n/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

type ImportRow = {
  nameEn: string
  nameZh?: string
  companyNumber?: string
  companyType?: string
  groupName?: string
}

export default function EntityBulkImportPage() {
  const t = useTranslations('admin.entities')
  const [groupId, setGroupId] = useState('')
  const [rows, setRows] = useState<ImportRow[]>([])
  const [preview, setPreview] = useState<{ validCount: number; errorCount: number } | null>(null)
  const [loading, setLoading] = useState(false)

  function handleFile(file: File) {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: result => {
        const parsed = result.data.map(row => ({
          nameEn: row.nameEn || row.name_en || row.Name || '',
          nameZh: row.nameZh || row.name_zh,
          companyNumber: row.companyNumber || row.company_number,
          companyType: row.companyType || row.company_type,
          groupName: row.groupName || row.group_name,
        })).filter(r => r.nameEn.trim())
        setRows(parsed)
        setPreview(null)
      },
    })
  }

  async function runImport(previewOnly: boolean) {
    if (rows.length === 0) {
      toast.error(t('importNoRows'))
      return
    }
    setLoading(true)
    try {
      const url = previewOnly ? '/api/admin/entity-groups/import?preview=1' : '/api/admin/entity-groups/import'
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          groupId: groupId || undefined,
          createGroupIfMissing: true,
          rows,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setPreview(data.preview ?? null)
        toast.error(data.error || t('importError'))
        return
      }
      if (previewOnly) {
        setPreview(data.preview)
        toast.success(t('previewReady', { valid: data.preview.validCount, errors: data.preview.errorCount }))
      } else {
        toast.success(t('importSuccess', { count: data.count }))
        setRows([])
        setPreview(null)
      }
    } catch {
      toast.error(t('importError'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 max-w-2xl space-y-6">
      <Link href="/admin/entities" className="text-sm" style={{ color: '#C9A96E' }}>← {t('back')}</Link>
      <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>{t('bulkImport')}</h1>
      <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>{t('importHint')}</p>

      <div className="space-y-2">
        <label className="text-xs" style={{ color: '#7A7060' }}>{t('defaultGroupId')}</label>
        <Input value={groupId} onChange={e => setGroupId(e.target.value)} placeholder="cuid (optional)" />
      </div>

      <input
        type="file"
        accept=".csv"
        onChange={e => {
          const f = e.target.files?.[0]
          if (f) handleFile(f)
        }}
      />

      {rows.length > 0 && (
        <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>{t('rowCount', { count: rows.length })}</p>
      )}

      {preview && (
        <p className="text-sm" style={{ color: '#C9A96E' }}>
          {t('previewSummary', { valid: preview.validCount, errors: preview.errorCount })}
        </p>
      )}

      <div className="flex gap-2">
        <Button variant="outline" disabled={loading || rows.length === 0} onClick={() => runImport(true)}>
          {t('preview')}
        </Button>
        <Button disabled={loading || rows.length === 0} onClick={() => runImport(false)}>
          {t('import')}
        </Button>
      </div>
    </div>
  )
}
