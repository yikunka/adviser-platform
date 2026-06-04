export const PROVIDER_OPTIONS = [
  { value: 'anthropic', label: 'Anthropic (Claude)' },
  { value: 'deepseek',  label: 'DeepSeek' },
  { value: 'alibaba',   label: '阿里百炼 (通义千问)' },
] as const

export type Provider = (typeof PROVIDER_OPTIONS)[number]['value']

export const MODEL_OPTIONS: Record<Provider, { value: string; label: string }[]> = {
  anthropic: [
    { value: 'claude-opus-4-5',   label: 'Claude Opus 4.5 (最强)' },
    { value: 'claude-sonnet-4-5', label: 'Claude Sonnet 4.5 (均衡)' },
    { value: 'claude-haiku-4-5',  label: 'Claude Haiku 4.5 (快速)' },
  ],
  deepseek: [
    { value: 'deepseek-chat',     label: 'DeepSeek V3 (均衡)' },
    { value: 'deepseek-reasoner', label: 'DeepSeek R1 (推理)' },
  ],
  alibaba: [
    { value: 'qwen3.5-plus',  label: 'Qwen3.5-Plus (均衡·推荐)' },
    { value: 'qwen3.5-flash', label: 'Qwen3.5-Flash (快速)' },
  ],
}

export const ENV_KEY_NAMES: Record<Provider, string> = {
  anthropic: 'ANTHROPIC_API_KEY',
  deepseek:  'DEEPSEEK_API_KEY',
  alibaba:   'ALIBABA_API_KEY',
}
