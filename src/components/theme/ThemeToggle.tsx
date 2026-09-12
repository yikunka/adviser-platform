'use client'

import { Moon, Sun } from 'lucide-react'
import { usePlatformTheme } from '@/components/theme/PlatformThemeProvider'

export function ThemeToggle({ className = '' }: { className?: string }) {
  const { theme, toggleTheme, ready } = usePlatformTheme()
  const isDay = theme === 'day'

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`inline-flex items-center justify-center rounded-md transition-colors ${className}`}
      style={{
        width: 34,
        height: 34,
        color: isDay ? 'var(--gold-muted)' : 'var(--muted-foreground)',
        background: isDay ? 'var(--accent)' : 'transparent',
        border: `1px solid ${isDay ? 'var(--border-subtle)' : 'transparent'}`,
        opacity: ready ? 1 : 0.55,
      }}
      aria-label={isDay ? 'Switch to night view' : 'Switch to day view'}
      title={isDay ? 'Night view' : 'Day view'}
    >
      {isDay ? <Moon size={15} strokeWidth={1.75} /> : <Sun size={15} strokeWidth={1.75} />}
    </button>
  )
}
