import Anthropic from '@anthropic-ai/sdk'
import { type Provider, ENV_KEY_NAMES } from './options'
export { PROVIDER_OPTIONS, MODEL_OPTIONS, ENV_KEY_NAMES, type Provider } from './options'

export const PROVIDER_BASE_URLS: Record<Provider, string> = {
  anthropic: 'https://api.anthropic.com',
  deepseek:  'https://api.deepseek.com',
  alibaba:   'https://dashscope.aliyuncs.com/compatible-mode/v1',
}

export function getEnvApiKey(provider: Provider): string {
  return process.env[ENV_KEY_NAMES[provider]] ?? ''
}

export function resolveApiKey(provider: Provider, dbKey: string): string {
  return dbKey.trim() || getEnvApiKey(provider)
}

export function maskApiKey(key: string): string {
  if (!key || key.length < 8) return ''
  return `${key.slice(0, 6)}...${key.slice(-4)}`
}

export const CONFIRM_TOOL_DESC = {
  name: 'confirm_requirement',
  description:
    "Call this ONLY after the user has explicitly confirmed your summary is correct. This finalises the requirement. Do NOT call it until the user says 'yes', 'correct', '对', '是' or similar.",
  parameters: {
    type: 'object' as const,
    properties: {
      title:    { type: 'string', description: 'A clear, concise title for the requirement (max 100 characters)' },
      summary:  { type: 'string', description: 'Detailed description of what the user wants built or changed' },
      priority: { type: 'string', enum: ['low', 'medium', 'high'], description: "Estimated priority based on user's words" },
    },
    required: ['title', 'summary', 'priority'],
  },
}

export type StreamEvent =
  | { type: 'text'; text: string }
  | { type: 'confirmed'; title: string; summary: string; priority: string }
  | { type: 'done' }
  | { type: 'error'; message: string }

type ChatMessage = { role: 'user' | 'assistant'; content: string }

function emitToolCall(
  accumulator: Record<number, { name: string; args: string }>,
  onEvent: (e: StreamEvent) => void,
) {
  for (const tc of Object.values(accumulator)) {
    if (tc.name !== 'confirm_requirement' || !tc.args.trim()) continue
    try {
      const input = JSON.parse(tc.args) as { title: string; summary: string; priority: string }
      onEvent({ type: 'confirmed', title: input.title ?? '', summary: input.summary ?? '', priority: input.priority ?? 'medium' })
    } catch { /* malformed JSON */ }
  }
}

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
    tools: [{
      name: CONFIRM_TOOL_DESC.name,
      description: CONFIRM_TOOL_DESC.description,
      input_schema: CONFIRM_TOOL_DESC.parameters,
    }],
    messages,
  })

  let toolName = ''
  let toolInputBuffer = ''

  for await (const chunk of sdkStream) {
    if (chunk.type === 'content_block_start') {
      if (chunk.content_block.type === 'tool_use') { toolName = chunk.content_block.name; toolInputBuffer = '' }
    } else if (chunk.type === 'content_block_delta') {
      if (chunk.delta.type === 'text_delta') onEvent({ type: 'text', text: chunk.delta.text })
      else if (chunk.delta.type === 'input_json_delta') toolInputBuffer += chunk.delta.partial_json
    } else if (chunk.type === 'content_block_stop') {
      if (toolName === 'confirm_requirement' && toolInputBuffer) {
        emitToolCall({ 0: { name: toolName, args: toolInputBuffer } }, onEvent)
        toolName = ''; toolInputBuffer = ''
      }
    }
  }
}

const REQUEST_TIMEOUT_MS = 60_000

