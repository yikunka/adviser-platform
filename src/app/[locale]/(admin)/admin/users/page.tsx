'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { UserPlus, Search, Eye, EyeOff, Pencil, Trash2, Ban, CheckCircle } from 'lucide-react'

type User = {
  id: string
  email: string
  nameEn: string
  platform: 'ADVISER' | 'SFS_DIAMOND'
  isActive: boolean
  emailVerified: string | null
  createdAt: string
}

// ── Styles ────────────────────────────────────────────────────────────
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
  background: 'var(--surface-modal)',
  borderBottom: '1px solid var(--border-subtle)',
  whiteSpace: 'nowrap',
}

const td: React.CSSProperties = {
  padding: '0.75rem 1rem',
  fontSize: '0.875rem',
  color: 'var(--muted-foreground)',
  borderBottom: '1px solid #1E1C15',
}

function inputStyle(focused: boolean): React.CSSProperties {
  return {
    background: 'var(--surface-panel)',
    border: `1px solid ${focused ? '#C9A96E' : 'var(--border-subtle)'}`,
    color: 'var(--foreground)',
  }
}

// ── Add-User Modal ────────────────────────────────────────────────────
function AddUserModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [email, setEmail]       = useState('')
  const [nameEn, setNameEn]     = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw]     = useState(false)
  const [loading, setLoading]   = useState(false)
  const [focusField, setFocusField] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, nameEn, password }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(res.status === 409 ? 'This email is already registered.' : (data.error ?? 'Failed to create user.'))
        return
      }
      toast.success('User created successfully.')
      onCreated()
      onClose()
    } catch {
      toast.error('Failed to create user.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
    >
      <div
        className="w-full max-w-md rounded-2xl p-7 space-y-5"
        style={{ background: 'var(--surface-modal)', border: '1px solid var(--border-subtle)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold" style={{ color: 'var(--foreground)' }}>Add User</h2>
          <button onClick={onClose} className="text-sm px-3 py-1 rounded-md" style={{ color: 'var(--muted-foreground)' }}>✕</button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>Email Address</label>
            <input
              type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="user@example.com"
              className="w-full rounded-lg px-3 py-2.5 text-sm outline-none"
              style={inputStyle(focusField === 'email')}
              onFocus={() => setFocusField('email')} onBlur={() => setFocusField('')}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>Full Name</label>
            <input
              type="text" required value={nameEn} onChange={e => setNameEn(e.target.value)} placeholder="e.g. Kenny Wong"
              className="w-full rounded-lg px-3 py-2.5 text-sm outline-none"
              style={inputStyle(focusField === 'name')}
              onFocus={() => setFocusField('name')} onBlur={() => setFocusField('')}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>Password</label>
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'} required minLength={8} value={password}
                onChange={e => setPassword(e.target.value)} placeholder="Min. 8 characters"
                className="w-full rounded-lg px-3 py-2.5 pr-10 text-sm outline-none"
                style={inputStyle(focusField === 'pw')}
                onFocus={() => setFocusField('pw')} onBlur={() => setFocusField('')}
              />
              <button type="button" onClick={() => setShowPw(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--muted-foreground)' }}>
                {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>
          <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
            Creates an Advise (TCSP) client portal login. Manage SFS partner logins under SFS Customers.
          </p>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-lg text-sm font-medium" style={{ border: '1px solid var(--border-subtle)', color: 'var(--muted-foreground)' }}>Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 py-2.5 rounded-lg text-sm font-medium disabled:opacity-60" style={{ background: '#C9A96E', color: '#0A0805' }}>
              {loading ? 'Creating…' : 'Create User'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Edit-User Modal ───────────────────────────────────────────────────
function EditUserModal({ user, onClose, onSaved }: { user: User; onClose: () => void; onSaved: () => void }) {
  const [email, setEmail]   = useState(user.email)
  const [nameEn, setNameEn] = useState(user.nameEn)
  const [loading, setLoading] = useState(false)
  const [focusField, setFocusField] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, nameEn }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(res.status === 409 ? 'Email already in use.' : (data.error ?? 'Failed to update user.'))
        return
      }
      toast.success('User updated.')
      onSaved()
      onClose()
    } catch {
      toast.error('Failed to update user.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-md rounded-2xl p-7 space-y-5" style={{ background: 'var(--surface-modal)', border: '1px solid var(--border-subtle)' }}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold" style={{ color: 'var(--foreground)' }}>Edit User</h2>
          <button onClick={onClose} className="text-sm px-3 py-1 rounded-md" style={{ color: 'var(--muted-foreground)' }}>✕</button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>Email Address</label>
            <input
              type="email" required value={email} onChange={e => setEmail(e.target.value)}
              className="w-full rounded-lg px-3 py-2.5 text-sm outline-none"
              style={inputStyle(focusField === 'email')}
              onFocus={() => setFocusField('email')} onBlur={() => setFocusField('')}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>Full Name</label>
            <input
              type="text" required value={nameEn} onChange={e => setNameEn(e.target.value)}
              className="w-full rounded-lg px-3 py-2.5 text-sm outline-none"
              style={inputStyle(focusField === 'name')}
              onFocus={() => setFocusField('name')} onBlur={() => setFocusField('')}
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-lg text-sm font-medium" style={{ border: '1px solid var(--border-subtle)', color: 'var(--muted-foreground)' }}>Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 py-2.5 rounded-lg text-sm font-medium disabled:opacity-60" style={{ background: '#C9A96E', color: '#0A0805' }}>
              {loading ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Delete Confirm Modal ──────────────────────────────────────────────
function DeleteConfirmModal({ user, onClose, onDeleted }: { user: User; onClose: () => void; onDeleted: () => void }) {
  const [loading, setLoading] = useState(false)

  async function handleDelete() {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json()
        toast.error(data.error ?? 'Failed to delete user.')
        return
      }
      toast.success('User deleted.')
      onDeleted()
      onClose()
    } catch {
      toast.error('Failed to delete user.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-sm rounded-2xl p-7 space-y-5" style={{ background: 'var(--surface-modal)', border: '1px solid var(--border-subtle)' }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(239,68,68,0.15)' }}>
            <Trash2 size={18} style={{ color: '#ef4444' }} />
          </div>
          <div>
            <h2 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>Delete User</h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>This action cannot be undone.</p>
          </div>
        </div>
        <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
          Are you sure you want to permanently delete <span style={{ color: 'var(--foreground)', fontWeight: 500 }}>{user.nameEn}</span> ({user.email})?
        </p>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-lg text-sm font-medium" style={{ border: '1px solid var(--border-subtle)', color: 'var(--muted-foreground)' }}>Cancel</button>
          <button onClick={handleDelete} disabled={loading} className="flex-1 py-2.5 rounded-lg text-sm font-medium disabled:opacity-60" style={{ background: '#ef4444', color: '#fff' }}>
            {loading ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────
export default function AdminUsersPage() {
  const [users, setUsers]             = useState<User[]>([])
  const [loading, setLoading]         = useState(true)
  const [search, setSearch]           = useState('')
  const [showAddModal, setShowAddModal]   = useState(false)
  const [editTarget, setEditTarget]       = useState<User | null>(null)
  const [deleteTarget, setDeleteTarget]   = useState<User | null>(null)
  const [togglingId, setTogglingId]       = useState<string | null>(null)

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search.trim()) params.set('q', search.trim())
      const res = await fetch(`/api/admin/users?${params}`)
      const data = await res.json()
      setUsers(data.users ?? [])
    } catch {
      toast.error('Failed to load users.')
    } finally {
      setLoading(false)
    }
  }, [search])

  useEffect(() => {
    const t = setTimeout(fetchUsers, search ? 300 : 0)
    return () => clearTimeout(t)
  }, [fetchUsers, search])

  async function toggleActive(user: User) {
    setTogglingId(user.id)
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !user.isActive }),
      })
      if (!res.ok) {
        const data = await res.json()
        toast.error(data.error ?? 'Failed to update user.')
        return
      }
      toast.success(user.isActive ? 'User disabled.' : 'User enabled.')
      fetchUsers()
    } catch {
      toast.error('Failed to update user.')
    } finally {
      setTogglingId(null)
    }
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>Advise Customer Accounts</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
            TCSP / Advise client portal logins only. SFS partners are managed under SFS Customers.
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-opacity hover:opacity-85"
          style={{ background: '#C9A96E', color: '#0A0805' }}
        >
          <UserPlus size={15} />
          Add User
        </button>
      </div>

      {/* Filters */}
      <div style={card} className="p-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 sm:max-w-xs">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--muted-foreground)' }} />
          <input
            type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search email or name…"
            className="w-full pl-8 pr-3 py-2 rounded-lg text-sm outline-none"
            style={{ background: 'var(--surface-input)', border: '1px solid var(--border-subtle)', color: 'var(--foreground)' }}
            onFocus={e => (e.currentTarget.style.borderColor = '#C9A96E')}
            onBlur={e => (e.currentTarget.style.borderColor = 'var(--border-subtle)')}
          />
        </div>
      </div>

      {/* Table */}
      <div style={{ ...card, overflow: 'hidden' }}>
        {loading ? (
          <div className="py-16 text-center text-sm" style={{ color: 'var(--muted-foreground)' }}>Loading…</div>
        ) : users.length === 0 ? (
          <div className="py-16 text-center text-sm" style={{ color: '#5A5040' }}>No users found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th style={th}>Email</th>
                  <th style={th}>Name</th>
                  <th style={th}>Status</th>
                  <th style={th}>Joined</th>
                  <th style={{ ...th, textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => {
                  const verified = !!u.emailVerified
                  const disabled = !u.isActive
                  return (
                    <tr
                      key={u.id}
                      className="cursor-pointer transition-colors hover:bg-[var(--surface-modal)]"
                      style={{ opacity: disabled ? 0.6 : 1 }}
                      onClick={() => setEditTarget(u)}
                      tabIndex={0}
                      onKeyDown={e => {
                        if (e.key === 'Enter' || e.key === ' ') setEditTarget(u)
                      }}
                    >
                      <td style={{ ...td, color: 'var(--foreground)', fontWeight: 500 }}>{u.email}</td>
                      <td style={td}>{u.nameEn}</td>
                      <td style={td}>
                        {disabled ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444' }}>
                            <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#ef4444' }} />
                            Disabled
                          </span>
                        ) : verified ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: 'rgba(16,185,129,0.12)', color: '#10b981' }}>
                            <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#10b981' }} />
                            Verified
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: 'rgba(120,113,108,0.15)', color: '#7A6A58' }}>
                            <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#7A6A58' }} />
                            Pending
                          </span>
                        )}
                      </td>
                      <td style={td}>{new Date(u.createdAt).toLocaleDateString('en-HK')}</td>
                      <td style={{ ...td, textAlign: 'right' }}>
                        <div className="flex items-center justify-end gap-1">
                          {/* Edit */}
                          <button
                            onClick={e => { e.stopPropagation(); setEditTarget(u) }}
                            title="Edit user"
                            className="p-1.5 rounded-md transition-colors"
                            style={{ color: 'var(--muted-foreground)' }}
                            onMouseEnter={e => (e.currentTarget.style.color = '#C9A96E')}
                            onMouseLeave={e => (e.currentTarget.style.color = 'var(--muted-foreground)')}
                          >
                            <Pencil size={14} />
                          </button>
                          {/* Disable / Enable */}
                          <button
                            onClick={e => { e.stopPropagation(); toggleActive(u) }}
                            disabled={togglingId === u.id}
                            title={disabled ? 'Enable user' : 'Disable user'}
                            className="p-1.5 rounded-md transition-colors disabled:opacity-40"
                            style={{ color: 'var(--muted-foreground)' }}
                            onMouseEnter={e => (e.currentTarget.style.color = disabled ? '#10b981' : '#f59e0b')}
                            onMouseLeave={e => (e.currentTarget.style.color = 'var(--muted-foreground)')}
                          >
                            {disabled ? <CheckCircle size={14} /> : <Ban size={14} />}
                          </button>
                          {/* Delete */}
                          <button
                            onClick={e => { e.stopPropagation(); setDeleteTarget(u) }}
                            title="Delete user"
                            className="p-1.5 rounded-md transition-colors"
                            style={{ color: 'var(--muted-foreground)' }}
                            onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
                            onMouseLeave={e => (e.currentTarget.style.color = 'var(--muted-foreground)')}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Count */}
      {!loading && users.length > 0 && (
        <p className="text-xs" style={{ color: '#5A5040' }}>
          {users.length} user{users.length !== 1 ? 's' : ''} found
        </p>
      )}

      {/* Modals */}
      {showAddModal && (
        <AddUserModal onClose={() => setShowAddModal(false)} onCreated={fetchUsers} />
      )}
      {editTarget && (
        <EditUserModal user={editTarget} onClose={() => setEditTarget(null)} onSaved={fetchUsers} />
      )}
      {deleteTarget && (
        <DeleteConfirmModal user={deleteTarget} onClose={() => setDeleteTarget(null)} onDeleted={fetchUsers} />
      )}
    </div>
  )
}
