'use client'

import { FormEvent, useEffect, useRef, useState } from 'react'

type Msg = { role: 'user' | 'assistant'; content: string }

const CYAN = '#00d4ff'
const RED = '#ff2200'
const BG = '#080808'
const SURFACE = '#0e0e0e'
const BORDER = '#1a1a1a'
const TEXT = '#f0f0f0'
const MUTED = '#666'
const MONO = "'Courier New', Courier, monospace"

const SUGGESTIONS = [
  '有哪些手感漆产品？',
  '查询配方物料清单',
  'UV漆的工艺要求',
  '某配方的保质期',
]

export default function CosmoChatWidget() {
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
          content: '// 系统就绪\n\n你好，我是 CosmoCoat 产品顾问 AI。\n可以向我查询产品配方、工艺参数、物料清单等信息。',
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
      const res = await fetch('/api/cosmocoat/chat', {
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
            content: '// ERROR: 连接失败\n\n请稍后重试，或联系 CosmoCoat 技术支持团队。',
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
        aria-label={open ? '关闭对话' : '产品顾问'}
        className="fixed bottom-6 right-6 z-50 flex items-center justify-center rounded-none transition-all duration-200 hover:scale-105 active:scale-95"
        style={{
          width: 48,
          height: 48,
          background: BG,
          border: `1px solid ${open ? RED : CYAN}`,
          boxShadow: open ? `0 0 12px ${RED}44` : `0 0 12px ${CYAN}44`,
        }}
      >
        {open ? (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M2 2l12 12M14 2L2 14" stroke={RED} strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2v10z" stroke={CYAN} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>

      {/* Chat panel */}
      {open && (
        <div
          className="fixed bottom-20 right-6 z-50 flex flex-col overflow-hidden"
          style={{
            width: 340,
            height: 480,
            background: BG,
            border: `1px solid ${CYAN}`,
            boxShadow: `0 0 30px ${CYAN}22, 0 0 60px ${CYAN}0a`,
          }}
        >
          {/* Scanline overlay */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              zIndex: 1,
              backgroundImage:
                'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.08) 3px, rgba(0,0,0,0.08) 4px)',
            }}
          />

          {/* Header */}
          <div
            className="relative z-10 flex items-center gap-2 px-4 py-3 flex-shrink-0"
            style={{ borderBottom: `1px solid ${BORDER}`, background: SURFACE }}
          >
            <div
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ background: CYAN, boxShadow: `0 0 6px ${CYAN}` }}
            />
            <div className="flex-1">
              <p
                className="text-xs font-bold tracking-widest uppercase"
                style={{ color: CYAN, fontFamily: MONO }}
              >
                COSMOCOAT // AI
              </p>
            </div>
            <div
              className="text-[10px] px-2 py-0.5"
              style={{
                color: '#00ff88',
                border: '1px solid #00ff8844',
                fontFamily: MONO,
              }}
            >
              ONLINE
            </div>
          </div>

          {/* Messages */}
          <div
            className="relative z-10 flex-1 overflow-y-auto px-4 py-3 space-y-3"
            style={{ scrollbarWidth: 'thin', scrollbarColor: `${BORDER} transparent` }}
          >
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {m.role === 'assistant' && (
                  <div
                    className="mr-2 mt-1 text-[10px] flex-shrink-0 font-bold"
                    style={{ color: CYAN, fontFamily: MONO }}
                  >
                    AI›
                  </div>
                )}
                <div
                  className="max-w-[80%] text-xs leading-relaxed whitespace-pre-wrap"
                  style={
                    m.role === 'user'
                      ? {
                          color: '#00ff88',
                          fontFamily: MONO,
                          textAlign: 'right',
                        }
                      : { color: TEXT }
                  }
                >
                  {m.content || (
                    <span className="flex gap-1 items-center">
                      <span className="text-[10px]" style={{ color: CYAN, fontFamily: MONO }}>
                        processing
                      </span>
                      <span className="flex gap-0.5">
                        {[0, 1, 2].map(j => (
                          <span
                            key={j}
                            className="w-1 h-1 rounded-full animate-bounce"
                            style={{ background: CYAN, animationDelay: `${j * 150}ms` }}
                          />
                        ))}
                      </span>
                    </span>
                  )}
                </div>
                {m.role === 'user' && (
                  <div
                    className="ml-2 mt-1 text-[10px] flex-shrink-0 font-bold"
                    style={{ color: '#00ff88', fontFamily: MONO }}
                  >
                    ›
                  </div>
                )}
              </div>
            ))}

            {/* Suggestion chips */}
            {messages.length === 1 && (
              <div className="flex flex-col gap-1.5 pt-1">
                {SUGGESTIONS.map(s => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="text-left text-[11px] px-3 py-1.5 transition-colors hover:border-[#00d4ff] hover:text-[#00d4ff]"
                    style={{
                      border: `1px solid ${BORDER}`,
                      color: MUTED,
                      fontFamily: MONO,
                    }}
                  >
                    {'> '}{s}
                  </button>
                ))}
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <form
            onSubmit={onSubmit}
            className="relative z-10 flex items-center gap-2 px-3 py-3 flex-shrink-0"
            style={{ borderTop: `1px solid ${BORDER}` }}
          >
            <span className="text-xs flex-shrink-0" style={{ color: CYAN, fontFamily: MONO }}>›_</span>
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="输入问题…"
              disabled={streaming}
              className="flex-1 text-xs bg-transparent outline-none placeholder:opacity-30"
              style={{ color: TEXT, fontFamily: MONO }}
            />
            <button
              type="submit"
              disabled={!input.trim() || streaming}
              className="flex-shrink-0 px-2 py-1 text-[10px] font-bold transition-all disabled:opacity-20"
              style={{
                color: CYAN,
                border: `1px solid ${CYAN}`,
                fontFamily: MONO,
              }}
            >
              SEND
            </button>
          </form>
        </div>
      )}
    </>
  )
}
