'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import {
  MessageSquarePlus,
  ExternalLink,
  Settings2,
  CheckCircle,
  AlertCircle,
  Loader2,
  Save,
  Eye,
  EyeOff,
  Zap,
  ClipboardCopy,
  KeyRound,
  RefreshCw,
  Trash2,
} from 'lucide-react'
import { PROVIDER_OPTIONS, MODEL_OPTIONS, type Provider } from '@/lib/feedback/options'

// ── Types ──────────────────────────────────────────────────────────────────

type ChatMessage = { role: 'user' | 'assistant'; content: string }

type Attachment = { url: string; name: string; type: string }

type FeatureRequest = {
  id: string
  title: string
  summary: string
  priority: string
  pageUrl: string
  pageTitle: string
  status: 'PENDING' | 'IN_PROGRESS' | 'DONE' | 'REJECTED'
  userEmail: string | null
  userName: string | null
  createdAt: string
  attachments?: Attachment[]
}

// Full detail includes conversation — fetched separately on demand
type FeatureRequestDetail = FeatureRequest & {
  conversation: ChatMessage[]
}

// API only returns saved values + key hints — options come from local import
type SavedConfig = {
  provider: Provider
  model: string
  hasApiKey: boolean
  hasDevtoolKey: boolean
  keys: Record<string, string>  // masked hints: "sk-81b7...009a"
}

// ── Constants ──────────────────────────────────────────────────────────────

const STATUS_OPTIONS = [
  { value: 'ALL', label: '全部状态' },
  { value: 'PENDING', label: '待处理' },
  { value: 'IN_PROGRESS', label: '处理中' },
  { value: 'DONE', label: '已完成' },
  { value: 'REJECTED', label: '已拒绝' },
]

const STATUS_META: Record<string, { bg: string; text: string; label: string }> = {
  PENDING: { bg: '#F59E0B22', text: '#F59E0B', label: '待处理' },
  IN_PROGRESS: { bg: '#38bdf822', text: '#38bdf8', label: '处理中' },
  DONE: { bg: '#10b98122', text: '#10b981', label: '已完成' },
  REJECTED: { bg: '#ef444422', text: '#ef4444', label: '已拒绝' },
}

const PRIORITY_COLOR: Record<string, string> = {
  low: '#6B7280',
  medium: '#F59E0B',
  high: '#EF4444',
}

const PRIORITY_LABEL: Record<string, string> = { low: '低', medium: '中', high: '高' }



// ── API Key input with show/hide toggle ────────────────────────────────────

function ApiKeyInput({
  label,
  placeholder,
  value,
  hint,
  onChange,
}: {
  label: string
  placeholder: string
  value: string
  hint: string  // masked existing key, e.g. "sk-81b7...009a"
  onChange: (v: string) => void
}) {
  const [show, setShow] = useState(false)
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium" style={{ color: '#EADDC3' }}>{label}</label>
        {hint && (
          <span className="text-xs font-mono" style={{ color: '#C9A96E' }}>
            已保存：{hint}
          </span>
        )}
      </div>
      <div className="relative max-w-sm">
        <Input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={hint ? `留空则保持现有 Key (${hint})` : placeholder}
          className="pr-9 text-sm"
          style={{ background: '#0E0E0A', border: '1px solid #2A2418', color: '#FFF7E6' }}
          autoComplete="off"
        />
        <button
          type="button"
          onClick={() => setShow(s => !s)}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 opacity-50 hover:opacity-100"
        >
          {show ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
      </div>
    </div>
  )
}

// ── Config Tab ─────────────────────────────────────────────────────────────

