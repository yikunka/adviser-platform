'use client'

import { useState } from 'react'
import { toast } from 'sonner'

type Props = {
  id: string
  children: React.ReactNode
  className?: string
  style?: React.CSSProperties
}

export function ClientDocumentDownloadLink({ id, children, className, style }: Props) {
  const [busy, setBusy] = useState(false)

  async function onClick(e: React.MouseEvent) {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    try {
      const res = await fetch(`/api/documents/${id}/download`)
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(
          json?.code === 'STORAGE_MISSING' || json?.error === 'File not found'
            ? 'This document record exists, but the file is no longer in storage. Please re-upload or contact staff.'
            : 'Download failed. Please try again.',
        )
        return
      }
      if (!json?.url || typeof json.url !== 'string') {
        toast.error('Download failed. Please try again.')
        return
      }
      window.location.assign(json.url)
    } catch {
      toast.error('Download failed. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className={className}
      style={style}
    >
      {busy ? '…' : children}
    </button>
  )
}
