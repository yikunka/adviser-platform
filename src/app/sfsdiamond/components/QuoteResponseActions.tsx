'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function QuoteResponseActions({
  orderId,
  status,
  quotedAmount,
}: {
  orderId: string
  status: string
  quotedAmount: number | null
}) {
  const router = useRouter()
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState<'ACCEPT' | 'REQUEST_CHANGE' | null>(null)
  const [error, setError] = useState('')
  const [showChange, setShowChange] = useState(false)

  if (status !== 'QUOTED' || quotedAmount == null) return null

  async function submit(action: 'ACCEPT' | 'REQUEST_CHANGE') {
    setBusy(action)
    setError('')
    try {
      const res = await fetch(`/api/sfsdiamond/orders/${orderId}/quote-response`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          ...(action === 'REQUEST_CHANGE' ? { note } : {}),
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(typeof json.error === 'string' ? json.error : 'Request failed')
      router.refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Request failed')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-3 pt-2">
      <p className="text-sm" style={{ color: '#6B5E4A' }}>
        Accept this quote to confirm production, or ask for a change.
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => void submit('ACCEPT')}
          className="px-5 py-2.5 rounded-full text-sm font-semibold disabled:opacity-50"
          style={{ background: '#C9A96E', color: '#0A0805' }}
        >
          {busy === 'ACCEPT' ? 'Confirming…' : 'Accept quote'}
        </button>
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => setShowChange(v => !v)}
          className="px-5 py-2.5 rounded-full text-sm font-medium border disabled:opacity-50"
          style={{ border: '1px solid #C9A96E', color: '#1A1A1A' }}
        >
          Request a change
        </button>
      </div>
      {showChange && (
        <div className="space-y-2">
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            rows={3}
            maxLength={2000}
            placeholder="Describe the change you need"
            className="w-full rounded-xl px-3 py-2 text-sm outline-none"
            style={{ border: '1px solid #EDE7D8', background: '#FAFAF8', color: '#1A1A1A' }}
          />
          <button
            type="button"
            disabled={busy !== null || !note.trim()}
            onClick={() => void submit('REQUEST_CHANGE')}
            className="px-5 py-2.5 rounded-full text-sm font-semibold disabled:opacity-50"
            style={{ background: '#1A1A1A', color: '#F5F0E8' }}
          >
            {busy === 'REQUEST_CHANGE' ? 'Sending…' : 'Send change request'}
          </button>
        </div>
      )}
      {error ? <p className="text-sm" style={{ color: '#B91C1C' }}>{error}</p> : null}
    </div>
  )
}
