'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

export type PlatformTheme = 'night' | 'day'

const STORAGE_KEY = '6am-platform-theme'

type PlatformThemeContextValue = {
  theme: PlatformTheme
  ready: boolean
  setTheme: (theme: PlatformTheme) => void
  toggleTheme: () => void
  themeClass: 'theme-dark' | 'theme-day'
}

const PlatformThemeContext = createContext<PlatformThemeContextValue | null>(null)

function readStoredTheme(): PlatformTheme {
  if (typeof window === 'undefined') return 'night'
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (stored === 'day' || stored === 'night') return stored
  } catch {
    /* ignore */
  }
  return 'night'
}

function applyDocumentTheme(theme: PlatformTheme) {
  const root = document.documentElement
  root.classList.remove('theme-dark', 'theme-day', 'dark')
  root.classList.add(theme === 'day' ? 'theme-day' : 'theme-dark')
  if (theme === 'night') root.classList.add('dark')
  root.setAttribute('data-ui-theme', theme)
  root.style.colorScheme = theme === 'day' ? 'light' : 'dark'
}

function clearDocumentTheme() {
  const root = document.documentElement
  root.classList.remove('theme-dark', 'theme-day', 'dark')
  root.removeAttribute('data-ui-theme')
  root.style.colorScheme = ''
}

export function PlatformThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<PlatformTheme>('night')
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const initial = readStoredTheme()
    setThemeState(initial)
    applyDocumentTheme(initial)
    setReady(true)
    return () => clearDocumentTheme()
  }, [])

  useEffect(() => {
    if (!ready) return
    applyDocumentTheme(theme)
  }, [theme, ready])

  const setTheme = useCallback((next: PlatformTheme) => {
    setThemeState(next)
    try {
      window.localStorage.setItem(STORAGE_KEY, next)
    } catch {
      /* ignore */
    }
  }, [])

  const toggleTheme = useCallback(() => {
    setThemeState(current => {
      const next: PlatformTheme = current === 'night' ? 'day' : 'night'
      try {
        window.localStorage.setItem(STORAGE_KEY, next)
      } catch {
        /* ignore */
      }
      return next
    })
  }, [])

  const value = useMemo<PlatformThemeContextValue>(
    () => ({
      theme,
      ready,
      setTheme,
      toggleTheme,
      themeClass: theme === 'day' ? 'theme-day' : 'theme-dark',
    }),
    [theme, ready, setTheme, toggleTheme],
  )

  return (
    <PlatformThemeContext.Provider value={value}>
      {children}
    </PlatformThemeContext.Provider>
  )
}

export function usePlatformTheme() {
  const ctx = useContext(PlatformThemeContext)
  if (!ctx) {
    throw new Error('usePlatformTheme must be used within PlatformThemeProvider')
  }
  return ctx
}
