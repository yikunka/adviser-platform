import type React from 'react'

/** Default input style for client KYC portal */
export const kycClientFieldStyle: React.CSSProperties = {
  width: '100%',
  background: 'var(--surface)',
  border: '1px solid var(--border-subtle)',
  color: 'var(--text-cream)',
  borderRadius: '0.375rem',
  padding: '0.5rem 0.75rem',
  fontSize: '0.875rem',
  outline: 'none',
  transition: 'border-color 150ms',
}

/** Admin edit form — uses theme CSS variables */
export const kycAdminFieldStyle: React.CSSProperties = {
  width: '100%',
  background: 'var(--surface)',
  border: '1px solid var(--border-subtle)',
  color: 'var(--foreground)',
  borderRadius: '0.375rem',
  padding: '0.5rem 0.75rem',
  fontSize: '0.875rem',
  outline: 'none',
}

export const kycSelectOptionStyle = { background: 'var(--surface-raised)' }
