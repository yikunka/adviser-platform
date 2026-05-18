'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'

type AlertDetail = {
  id: string
  result: string
  resolution: string
  matchScore: number | null
  reviewNotes: string | null
  subjectType: string
  keyPersonId: string | null
  companyId: string | null
  createdAt: string
  amlRecord: {
    primaryName: string
    aliases: string[]
    dateOfBirth: string | null
    nationality: string | null
    gender: string | null
    placeOfBirth: string | null
    addresses: unknown
    idNumbers: unknown
    listingReason: string | null
    listingDate: string | null
    listVersionDate: string
    rawData: unknown
    entityType: string
    source: { nameEn: string; sourceUrl: string }
  }
}

const RESULT_COLOR: Record<string, { banner: string; text: string }> = {
  STRONG_HIT:   { banner: 'bg-[rgba(239,68,68,0.1)] border-[rgba(239,68,68,0.3)]',  text: 'text-[#ef4444]' },
  POTENTIAL_HIT: { banner: 'bg-[rgba(245,158,11,0.1)] border-[rgba(245,158,11,0.3)]', text: 'text-[#f59e0b]' },
  WEAK_HIT:     { banner: 'bg-[rgba(234,179,8,0.1)] border-[rgba(234,179,8,0.3)]',   text: 'text-[#eab308]' },
}

function JsonBlock({ label, value }: { label: string; value: unknown }) {
  if (value == null) return null
  const isEmptyObject = typeof value === 'object' && !Array.isArray(value) && Object.keys(value as Record<string, unknown>).length === 0
  const isEmptyArray = Array.isArray(value) && value.length === 0
  if (isEmptyObject || isEmptyArray) return null

  return (
    <div className="space-y-1 text-sm">
      <p className="font-medium" style={{ color: 'var(--muted-foreground)' }}>{label}</p>
      <pre className="max-h-72 overflow-auto rounded-md border border-[#2A2418] p-3 whitespace-pre-wrap" style={{ background: '#0A0A0A', color: 'var(--foreground)' }}>
        {typeof value === 'string' ? value : JSON.stringify(value, null, 2)}
      </pre>
    </div>
  )
}