async function streamOpenAICompat(
  systemPrompt: string,
  messages: ChatMessage[],
  model: string,
  apiKey: string,
  baseUrl: string,
  onEvent: (event: StreamEvent) => void,
  userSignal?: AbortSignal,
) {
  const timeoutCtrl = new AbortController()
  const timer = setTimeout(() => timeoutCtrl.abort(), REQUEST_TIMEOUT_MS)
  const signal = userSignal
    ? AbortSignal.any([userSignal, timeoutCtrl.signal])
    : timeoutCtrl.signal

  let res: Response
  try {
    res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      signal,
      body: JSON.stringify({
        model, stream: true,
        messages: [{ role: 'system', content: systemPrompt }, ...messages],
        tools: [{ type: 'function', function: { name: CONFIRM_TOOL_DESC.name, description: CONFIRM_TOOL_DESC.description, parameters: CONFIRM_TOOL_DESC.parameters } }],
        tool_choice: 'auto',
      }),
    })
  } finally {
    clearTimeout(timer)
  }

  if (!res.ok) { const t = await res.text().catch(() => ''); throw new Error(`LLM API ${res.status}: ${t.slice(0, 300)}`) }
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
      if (data === '[DONE]') { emitToolCall(toolCallAccumulator, onEvent); return }
      try {
        const chunk = JSON.parse(data) as {
          choices?: { delta?: { content?: string | null; tool_calls?: { index: number; function?: { name?: string; arguments?: string } }[] }; finish_reason?: string | null }[]
        }
        const choice = chunk.choices?.[0]
        if (!choice) continue
        const delta = choice.delta ?? {}
        if (delta.content) onEvent({ type: 'text', text: delta.content })
        if (delta.tool_calls) {
          for (const tc of delta.tool_calls) {
            if (!toolCallAccumulator[tc.index]) toolCallAccumulator[tc.index] = { name: '', args: '' }
            if (tc.function?.name) toolCallAccumulator[tc.index]!.name += tc.function.name
            if (tc.function?.arguments) toolCallAccumulator[tc.index]!.args += tc.function.arguments
          }
        }
        const fr = choice.finish_reason
        if (fr === 'tool_calls' || fr === 'stop') emitToolCall(toolCallAccumulator, onEvent)
      } catch { /* non-JSON SSE line */ }
    }
  }
  emitToolCall(toolCallAccumulator, onEvent)
}

export async function streamLlmResponse(opts: {
  provider: Provider
  model: string
  apiKey: string
  systemPrompt: string
  messages: ChatMessage[]
  signal?: AbortSignal
  onEvent: (event: StreamEvent) => void
}) {
  const { provider, model, apiKey, systemPrompt, messages, signal, onEvent } = opts
  if (!apiKey) throw new Error(`${ENV_KEY_NAMES[provider]} not configured.`)
  if (provider === 'anthropic') {
    await streamAnthropic(systemPrompt, messages, model, apiKey, onEvent)
  } else {
    await streamOpenAICompat(systemPrompt, messages, model, apiKey, PROVIDER_BASE_URLS[provider], onEvent, signal)
  }
}

export async function testLlmConnection(provider: Provider, model: string, apiKey: string): Promise<string> {
  if (!apiKey) throw new Error(`No API key provided for ${provider}`)
  if (provider === 'anthropic') {
    const anthropic = new Anthropic({ apiKey })
    const msg = await anthropic.messages.create({ model, max_tokens: 16, messages: [{ role: 'user', content: 'Reply with: OK' }] })
    return (msg.content[0] as { text: string })?.text ?? 'OK'
  }
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 15_000)
  try {
    const res = await fetch(`${PROVIDER_BASE_URLS[provider]}/chat/completions`, {
      method: 'POST', signal: ctrl.signal,
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, max_tokens: 16, messages: [{ role: 'user', content: 'Reply with: OK' }] }),
    })
    clearTimeout(timer)
    if (!res.ok) { const t = await res.text().catch(() => ''); throw new Error(`API ${res.status}: ${t.slice(0, 200)}`) }
    const data = await res.json() as { choices?: { message?: { content?: string } }[] }
    return data.choices?.[0]?.message?.content ?? 'OK'
  } finally {
    clearTimeout(timer)
  }
}
