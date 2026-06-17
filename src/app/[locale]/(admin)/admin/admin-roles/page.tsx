'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, ShieldCheck, Users, X, Check } from 'lucide-react'
import { PERMISSION_GROUPS, ACTION_LABELS, type PermAction } from '@/lib/auth/permissions'

// ── Types ──────────────────────────────────────────────────────────
type AdminRole = {
  id: string
  name: string
  description: string
  color: string
  permissions: string[]
  isSystem: boolean
  createdAt: string
  _count: { users: number }
}

// ── Permission matrix helpers ──────────────────────────────────────
const ALL_ACTIONS: PermAction[] = ['create', 'edit', 'delete', 'import', 'export', 'approve', 'complete']

function PermMatrix({
  permissions,
  onChange,
  readonly,
}: {
  permissions: Set<string>
  onChange: (next: Set<string>) => void
  readonly?: boolean
}) {
  function toggle(key: string) {
    if (readonly) return
    const next = new Set(permissions)
    if (next.has(key)) {
      next.delete(key)
      if (!key.includes('.')) {
        for (const a of ALL_ACTIONS) next.delete(`${key}.${a}`)
      }
    } else {
      next.add(key)
      if (key.includes('.')) next.add(key.split('.')[0])
    }
    onChange(next)
  }

  function togglePageAll(menuKey: string, actions: PermAction[]) {
    if (readonly || actions.length === 0) return
    const next = new Set(permissions)
    const allChecked = actions.every(a => next.has(`${menuKey}.${a}`))
    if (allChecked) {
      for (const a of actions) next.delete(`${menuKey}.${a}`)
    } else {
      next.add(menuKey)
      for (const a of actions) next.add(`${menuKey}.${a}`)
    }
    onChange(next)
  }

  function toggleGroupAll(pages: typeof PERMISSION_GROUPS[0]['pages']) {
    if (readonly) return
    const next = new Set(permissions)
    const allChecked = pages.every(
      p => next.has(p.menuKey) && p.actions.every(a => next.has(`${p.menuKey}.${a}`))
    )
    if (allChecked) {
      for (const p of pages) {
        next.delete(p.menuKey)
        for (const a of ALL_ACTIONS) next.delete(`${p.menuKey}.${a}`)
      }
    } else {
      for (const p of pages) {
        next.add(p.menuKey)
        for (const a of p.actions) next.add(`${p.menuKey}.${a}`)
      }
    }
    onChange(next)
  }

  return (
    <div className="space-y-6">
      {PERMISSION_GROUPS.map(group => {
        const groupAllChecked = group.pages.every(
          p => permissions.has(p.menuKey) && p.actions.every(a => permissions.has(`${p.menuKey}.${a}`))
        )
        const groupSomeChecked = group.pages.some(
          p => permissions.has(p.menuKey) || p.actions.some(a => permissions.has(`${p.menuKey}.${a}`))
        )

        return (
          <div key={group.group}>
            {/* Group header with select-all */}
            <div className="flex items-center gap-2 mb-2">
              <button
                type="button"
                title={groupAllChecked ? '取消全选此分组' : '全选此分组'}
                onClick={() => toggleGroupAll(group.pages)}
                disabled={readonly}
                className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0 transition-all"
                style={{
                  background: groupAllChecked ? '#C9A96E' : groupSomeChecked ? 'rgba(201,169,110,0.25)' : 'transparent',
                  border: `1px solid ${groupAllChecked || groupSomeChecked ? '#C9A96E' : '#4A3A28'}`,
                  cursor: readonly ? 'default' : 'pointer',
                }}
              >
                {groupAllChecked
                  ? <Check size={10} strokeWidth={3} style={{ color: '#0A0805' }} />
                  : groupSomeChecked
                    ? <span style={{ width: 8, height: 2, background: '#C9A96E', display: 'block', borderRadius: 1 }} />
                    : null
                }
              </button>
              <span className="text-xs font-bold uppercase tracking-widest"
                style={{ color: '#C9A96E' }}>{group.group}</span>
              <div className="flex-1 h-px" style={{ background: '#2A2418' }} />
            </div>

            <div className="rounded-lg overflow-hidden" style={{ border: '1px solid #2A2418' }}>
              {/* Column header */}
              <div className="grid text-center"
                style={{
                  gridTemplateColumns: `1fr repeat(${ALL_ACTIONS.length}, 44px)`,
                  background: '#111108',
                  borderBottom: '1px solid #2A2418',
                }}
              >
                <div className="px-3 py-2 text-left text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>
                  页面
                </div>
                {ALL_ACTIONS.map(a => (
                  <div key={a} className="py-2 text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>
                    {ACTION_LABELS[a]}
                  </div>
                ))}
              </div>

              {/* Rows */}
              {group.pages.map((page, idx) => {
                const hasView = permissions.has(page.menuKey)
                const pageAllActions = page.actions.length > 0 && page.actions.every(a => permissions.has(`${page.menuKey}.${a}`))
                const pageSomeActions = page.actions.some(a => permissions.has(`${page.menuKey}.${a}`))

                return (
                  <div
                    key={page.menuKey}
                    className="grid items-center"
                    style={{
                      gridTemplateColumns: `1fr repeat(${ALL_ACTIONS.length}, 44px)`,
                      borderBottom: idx < group.pages.length - 1 ? '1px solid #1A1810' : undefined,
                      background: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)',
                    }}
                  >
                    {/* Page name + view checkbox + select-all-actions */}
                    <div className="px-3 py-2.5 flex items-center gap-2">
                      <Checkbox
                        checked={hasView}
                        onChange={() => toggle(page.menuKey)}
                        disabled={readonly}
                      />
                      <span className="text-sm" style={{ color: hasView ? 'var(--foreground)' : 'var(--muted-foreground)' }}>
                        {page.label}
                      </span>
                      {page.actions.length > 0 && !readonly && (
                        <button
                          type="button"
                          onClick={() => togglePageAll(page.menuKey, page.actions)}
                          title={pageAllActions ? '取消全选操作' : '全选操作'}
                          className="ml-auto text-[10px] px-1.5 py-0.5 rounded transition-all flex-shrink-0"
                          style={{
                            color: pageAllActions ? '#0A0805' : pageSomeActions ? '#C9A96E' : '#4A3A28',
                            background: pageAllActions ? '#C9A96E' : pageSomeActions ? 'rgba(201,169,110,0.15)' : 'transparent',
                            border: `1px solid ${pageAllActions || pageSomeActions ? '#C9A96E44' : '#2A2418'}`,
                          }}
                        >
                          全
                        </button>
                      )}
                    </div>

                    {/* Action checkboxes */}
                    {ALL_ACTIONS.map(action => {
                      const key = `${page.menuKey}.${action}`
                      const applicable = page.actions.includes(action)
                      const checked = permissions.has(key)
                      return (
                        <div key={action} className="flex items-center justify-center py-2.5">
                          {applicable ? (
                            <Checkbox
                              checked={checked}
                              onChange={() => toggle(key)}
                              disabled={readonly || !hasView}
                              dim={!hasView}
                            />
                          ) : (
                            <span className="text-xs" style={{ color: '#2A2418' }}>—</span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function Checkbox({
  checked,
  onChange,
  disabled,
  dim,
}: {
  checked: boolean
  onChange: () => void
  disabled?: boolean
  dim?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onChange}
      disabled={disabled}
      className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0 transition-all"
      style={{
        background: checked ? '#C9A96E' : 'transparent',
        border: `1px solid ${checked ? '#C9A96E' : dim ? '#2A2418' : '#4A3A28'}`,
        opacity: disabled && !checked ? 0.35 : 1,
        cursor: disabled ? 'default' : 'pointer',
      }}
    >
      {checked && <Check size={10} strokeWidth={3} style={{ color: '#0A0805' }} />}
    </button>
  )
}

// ── Color presets ──────────────────────────────────────────────────
const COLOR_PRESETS = [
  '#6b7280', '#C9A96E', '#60a5fa', '#4ade80',
  '#f472b6', '#fb923c', '#a78bfa', '#f59e0b',
]

// ── Editor modal ───────────────────────────────────────────────────
function RoleEditor({
  role,
  onClose,
  onSaved,
}: {
  role: AdminRole | null
  onClose: () => void
  onSaved: () => void
}) {
  const [name, setName] = useState(role?.name ?? '')
  const [description, setDescription] = useState(role?.description ?? '')
  const [color, setColor] = useState(role?.color ?? '#6b7280')
  const [permissions, setPermissions] = useState<Set<string>>(
    () => new Set(role?.permissions ?? [])
  )
  const [saving, setSaving] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    try {
      const body = {
        name,
        description,
        color,
        permissions: Array.from(permissions),
      }
      const res = role
        ? await fetch(`/api/admin/roles/${role.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          })
        : await fetch('/api/admin/roles', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          })

      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? '保存失败'); return }
      toast.success(role ? '角色已更新' : '角色已创建')
      onSaved()
      onClose()
    } finally {
      setSaving(false)
    }
  }

  const permCount = permissions.size

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
    >
      <div
        className="w-full max-w-4xl rounded-2xl flex flex-col"
        style={{
          background: '#0d0d0d',
          border: '1px solid #2A2418',
          maxHeight: '92vh',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 flex-shrink-0"
          style={{ borderBottom: '1px solid #2A2418' }}>
          <h2 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>
            {role ? '编辑角色' : '创建角色'}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-md transition-colors"
            style={{ color: 'var(--muted-foreground)' }}>
            <X size={16} />
          </button>
        </div>

        <form onSubmit={submit} className="flex flex-col flex-1 min-h-0">
          {/* Basic info */}
          <div className="px-6 py-4 flex-shrink-0 grid grid-cols-2 gap-4"
            style={{ borderBottom: '1px solid #2A2418' }}>
            <div className="space-y-1.5">
              <label className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>
                角色名称 <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                required
                value={name}
                onChange={e => setName(e.target.value)}
                disabled={role?.isSystem}
                placeholder="e.g. CosmoCoat 操作员"
                className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                style={{ background: '#1A1A12', border: '1px solid #2A2418', color: 'var(--foreground)' }}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>
                描述
              </label>
              <input
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="角色描述（可选）"
                className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                style={{ background: '#1A1A12', border: '1px solid #2A2418', color: 'var(--foreground)' }}
              />
            </div>
            <div className="space-y-1.5 col-span-2">
              <label className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>
                角色颜色
              </label>
              <div className="flex items-center gap-2">
                {COLOR_PRESETS.map(c => (
                  <button
                    key={c} type="button"
                    onClick={() => setColor(c)}
                    className="w-6 h-6 rounded-full transition-all"
                    style={{
                      background: c,
                      outline: color === c ? `2px solid ${c}` : 'none',
                      outlineOffset: 2,
                    }}
                  />
                ))}
                <input
                  type="color" value={color}
                  onChange={e => setColor(e.target.value)}
                  className="w-6 h-6 rounded cursor-pointer"
                  style={{ border: 'none', padding: 0, background: 'transparent' }}
                  title="自定义颜色"
                />
                <span className="text-xs ml-1" style={{ color: 'var(--muted-foreground)' }}>
                  {permCount} 项权限
                </span>
              </div>
            </div>
          </div>

          {/* Permission matrix */}
          <div className="flex-1 overflow-y-auto px-6 py-4">
            <PermMatrix
              permissions={permissions}
              onChange={setPermissions}
              readonly={role?.isSystem}
            />
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-6 py-4 flex-shrink-0"
            style={{ borderTop: '1px solid #2A2418' }}>
            {role?.isSystem && (
              <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                系统内置角色，权限不可修改
              </p>
            )}
            <div className="flex gap-3 ml-auto">
              <button type="button" onClick={onClose}
                className="px-5 py-2 rounded-lg text-sm font-medium"
                style={{ border: '1px solid #2A2418', color: 'var(--muted-foreground)' }}>
                取消
              </button>
              {!role?.isSystem && (
                <button type="submit" disabled={saving || !name.trim()}
                  className="px-5 py-2 rounded-lg text-sm font-semibold disabled:opacity-50"
                  style={{ background: '#C9A96E', color: '#0A0805' }}>
                  {saving ? '保存中…' : '保存角色'}
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────
export default function AdminRolesPage() {
  const [roles, setRoles] = useState<AdminRole[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<AdminRole | null | 'new'>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/roles')
      const data = await res.json()
      if (!res.ok) { toast.error('加载失败'); return }
      setRoles(data.roles ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  async function handleDelete(role: AdminRole) {
    if (!confirm(`确认删除角色「${role.name}」？此操作不可撤销。`)) return
    setDeleting(role.id)
    try {
      const res = await fetch(`/api/admin/roles/${role.id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? '删除失败'); return }
      toast.success('角色已删除')
      await load()
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>角色管理</h1>
          <p className="text-sm mt-1.5" style={{ color: 'var(--muted-foreground)' }}>
            创建自定义角色，精确配置页面访问权限和操作按钮权限，再分配给团队成员。
          </p>
        </div>
        <button
          onClick={() => setEditing('new')}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold"
          style={{ background: '#C9A96E', color: '#0A0805' }}
        >
          <Plus size={15} />
          新建角色
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40" style={{ color: 'var(--muted-foreground)' }}>
          <div className="w-6 h-6 rounded-full border-2 animate-spin"
            style={{ borderColor: '#C9A96E', borderTopColor: 'transparent' }} />
        </div>
      ) : roles.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-40 rounded-xl gap-3"
          style={{ border: '1px dashed #2A2418', color: 'var(--muted-foreground)' }}>
          <ShieldCheck size={28} strokeWidth={1.2} />
          <p className="text-sm">暂无自定义角色，点击「新建角色」开始</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {roles.map(role => (
            <div
              key={role.id}
              className="rounded-xl px-5 py-4 flex items-center gap-4"
              style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
            >
              {/* Color badge */}
              <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: role.color + '22', border: `1px solid ${role.color}44` }}>
                <ShieldCheck size={16} style={{ color: role.color }} />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm" style={{ color: 'var(--foreground)' }}>
                    {role.name}
                  </span>
                  {role.isSystem && (
                    <span className="text-xs px-1.5 py-0.5 rounded"
                      style={{ background: 'rgba(201,169,110,0.12)', color: '#C9A96E' }}>
                      系统
                    </span>
                  )}
                </div>
                {role.description && (
                  <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--muted-foreground)' }}>
                    {role.description}
                  </p>
                )}
              </div>

              {/* Stats */}
              <div className="flex items-center gap-4 flex-shrink-0">
                <div className="text-center">
                  <p className="text-lg font-bold tabular-nums" style={{ color: role.color }}>
                    {role.permissions.length}
                  </p>
                  <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>权限项</p>
                </div>
                <div className="text-center">
                  <div className="flex items-center gap-1 justify-center">
                    <Users size={13} style={{ color: 'var(--muted-foreground)' }} />
                    <p className="text-lg font-bold tabular-nums" style={{ color: 'var(--foreground)' }}>
                      {role._count.users}
                    </p>
                  </div>
                  <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>用户</p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={() => setEditing(role)}
                  className="p-2 rounded-lg transition-colors"
                  style={{ color: 'var(--muted-foreground)' }}
                  title="编辑权限"
                >
                  <Pencil size={14} />
                </button>
                {!role.isSystem && (
                  <button
                    onClick={() => handleDelete(role)}
                    disabled={deleting === role.id}
                    className="p-2 rounded-lg transition-colors disabled:opacity-40"
                    style={{ color: 'var(--muted-foreground)' }}
                    title="删除角色"
                    onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
                    onMouseLeave={e => (e.currentTarget.style.color = 'var(--muted-foreground)')}
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {editing !== null && (
        <RoleEditor
          role={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={load}
        />
      )}
    </div>
  )
}
