'use client'

/**
 * Feedback Plugin — FeedbackWidget
 *
 * A floating button (bottom-right) that opens an AI-assisted requirements dialog.
 * Users describe what they want to change; the LLM clarifies and confirms the
 * requirement before saving it to the backend.
 *
 * INSTALL:  Add <FeedbackWidget /> anywhere in your layout (e.g. AdminShell).
 * CONFIG:   Set ANTHROPIC_API_KEY in your environment.
 * ADMIN:    View submitted requirements at /admin/feedback.
 */

import { FormEvent, useCallback, useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { MessageSquarePlus, Send, X, CheckCircle, Loader2, ChevronDown } from 'lucide-react'
import { toast } from 'sonner'

// ── Types ──────────────────────────────────────────────────────────────────

type ChatMessage = {
  role: 'user' | 'assistant'
  content: string
}

type ConfirmedRequirement = {
  title: string
  summary: string
  priority: 'low' | 'medium' | 'high'
}

type StreamEvent =
  | { type: 'text'; text: string }
  | { type: 'confirmed'; title: string; summary: string; priority: string }
  | { type: 'done' }
  | { type: 'error'; message: string }

// ── Style constants ────────────────────────────────────────────────────────

const PRIORITY_LABELS: Record<string, string> = {
  low: '低优先级',
  medium: '中优先级',
  high: '高优先级',
}

const PRIORITY_COLORS: Record<string, string> = {
  low: '#6B7280',
  medium: '#F59E0B',
  high: '#EF4444',
}

// ── Main component ─────────────────────────────────────────────────────────

export function FeedbackWidget() {
  const pathname = usePathname()

  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [confirmed, setConfirmed] = useState<ConfirmedRequirement | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streaming])

  // Focus input when dialog opens
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [open])

  const GREETING: ChatMessage = {
    role: 'assistant',
    content: '你好！我在这里记录你的需求和改进建议。请告诉我你在使用这个页面时，有什么想调整或新增的功能？',
  }

  function openDialog() {
    setOpen(true)
    if (saved) {
      // Previous session was saved — start fresh so the user isn't stuck on the success screen
      abortRef.current?.abort()
      setMessages([GREETING])
      setInput('')
      setConfirmed(null)
      setSaved(false)
      setStreaming(false)
    } else if (messages.length === 0) {
      setMessages([GREETING])
    }
  }

  function closeDialog() {
    abortRef.current?.abort()
    setOpen(false)
  }

  function reset() {
    abortRef.current?.abort()
    setMessages([])
    setInput('')
    setConfirmed(null)
    setSaved(false)
    setStreaming(false)
  }

  const sendMessage = useCallback(
    async (userText: string) => {
      if (!userText.trim() || streaming) return

      const userMessage: ChatMessage = { role: 'user', content: userText.trim() }
      const newMessages = [...messages, userMessage]
      setMessages(newMessages)
      setInput('')
      setStreaming(true)
      setConfirmed(null)

      const abort = new AbortController()
      abortRef.current = abort

      // Append assistant message placeholder
      setMessages(prev => [...prev, { role: 'assistant', content: '' }])

      try {
        const res = await fetch('/api/feedback/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: abort.signal,
          body: JSON.stringify({
            messages: newMessages,
            pageContext: {
              url: pathname,
              title: typeof document !== 'undefined' ? document.title : '',
            },
          }),
        })

        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error(data.error || 'Failed to connect to AI')
        }

        if (!res.body) throw new Error('No response body')

        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''
        let assistantText = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() ?? ''

          for (const line of lines) {
            if (!line.trim()) continue
            try {
              const event = JSON.parse(line) as StreamEvent
              if (event.type === 'text') {
                assistantText += event.text
                setMessages(prev => {
                  const updated = [...prev]
                  updated[updated.length - 1] = { role: 'assistant', content: assistantText }
                  return updated
                })
              } else if (event.type === 'confirmed') {
                setConfirmed({
                  title: event.title,
                  summary: event.summary,
                  priority: (event.priority ?? 'medium') as 'low' | 'medium' | 'high',
                })
              } else if (event.type === 'error') {
                throw new Error(event.message)
              }
            } catch {
              // skip non-JSON lines
            }
          }
        }
      } catch (err) {
        if ((err as Error).name === 'AbortError') return
        toast.error(err instanceof Error ? err.message : 'AI request failed')
      } finally {
        setStreaming(false)
        // Always clean up any trailing empty assistant placeholder
        setMessages(prev => {
          const last = prev[prev.length - 1]
          if (last?.role === 'assistant' && !last.content.trim()) return prev.slice(0, -1)
          return prev
        })
      }
    },
    [messages, pathname, streaming],
  )

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    await sendMessage(input)
  }

  async function saveRequirement() {
    if (!confirmed) return
    setSaving(true)
    try {
      const res = await fetch('/api/feedback/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: confirmed.title,
          summary: confirmed.summary,
          priority: confirmed.priority,
          pageUrl: pathname,
          pageTitle: typeof document !== 'undefined' ? document.title : '',
          conversation: messages.filter(m => m.content.trim()),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Save failed')

      setSaved(true)
      setConfirmed(null)
      toast.success('需求已记录！感谢你的反馈。')
      setTimeout(() => closeDialog(), 1500)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save requirement')
    } finally {
      setSaving(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  return (
    <>
      {/* Floating trigger button */}
      <button
        type="button"
        onClick={openDialog}
        aria-label="Submit a feature request"
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium shadow-lg transition-all hover:scale-105 active:scale-95"
        style={{
          background: 'linear-gradient(135deg, #C9A96E 0%, #A07840 100%)',
          color: '#0A0805',
          boxShadow: '0 4px 20px rgba(201,169,110,0.4)',
        }}
      >
        <MessageSquarePlus size={16} />
        <span className="hidden sm:inline">提交需求</span>
      </button>

      {/* Dialog overlay */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-end p-4 sm:p-6"
          onClick={e => {
            if (e.target === e.currentTarget) closeDialog()
          }}
        >
          <div
            className="flex flex-col rounded-2xl shadow-2xl"
            style={{
              width: '100%',
              maxWidth: 440,
              height: 560,
              background: '#11110E',
              border: '1px solid #2A2418',
              boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
            }}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between px-4 py-3 rounded-t-2xl flex-shrink-0"
              style={{ borderBottom: '1px solid #2A2418', background: '#161410' }}
            >
              <div className="flex items-center gap-2">
                <MessageSquarePlus size={16} style={{ color: '#C9A96E' }} />
                <span className="text-sm font-semibold" style={{ color: '#FFF7E6' }}>
                  提交需求
                </span>
              </div>
              <div className="flex items-center gap-1">
                {messages.length > 1 && !saved && (
                  <button
                    type="button"
                    onClick={reset}
                    className="p-1.5 rounded-md text-xs transition-colors hover:bg-white/5"
                    style={{ color: '#9F927B' }}
                    title="New conversation"
                  >
                    重置
                  </button>
                )}
                <button
                  type="button"
                  onClick={closeDialog}
                  className="p-1.5 rounded-md transition-colors hover:bg-white/5"
                  style={{ color: '#9F927B' }}
                  aria-label="Close"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Messages area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {/* Success state — replaces message list when saved */}
              {saved ? (
                <div className="flex flex-col items-center justify-center h-full gap-3">
                  <CheckCircle size={36} style={{ color: '#10b981' }} />
                  <p className="text-sm font-medium" style={{ color: '#10b981' }}>需求已成功记录！</p>
                  <p className="text-xs" style={{ color: '#5A5040' }}>感谢你的反馈，窗口即将关闭</p>
                </div>
              ) : (
                <>
                  {messages.map((msg, i) => {
                    // While streaming: show spinner only on the last (empty) assistant message
                    const isStreamingPlaceholder = streaming && i === messages.length - 1 && msg.role === 'assistant' && !msg.content
                    // After streaming: skip any empty assistant messages (shouldn't exist, but safety net)
                    if (!streaming && msg.role === 'assistant' && !msg.content) return null
                    return (
                      <div
                        key={i}
                        className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className="max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed"
                          style={
                            msg.role === 'user'
                              ? { background: '#C9A96E', color: '#0A0805' }
                              : { background: '#1E1A14', color: '#EDE4D0', border: '1px solid #2A2418' }
                          }
                        >
                          {isStreamingPlaceholder ? (
                            <span className="flex items-center gap-1.5 opacity-60">
                              <Loader2 size={12} className="animate-spin" />
                              <span>思考中…</span>
                            </span>
                          ) : msg.content}
                        </div>
                      </div>
                    )
                  })}

                  {/* Confirmed requirement card */}
                  {confirmed && (
                    <div
                      className="rounded-xl p-3.5 space-y-2.5 text-sm"
                      style={{
                        background: 'rgba(201,169,110,0.08)',
                        border: '1px solid rgba(201,169,110,0.3)',
                      }}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <CheckCircle size={15} style={{ color: '#C9A96E', flexShrink: 0, marginTop: 1 }} />
                        <span className="flex-1 font-medium" style={{ color: '#FFF7E6' }}>
                          {confirmed.title}
                        </span>
                        <span
                          className="text-xs px-2 py-0.5 rounded-full flex-shrink-0"
                          style={{
                            background: (PRIORITY_COLORS[confirmed.priority] ?? '#6B7280') + '22',
                            color: PRIORITY_COLORS[confirmed.priority] ?? '#6B7280',
                            border: `1px solid ${(PRIORITY_COLORS[confirmed.priority] ?? '#6B7280')}44`,
                          }}
                        >
                          {PRIORITY_LABELS[confirmed.priority] ?? confirmed.priority}
                        </span>
                      </div>
                      <p style={{ color: '#C4B89A', lineHeight: 1.6 }}>{confirmed.summary}</p>
                      <button
                        type="button"
                        onClick={saveRequirement}
                        disabled={saving}
                        className="w-full flex items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium transition-opacity disabled:opacity-50"
                        style={{ background: '#C9A96E', color: '#0A0805' }}
                      >
                        {saving ? (
                          <><Loader2 size={13} className="animate-spin" /> 保存中…</>
                        ) : (
                          <><CheckCircle size={13} /> 确认并保存需求</>
                        )}
                      </button>
                    </div>
                  )}
                </>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input area */}
            {!saved && (
              <form
                onSubmit={handleSubmit}
                className="flex-shrink-0 p-3 flex items-end gap-2"
                style={{ borderTop: '1px solid #2A2418' }}
              >
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="描述你的需求… (Enter 发送，Shift+Enter 换行)"
                  rows={1}
                  disabled={streaming}
                  className="flex-1 resize-none rounded-xl px-3 py-2 text-sm outline-none disabled:opacity-50"
                  style={{
                    background: '#0E0E0A',
                    border: '1px solid #2A2418',
                    color: '#FFF7E6',
                    minHeight: 40,
                    maxHeight: 120,
                  }}
                  onInput={e => {
                    const target = e.target as HTMLTextAreaElement
                    target.style.height = 'auto'
                    target.style.height = `${Math.min(target.scrollHeight, 120)}px`
                  }}
                />
                <button
                  type="submit"
                  disabled={!input.trim() || streaming}
                  className="flex-shrink-0 flex items-center justify-center rounded-xl p-2.5 transition-opacity disabled:opacity-40"
                  style={{ background: '#C9A96E', color: '#0A0805' }}
                >
                  {streaming ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Send size={16} />
                  )}
                </button>
              </form>
            )}

            {/* Page context hint */}
            <div
              className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-b-2xl text-xs truncate"
              style={{
                borderTop: '1px solid #1A1610',
                background: '#0E0C08',
                color: '#5A5040',
              }}
            >
              <ChevronDown size={11} className="-rotate-90 flex-shrink-0" />
              <span className="truncate">{pathname}</span>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
