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
      className={`p-2 rounded-md transition-colors ${className}`}
      style={{
        color: 'var(--muted-foreground)',
        background: ready && isDay ? 'var(--accent)' : 'transparent',
        opacity: ready ? 1 : 0.6,
      }}
      aria-label={isDay ? 'Switch to night view' : 'Switch to day view'}
      title={isDay ? 'Night view' : 'Day view'}
    >
      {isDay ? <Moon size={16} strokeWidth={1.75} /> : <Sun size={16} strokeWidth={1.75} />}
    </button>
  )
}