function ConfigTab() {
  // Saved values from API — null while loading, keeps last value on error
  const [saved, setSaved] = useState<SavedConfig | null>(null)
  const [configLoading, setConfigLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [generatingKey, setGeneratingKey] = useState(false)
  const [newRawKey, setNewRawKey] = useState('')

  // Form state — initialised from PROVIDER_OPTIONS so Select always has items
  const [provider, setProvider] = useState<Provider>(PROVIDER_OPTIONS[0].value)
  const [model, setModel] = useState<string>(MODEL_OPTIONS[PROVIDER_OPTIONS[0].value][0]?.value ?? '')
  const [anthropicKey, setAnthropicKey] = useState('')
  const [deepseekKey, setDeepseekKey] = useState('')
  const [alibabaKey, setAlibabaKey] = useState('')

  // Load saved config — failure is non-fatal, form still works
  useEffect(() => {
    fetch('/api/admin/feedback/config')
      .then(async r => {
        const data = await r.json().catch(() => null)
        if (r.ok && data) {
          setSaved(data as SavedConfig)
          setProvider(data.provider as Provider)
          setModel(data.model as string)
        }
      })
      .catch(() => { /* silent — form stays usable */ })
      .finally(() => setConfigLoading(false))
  }, [])

  function handleProviderChange(newProvider: string | null) {
    if (!newProvider) return
    const p = newProvider as Provider
    setProvider(p)
    // Auto-select first model for the new provider
    setModel(MODEL_OPTIONS[p]?.[0]?.value ?? '')
  }

  async function saveConfig() {
    setSaving(true)
    try {
      const res = await fetch('/api/admin/feedback/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          model: model || (MODEL_OPTIONS[provider]?.[0]?.value ?? ''),
          ...(anthropicKey ? { anthropicKey } : {}),
          ...(deepseekKey  ? { deepseekKey  } : {}),
          ...(alibabaKey   ? { alibabaKey   } : {}),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || '保存失败')
      setSaved(data as SavedConfig)
      setAnthropicKey('')
      setDeepseekKey('')
      setAlibabaKey('')
      toast.success(data.toast ?? '配置已保存')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  async function testConnection() {
    setTesting(true)
    try {
      const res = await fetch('/api/admin/feedback/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'test' }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.success) throw new Error(data.error || '连接失败')
      toast.success(`✓ 连接成功！模型回复：${data.reply}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '连接测试失败')
    } finally {
      setTesting(false)
    }
  }

  async function generateDevtoolKey() {
    setGeneratingKey(true)
    setNewRawKey('')
    try {
      const res = await fetch('/api/admin/feedback/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate-devtool-key' }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.rawKey) throw new Error(data.error || '生成失败')
      setNewRawKey(data.rawKey as string)
      setSaved(prev => prev ? { ...prev, hasDevtoolKey: true } : prev)
      toast.success('API Key 已生成，请立即复制，离开后无法再查看')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '生成失败')
    } finally {
      setGeneratingKey(false)
    }
  }

  async function revokeDevtoolKey() {
    try {
      await fetch('/api/admin/feedback/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'revoke-devtool-key' }),
      })
      setSaved(prev => prev ? { ...prev, hasDevtoolKey: false } : prev)
      setNewRawKey('')
      toast.success('API Key 已撤销')
    } catch {
      toast.error('撤销失败')
    }
  }

  const modelOptions = MODEL_OPTIONS[provider] ?? []
  const hasKey = saved?.hasApiKey ?? false
  const hasDevtoolKey = saved?.hasDevtoolKey ?? false
  const keyHints = saved?.keys ?? {}

  return (
    <div className="space-y-5">
      <Card className="rounded-lg border-[#2A2418] bg-card">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2" style={{ color: 'var(--foreground)' }}>
            <Settings2 size={16} style={{ color: '#C9A96E' }} />
            LLM 模型配置
          </CardTitle>
          <CardDescription className="flex items-center gap-2">
            选择供应商和模型，直接在此配置 API Key（优先级高于环境变量）。
            {configLoading && <Loader2 size={12} className="animate-spin opacity-50" />}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">

          {/* ── 供应商 + 模型 ── */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium" style={{ color: '#EADDC3' }}>供应商</label>
              <Select value={provider} onValueChange={v => handleProviderChange(v as Provider)}>
                <SelectTrigger style={{ background: '#0E0E0A', border: '1px solid #2A2418' }}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROVIDER_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" style={{ color: '#EADDC3' }}>模型</label>
              <Select value={model} onValueChange={v => v && setModel(v)}>
                <SelectTrigger style={{ background: '#0E0E0A', border: '1px solid #2A2418' }}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {modelOptions.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* ── API Keys ── */}
          <div className="space-y-4 pt-1">
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#7A7060' }}>
              API Keys（留空则保持现有 / 使用环境变量）
            </p>
            <ApiKeyInput
              label="Anthropic Claude"
              placeholder="sk-ant-..."
              value={anthropicKey}
              hint={keyHints['anthropic'] ?? ''}
              onChange={setAnthropicKey}
            />
            <ApiKeyInput
              label="DeepSeek"
              placeholder="sk-..."
              value={deepseekKey}
              hint={keyHints['deepseek'] ?? ''}
              onChange={setDeepseekKey}
            />
            <ApiKeyInput
              label="阿里百炼 (DashScope)"
              placeholder="sk-..."
              value={alibabaKey}
              hint={keyHints['alibaba'] ?? ''}
              onChange={setAlibabaKey}
            />
          </div>

          {/* ── 当前 Key 状态（提示，不阻止保存）── */}
          {!hasKey && (
            <div
              className="flex items-center gap-2.5 rounded-lg px-3.5 py-2.5 text-sm"
              style={{ background: '#F59E0B12', border: '1px solid #F59E0B30' }}
            >
              <AlertCircle size={14} style={{ color: '#F59E0B', flexShrink: 0 }} />
              <span style={{ color: '#F59E0B' }}>
                {provider} 暂未配置 API Key，保存后填写 Key 才能正常使用
              </span>
            </div>
          )}

          {/* ── Buttons ── */}
          <div className="flex items-center gap-3 flex-wrap">
            <Button
              onClick={saveConfig}
              disabled={saving}
              size="sm"
              style={{ background: '#C9A96E', color: '#0A0805' }}
            >
              {saving
                ? <><Loader2 size={13} className="animate-spin mr-1.5" />保存中…</>
                : <><Save size={13} className="mr-1.5" />保存配置</>
              }
            </Button>
            <Button
              onClick={testConnection}
              disabled={testing || !hasKey}
              variant="outline"
              size="sm"
              style={{ borderColor: '#2A2418', color: 'var(--foreground)' }}
            >
              {testing
                ? <><Loader2 size={13} className="animate-spin mr-1.5" />测试中…</>
                : <><Zap size={13} className="mr-1.5" />测试连接</>
              }
            </Button>
          </div>

        </CardContent>
      </Card>

      {/* ── Dev Tool API Key ── */}
      <Card className="rounded-lg border-[#2A2418] bg-card">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2" style={{ color: 'var(--foreground)' }}>
            <KeyRound size={16} style={{ color: '#C9A96E' }} />
            Dev Tool API Key
          </CardTitle>
          <CardDescription>
            供外部开发管理工具通过 Bearer Token 查询需求列表。发现接口：
            <code className="ml-1 text-xs px-1 py-0.5 rounded" style={{ background: '#1A1A12', color: '#C9A96E' }}>
              GET /api/devtool/info
            </code>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">

          <div className="flex items-center gap-2 text-sm">
            {hasDevtoolKey ? (
              <><CheckCircle size={14} style={{ color: '#10b981' }} /><span style={{ color: '#10b981' }}>已配置 API Key</span></>
            ) : (
              <><AlertCircle size={14} style={{ color: '#6B7280' }} /><span style={{ color: '#6B7280' }}>尚未生成 API Key</span></>
            )}
          </div>

          {newRawKey && (
            <div
              className="rounded-lg p-3 space-y-2"
              style={{ background: 'rgba(201,169,110,0.08)', border: '1px solid rgba(201,169,110,0.3)' }}
            >
              <p className="text-xs font-medium" style={{ color: '#C9A96E' }}>
                ⚠️ 请立即复制，此 Key 只显示一次
              </p>
              <div className="flex items-center gap-2">
                <code
                  className="flex-1 text-xs font-mono break-all rounded px-2 py-1.5 select-all"
                  style={{ background: '#0E0E0A', color: '#FFF7E6', border: '1px solid #2A2418' }}
                >
                  {newRawKey}
                </code>
                <Button
                  size="sm"
                  variant="outline"
                  className="shrink-0"
                  style={{ borderColor: '#2A2418' }}
                  onClick={() => { navigator.clipboard.writeText(newRawKey); toast.success('已复制') }}
                >
                  <ClipboardCopy size={13} />
                </Button>
              </div>
            </div>
          )}

          <div className="flex items-center gap-3 flex-wrap">
            <Button
              onClick={generateDevtoolKey}
              disabled={generatingKey}
              size="sm"
              variant="outline"
              style={{ borderColor: '#2A2418' }}
            >
              {generatingKey
                ? <><Loader2 size={13} className="animate-spin mr-1.5" />生成中…</>
                : hasDevtoolKey
                  ? <><RefreshCw size={13} className="mr-1.5" />重新生成</>
                  : <><KeyRound size={13} className="mr-1.5" />生成 API Key</>
              }
            </Button>
            {hasDevtoolKey && (
              <Button
                onClick={revokeDevtoolKey}
                size="sm"
                variant="outline"
                style={{ borderColor: '#ef444444', color: '#ef4444' }}
              >
                <Trash2 size={13} className="mr-1.5" />撤销
              </Button>
            )}
          </div>

          <div
            className="rounded-lg p-3 text-xs space-y-1.5"
            style={{ background: '#0E0E0A', border: '1px solid #1E1A14', color: '#7A7060' }}
          >
            <p className="font-medium" style={{ color: '#9F927B' }}>开发工具接入方式</p>
            <p>① 探测服务器：<code className="font-mono" style={{ color: '#C9A96E' }}>GET /api/devtool/info</code></p>
            <p>② 查询需求：<code className="font-mono" style={{ color: '#C9A96E' }}>GET /api/devtool/requirements?status=PENDING</code></p>
            <p>③ 更新状态：<code className="font-mono" style={{ color: '#C9A96E' }}>PATCH /api/devtool/requirements/:id  {'{"status":"IN_PROGRESS"}'}</code></p>
            <p>④ 请求 header：<code className="font-mono" style={{ color: '#C9A96E' }}>Authorization: Bearer &lt;key&gt;</code></p>
          </div>

        </CardContent>
      </Card>
    </div>
  )
}

// ── Dev prompt builder ─────────────────────────────────────────────────────
//
// ⚠️  原则：生成的提示词里永远不要出现「将需求标记为已完成 / 更新状态」之类的指令。
//    需求状态（PENDING → IN_PROGRESS → DONE 等）由外部 pipeline 自动维护，
//    不需要也不应该让 AI Agent 去操作 /admin/feedback。
//    未来扩展提示词时，请严格遵守这条规则。
//
const PRIORITY_LABEL_CN: Record<string, string> = { low: '低', medium: '中', high: '高' }

function buildDevPrompt(item: FeatureRequest, conversation: ChatMessage[] = []): string {
  const priorityLabel = PRIORITY_LABEL_CN[item.priority] ?? item.priority
  const userQuotes = conversation
    .filter(m => m.role === 'user' && m.content.trim())
    .map(m => `> ${m.content.trim()}`)
    .join('\n')

  const attachments = item.attachments ?? []
  const attachmentLines = attachments.length > 0
    ? attachments.map(a => `- [${a.name}](${a.url})`).join('\n')
    : ''

  return [
    '## 开发任务',
    '',
    `**需求标题**：${item.title}`,
    `**优先级**：${priorityLabel}`,
    `**来源页面**：${item.pageUrl}${item.pageTitle ? ` (${item.pageTitle})` : ''}`,
    `**提交人**：${item.userName || item.userEmail || '未知'}`,
    '',
    '**需求描述**：',
    item.summary,
    '',
    ...(userQuotes ? ['**用户原话**：', userQuotes, ''] : []),
    ...(attachmentLines ? ['**附件**：', attachmentLines, ''] : []),
    '---',
    '参考 `src/lib/feedback/system-knowledge.md` 了解系统现有功能上下文。',
    '完成后请同步更新 `src/lib/feedback/system-knowledge.md`。',
  ].join('\n')
}

function buildBatchDevPrompt(items: FeatureRequest[]): string {
  const tasks = items.map((item, i) => {
    const priorityLabel = PRIORITY_LABEL_CN[item.priority] ?? item.priority
    const attachments = item.attachments ?? []
    const attachmentLines = attachments.length > 0
      ? `\n\n**附件**：\n${attachments.map(a => `- [${a.name}](${a.url})`).join('\n')}`
      : ''
    return [
      `### 任务 ${i + 1}：${item.title}`,
      '',
      `**优先级**：${priorityLabel} · **来源页面**：${item.pageUrl}`,
      '',
      '**需求描述**：',
      item.summary + attachmentLines,
    ].join('\n')
  })

  return [
    '## 开发任务列表',
    '',
    `共 ${items.length} 个需求，请按顺序逐个完成。`,
    '',
    '---',
    '',
    tasks.join('\n\n---\n\n'),
    '',
    '---',
    '',
    '## 执行规则',
    '',
    '- 按任务编号顺序执行，完成一个再开始下一个',
    '- 每完成一个任务，检查是否需要更新 `src/lib/feedback/system-knowledge.md`',
    '- 参考 `src/lib/feedback/system-knowledge.md` 了解系统现有功能上下文',
  ].join('\n')
}

// ── Requirements Tab ───────────────────────────────────────────────────────

function RequirementsTab() {
  const [items, setItems] = useState<FeatureRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState('ALL')
  const [detailItem, setDetailItem] = useState<FeatureRequestDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [batchCopying, setBatchCopying] = useState(false)

  async function openDetail(item: FeatureRequest) {
    // Show dialog immediately with basic info, then load conversation
    setDetailItem({ ...item, conversation: [] })
    setDetailLoading(true)
    try {
      const res = await fetch(`/api/admin/feedback/${item.id}`)
      const data = await res.json()
      if (res.ok && data.item) {
        setDetailItem({
          ...item,
          conversation: Array.isArray(data.item.conversation) ? data.item.conversation : [],
        })
      }
    } catch {
      // Keep basic info, just no conversation
    } finally {
      setDetailLoading(false)
    }
  }

  const fetchItems = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filterStatus !== 'ALL') params.set('status', filterStatus)
      const res = await fetch(`/api/admin/feedback?${params}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load')
      setItems(data.items ?? [])
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }, [filterStatus])

  // eslint-disable-next-line react-hooks/set-state-in-effect -- fetchItems updates state after the async request resolves.
  useEffect(() => { fetchItems() }, [fetchItems])

  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    if (selectedIds.size === items.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(items.map(i => i.id)))
    }
  }

  async function batchCopyDevPrompt() {
    const selected = items.filter(i => selectedIds.has(i.id))
    if (selected.length === 0) return
    setBatchCopying(true)
    try {
      await navigator.clipboard.writeText(buildBatchDevPrompt(selected))
    } catch {
      toast.error('无法访问剪贴板，请检查浏览器权限')
      setBatchCopying(false)
      return
    }
    const pendingIds = selected.filter(i => i.status === 'PENDING').map(i => i.id)
    await Promise.all(pendingIds.map(id => updateStatus(id, 'IN_PROGRESS', true)))
    setBatchCopying(false)
    setSelectedIds(new Set())
    const updatedCount = pendingIds.length
    toast.success(
      updatedCount > 0
        ? `已复制 ${selected.length} 个任务，${updatedCount} 个需求状态已更新为「处理中」`
        : `已复制 ${selected.length} 个任务到剪贴板`,
    )
  }

  async function copyDevPrompt(item: FeatureRequest, conversation: ChatMessage[] = []) {
    try {
      await navigator.clipboard.writeText(buildDevPrompt(item, conversation))
    } catch {
      toast.error('无法访问剪贴板，请检查浏览器权限')
      return
    }
    if (item.status === 'PENDING') {
      await updateStatus(item.id, 'IN_PROGRESS', true)
      toast.success('已复制到剪贴板，状态已更新为「处理中」')
    } else {
      toast.success('已复制到剪贴板')
    }
  }

  async function updateStatus(id: string, status: string, silent = false) {
    setUpdatingId(id)
    try {
      const res = await fetch(`/api/admin/feedback/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || '更新失败')
      setItems(prev => prev.map(item => item.id === id ? { ...item, status: status as FeatureRequest['status'] } : item))
      if (detailItem?.id === id) setDetailItem(prev => prev ? { ...prev, status: status as FeatureRequestDetail['status'] } : prev)
      if (!silent) toast.success('状态已更新')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '更新失败')
    } finally {
      setUpdatingId(null)
    }
  }

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
          共 {items.length} 条需求
        </p>
        <Select value={filterStatus} onValueChange={v => setFilterStatus(v ?? 'ALL')}>
          <SelectTrigger className="w-[140px]" style={{ background: '#0E0E0A', border: '1px solid #2A2418' }}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map(opt => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card className="rounded-lg border-[#2A2418] bg-card">
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center flex items-center justify-center gap-2" style={{ color: 'var(--muted-foreground)' }}>
              <Loader2 size={16} className="animate-spin" /> 加载中…
            </div>
          ) : items.length === 0 ? (
            <div className="p-12 text-center space-y-2">
              <MessageSquarePlus size={32} className="mx-auto opacity-20" />
              <p style={{ color: '#5A5040' }}>暂无需求记录</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10 pr-0">
                    <input
                      type="checkbox"
                      checked={items.length > 0 && selectedIds.size === items.length}
                      ref={el => { if (el) el.indeterminate = selectedIds.size > 0 && selectedIds.size < items.length }}
                      onChange={toggleSelectAll}
                      className="h-4 w-4 rounded accent-[#C9A96E] cursor-pointer"
                    />
                  </TableHead>
                  <TableHead>需求标题</TableHead>
                  <TableHead>优先级</TableHead>
                  <TableHead>来源页面</TableHead>
                  <TableHead>提交人</TableHead>
                  <TableHead>时间</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map(item => {
                  const st = STATUS_META[item.status]
                  const isSelected = selectedIds.has(item.id)
                  return (
                    <TableRow
                      key={item.id}
                      className="cursor-pointer hover:bg-white/[0.02]"
                      style={isSelected ? { background: 'rgba(201,169,110,0.05)' } : undefined}
                      onClick={() => openDetail(item)}
                    >
                      <TableCell className="w-10 pr-0" onClick={e => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelect(item.id)}
                          className="h-4 w-4 rounded accent-[#C9A96E] cursor-pointer"
                        />
                      </TableCell>
                      <TableCell className="max-w-[220px]">
                        <p className="truncate font-medium text-sm" style={{ color: 'var(--foreground)' }}>
                          {item.title || '(无标题)'}
                        </p>
                        <p className="truncate text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                          {item.summary}
                        </p>
                      </TableCell>
                      <TableCell>
                        <span
                          className="text-xs px-2 py-0.5 rounded-full"
                          style={{
                            background: (PRIORITY_COLOR[item.priority] ?? '#6B7280') + '22',
                            color: PRIORITY_COLOR[item.priority] ?? '#6B7280',
                          }}
                        >
                          {PRIORITY_LABEL[item.priority] ?? item.priority}
                        </span>
                      </TableCell>
                      <TableCell className="max-w-[140px]">
                        <span className="truncate text-xs font-mono block" style={{ color: 'var(--muted-foreground)' }}>
                          {item.pageUrl}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                          {item.userName || item.userEmail || '—'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs whitespace-nowrap" style={{ color: 'var(--muted-foreground)' }}>
                          {new Date(item.createdAt).toLocaleString('zh-HK', {
                            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                          })}
                        </span>
                      </TableCell>
                      <TableCell onClick={e => e.stopPropagation()}>
                        <Select
                          value={item.status}
                          onValueChange={value => value && updateStatus(item.id, value)}
                          disabled={updatingId === item.id}
                        >
                          <SelectTrigger
                            className="h-7 text-xs w-[96px]"
                            style={{
                              background: st?.bg,
                              color: st?.text,
                              border: `1px solid ${st?.text ?? 'transparent'}33`,
                            }}
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {STATUS_OPTIONS.filter(s => s.value !== 'ALL').map(opt => (
                              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            title="复制为开发提示词"
                            onClick={() => copyDevPrompt(item)}
                          >
                            <ClipboardCopy size={13} className="text-muted-foreground" />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openDetail(item)}>
                            <ExternalLink size={13} className="text-muted-foreground" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Batch action bar */}
      {selectedIds.size > 0 && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 rounded-full px-5 py-3 shadow-2xl"
          style={{ background: '#1E1A14', border: '1px solid #C9A96E55' }}
        >
          <span className="text-sm font-medium" style={{ color: '#C9A96E' }}>
            已选 {selectedIds.size} 个需求
          </span>
          <div className="w-px h-4" style={{ background: '#3A3020' }} />
          <Button
            size="sm"
            disabled={batchCopying}
            onClick={batchCopyDevPrompt}
            style={{ background: '#C9A96E', color: '#0A0805', borderRadius: 999 }}
          >
            {batchCopying
              ? <><Loader2 size={13} className="animate-spin mr-1.5" />复制中…</>
              : <><ClipboardCopy size={13} className="mr-1.5" />批量复制提示词</>
            }
          </Button>
          <button
            type="button"
            onClick={() => setSelectedIds(new Set())}
            className="text-xs transition-opacity hover:opacity-100 opacity-50"
            style={{ color: '#9F927B' }}
          >
            取消
          </button>
        </div>
      )}

      {/* Detail dialog */}
      <Dialog open={!!detailItem} onOpenChange={open => !open && setDetailItem(null)}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] flex flex-col border-[#2A2418] bg-[#11110E] text-[#FFF7E6]">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="text-[#FFF7E6] text-base">
              {detailItem?.title || '需求详情'}
            </DialogTitle>
          </DialogHeader>
          {detailItem && (
            <div className="flex-1 overflow-y-auto space-y-4 text-sm pr-1">
              {/* Tags */}
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className="text-xs px-2.5 py-1 rounded-full"
                  style={{
                    background: (PRIORITY_COLOR[detailItem.priority] ?? '#6B7280') + '22',
                    color: PRIORITY_COLOR[detailItem.priority] ?? '#6B7280',
                  }}
                >
                  {PRIORITY_LABEL[detailItem.priority] ?? detailItem.priority} 优先级
                </span>
                <span
                  className="text-xs px-2.5 py-1 rounded-full"
                  style={{
                    background: STATUS_META[detailItem.status]?.bg,
                    color: STATUS_META[detailItem.status]?.text,
                  }}
                >
                  {STATUS_META[detailItem.status]?.label}
                </span>
              </div>

              {/* Summary */}
              <div
                className="rounded-lg p-3.5"
                style={{ background: 'rgba(201,169,110,0.06)', border: '1px solid rgba(201,169,110,0.2)' }}
              >
                <p className="text-xs font-medium mb-1.5" style={{ color: '#C9A96E' }}>已确认需求</p>
                <p style={{ color: '#EDE4D0', lineHeight: 1.7 }}>{detailItem.summary}</p>
              </div>

              {/* Meta */}
              <div className="grid grid-cols-3 gap-3 text-xs" style={{ color: '#9F927B' }}>
                <div>
                  <p className="font-medium mb-0.5">来源页面</p>
                  <p className="font-mono truncate" title={detailItem.pageUrl}>{detailItem.pageUrl}</p>
                </div>
                <div>
                  <p className="font-medium mb-0.5">提交人</p>
                  <p>{detailItem.userName || detailItem.userEmail || '未知'}</p>
                </div>
                <div>
                  <p className="font-medium mb-0.5">提交时间</p>
                  <p>{new Date(detailItem.createdAt).toLocaleString('zh-HK')}</p>
                </div>
              </div>

              {/* Attachments */}
              {detailItem.attachments && detailItem.attachments.length > 0 && (
                <div>
                  <p className="text-xs font-medium mb-2" style={{ color: '#9F927B' }}>
                    附件 ({detailItem.attachments.length})
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {detailItem.attachments.map(a => (
                      <a
                        key={a.url}
                        href={a.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs hover:border-[#C9A96E66] transition-colors"
                        style={{ background: '#1E1A14', border: '1px solid #2A2418', color: '#C4B89A' }}
                      >
                        {a.type.startsWith('image/') ? '🖼' : '📎'} {a.name}
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Conversation */}
              <div>
                <p className="text-xs font-medium mb-2 flex items-center gap-1.5" style={{ color: '#9F927B' }}>
                  聊天记录
                  {detailLoading && <Loader2 size={11} className="animate-spin" />}
                </p>
                {!detailLoading && detailItem.conversation.length === 0 ? (
                  <p className="text-xs" style={{ color: '#5A5040' }}>暂无聊天记录</p>
                ) : (
                  <div
                    className="rounded-lg p-3 space-y-2 max-h-72 overflow-y-auto"
                    style={{ background: '#0E0C08', border: '1px solid #1E1A14' }}
                  >
                    {detailItem.conversation.map((msg, i) => (
                      <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div
                          className="max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed"
                          style={
                            msg.role === 'user'
                              ? { background: '#C9A96E', color: '#0A0805' }
                              : { background: '#1E1A14', color: '#C4B89A', border: '1px solid #2A2418' }
                          }
                        >
                          {msg.content}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Copy prompt */}
              <Button
                size="sm"
                className="w-full"
                style={{ background: '#C9A96E', color: '#0A0805' }}
                onClick={() => copyDevPrompt(detailItem, detailItem.conversation)}
              >
                <ClipboardCopy size={14} className="mr-2" />
                复制为开发提示词
                {detailItem.status === 'PENDING' && (
                  <span className="ml-2 text-xs opacity-70">· 自动标记为处理中</span>
                )}
              </Button>

              {/* Status */}
              <div>
                <p className="text-xs font-medium mb-1.5" style={{ color: '#9F927B' }}>更新状态</p>
                <div className="flex gap-2 flex-wrap">
                  {STATUS_OPTIONS.filter(s => s.value !== 'ALL').map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      disabled={updatingId === detailItem.id}
                      onClick={() => updateStatus(detailItem.id, opt.value)}
                      className="text-xs px-3 py-1.5 rounded-lg border transition-colors"
                      style={{
                        borderColor: detailItem.status === opt.value ? '#C9A96E' : '#2A2418',
                        background: detailItem.status === opt.value ? 'rgba(201,169,110,0.15)' : 'transparent',
                        color: detailItem.status === opt.value ? '#C9A96E' : '#9F927B',
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function AdminFeedbackPage() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <div className="flex items-center gap-2 text-xs mb-2" style={{ color: '#7A7060' }}>
          <span>Dashboard</span>
          <span>/</span>
          <span style={{ color: 'var(--muted-foreground)' }}>需求迭代</span>
        </div>
        <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: 'var(--foreground)' }}>
          <MessageSquarePlus size={22} style={{ color: '#C9A96E' }} />
          需求迭代
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
          管理用户反馈、配置 AI 模型
        </p>
      </div>

      <Tabs defaultValue="requirements">
        <TabsList className="border-[#2A2418] bg-[#0E0E0A]">
          <TabsTrigger value="requirements" className="data-[state=active]:text-[#C9A96E]">
            需求列表
          </TabsTrigger>
          <TabsTrigger value="config" className="data-[state=active]:text-[#C9A96E]">
            模型配置
          </TabsTrigger>
        </TabsList>

        <TabsContent value="requirements" className="mt-4">
          <RequirementsTab />
        </TabsContent>

        <TabsContent value="config" className="mt-4">
          <ConfigTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
