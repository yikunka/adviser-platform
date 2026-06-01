/**
 * Feedback Plugin — Unified LLM streaming client
 *
 * Supports three providers:
 *   - anthropic  → @anthropic-ai/sdk
 *   - deepseek   → OpenAI-compatible API at api.deepseek.com
 *   - alibaba    → OpenAI-compatible API (DashScope) at dashscope.aliyuncs.com
 *
 * API key resolution order: DB-stored key → environment variable
 *
 * Stream output: newline-delimited JSON events
 *   { type: 'text',      text: string }
 *   { type: 'confirmed', title: string, summary: string, priority: string }
 *   { type: 'done' }
 *   { type: 'error',     message: string }
 */

import Anthropic from '@anthropic-ai/sdk'
import { type Provider, ENV_KEY_NAMES } from '@/lib/feedback/options'
export { PROVIDER_OPTIONS, MODEL_OPTIONS, ENV_KEY_NAMES, type Provider } from '@/lib/feedback/options'

export const PROVIDER_BASE_URLS: Record<Provider, string> = {
  anthropic: 'https://api.anthropic.com',
  deepseek: 'https://api.deepseek.com',
  alibaba: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
}

/** Read API key from env var only (no DB access — used for display in admin UI) */
export function getEnvApiKey(provider: Provider): string {
  return process.env[ENV_KEY_NAMES[provider]] ?? ''
}

/** Resolve the effective API key: DB-stored key wins over env var */
export function resolveApiKey(provider: Provider, dbKey: string): string {
  return dbKey.trim() || getEnvApiKey(provider)
}

/** Mask a key for safe display: "sk-81b7...009a" */
export function maskApiKey(key: string): string {
  if (!key || key.length < 8) return ''
  return `${key.slice(0, 6)}...${key.slice(-4)}`
}

// ── Tool definition ────────────────────────────────────────────────────────

export const CONFIRM_TOOL_DESC = {
  name: 'confirm_requirement',
  description:
    "Call this ONLY after the user has explicitly confirmed your summary is correct. This finalises the requirement. Do NOT call it until the user says 'yes', 'correct', '对', '是' or similar.",
  parameters: {
    type: 'object' as const,
    properties: {
      title: {
        type: 'string',
        description: 'A clear, concise title for the requirement (max 100 characters)',
      },
      summary: {
        type: 'string',
        description: 'Detailed description of what the user wants built or changed',
      },
      priority: {
        type: 'string',
        enum: ['low', 'medium', 'high'],
        description: "Estimated priority based on user's words",
      },
    },
    required: ['title', 'summary', 'priority'],
  },
}

// ── Stream event type ──────────────────────────────────────────────────────

export type StreamEvent =
  | { type: 'text'; text: string }
  | { type: 'confirmed'; title: string; summary: string; priority: string }
  | { type: 'done' }
  | { type: 'error'; message: string }

type ChatMessage = { role: 'user' | 'assistant'; content: string }

// ── Helpers ────────────────────────────────────────────────────────────────

/** Emit a confirm_requirement tool result, ignoring parse errors */
function emitToolCall(
  accumulator: Record<number, { name: string; args: string }>,
  onEvent: (e: StreamEvent) => void,
) {
  for (const tc of Object.values(accumulator)) {
    if (tc.name !== 'confirm_requirement' || !tc.args.trim()) continue
    try {
      const input = JSON.parse(tc.args) as { title: string; summary: string; priority: string }
      onEvent({
        type: 'confirmed',
        title: input.title ?? '',
        summary: input.summary ?? '',
        priority: input.priority ?? 'medium',
      })
    } catch {
      // malformed JSON — ignore
    }
  }
}

// ── Anthropic streaming ────────────────────────────────────────────────────

async function streamAnthropic(
  systemPrompt: string,
  messages: ChatMessage[],
  model: string,
  apiKey: string,
  onEvent: (event: StreamEvent) => void,
) {
  const anthropic = new Anthropic({ apiKey })

  const sdkStream = anthropic.messages.stream({
    model,
    max_tokens: 1024,
    system: systemPrompt,
    tools: [
      {
        name: CONFIRM_TOOL_DESC.name,
        description: CONFIRM_TOOL_DESC.description,
        input_schema: CONFIRM_TOOL_DESC.parameters,
      },
    ],
    messages,
  })

  let toolName = ''
  let toolInputBuffer = ''

  for await (const chunk of sdkStream) {
    if (chunk.type === 'content_block_start') {
      if (chunk.content_block.type === 'tool_use') {
        toolName = chunk.content_block.name
        toolInputBuffer = ''
      }
    } else if (chunk.type === 'content_block_delta') {
      if (chunk.delta.type === 'text_delta') {
        onEvent({ type: 'text', text: chunk.delta.text })
      } else if (chunk.delta.type === 'input_json_delta') {
        toolInputBuffer += chunk.delta.partial_json
      }
    } else if (chunk.type === 'content_block_stop') {
      if (toolName === 'confirm_requirement' && toolInputBuffer) {
        emitToolCall({ 0: { name: toolName, args: toolInputBuffer } }, onEvent)
        toolName = ''
        toolInputBuffer = ''
      }
    }
  }
}

// ── OpenAI-compatible streaming (DeepSeek / Alibaba) ──────────────────────

const REQUEST_TIMEOUT_MS = 60_000 // 60 s — LLM first-token latency can be high

