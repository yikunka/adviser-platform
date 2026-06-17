'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import type { Platform, UserRole } from '@prisma/client'
import { ADMIN_MENU_OPTIONS, ADMIN_PLATFORM_OPTIONS, type AdminMenuKey } from '@/lib/auth/admin-access'
import { UserPlus, Pencil, Trash2, Ban, CheckCircle, ShieldCheck } from 'lucide-react'

type AdminRoleStub = { id: string; name: string; color: string }

type TeamUser = {
  id: string
  email: string
  nameEn: string
  role: UserRole
  isActive: boolean
  adminPlatforms: Platform[]
  adminMenuKeys: string[]
  adminRoles: AdminRoleStub[]
  emailVerified: string | null
  createdAt: string
}

const card: React.CSSProperties = {
  background: 'var(--card)',
  border: '1px solid var(--border)',
  borderRadius: '0.75rem',
}

const th: React.CSSProperties = {
  textAlign: 'left',
  padding: '0.75rem 1rem',
  fontWeight: 500,
  fontSize: '0.8125rem',
  color: 'var(--muted-foreground)',
  background: '#111108',
  borderBottom: '1px solid #2A2418',
}

const td: React.CSSProperties = {
  padding: '0.75rem 1rem',
  fontSize: '0.875rem',
  color: 'var(--muted-foreground)',
  borderBottom: '1px solid #1E1C15',
}

function RoleLabel({ role }: { role: UserRole }) {
  const t = useTranslations('admin.team')
  if (role === 'SUPER_ADMIN') return <span>{t('roleSuper')}</span>
  if (role === 'COMPLIANCE') return <span>{t('roleCompliance')}</span>
  return <span>{t('roleStaff')}</span>
}

