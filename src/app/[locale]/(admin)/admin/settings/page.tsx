'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'

type StaffUser = {
  id: string
  nameEn: string
  email: string
  role: string
  createdAt: string
}

const ROLE_COLOR: Record<string, string> = {
  SUPER_ADMIN: 'bg-[rgba(239,68,68,0.12)] text-[#ef4444]',
  COMPLIANCE:  'bg-[rgba(245,158,11,0.12)] text-[#f59e0b]',
  STAFF:       'bg-[rgba(120,113,108,0.15)] text-[#9A8060]',
}

const cardStyle: React.CSSProperties = {
  background: 'var(--card)',
  border: '1px solid var(--border)',
  borderRadius: '0.75rem',
  padding: '1.5rem',
}

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '0.75rem 1rem',
  fontWeight: 500,
  fontSize: '0.875rem',
  color: 'var(--muted-foreground)',
  background: '#1A1A12',
  borderBottom: '1px solid #2A2418',
}

const tdStyle: React.CSSProperties = {
  padding: '0.75rem 1rem',
  fontSize: '0.875rem',
  color: 'var(--muted-foreground)',
}

export default function AdminSettingsPage() {
  const [staff, setStaff] = useState<StaffUser[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/admin/staff')
      .then(r => r.json())
      .then(data => { setStaff(data.staff ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>Settings</h1>

      {/* Staff users */}
      <div style={cardStyle}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>Staff Accounts</h2>
        </div>

        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '0.5rem', overflow: 'hidden' }}>
          {loading ? (
            <div className="px-4 py-8 text-center text-sm" style={{ color: 'var(--muted-foreground)' }}>Loading...</div>
          ) : staff.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm" style={{ color: '#5A5040' }}>No staff accounts found</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th style={thStyle}>Name</th>
                  <th style={thStyle}>Email</th>
                  <th style={thStyle}>Role</th>
                  <th style={thStyle}>Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2A2418]">
                {staff.map(u => (
                  <tr key={u.id} className="hover:bg-[#1A1A12] transition-colors">
                    <td style={{ ...tdStyle, color: 'var(--foreground)', fontWeight: 500 }}>{u.nameEn}</td>
                    <td style={tdStyle}>{u.email}</td>
                    <td style={tdStyle}>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_COLOR[u.role] ?? 'bg-[rgba(120,113,108,0.15)] text-[#9A8060]'}`}>
                        {u.role}
                      </span>
                    </td>
                    <td style={tdStyle}>{new Date(u.createdAt).toLocaleDateString('en-HK')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Platform info */}
      <div style={cardStyle} className="space-y-4">
        <h2 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>Platform</h2>
        <div className="grid sm:grid-cols-2 gap-4 text-sm">
          {[
            ['Application', '6AM Advisory Platform'],
            ['Version', '1.0.0'],
            ['Environment', process.env.NODE_ENV ?? 'production'],
          ].map(([label, value]) => (
            <div key={label} className="flex justify-between py-2 border-b border-[#2A2418]">
              <span style={{ color: 'var(--muted-foreground)' }}>{label}</span>
              <span style={{ color: 'var(--foreground)' }}>{value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