async function streamOpenAICompat(
  systemPrompt: string,
  messages: ChatMessage[],
  model: string,
  apiKey: string,
  baseUrl: string,
  onEvent: (event: StreamEvent) => void,
  userSignal?: AbortSignal,
) {
  // Combine user abort signal with our own timeout
  const timeoutCtrl = new AbortController()
  const timer = setTimeout(() => timeoutCtrl.abort(), REQUEST_TIMEOUT_MS)

  // Merge signals: abort if either fires
  const signal = userSignal
    ? AbortSignal.any([userSignal, timeoutCtrl.signal])
    : timeoutCtrl.signal

  let res: Response
  try {
    res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      signal,
      body: JSON.stringify({
        model,
        stream: true,
        messages: [{ role: 'system', content: systemPrompt }, ...messages],
        tools: [
          {
            type: 'function',
            function: {
              name: CONFIRM_TOOL_DESC.name,
              description: CONFIRM_TOOL_DESC.description,
              parameters: CONFIRM_TOOL_DESC.parameters,
            },
          },
        ],
        tool_choice: 'auto',
      }),
    })
  } finally {
    clearTimeout(timer)
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`LLM API ${res.status}: ${text.slice(0, 300)}`)
  }

  if (!res.body) throw new Error('LLM API returned no response body')

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  const toolCallAccumulator: Record<number, { name: string; args: string }> = {}

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const raw of lines) {
      const line = raw.trim()
      if (!line.startsWith('data:')) continue

      const data = line.slice(5).trim()

      // ── Stream end ──
      if (data === '[DONE]') {
        // Flush any accumulated tool calls that didn't arrive with a finish_reason chunk
        emitToolCall(toolCallAccumulator, onEvent)
        return
      }

      try {
        const chunk = JSON.parse(data) as {
          choices?: {
            delta?: {
              content?: string | null
              tool_calls?: { index: number; function?: { name?: string; arguments?: string } }[]
            }
            finish_reason?: string | null
          }[]
        }

        const choice = chunk.choices?.[0]
        if (!choice) continue

        const delta = choice.delta ?? {}

        // Text token
        if (delta.content) {
          onEvent({ type: 'text', text: delta.content })
        }

        // Tool call accumulation
        if (delta.tool_calls) {
          for (const tc of delta.tool_calls) {
            if (!toolCallAccumulator[tc.index]) {
              toolCallAccumulator[tc.index] = { name: '', args: '' }
            }
            if (tc.function?.name) toolCallAccumulator[tc.index]!.name += tc.function.name
            if (tc.function?.arguments) toolCallAccumulator[tc.index]!.args += tc.function.arguments
          }
        }

        // Flush tool calls on finish (some providers send finish_reason before [DONE])
        const fr = choice.finish_reason
        if (fr === 'tool_calls' || fr === 'stop') {
          emitToolCall(toolCallAccumulator, onEvent)
        }
      } catch {
        // non-JSON SSE line — skip
      }
    }
  }

  // Fallback flush if stream ended without [DONE]
  emitToolCall(toolCallAccumulator, onEvent)
}

// ── Public streaming API ───────────────────────────────────────────────────

export async function streamLlmResponse(opts: {
  provider: Provider
  model: string
  /** Resolved API key (DB key or env var — caller is responsible for resolving). */
  apiKey: string
  systemPrompt: string
  messages: ChatMessage[]
  signal?: AbortSignal
  onEvent: (event: StreamEvent) => void
}) {
  const { provider, model, apiKey, systemPrompt, messages, signal, onEvent } = opts

  if (!apiKey) {
    throw new Error(
      `${ENV_KEY_NAMES[provider]} not configured. Set it in 后台 → 需求迭代 → 模型配置, or in your .env.local file.`,
    )
  }

  if (provider === 'anthropic') {
    await streamAnthropic(systemPrompt, messages, model, apiKey, onEvent)
  } else {
    await streamOpenAICompat(
      systemPrompt,
      messages,
      model,
      apiKey,
      PROVIDER_BASE_URLS[provider],
      onEvent,
      signal,
    )
  }
}

// ── Quick connectivity test (non-streaming) ────────────────────────────────

export async function testLlmConnection(provider: Provider, model: string, apiKey: string): Promise<string> {
  if (!apiKey) throw new Error(`No API key provided for ${provider}`)

  if (provider === 'anthropic') {
    const anthropic = new Anthropic({ apiKey })
    const msg = await anthropic.messages.create({
      model,
      max_tokens: 16,
      messages: [{ role: 'user', content: 'Reply with: OK' }],
    })
    return (msg.content[0] as { text: string })?.text ?? 'OK'
  }

  // OpenAI-compatible (DeepSeek / Alibaba)
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 15_000)
  try {
    const res = await fetch(`${PROVIDER_BASE_URLS[provider]}/chat/completions`, {
      method: 'POST',
      signal: ctrl.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        max_tokens: 16,
        messages: [{ role: 'user', content: 'Reply with: OK' }],
      }),
    })
    clearTimeout(timer)
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`API ${res.status}: ${text.slice(0, 200)}`)
    }
    const data = await res.json() as { choices?: { message?: { content?: string } }[] }
    return data.choices?.[0]?.message?.content ?? 'OK'
  } finally {
    clearTimeout(timer)
  }
}
