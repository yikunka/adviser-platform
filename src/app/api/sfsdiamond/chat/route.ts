import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { checkRateLimit } from '@/lib/auth/rate-limit'
import { buildSfsChatSystemPrompt } from '@/lib/sfs/chat-knowledge'

const MAX_MESSAGES = 20
const MAX_CONTENT_CHARS = 2000

export async function POST(req: NextRequest) {
  const rl = checkRateLimit(req, 15, 60_000)
  if (rl) return rl

  const body = await req.json().catch(() => null)
  if (!body?.messages || !Array.isArray(body.messages)) {
    return Response.json({ error: 'Invalid request' }, { status: 400 })
  }
  if (body.messages.length > MAX_MESSAGES) {
    return Response.json({ error: 'Too many messages' }, { status: 400 })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return Response.json({ error: 'API key not configured' }, { status: 503 })
  }

  const messages: { role: 'user' | 'assistant'; content: string }[] = []
  for (const raw of body.messages as { role?: unknown; content?: unknown }[]) {
    if (raw.role !== 'user' && raw.role !== 'assistant') {
      return Response.json({ error: 'Invalid message role' }, { status: 400 })
    }
    if (typeof raw.content !== 'string' || !raw.content.trim()) {
      return Response.json({ error: 'Invalid message content' }, { status: 400 })
    }
    if (raw.content.length > MAX_CONTENT_CHARS) {
      return Response.json({ error: 'Message too long' }, { status: 400 })
    }
    messages.push({ role: raw.role, content: raw.content.slice(0, MAX_CONTENT_CHARS) })
  }

  if (messages.length === 0) {
    return Response.json({ error: 'Invalid request' }, { status: 400 })
  }

  const systemPrompt = buildSfsChatSystemPrompt()
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      function send(event: Record<string, unknown>) {
        controller.enqueue(encoder.encode(JSON.stringify(event) + '\n'))
      }
      try {
        const anthropic = new Anthropic({ apiKey })
        const sdkStream = anthropic.messages.stream({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 512,
          system: systemPrompt,
          messages,
        })
        for await (const chunk of sdkStream) {
          if (
            chunk.type === 'content_block_delta' &&
            chunk.delta.type === 'text_delta'
          ) {
            send({ type: 'text', text: chunk.delta.text })
          }
        }
        send({ type: 'done' })
      } catch (err) {
        send({ type: 'error', message: err instanceof Error ? err.message : 'Request failed' })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-cache, no-store',
      'X-Accel-Buffering': 'no',
    },
  })
}
