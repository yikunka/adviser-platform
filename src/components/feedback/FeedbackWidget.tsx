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
import { MessageSquarePlus, Send, X, CheckCircle, Loader2, ChevronDown, Paperclip, FileText, Image as ImageIcon } from 'lucide-react'
import { toast } from 'sonner'

// ── Types ──────────────────────────────────────────────────────────────────

type Attachment = {
  url: string
  name: string
  type: string
}

type ChatMessage = {
  role: 'user' | 'assistant'
  content: string
  attachments?: Attachment[]
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

type UploadingFile = {
  id: string
  name: string
  status: 'uploading' | 'done' | 'error'
  result?: Attachment
}

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

// ── Attachment helpers ─────────────────────────────────────────────────────

function isImage(type: string) {
  return type.startsWith('image/')
}

function AttachmentChip({ a, onRemove }: { a: Attachment; onRemove?: () => void }) {
  return (
    <div
      className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs max-w-[160px]"
      style={{ background: '#1E1A14', border: '1px solid #3A3020', color: '#C4B89A' }}
    >
      {isImage(a.type) ? (
        <ImageIcon size={11} style={{ color: '#C9A96E', flexShrink: 0 }} />
      ) : (
        <FileText size={11} style={{ color: '#C9A96E', flexShrink: 0 }} />
      )}
      <a
        href={a.url}
        target="_blank"
        rel="noopener noreferrer"
        className="truncate hover:text-[#C9A96E] transition-colors"
        title={a.name}
      >
        {a.name}
      </a>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="flex-shrink-0 hover:text-red-400 transition-colors"
          title="移除"
        >
          <X size={10} />
        </button>
      )}
    </div>
  )
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

  // Attachments
  const [pendingAttachments, setPendingAttachments] = useState<Attachment[]>([])
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([])
  // All attachments accumulated in this session (for saving)
  const [sessionAttachments, setSessionAttachments] = useState<Attachment[]>([])

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streaming])

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [open])

  const GREETING: ChatMessage = {
    role: 'assistant',
    content: '你好！我在这里记录你的需求和改进建议。请告诉我你在使用这个页面时，有什么想调整或新增的功能？可以附上截图或文件来帮助说明。',
  }

  function openDialog() {
    setOpen(true)
    if (saved) {
      abortRef.current?.abort()
      setMessages([GREETING])
      setInput('')
      setConfirmed(null)
      setSaved(false)
      setStreaming(false)
      setPendingAttachments([])
      setUploadingFiles([])
      setSessionAttachments([])
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
    setPendingAttachments([])
    setUploadingFiles([])
    setSessionAttachments([])
  }

  // ── File upload ──────────────────────────────────────────────────────────

  async function uploadFile(file: File) {
    const id = crypto.randomUUID()
    setUploadingFiles(prev => [...prev, { id, name: file.name, status: 'uploading' }])

    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/feedback/upload', { method: 'POST', body: formData })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? '上传失败')

      const attachment: Attachment = { url: data.url, name: data.name, type: data.type }
      setPendingAttachments(prev => [...prev, attachment])
      setSessionAttachments(prev => [...prev, attachment])
      setUploadingFiles(prev => prev.map(f => f.id === id ? { ...f, status: 'done', result: attachment } : f))
      // Remove done indicator after 1.5s
      setTimeout(() => setUploadingFiles(prev => prev.filter(f => f.id !== id)), 1500)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '文件上传失败')
      setUploadingFiles(prev => prev.map(f => f.id === id ? { ...f, status: 'error' } : f))
      setTimeout(() => setUploadingFiles(prev => prev.filter(f => f.id !== id)), 2000)
    }
  }

  function handleFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    files.forEach(uploadFile)
    e.target.value = ''
  }

  function removePendingAttachment(url: string) {
    setPendingAttachments(prev => prev.filter(a => a.url !== url))
  }

  // ── Send message ─────────────────────────────────────────────────────────

  const sendMessage = useCallback(
    async (userText: string) => {
      if (!userText.trim() && pendingAttachments.length === 0) return
      if (streaming) return

      // Build the content string: user text + attachment links (for LLM to read)
      const attachmentLines = pendingAttachments.length > 0
        ? `\n\n[附件]\n${pendingAttachments.map(a => `- ${a.name}: ${a.url}`).join('\n')}`
        : ''
      const fullContent = (userText.trim() + attachmentLines).trim()

      const userMessage: ChatMessage = {
        role: 'user',
        content: fullContent,
        attachments: pendingAttachments.length > 0 ? [...pendingAttachments] : undefined,
      }
      const newMessages = [...messages, userMessage]
      setMessages(newMessages)
      setInput('')
      setPendingAttachments([])
      setStreaming(true)
      setConfirmed(null)

      const abort = new AbortController()
      abortRef.current = abort

      setMessages(prev => [...prev, { role: 'assistant', content: '' }])

      try {
        // Send plain messages (content includes attachment URLs as text)
        const res = await fetch('/api/feedback/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: abort.signal,
          body: JSON.stringify({
            messages: newMessages.map(m => ({ role: m.role, content: m.content })),
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
        setMessages(prev => {
          const last = prev[prev.length - 1]
          if (last?.role === 'assistant' && !last.content.trim()) return prev.slice(0, -1)
          return prev
        })
      }
    },
    [messages, pathname, streaming, pendingAttachments],
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
          conversation: messages.filter(m => m.content.trim()).map(m => ({ role: m.role, content: m.content })),
          attachments: sessionAttachments,
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

  const isUploading = uploadingFiles.some(f => f.status === 'uploading')

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
              height: 580,
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
              {saved ? (
                <div className="flex flex-col items-center justify-center h-full gap-3">
                  <CheckCircle size={36} style={{ color: '#10b981' }} />
                  <p className="text-sm font-medium" style={{ color: '#10b981' }}>需求已成功记录！</p>
                  <p className="text-xs" style={{ color: '#5A5040' }}>感谢你的反馈，窗口即将关闭</p>
                </div>
              ) : (
                <>
                  {messages.map((msg, i) => {
                    const isStreamingPlaceholder = streaming && i === messages.length - 1 && msg.role === 'assistant' && !msg.content
                    if (!streaming && msg.role === 'assistant' && !msg.content) return null

                    // Strip the raw attachment lines from displayed content
                    const displayContent = msg.content.replace(/\n\n\[附件\]\n[\s\S]*$/, '').trim()

                    return (
                      <div
                        key={i}
                        className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} gap-1`}
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
                          ) : displayContent || (!msg.attachments?.length ? msg.content : '')}
                        </div>
                        {/* Attachment chips on user messages */}
                        {msg.attachments && msg.attachments.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 max-w-[85%] justify-end">
                            {msg.attachments.map(a => (
                              <AttachmentChip key={a.url} a={a} />
                            ))}
                          </div>
                        )}
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
                      {sessionAttachments.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-1" style={{ borderTop: '1px solid rgba(201,169,110,0.2)' }}>
                          <span className="text-xs w-full" style={{ color: '#7A6A50' }}>
                            附件 ({sessionAttachments.length})
                          </span>
                          {sessionAttachments.map(a => (
                            <AttachmentChip key={a.url} a={a} />
                          ))}
                        </div>
                      )}
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

            {/* Pending attachments row */}
            {(pendingAttachments.length > 0 || uploadingFiles.length > 0) && !saved && (
              <div
                className="flex-shrink-0 flex flex-wrap gap-1.5 px-3 py-2"
                style={{ borderTop: '1px solid #1E1A14', background: '#0E0C08' }}
              >
                {uploadingFiles.map(f => (
                  <div
                    key={f.id}
                    className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs"
                    style={{ background: '#1E1A14', border: '1px solid #3A3020', color: '#7A6A50' }}
                  >
                    <Loader2 size={10} className="animate-spin" />
                    <span className="truncate max-w-[120px]">{f.name}</span>
                  </div>
                ))}
                {pendingAttachments.map(a => (
                  <AttachmentChip key={a.url} a={a} onRemove={() => removePendingAttachment(a.url)} />
                ))}
              </div>
            )}

            {/* Input area */}
            {!saved && (
              <form
                onSubmit={handleSubmit}
                className="flex-shrink-0 p-3 flex items-end gap-2"
                style={{ borderTop: '1px solid #2A2418' }}
              >
                {/* Hidden file input */}
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/*,.pdf,.doc,.docx,.txt"
                  className="hidden"
                  onChange={handleFileInputChange}
                />

                {/* Paperclip button */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={streaming || isUploading}
                  className="flex-shrink-0 flex items-center justify-center rounded-xl p-2.5 transition-opacity disabled:opacity-40"
                  style={{ border: '1px solid #2A2418', color: '#7A6A50' }}
                  title="上传附件（图片、PDF、Word、TXT）"
                >
                  {isUploading ? <Loader2 size={15} className="animate-spin" /> : <Paperclip size={15} />}
                </button>

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
                  disabled={(!input.trim() && pendingAttachments.length === 0) || streaming || isUploading}
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
