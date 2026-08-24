'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { FinancialBreadcrumbs } from '@/components/admin/financial/FinancialBreadcrumbs'
import { useFinancialCompany } from '@/components/admin/financial/FinancialCompanyContext'
import {
  BS_REPORT_SECTIONS,
  PL_REPORT_SECTIONS,
  REPORT_SECTION_LABELS,
  type BsReportSection,
  type PlReportSection,
} from '@/lib/financial/report-structure'

type AccountLite = {
  id: string
  code: string
  name: string
  type: string
  level: number
  parentId: string | null
  sortOrder?: number
}

type StatementKind = 'INCOME_STATEMENT' | 'BALANCE_SHEET'

const fieldStyle: React.CSSProperties = {
  width: '100%',
  background: '#0A0A0A',
  border: '1px solid #2A2418',
  color: '#F0EAD8',
  borderRadius: '0.375rem',
  padding: '0.5rem 0.75rem',
  fontSize: '0.875rem',
  outline: 'none',
}

function SectionAccountPicker({
  section,
  label,
  accounts,
  selectedIds,
  onChange,
  disabled,
}: {
  section: string
  label: string
  accounts: AccountLite[]
  selectedIds: string[]
  onChange: (ids: string[]) => void
  disabled?: boolean
}) {
  const [q, setQ] = useState('')
  const selected = useMemo(() => new Set(selectedIds), [selectedIds])
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    if (!needle) return accounts
    return accounts.filter(a =>
      a.code.toLowerCase().includes(needle)
      || a.name.toLowerCase().includes(needle),
    )
  }, [accounts, q])

  function toggle(id: string) {
    if (disabled) return
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    onChange([...next])
  }

  return (
    <div
      className="rounded-lg overflow-hidden"
      style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
    >
      <div className="px-4 py-3 flex items-center justify-between gap-3" style={{ borderBottom: '1px solid #2A2418' }}>
        <div>
          <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>{label}</p>
          <p className="text-[11px] mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
            {section} · 已选 {selectedIds.length} 个科目（含子级）
          </p>
        </div>
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="筛选科目编码 / 名称"
          className="max-w-[14rem] text-xs"
          style={fieldStyle}
          disabled={disabled}
        />
      </div>
      <div className="max-h-56 overflow-y-auto divide-y divide-[#2A2418]">
        {filtered.length === 0 ? (
          <p className="px-4 py-6 text-xs text-center" style={{ color: 'var(--muted-foreground)' }}>无匹配科目</p>
        ) : filtered.map(account => {
          const checked = selected.has(account.id)
          return (
            <label
              key={account.id}
              className="flex items-center gap-3 px-4 py-2 text-sm cursor-pointer hover:bg-[#111108]"
              style={{ color: 'var(--foreground)', paddingLeft: `${0.75 + (account.level - 1) * 0.75}rem` }}
            >
              <input
                type="checkbox"
                checked={checked}
                disabled={disabled}
                onChange={() => toggle(account.id)}
              />
              <span className="font-mono text-xs" style={{ color: '#C9A96E' }}>{account.code}</span>
              <span className="truncate">{account.name}</span>
              <span className="ml-auto text-[10px]" style={{ color: 'var(--muted-foreground)' }}>L{account.level}</span>
            </label>
          )
        })}
      </div>
    </div>
  )
}