export default function AMLAlertDetailPage() {
  const t = useTranslations('admin.aml')
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [alert, setAlert] = useState<AlertDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetch(`/api/aml/alerts/${id}`)
      .then(r => r.json())
      .then(data => { setAlert(data); setNotes(data.reviewNotes ?? ''); setLoading(false) })
  }, [id])

  async function resolve(resolution: 'FALSE_POSITIVE' | 'CONFIRMED' | 'ESCALATED') {
    setSubmitting(true)
    const res = await fetch(`/api/aml/alerts/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resolution, reviewNotes: notes }),
    })
    if (res.ok) {
      router.back()
    } else {
      setSubmitting(false)
    }
  }

  if (loading) return <div className="p-8" style={{ color: 'var(--muted-foreground)' }}>Loading...</div>
  if (!alert) return <div className="p-8" style={{ color: '#ef4444' }}>Alert not found</div>

  const isResolved = alert.resolution !== 'PENDING'
  const resultStyle = RESULT_COLOR[alert.result] ?? { banner: 'bg-[rgba(120,113,108,0.1)] border-[#2A2418]', text: 'text-[#9A8060]' }

  return (
    <div className="p-6 max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="text-sm transition-colors" style={{ color: 'var(--muted-foreground)' }}>
          ← Back
        </button>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>AML Alert Detail</h1>
      </div>

      <div className={`border rounded-lg p-4 ${resultStyle.banner}`}>
        <div className="flex items-center justify-between">
          <span className={`font-semibold text-lg ${resultStyle.text}`}>{alert.result.replace('_', ' ')}</span>
          {alert.matchScore != null && (
            <span className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
              Match score: {(alert.matchScore * 100).toFixed(1)}%
            </span>
          )}
        </div>
        <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
          Subject: {alert.subjectType.replace('_', ' ')} · Created {new Date(alert.createdAt).toLocaleString()}
        </p>
      </div>

      <div className="rounded-lg p-4 space-y-3" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
        <h2 className="font-semibold" style={{ color: 'var(--foreground)' }}>Matched Sanctions Record</h2>
        <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
          <div>
            <span style={{ color: 'var(--muted-foreground)' }}>Primary Name: </span>
            <span className="font-medium" style={{ color: 'var(--foreground)' }}>{alert.amlRecord.primaryName}</span>
          </div>
          <div>
            <span style={{ color: 'var(--muted-foreground)' }}>Entity Type: </span>
            <span style={{ color: 'var(--foreground)' }}>{alert.amlRecord.entityType}</span>
          </div>
          <div>
            <span style={{ color: 'var(--muted-foreground)' }}>Source: </span>
            <a
              href={alert.amlRecord.source.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="hover:underline"
              style={{ color: '#C9A96E' }}
            >
              {alert.amlRecord.source.nameEn}
            </a>
          </div>
          {alert.amlRecord.nationality && (
            <div>
              <span style={{ color: 'var(--muted-foreground)' }}>Nationality: </span>
              <span style={{ color: 'var(--foreground)' }}>{alert.amlRecord.nationality}</span>
            </div>
          )}
          {alert.amlRecord.gender && (
            <div>
              <span style={{ color: 'var(--muted-foreground)' }}>Gender: </span>
              <span style={{ color: 'var(--foreground)' }}>{alert.amlRecord.gender}</span>
            </div>
          )}
          {alert.amlRecord.dateOfBirth && (
            <div>
              <span style={{ color: 'var(--muted-foreground)' }}>Date of Birth: </span>
              <span style={{ color: 'var(--foreground)' }}>{new Date(alert.amlRecord.dateOfBirth).toLocaleDateString()}</span>
            </div>
          )}
          {alert.amlRecord.placeOfBirth && (
            <div>
              <span style={{ color: 'var(--muted-foreground)' }}>Place of Birth: </span>
              <span style={{ color: 'var(--foreground)' }}>{alert.amlRecord.placeOfBirth}</span>
            </div>
          )}
          {alert.amlRecord.listingDate && (
            <div>
              <span style={{ color: 'var(--muted-foreground)' }}>Listing Date: </span>
              <span style={{ color: 'var(--foreground)' }}>{new Date(alert.amlRecord.listingDate).toLocaleDateString()}</span>
            </div>
          )}
          <div>
            <span style={{ color: 'var(--muted-foreground)' }}>List Version Date: </span>
            <span style={{ color: 'var(--foreground)' }}>{new Date(alert.amlRecord.listVersionDate).toLocaleDateString()}</span>
          </div>
        </div>
        {alert.amlRecord.aliases.length > 0 && (
          <div className="text-sm">
            <span style={{ color: 'var(--muted-foreground)' }}>Aliases: </span>
            <span style={{ color: 'var(--foreground)' }}>{alert.amlRecord.aliases.join(', ')}</span>
          </div>
        )}
        {alert.amlRecord.listingReason && (
          <div className="text-sm">
            <span style={{ color: 'var(--muted-foreground)' }}>Listing reason: </span>
            <span style={{ color: 'var(--foreground)' }}>{alert.amlRecord.listingReason}</span>
          </div>
        )}
        <JsonBlock label="ID Numbers" value={alert.amlRecord.idNumbers} />
        <JsonBlock label="Addresses" value={alert.amlRecord.addresses} />
        <JsonBlock label="Raw Source Record" value={alert.amlRecord.rawData} />
      </div>

      {!isResolved ? (
        <div className="rounded-lg p-4 space-y-4" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          <h2 className="font-semibold" style={{ color: 'var(--foreground)' }}>Resolution</h2>
          <div className="space-y-2">
            <Label htmlFor="notes" style={{ color: 'var(--muted-foreground)' }}>Review Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Document your review findings..."
              rows={4}
              style={{ background: '#0A0A0A', border: '1px solid #2A2418', color: 'var(--foreground)' }}
            />
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => resolve('FALSE_POSITIVE')} disabled={submitting}>
              {t('resolution.falsePositive')}
            </Button>
            <Button variant="destructive" onClick={() => resolve('CONFIRMED')} disabled={submitting}>
              {t('resolution.confirmed')}
            </Button>
            <Button onClick={() => resolve('ESCALATED')} disabled={submitting} className="bg-purple-600 hover:bg-purple-700">
              {t('resolution.escalated')}
            </Button>
          </div>
        </div>
      ) : (
        <div className="rounded-lg p-4" style={{ background: '#1A1A12', border: '1px solid #2A2418' }}>
          <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
            <span className="font-medium" style={{ color: 'var(--foreground)' }}>Resolution:</span>{' '}
            {alert.resolution.replace('_', ' ')}
          </p>
          {alert.reviewNotes && (
            <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
              <span className="font-medium" style={{ color: 'var(--foreground)' }}>Notes:</span>{' '}
              {alert.reviewNotes}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