function FormFields({
  role,
  setRole,
  platforms,
  togglePlatform,
  menus,
  toggleMenu,
  adminRoleIds,
  toggleAdminRole,
  availableRoles,
}: {
  role: UserRole
  setRole: (r: UserRole) => void
  platforms: Set<Platform>
  togglePlatform: (p: Platform) => void
  menus: Set<AdminMenuKey>
  toggleMenu: (k: AdminMenuKey) => void
  adminRoleIds: Set<string>
  toggleAdminRole: (id: string) => void
  availableRoles: AdminRoleStub[]
}) {
  const t = useTranslations('admin.team')
  const byGroup = useMemo(() => {
    const g = new Map<string, typeof ADMIN_MENU_OPTIONS>()
    for (const opt of ADMIN_MENU_OPTIONS) {
      if (opt.key === 'adminTeam') continue // super-only, not assignable here
      const arr = g.get(opt.group) ?? []
      arr.push(opt)
      g.set(opt.group, arr)
    }
    return g
  }, [])

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <label className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>
          {t('role')}
        </label>
        <select
          value={role}
          onChange={e => setRole(e.target.value as UserRole)}
          className="w-full rounded-lg px-3 py-2.5 text-sm outline-none"
          style={{ background: '#1A1A12', border: '1px solid #2A2418', color: 'var(--foreground)' }}
        >
          <option value="STAFF">Staff</option>
          <option value="COMPLIANCE">Compliance</option>
          <option value="SUPER_ADMIN">Super Admin</option>
        </select>
      </div>

      {availableRoles.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>
            {t('dynamicRole')}
          </p>
          <div className="rounded-lg p-3 space-y-2" style={{ background: '#0E0E0A', border: '1px solid #2A2418' }}>
            {availableRoles.map(r => {
              const checked = adminRoleIds.has(r.id)
              return (
                <label key={r.id} className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleAdminRole(r.id)}
                    className="rounded"
                  />
                  <span
                    className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium"
                    style={{ background: r.color + '22', color: r.color, border: `1px solid ${r.color}44` }}
                  >
                    <ShieldCheck size={11} />
                    {r.name}
                  </span>
                </label>
              )
            })}
          </div>
          {adminRoleIds.size > 0 && (
            <p className="text-[11px]" style={{ color: '#6A5A40' }}>
              {t('dynamicRoleNote')}
            </p>
          )}
        </div>
      )}

      <div className="space-y-2">
        <p className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>
          {t('platforms')}
        </p>
        <div className="flex flex-wrap gap-2">
          {ADMIN_PLATFORM_OPTIONS.map(p => (
            <label key={p.value} className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={platforms.has(p.value)}
                onChange={() => togglePlatform(p.value)}
              />
              <span style={{ color: 'var(--foreground)' }}>{p.label}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>
          {t('menus')}
        </p>
        <div className="space-y-3 max-h-52 overflow-y-auto pr-1">
          {[...byGroup.entries()].map(([group, opts]) => (
            <div key={group}>
              <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: '#6A5A40' }}>
                {group}
              </p>
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                {opts.map(o => (
                  <label key={o.key} className="flex items-center gap-2 text-xs cursor-pointer">
                    <input type="checkbox" checked={menus.has(o.key)} onChange={() => toggleMenu(o.key)} />
                    <span style={{ color: 'var(--foreground)' }}>{o.label}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function EditorModal({
  mode,
  user,
  onClose,
  onSaved,
}: {
  mode: 'create' | 'edit'
  user: TeamUser | null
  onClose: () => void
  onSaved: () => void
}) {
  const t = useTranslations('admin.team')
  const [email, setEmail] = useState(user?.email ?? '')
  const [nameEn, setNameEn] = useState(user?.nameEn ?? '')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<UserRole>(user?.role ?? 'STAFF')
  const [platforms, setPlatforms] = useState<Set<Platform>>(
    () => new Set(user?.adminPlatforms ?? []),
  )
  const [menus, setMenus] = useState<Set<AdminMenuKey>>(
    () => new Set((user?.adminMenuKeys ?? []) as AdminMenuKey[]),
  )
  const [adminRoleIds, setAdminRoleIds] = useState<Set<string>>(
    () => new Set((user?.adminRoles ?? []).map(r => r.id)),
  )
  const [availableRoles, setAvailableRoles] = useState<AdminRoleStub[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetch('/api/admin/roles')
      .then(r => r.json())
      .then(d => setAvailableRoles(d.roles ?? []))
      .catch(() => {})
  }, [])

  const togglePlatform = (p: Platform) => {
    setPlatforms(prev => {
      const n = new Set(prev)
      if (n.has(p)) n.delete(p)
      else n.add(p)
      return n
    })
  }

  const toggleMenu = (k: AdminMenuKey) => {
    setMenus(prev => {
      const n = new Set(prev)
      if (n.has(k)) n.delete(k)
      else n.add(k)
      return n
    })
  }

  const toggleAdminRole = (id: string) => {
    setAdminRoleIds(prev => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      if (mode === 'create') {
        const res = await fetch('/api/admin/team', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email,
            nameEn,
            password,
            role,
            adminPlatforms: [...platforms],
            adminMenuKeys: [...menus],
            adminRoleIds: [...adminRoleIds],
          }),
        })
        const data = await res.json()
        if (!res.ok) {
          toast.error(data.error ?? 'Failed')
          return
        }
        toast.success(t('created'))
      } else if (user) {
        const body: Record<string, unknown> = {
          email,
          nameEn,
          role,
          adminPlatforms: [...platforms],
          adminMenuKeys: [...menus],
          adminRoleIds: [...adminRoleIds],
        }
        if (password.length >= 8) body.password = password
        const res = await fetch(`/api/admin/team/${user.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        const data = await res.json()
        if (!res.ok) {
          toast.error(data.error ?? 'Failed')
          return
        }
        toast.success(t('saved'))
      }
      onSaved()
      onClose()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
      onClick={e => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="w-full max-w-lg rounded-2xl p-7 space-y-5 max-h-[90vh] overflow-y-auto"
        style={{ background: '#111111', border: '1px solid #2A2418' }}
      >
        <h2 className="text-lg font-semibold" style={{ color: 'var(--foreground)' }}>
          {mode === 'create' ? t('createTitle') : t('editTitle')}
        </h2>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>
              {t('email')}
            </label>
            <input
              required
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full rounded-lg px-3 py-2.5 text-sm outline-none"
              style={{ background: '#1A1A12', border: '1px solid #2A2418', color: 'var(--foreground)' }}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>
              {t('name')}
            </label>
            <input
              required
              value={nameEn}
              onChange={e => setNameEn(e.target.value)}
              className="w-full rounded-lg px-3 py-2.5 text-sm outline-none"
              style={{ background: '#1A1A12', border: '1px solid #2A2418', color: 'var(--foreground)' }}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>
              {mode === 'create' ? t('password') : t('passwordNew')}
            </label>
            <input
              type="password"
              required={mode === 'create'}
              minLength={mode === 'create' ? 8 : undefined}
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full rounded-lg px-3 py-2.5 text-sm outline-none"
              style={{ background: '#1A1A12', border: '1px solid #2A2418', color: 'var(--foreground)' }}
            />
          </div>
          <FormFields
            role={role}
            setRole={setRole}
            platforms={platforms}
            togglePlatform={togglePlatform}
            menus={menus}
            toggleMenu={toggleMenu}
            adminRoleIds={adminRoleIds}
            toggleAdminRole={toggleAdminRole}
            availableRoles={availableRoles}
          />
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-lg text-sm font-medium"
              style={{ border: '1px solid #2A2418', color: 'var(--muted-foreground)' }}
            >
              {t('cancel')}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2.5 rounded-lg text-sm font-medium disabled:opacity-60"
              style={{ background: '#C9A96E', color: '#0A0805' }}
            >
              {loading ? '…' : t('save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function AdminTeamPage() {
  const t = useTranslations('admin.team')
  const [users, setUsers] = useState<TeamUser[]>([])
  const [loading, setLoading] = useState(true)
  const [editorMode, setEditorMode] = useState<'create' | 'edit' | null>(null)
  const [editUser, setEditUser] = useState<TeamUser | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/team')
      const data = await res.json()
      if (!res.ok) {
        toast.error(t('loadFailed'))
        return
      }
      setUsers(data.users ?? [])
    } catch {
      toast.error(t('loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial `/api/admin/team` fetch
    void load()
  }, [load])

  async function toggleActive(u: TeamUser) {
    const res = await fetch(`/api/admin/team/${u.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !u.isActive }),
    })
    if (!res.ok) {
      const d = await res.json()
      toast.error(d.error ?? 'Failed')
      return
    }
    toast.success(t('saved'))
    load()
  }

  async function remove(u: TeamUser) {
    if (!confirm(t('confirmDelete'))) return
    const res = await fetch(`/api/admin/team/${u.id}`, { method: 'DELETE' })
    if (!res.ok) {
      const d = await res.json()
      toast.error(d.error ?? 'Failed')
      return
    }
    toast.success(t('deleted'))
    load()
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>
            {t('title')}
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
            {t('subtitle')}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setEditUser(null)
            setEditorMode('create')
          }}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
          style={{ background: '#C9A96E', color: '#0A0805' }}
        >
          <UserPlus size={15} />
          {t('add')}
        </button>
      </div>

      <div style={{ ...card, overflow: 'hidden' }}>
        {loading ? (
          <div className="py-16 text-center text-sm" style={{ color: 'var(--muted-foreground)' }}>
            …
          </div>
        ) : users.length === 0 ? (
          <div className="py-16 text-center text-sm" style={{ color: '#5A5040' }}>
            —
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th style={th}>{t('email')}</th>
                  <th style={th}>{t('name')}</th>
                  <th style={th}>{t('role')}</th>
                  <th style={th}>{t('dynamicRole')}</th>
                  <th style={th}>{t('platforms')}</th>
                  <th style={th}>{t('menus')}</th>
                  <th style={th}>{t('status')}</th>
                  <th style={{ ...th, textAlign: 'right' }}>{t('actions')}</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => {
                  const legacy =
                    u.adminMenuKeys.length === 0 &&
                    u.adminPlatforms.length === 0 &&
                    u.adminRoles.length === 0 &&
                    u.role !== 'SUPER_ADMIN'
                  const superFull = u.role === 'SUPER_ADMIN'
                  return (
                    <tr
                      key={u.id}
                      className="cursor-pointer transition-colors hover:bg-[#111108]"
                      onClick={() => {
                        setEditUser(u)
                        setEditorMode('edit')
                      }}
                      tabIndex={0}
                      onKeyDown={e => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          setEditUser(u)
                          setEditorMode('edit')
                        }
                      }}
                    >
                      <td style={{ ...td, color: 'var(--foreground)', fontWeight: 500 }}>{u.email}</td>
                      <td style={td}>{u.nameEn}</td>
                      <td style={td}>
                        <RoleLabel role={u.role} />
                      </td>
                      <td style={td}>
                        {u.adminRoles.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {u.adminRoles.map(r => (
                              <span
                                key={r.id}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium"
                                style={{ background: r.color + '22', color: r.color, border: `1px solid ${r.color}44` }}
                              >
                                <ShieldCheck size={11} />
                                {r.name}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span style={{ color: '#3A3020' }}>—</span>
                        )}
                      </td>
                      <td style={td} className="max-w-[140px] truncate" title={u.adminPlatforms.join(', ')}>
                        {superFull
                          ? '—'
                          : u.adminPlatforms.length
                            ? u.adminPlatforms.join(', ')
                            : legacy
                              ? t('legacyAccess')
                              : '—'}
                      </td>
                      <td style={td} className="max-w-[200px] truncate" title={u.adminMenuKeys.join(', ')}>
                        {superFull
                          ? '—'
                          : u.adminMenuKeys.length
                            ? u.adminMenuKeys.join(', ')
                            : legacy
                              ? t('legacyAccess')
                              : '—'}
                      </td>
                      <td style={td}>{u.isActive ? t('active') : t('disabled')}</td>
                      <td style={{ ...td, textAlign: 'right' }}>
                        <button
                          type="button"
                          className="p-1.5 rounded-md inline-flex"
                          onClick={e => {
                            e.stopPropagation()
                            setEditUser(u)
                            setEditorMode('edit')
                          }}
                        >
                          <Pencil size={14} />
                        </button>
                        <button type="button" className="p-1.5 rounded-md inline-flex" onClick={e => { e.stopPropagation(); toggleActive(u) }}>
                          {u.isActive ? <Ban size={14} /> : <CheckCircle size={14} />}
                        </button>
                        <button type="button" className="p-1.5 rounded-md inline-flex" onClick={e => { e.stopPropagation(); remove(u) }}>
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editorMode && (
        <EditorModal
          key={editorMode === 'edit' ? editUser?.id ?? 'x' : 'new'}
          mode={editorMode}
          user={editUser}
          onClose={() => {
            setEditorMode(null)
            setEditUser(null)
          }}
          onSaved={load}
        />
      )}
    </div>
  )
}
