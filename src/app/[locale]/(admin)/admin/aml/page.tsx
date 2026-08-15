'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useRouter, Link } from '@/i18n/navigation'

type Alert = {
  id: string
  result: string
  resolution: string
  matchScore: number | null
  subjectType: string
  keyPersonId: string | null
  companyId: string | null
  subjectName: string | null
  createdAt: string
  amlRecord: {
    primaryName: string
    source: { nameEn: string }
  }
}

type AMLSource = {
  id: string
  seqNo: number
  nameEn: string
  nameZh: string
  format: string
  isActive: boolean
  lastFetched: string | null
  recordCount: number
}

type FatfListEntry = {
  name: string
  aliases: string[]
  listingReason: string | null
  listingDate: string | null
}

type FatfListPanel = {
  seqNo: number
  key: string
  labelZh: string
  labelEn: string
  titleEn: string
  titleZh: string
  asOf: string | null
  referenceUrl: string | null
  sourceId: string | null
  lastFetched: string | null
  recordCountInDb: number
  entries: FatfListEntry[]
}

type SourceRecordRow = {
  id: string
  primaryName: string
  aliases: string[]
  entityType: string
  nationality: string | null
  listingReason: string | null
  listingDate: string | null
}

type SourceIngestResult = {
  seqNo: number
  nameEn: string
  status: 'pending' | 'ingesting' | 'ok' | 'skipped' | 'error'
  skippedReason?: 'already_upserted' | 'file_reused' | 'no_local_file'
  upserted: number
  totalInDb: number
  fetchedAt: string | null
  savedFile: string | null
  error?: string
}

const RESULT_COLOR: Record<string, string> = {
  STRONG_HIT:   'bg-[rgba(239,68,68,0.12)] text-[#ef4444]',
  POTENTIAL_HIT: 'bg-[rgba(245,158,11,0.12)] text-[#f59e0b]',
  WEAK_HIT:     'bg-[rgba(234,179,8,0.12)] text-[#eab308]',
}

const RESOLUTION_COLOR: Record<string, string> = {
  PENDING:        'bg-[rgba(59,130,246,0.12)] text-[#60a5fa]',
  FALSE_POSITIVE: 'bg-[rgba(120,113,108,0.15)] text-[#9A8060]',
  CONFIRMED:      'bg-[rgba(239,68,68,0.12)] text-[#ef4444]',
  ESCALATED:      'bg-[rgba(168,85,247,0.12)] text-[#c084fc]',
}

const thStyle: React.CSSProperties = {
  textAlign: 'left', padding: '0.75rem 1rem', fontWeight: 500,
  fontSize: '0.875rem', color: 'var(--muted-foreground)',
  background: '#1A1A12', borderBottom: '1px solid #2A2418',
}

