'use client'

import { useState } from 'react'

type Props = {
  orderId: string
  initialValue: string | null
  compact?: boolean
}

const GOLD = '#C9A96E'
const DARK = '#1A1A1A'
const MUTED = '#6B5E4A'
const BORDER = '#EDE7D8'

export default function CustomerInternalOrderCodeField({
  orderId,
  initialValue,
  compact = false,
}: Props) {
  const [value, setValue] = useState(initialValue ?? '')
  const [savedValue, setSavedValue] = useState(initialValue ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  const dirty = value.trim() !== savedValue.trim()

  async function save() {
    if (!dirty || saving) return
    setSaving(true)
    setError('')
    setSaved(false)
    try {
      const res = await fetch(`/api/sfsdiamond/orders/${orderId}/internal-order-code`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerInternalOrderCode: value.trim() || null,
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setError(body.error ?? 'Failed to save')
        return
      }
      const data = await res.json()
      const next = data.customerInternalOrderCode ?? ''
      setValue(next)
      setSavedValue(next)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch {
      setError('Network error — please try again')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={compact ? 'mt-1.5' : 'mt-3'}>
      <label
        className="block text-[11px] font-medium uppercase tracking-wider mb-1"
        style={{ color: MUTED }}
      >
        Your Internal Order Code
      </label>
      <div className={`flex ${compact ? 'flex-col sm:flex-row' : 'flex-col sm:flex-row'} gap-2`}>
        <input
          type="text"
          value={value}
          onChange={e => {
            setValue(e.target.value)
            setError('')
          }}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault()
              void save()
            }
          }}
          maxLength={100}
          placeholder="e.g. PO-2026-0042"
          className="flex-1 rounded-lg px-3 py-2 text-xs font-mono outline-none transition-shadow focus:ring-2 focus:ring-[rgba(201,169,110,0.35)]"
          style={{
            background: '#FFFFFF',
            border: `1px solid ${BORDER}`,
            color: DARK,
          }}
        />
        <button
          type="button"
          onClick={() => void save()}
          disabled={!dirty || saving}
          className="px-3 py-2 rounded-lg text-xs font-semibold transition-all hover:opacity-90 disabled:opacity-40 self-start sm:self-auto whitespace-nowrap"
          style={{ background: GOLD, color: '#0A0805' }}
        >
          {saving ? 'Saving…' : saved ? 'Saved' : 'Save'}
        </button>
      </div>
      {!compact && (
        <p className="text-[11px] mt-1.5" style={{ color: MUTED }}>
          Optional reference for your own tracking — you can update this at any time.
        </p>
      )}
      {error && (
        <p className="text-[11px] mt-1" style={{ color: '#ef4444' }}>
          {error}
        </p>
      )}
    </div>
  )
}
