'use client'

import { useEffect, useState, useTransition } from 'react'
import Link from 'next/link'

type NotificationRow = {
  id: string
  title: string
  message: string
  relatedEntityId: string | null
  isRead: boolean
  createdAt: string
}

export default function PartnerNotifications() {
  const [items, setItems] = useState<NotificationRow[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()

  async function load() {
    const res = await fetch('/api/notifications')
    if (!res.ok) return
    const data = await res.json()
    setItems(data.notifications ?? [])
    setUnreadCount(data.unreadCount ?? 0)
  }

  useEffect(() => {
    startTransition(() => {
      void load()
    })
  }, [])

  async function markRead(id: string) {
    await fetch(`/api/notifications/${id}`, { method: 'PATCH' })
    setItems(prev => prev.map(n => (n.id === id ? { ...n, isRead: true } : n)))
    setUnreadCount(c => Math.max(0, c - 1))
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="relative inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium"
        style={{
          background: 'rgba(201,169,110,0.1)',
          color: '#C9A96E',
          border: '1px solid rgba(201,169,110,0.25)',
        }}
      >
        Notifications
        {unreadCount > 0 && (
          <span
            className="min-w-5 h-5 px-1 rounded-full text-[11px] font-bold flex items-center justify-center"
            style={{ background: '#C9A96E', color: '#0A0805' }}
          >
            {unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 mt-2 w-[min(100vw-2rem,22rem)] rounded-2xl overflow-hidden z-20"
          style={{
            background: '#fff',
            border: '1px solid #EDE7D8',
            boxShadow: '0 12px 40px rgba(0,0,0,0.12)',
          }}
        >
          <div className="px-4 py-3 border-b" style={{ borderColor: '#EDE7D8' }}>
            <p className="text-sm font-semibold" style={{ color: '#1A1A1A' }}>
              {pending ? 'Loading…' : 'Recent updates'}
            </p>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-4 py-6 text-sm" style={{ color: '#6B5E4A' }}>No notifications yet.</p>
            ) : (
              items.map(n => (
                <div
                  key={n.id}
                  className="px-4 py-3 border-b last:border-b-0"
                  style={{
                    borderColor: '#EDE7D8',
                    background: n.isRead ? '#fff' : 'rgba(201,169,110,0.06)',
                  }}
                >
                  <p className="text-xs font-semibold" style={{ color: '#1A1A1A' }}>{n.title}</p>
                  <p className="text-xs mt-1 leading-relaxed" style={{ color: '#6B5E4A' }}>{n.message}</p>
                  <div className="mt-2 flex items-center gap-3">
                    {n.relatedEntityId && (
                      <Link
                        href={`/sfsdiamond/dashboard/${n.relatedEntityId}`}
                        className="text-xs font-medium"
                        style={{ color: '#C9A96E' }}
                        onClick={() => {
                          if (!n.isRead) void markRead(n.id)
                          setOpen(false)
                        }}
                      >
                        Open order
                      </Link>
                    )}
                    {!n.isRead && (
                      <button
                        type="button"
                        className="text-xs"
                        style={{ color: '#9A8060' }}
                        onClick={() => void markRead(n.id)}
                      >
                        Mark read
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
