'use client'

import { FormEvent, useEffect, useRef, useState } from 'react'
import { SFS_SALES_PHONE_DISPLAY } from '@/lib/sfs/sales-contact'

type Msg = { role: 'user' | 'assistant'; content: string }

const GOLD = '#C9A96E'
const DARK = '#1A1A1A'
const CREAM = '#F5F0E8'
const SURFACE = '#111111'
const BORDER = '#2A2418'

const SUGGESTIONS = [
  'How much ashes do I need?',
  'How long does it take?',
  'Are memorial diamonds real?',
  'Can I use pet remains?',
]

export default function SFSChatWidget() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100)
      if (messages.length === 0) {
        setMessages([{
          role: 'assistant',
          content: "Hello, I'm here to answer your questions about SFS memorial diamonds. How can I help you today?",
        }])
      }
    }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function send(text: string) {
    const trimmed = text.trim()
    if (!trimmed || streaming) return

    const userMsg: Msg = { role: 'user', content: trimmed }
    const history = [...messages, userMsg]
    setMessages(history)
    setInput('')
    setStreaming(true)

    const assistantMsg: Msg = { role: 'assistant', content: '' }
    setMessages([...history, assistantMsg])

    abortRef.current = new AbortController()
    try {
      const res = await fetch('/api/sfsdiamond/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: abortRef.current.signal,
        body: JSON.stringify({ messages: history }),
      })
      if (!res.ok || !res.body) throw new Error('Request failed')

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
            const ev = JSON.parse(line) as { type: string; text?: string }
            if (ev.type === 'text' && ev.text) {
              assistantMsg.content += ev.text
              setMessages(prev => {
                const next = [...prev]
                next[next.length - 1] = { ...assistantMsg }
                return next
              })
            }
          } catch { /* skip */ }
        }
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setMessages(prev => {
          const next = [...prev]
          next[next.length - 1] = {
            role: 'assistant',
            content: `I'm sorry, I couldn't reach our servers. Please try again or contact us on WhatsApp / phone at ${SFS_SALES_PHONE_DISPLAY}.`,
          }
          return next
        })
      }
    } finally {
      setStreaming(false)
      abortRef.current = null
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    send(input)
  }

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(o => !o)}
        aria-label={open ? 'Close chat' : 'Chat with us'}
        className="fixed bottom-6 right-6 z-50 flex items-center justify-center rounded-full shadow-2xl transition-all duration-200 hover:scale-105 active:scale-95"
        style={{
          width: 52,
          height: 52,
          background: open ? DARK : GOLD,
          border: `1px solid ${open ? GOLD : 'transparent'}`,
        }}
      >
        {open ? (
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M2 2l14 14M16 2L2 16" stroke={GOLD} strokeWidth="2" strokeLinecap="round" />
          </svg>
        ) : (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2v10z" stroke={DARK} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>

      {/* Chat panel */}
      {open && (
        <div
          className="fixed bottom-20 right-6 z-50 flex flex-col rounded-2xl shadow-2xl overflow-hidden"
          style={{
            width: 340,
            height: 480,
            background: SURFACE,
            border: `1px solid ${BORDER}`,
          }}
        >
          {/* Header */}
          <div
            className="flex items-center gap-3 px-4 py-3 flex-shrink-0"
            style={{ background: DARK, borderBottom: `1px solid ${BORDER}` }}
          >
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: GOLD }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" stroke={DARK} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill={DARK} />
              </svg>
            </div>
            <div>
              <p className="text-xs font-semibold" style={{ color: CREAM }}>SFS Diamond</p>
              <p className="text-[10px]" style={{ color: GOLD }}>AI Assistant · Online</p>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3" style={{ scrollbarWidth: 'thin' }}>
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className="max-w-[80%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed"
                  style={
                    m.role === 'user'
                      ? { background: GOLD, color: DARK }
                      : { background: '#1E1A14', color: '#D4C9B4', border: `1px solid ${BORDER}` }
                  }
                >
                  {m.content || (
                    <span className="flex gap-1 items-center">
                      <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: GOLD, animationDelay: '0ms' }} />
                      <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: GOLD, animationDelay: '150ms' }} />
                      <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: GOLD, animationDelay: '300ms' }} />
                    </span>
                  )}
                </div>
              </div>
            ))}

            {/* Suggestion chips — shown only at start */}
            {messages.length === 1 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {SUGGESTIONS.map(s => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="text-[11px] px-3 py-1.5 rounded-full border transition-colors hover:border-[#C9A96E] hover:text-[#C9A96E]"
                    style={{ border: `1px solid ${BORDER}`, color: '#7A6A58' }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <form
            onSubmit={onSubmit}
            className="flex items-center gap-2 px-3 py-3 flex-shrink-0"
            style={{ borderTop: `1px solid ${BORDER}` }}
          >
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Ask a question…"
              disabled={streaming}
              className="flex-1 text-xs bg-transparent outline-none placeholder:opacity-40"
              style={{ color: CREAM }}
            />
            <button
              type="submit"
              disabled={!input.trim() || streaming}
              className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-all disabled:opacity-30"
              style={{ background: GOLD }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                <path d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z" stroke={DARK} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </form>
        </div>
      )}
    </>
  )
}