export default function AMLPage() {
  const t = useTranslations('admin.aml')
  const router = useRouter()
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [resolution, setResolution] = useState('all')
  const [result, setResult] = useState('all')
  const [running, setRunning] = useState(false)
  const [ingesting, setIngesting] = useState(false)
  const [extractingLocal, setExtractingLocal] = useState(false)
  const [sources, setSources] = useState<AMLSource[]>([])
  const [ingestResults, setIngestResults] = useState<SourceIngestResult[] | null>(null)
  const [showSources, setShowSources] = useState(false)
  const [showFatfSources, setShowFatfSources] = useState(true)
  const [fatfLists, setFatfLists] = useState<FatfListPanel[]>([])
  const [expandedFatfKey, setExpandedFatfKey] = useState<string | null>(null)
  const [expandedSourceId, setExpandedSourceId] = useState<string | null>(null)
  const [sourceRecords, setSourceRecords] = useState<Record<string, { total: number; records: SourceRecordRow[]; loading: boolean }>>({})

  const isFatfSource = (s: { seqNo: number; nameEn: string }) =>
    s.seqNo === 14 || s.seqNo === 15 || s.nameEn.toUpperCase().includes('FATF')

  const load = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (resolution !== 'all') params.set('resolution', resolution)
    if (result !== 'all') params.set('result', result)
    const res = await fetch(`/api/aml/alerts?${params}`)
    if (res.ok) {
      const data = await res.json()
      setAlerts(data.alerts)
      setTotal(data.total)
    }
    setLoading(false)
  }, [resolution, result])

  const loadSources = useCallback(async () => {
    const res = await fetch('/api/aml/sources')
    if (res.ok) setSources(await res.json())
  }, [])

  const loadFatfLists = useCallback(async () => {
    const res = await fetch('/api/aml/fatf-lists')
    if (res.ok) {
      const data = await res.json()
      setFatfLists(Array.isArray(data.lists) ? data.lists : [])
    }
  }, [])

  // eslint-disable-next-line react-hooks/set-state-in-effect -- load updates state after the async request resolves.
  useEffect(() => { load() }, [load])
  // eslint-disable-next-line react-hooks/set-state-in-effect -- loadSources updates state after the async request resolves.
  useEffect(() => { loadSources() }, [loadSources])
  // eslint-disable-next-line react-hooks/set-state-in-effect -- loadFatfLists updates state after the async request resolves.
  useEffect(() => { loadFatfLists() }, [loadFatfLists])

  async function toggleSourceRecords(sourceId: string) {
    if (expandedSourceId === sourceId) {
      setExpandedSourceId(null)
      return
    }
    setExpandedSourceId(sourceId)
    if (sourceRecords[sourceId]?.records.length) return
    setSourceRecords(prev => ({
      ...prev,
      [sourceId]: { total: prev[sourceId]?.total ?? 0, records: prev[sourceId]?.records ?? [], loading: true },
    }))
    try {
      const res = await fetch(`/api/aml/sources/${sourceId}/records?page=1&pageSize=50`)
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setSourceRecords(prev => ({
          ...prev,
          [sourceId]: { total: 0, records: [], loading: false },
        }))
        return
      }
      setSourceRecords(prev => ({
        ...prev,
        [sourceId]: {
          total: data.total ?? 0,
          records: Array.isArray(data.records) ? data.records : [],
          loading: false,
        },
      }))
    } catch {
      setSourceRecords(prev => ({
        ...prev,
        [sourceId]: { total: 0, records: [], loading: false },
      }))
    }
  }

  async function handleIngest() {
    // Initialise all rows as pending immediately
    setIngestResults(
      sources.map(s => ({
        seqNo: s.seqNo,
        nameEn: s.nameEn,
        status: 'pending',
        upserted: 0,
        totalInDb: s.recordCount,
        fetchedAt: s.lastFetched,
        savedFile: null,
      }))
    )
    setIngesting(true)
    setShowSources(true)

    const res = await fetch('/api/aml/ingest', { method: 'POST' })
    if (!res.ok || !res.body) { setIngesting(false); return }

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buf = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buf += decoder.decode(value, { stream: true })
      const lines = buf.split('\n')
      buf = lines.pop() ?? ''
      for (const line of lines) {
        if (!line.trim()) continue
        try {
          const event = JSON.parse(line)
          if (event.type === 'start') {
            setIngestResults(prev => prev?.map(r =>
              r.seqNo === event.seqNo ? { ...r, status: 'ingesting' } : r
            ) ?? null)
          } else if (event.type === 'result') {
            setIngestResults(prev => prev?.map(r =>
              r.seqNo === event.result.seqNo ? event.result : r
            ) ?? null)
          }
        } catch { /* ignore malformed line */ }
      }
    }

    setIngesting(false)
    loadSources()
    loadFatfLists()
    load()
  }

  async function handleExtractLocal() {
    setIngestResults(
      sources.map(s => ({
        seqNo: s.seqNo,
        nameEn: s.nameEn,
        status: 'pending',
        upserted: 0,
        totalInDb: s.recordCount,
        fetchedAt: s.lastFetched,
        savedFile: null,
      })),
    )
    setExtractingLocal(true)
    setShowSources(true)

    const res = await fetch('/api/aml/ingest-local', { method: 'POST' })
    if (!res.ok || !res.body) {
      setExtractingLocal(false)
      return
    }

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buf = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buf += decoder.decode(value, { stream: true })
      const lines = buf.split('\n')
      buf = lines.pop() ?? ''
      for (const line of lines) {
        if (!line.trim()) continue
        try {
          const event = JSON.parse(line)
          if (event.type === 'start') {
            setIngestResults(prev => prev?.map(r =>
              r.seqNo === event.seqNo ? { ...r, status: 'ingesting' } : r,
            ) ?? null)
          } else if (event.type === 'result') {
            setIngestResults(prev => prev?.map(r =>
              r.seqNo === event.result.seqNo ? event.result as SourceIngestResult : r,
            ) ?? null)
          }
        } catch { /* ignore */ }
      }
    }

    setExtractingLocal(false)
    loadSources()
    loadFatfLists()
    load()
  }

  async function handleScreen() {
    setRunning(true)
    await fetch('/api/aml/screen', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ all: true }) })
    setRunning(false)
    load()
  }

  // Merge ingestResults into sources for display; FATF lists render in a separate panel
  const displaySources = sources.map(s => {
    const r = ingestResults?.find(r => r.seqNo === s.seqNo)
    return { ...s, ingestResult: r ?? null }
  })
  const sanctionsSources = displaySources.filter(s => !isFatfSource(s))
  const fatfSources = displaySources.filter(s => isFatfSource(s))

  function renderSourceRows(rows: typeof displaySources) {
    return rows.flatMap(s => {
      const r = s.ingestResult
      const statusBadge = r ? (
        r.status === 'ingesting'
          ? <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-[rgba(201,169,110,0.15)] text-[#C9A96E] animate-pulse">⟳ Ingesting…</span>
          : r.status === 'pending'
            ? <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-[rgba(120,113,108,0.15)] text-[#9A8060]">· Pending</span>
            : r.status === 'ok'
              ? <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-[rgba(16,185,129,0.12)] text-[#10b981]">✓ {r.upserted} upserted</span>
              : r.status === 'skipped'
                ? <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-[rgba(120,113,108,0.15)] text-[#9A8060]">
                    {r.skippedReason === 'no_local_file'
                      ? t('skippedNoLocal')
                      : r.skippedReason === 'already_upserted'
                        ? '↩ Already done today'
                        : '↩ File reused'}
                  </span>
                : <div className="space-y-1">
                    <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-[rgba(239,68,68,0.12)] text-[#ef4444]" title={r.error}>✗ Error</span>
                    {r.error ? (
                      <p className="text-[11px] leading-snug max-w-[28rem] break-words font-mono" style={{ color: '#b91c1c' }}>{r.error}</p>
                    ) : null}
                  </div>
      ) : s.lastFetched
          ? <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-[rgba(120,113,108,0.15)] text-[#9A8060]">—</span>
          : <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-[rgba(245,158,11,0.12)] text-[#f59e0b]">Never fetched</span>
      const expanded = expandedSourceId === s.id
      const bundle = sourceRecords[s.id]
      const mainRow = (
        <tr key={s.id} className="hover:bg-[#1A1A12] transition-colors">
          <td className="px-4 py-2.5 font-mono text-xs" style={{ color: 'var(--muted-foreground)' }}>{s.seqNo}</td>
          <td className="px-4 py-2.5">
            <button
              type="button"
              className="text-left w-full"
              onClick={() => void toggleSourceRecords(s.id)}
            >
              <p className="font-medium flex items-center gap-2" style={{ color: 'var(--foreground)' }}>
                <span style={{ color: '#C9A96E', fontSize: '0.7rem' }}>{expanded ? '▼' : '▶'}</span>
                {s.nameEn}
              </p>
              <p className="text-xs pl-4" style={{ color: 'var(--muted-foreground)' }}>{s.nameZh}</p>
            </button>
          </td>
          <td className="px-4 py-2.5 font-mono text-xs" style={{ color: 'var(--muted-foreground)' }}>{s.format}</td>
          <td className="px-4 py-2.5 text-xs" style={{ color: 'var(--muted-foreground)' }}>
            {s.lastFetched ? new Date(s.lastFetched).toLocaleString() : '—'}
          </td>
          <td className="px-4 py-2.5 text-xs font-mono" style={{ color: r?.status === 'ok' ? '#10b981' : 'var(--foreground)' }}>
            {r?.status === 'ok' ? r.totalInDb.toLocaleString() : s.recordCount.toLocaleString()}
          </td>
          <td className="px-4 py-2.5">{statusBadge}</td>
        </tr>
      )
      if (!expanded) return [mainRow]
      const detailRow = (
        <tr key={`${s.id}-records`}>
          <td colSpan={6} className="px-4 py-3" style={{ background: '#0E0E0A' }}>
            {bundle?.loading ? (
              <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Loading list content…</p>
            ) : !bundle?.records.length ? (
              <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>No records in database for this list.</p>
            ) : (
              <div className="space-y-2">
                <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                  Showing {bundle.records.length} of {bundle.total.toLocaleString()} records
                </p>
                <div className="max-h-64 overflow-y-auto rounded border border-[#2A2418]">
                  <table className="w-full text-xs">
                    <thead>
                      <tr style={{ background: '#1A1A12' }}>
                        {['Name', 'Aliases', 'Type', 'Reason'].map(h => (
                          <th key={h} className="px-3 py-2 text-left font-medium" style={{ color: 'var(--muted-foreground)' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#2A2418]">
                      {bundle.records.map(rec => (
                        <tr key={rec.id}>
                          <td className="px-3 py-1.5" style={{ color: 'var(--foreground)' }}>{rec.primaryName}</td>
                          <td className="px-3 py-1.5" style={{ color: 'var(--muted-foreground)' }}>
                            {rec.aliases?.slice(0, 3).join('; ') || '—'}
                          </td>
                          <td className="px-3 py-1.5" style={{ color: 'var(--muted-foreground)' }}>{rec.entityType}</td>
                          <td className="px-3 py-1.5" style={{ color: 'var(--muted-foreground)' }}>{rec.listingReason || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </td>
        </tr>
      )
      return [mainRow, detailRow]
    })
  }

  function renderSourceTable(rows: typeof displaySources) {
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: '#1A1A12', borderBottom: '1px solid #2A2418' }}>
              {['#', '名单 / List', 'Format', 'Last Downloaded', 'Records in DB', 'Last Run Status'].map(h => (
                <th key={h} className="px-4 py-2 text-left font-medium" style={{ color: 'var(--muted-foreground)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#2A2418]">
            {renderSourceRows(rows)}
          </tbody>
        </table>
      </div>
    )
  }

  function renderFatfEntryTable(entries: FatfListEntry[]) {
    return (
      <div className="max-h-80 overflow-y-auto rounded border border-[#2A2418]">
        <table className="w-full text-xs">
          <thead>
            <tr style={{ background: '#1A1A12' }}>
              {['Jurisdiction / 司法管轄區', 'Aliases / 別名', 'Listing reason', 'As of'].map(h => (
                <th key={h} className="px-3 py-2 text-left font-medium" style={{ color: 'var(--muted-foreground)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#2A2418]">
            {entries.map((e, i) => (
              <tr key={`${e.name}-${i}`}>
                <td className="px-3 py-2 font-medium" style={{ color: 'var(--foreground)' }}>{e.name}</td>
                <td className="px-3 py-2" style={{ color: 'var(--muted-foreground)' }}>
                  {e.aliases.length ? e.aliases.join('; ') : '—'}
                </td>
                <td className="px-3 py-2" style={{ color: 'var(--muted-foreground)' }}>{e.listingReason || '—'}</td>
                <td className="px-3 py-2 whitespace-nowrap" style={{ color: 'var(--muted-foreground)' }}>
                  {e.listingDate || '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>{t('title')}</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>{total} total alerts</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={handleIngest} disabled={ingesting || extractingLocal}>
            {ingesting ? 'Ingesting...' : t('ingest')}
          </Button>
          <Button variant="secondary" onClick={handleExtractLocal} disabled={ingesting || extractingLocal}>
            {extractingLocal ? t('extractingLocal') : t('extractLocal')}
          </Button>
          <Button onClick={handleScreen} disabled={running || ingesting || extractingLocal}>
            {running ? 'Scanning...' : t('runScan')}
          </Button>
        </div>
      </div>

      {/* Sanctions list status panel (excl. FATF) */}
      <div className="rounded-lg overflow-hidden" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
        <button
          className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium"
          style={{ color: 'var(--foreground)', borderBottom: showSources ? '1px solid #2A2418' : 'none' }}
          onClick={() => setShowSources(v => !v)}
        >
          <span>制裁名单状态 · Sanctions Lists ({sanctionsSources.length})</span>
          <span style={{ color: 'var(--muted-foreground)' }}>{showSources ? '▲' : '▼'}</span>
        </button>
        {showSources && renderSourceTable(sanctionsSources)}
      </div>

      {/* FATF jurisdiction lists — expandable content like sanctions status */}
      <div className="rounded-lg overflow-hidden" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
        <button
          type="button"
          className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium"
          style={{ color: 'var(--foreground)', borderBottom: showFatfSources ? '1px solid #2A2418' : 'none' }}
          onClick={() => setShowFatfSources(v => !v)}
        >
          <span>
            FATF 黑名單與灰名單 · FATF Lists ({fatfLists.length || fatfSources.length || 2})
          </span>
          <span style={{ color: 'var(--muted-foreground)' }}>{showFatfSources ? '▲' : '▼'}</span>
        </button>
        {showFatfSources && (
          <div className="divide-y divide-[#2A2418]">
            {(fatfLists.length
              ? fatfLists
              : [
                  {
                    seqNo: 14,
                    key: 'fatf-call-for-action',
                    labelZh: 'FATF 黑名單（呼籲採取行動）',
                    labelEn: 'Call for Action',
                    titleEn: 'FATF Call for Action',
                    titleZh: 'FATF 黑名單',
                    asOf: null,
                    referenceUrl: null,
                    sourceId: fatfSources.find(s => s.seqNo === 14)?.id ?? null,
                    lastFetched: null,
                    recordCountInDb: fatfSources.find(s => s.seqNo === 14)?.recordCount ?? 0,
                    entries: [] as FatfListEntry[],
                  },
                  {
                    seqNo: 15,
                    key: 'fatf-increased-monitoring',
                    labelZh: 'FATF 灰名單（加強監控）',
                    labelEn: 'Increased Monitoring',
                    titleEn: 'FATF Increased Monitoring',
                    titleZh: 'FATF 灰名單',
                    asOf: null,
                    referenceUrl: null,
                    sourceId: fatfSources.find(s => s.seqNo === 15)?.id ?? null,
                    lastFetched: null,
                    recordCountInDb: fatfSources.find(s => s.seqNo === 15)?.recordCount ?? 0,
                    entries: [] as FatfListEntry[],
                  },
                ]
            ).map(list => {
              const open = expandedFatfKey === list.key
              const ingest = ingestResults?.find(r => r.seqNo === list.seqNo)
              return (
                <div key={list.key}>
                  <button
                    type="button"
                    className="w-full flex items-start justify-between gap-3 px-4 py-3 text-left hover:bg-[#1A1A12] transition-colors"
                    onClick={() => setExpandedFatfKey(open ? null : list.key)}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium flex items-center gap-2" style={{ color: 'var(--foreground)' }}>
                        <span style={{ color: '#C9A96E', fontSize: '0.7rem' }}>{open ? '▼' : '▶'}</span>
                        {list.labelZh}
                      </p>
                      <p className="text-xs pl-4 mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                        {list.titleEn}
                        {list.asOf ? ` · as of ${list.asOf}` : ''}
                      </p>
                    </div>
                    <div className="shrink-0 text-right space-y-1">
                      <p className="text-xs font-mono" style={{ color: 'var(--foreground)' }}>
                        {list.entries.length || list.recordCountInDb} jurisdictions
                      </p>
                      {ingest?.status === 'ok' ? (
                        <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-[rgba(16,185,129,0.12)] text-[#10b981]">
                          ✓ DB {ingest.totalInDb}
                        </span>
                      ) : list.recordCountInDb > 0 ? (
                        <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-[rgba(120,113,108,0.15)] text-[#9A8060]">
                          DB {list.recordCountInDb}
                        </span>
                      ) : null}
                    </div>
                  </button>
                  {open ? (
                    <div className="px-4 pb-4 space-y-2" style={{ background: '#0E0E0A' }}>
                      {list.referenceUrl ? (
                        <a
                          href={list.referenceUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs hover:underline"
                          style={{ color: '#C9A96E' }}
                        >
                          FATF reference →
                        </a>
                      ) : null}
                      {list.entries.length > 0
                        ? renderFatfEntryTable(list.entries)
                        : (
                          <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                            No jurisdiction entries loaded. Check bundled FATF JSON or run ingest.
                          </p>
                        )}
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div className="flex gap-3">
        <Select value={result} onValueChange={v => setResult(v ?? 'all')}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Severity" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Severities</SelectItem>
            <SelectItem value="STRONG_HIT">{t('severity.strong')}</SelectItem>
            <SelectItem value="POTENTIAL_HIT">{t('severity.potential')}</SelectItem>
            <SelectItem value="WEAK_HIT">{t('severity.weak')}</SelectItem>
          </SelectContent>
        </Select>

        <Select value={resolution} onValueChange={v => setResolution(v ?? 'all')}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Resolution" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Resolutions</SelectItem>
            <SelectItem value="PENDING">{t('resolution.pending')}</SelectItem>
            <SelectItem value="FALSE_POSITIVE">{t('resolution.falsePositive')}</SelectItem>
            <SelectItem value="CONFIRMED">{t('resolution.confirmed')}</SelectItem>
            <SelectItem value="ESCALATED">{t('resolution.escalated')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg overflow-hidden" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
        {loading ? (
          <div className="p-8 text-center" style={{ color: 'var(--muted-foreground)' }}>Loading...</div>
        ) : alerts.length === 0 ? (
          <div className="p-8 text-center" style={{ color: '#5A5040' }}>No alerts found</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th style={thStyle}>Matched Name</th>
                <th style={thStyle}>Source</th>
                <th style={thStyle}>Subject</th>
                <th style={thStyle}>Score</th>
                <th style={thStyle}>Severity</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>Date</th>
                <th style={thStyle} />
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2A2418]">
              {alerts.map(alert => (
                <tr
                  key={alert.id}
                  className="cursor-pointer hover:bg-[#1A1A12] transition-colors"
                  tabIndex={0}
                  onClick={() => router.push(`/admin/aml/${alert.id}`)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ' ') router.push(`/admin/aml/${alert.id}`)
                  }}
                >
                  <td className="px-4 py-3 font-medium" style={{ color: 'var(--foreground)' }}>{alert.amlRecord.primaryName}</td>
                  <td className="px-4 py-3" style={{ color: 'var(--muted-foreground)' }}>{alert.amlRecord.source.nameEn}</td>
                  <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                    {alert.subjectName ? (
                      <Link
                        href={alert.keyPersonId
                          ? `/admin/kyc?personId=${alert.keyPersonId}`
                          : `/admin/companies/${alert.companyId}`}
                        className="hover:underline font-medium"
                        style={{ color: '#C9A96E' }}
                      >
                        {alert.subjectName}
                      </Link>
                    ) : (
                      <span style={{ color: 'var(--muted-foreground)' }}>
                        {alert.subjectType === 'KEY_PERSON' ? 'Key Person' : 'Company'}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3" style={{ color: 'var(--muted-foreground)' }}>
                    {alert.matchScore != null ? `${(alert.matchScore * 100).toFixed(1)}%` : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${RESULT_COLOR[alert.result] ?? 'bg-[rgba(120,113,108,0.15)] text-[#9A8060]'}`}>
                      {alert.result.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${RESOLUTION_COLOR[alert.resolution] ?? 'bg-[rgba(120,113,108,0.15)] text-[#9A8060]'}`}>
                      {alert.resolution.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3" style={{ color: 'var(--muted-foreground)' }}>
                    {new Date(alert.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-xs font-medium" style={{ color: '#C9A96E' }}>
                    Review →
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