export default function FinancialSettingsPage() {
  const company = useFinancialCompany()
  const readOnly = company.financialReadOnly
  const [statement, setStatement] = useState<StatementKind>('INCOME_STATEMENT')
  const [accounts, setAccounts] = useState<AccountLite[]>([])
  const [selectedBySection, setSelectedBySection] = useState<Record<string, string[]>>({})
  const [configured, setConfigured] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const sectionKeys = statement === 'INCOME_STATEMENT' ? PL_REPORT_SECTIONS : BS_REPORT_SECTIONS

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(
        `/api/admin/financial/report-structure?companyId=${encodeURIComponent(company.id)}&statement=${statement}`,
      )
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || '加载失败')
      setAccounts(data.accounts ?? [])
      setConfigured(Boolean(data.configured))
      const next: Record<string, string[]> = {}
      for (const key of sectionKeys) {
        next[key] = (data.sections?.[key]?.accounts ?? []).map((a: AccountLite) => a.id)
      }
      setSelectedBySection(next)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }, [company.id, statement, sectionKeys])

  useEffect(() => {
    void load()
  }, [load])

  async function save() {
    setSaving(true)
    try {
      const mappings = sectionKeys.flatMap(section =>
        (selectedBySection[section] ?? []).map(accountId => ({ section, accountId })),
      )
      const res = await fetch('/api/admin/financial/report-structure', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId: company.id, statement, mappings }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || '保存失败')
      toast.success(data.toast || '已保存')
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  async function seedSuggestions() {
    if (!window.confirm('将按当前科目类型/编码推断覆盖本表的自定义映射，是否继续？')) return
    setSaving(true)
    try {
      const res = await fetch(
        `/api/admin/financial/report-structure?companyId=${encodeURIComponent(company.id)}&statement=${statement}`,
        { method: 'POST' },
      )
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || '初始化失败')
      toast.success(data.toast || '已写入建议映射')
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '初始化失败')
    } finally {
      setSaving(false)
    }
  }

  async function clearAll() {
    if (!window.confirm('清空后报表将恢复按科目类型/编码自动推断。确定？')) return
    setSelectedBySection(Object.fromEntries(sectionKeys.map(k => [k, []])))
    setSaving(true)
    try {
      const res = await fetch('/api/admin/financial/report-structure', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId: company.id, statement, mappings: [] }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || '清空失败')
      toast.success(data.toast || '已清空')
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '清空失败')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <div className="space-y-2">
        <FinancialBreadcrumbs section="财务设置" />
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>财务设置</h1>
            <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
              按公司配置利润表 / 资产负债表各分类由哪些科目构成。勾选一级科目会自动包含其下级。
              {configured
                ? ' 当前：已启用自定义结构。'
                : ' 当前：未配置，报表仍按科目类型与编码推断。'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" disabled={readOnly || saving || loading} onClick={() => void seedSuggestions()}>
              初始化建议
            </Button>
            <Button type="button" variant="outline" disabled={readOnly || saving || loading} onClick={() => void clearAll()} style={{ color: '#ef4444', borderColor: '#ef4444' }}>
              清空本表
            </Button>
            <Button type="button" disabled={readOnly || saving || loading} onClick={() => void save()}>
              {saving ? '保存中…' : '保存'}
            </Button>
          </div>
        </div>
      </div>

      <div className="flex gap-2">
        {([
          ['INCOME_STATEMENT', '利润表'],
          ['BALANCE_SHEET', '资产负债表'],
        ] as const).map(([value, label]) => {
          const active = statement === value
          return (
            <button
              key={value}
              type="button"
              onClick={() => setStatement(value)}
              className="px-3 py-1.5 rounded-full text-xs font-semibold"
              style={{
                background: active ? 'rgba(201,169,110,0.2)' : 'rgba(201,169,110,0.06)',
                color: active ? '#C9A96E' : 'var(--muted-foreground)',
                border: active ? '1px solid #C9A96E' : '1px solid transparent',
              }}
            >
              {label}
            </button>
          )
        })}
      </div>

      {readOnly && (
        <p className="text-xs rounded-md px-3 py-2" style={{ background: 'rgba(201,169,110,0.08)', color: '#C9A96E' }}>
          当前为只读权限；保存需财务经理或具备写入权限的帐号。
        </p>
      )}

      {loading ? (
        <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>加载中…</p>
      ) : (
        <div className="space-y-4">
          {sectionKeys.map(section => (
            <SectionAccountPicker
              key={section}
              section={section}
              label={REPORT_SECTION_LABELS[section as PlReportSection | BsReportSection]}
              accounts={accounts}
              selectedIds={selectedBySection[section] ?? []}
              disabled={readOnly || saving}
              onChange={ids => setSelectedBySection(prev => ({ ...prev, [section]: ids }))}
            />
          ))}
        </div>
      )}
    </div>
  )
}
