'use client'

/* eslint-disable react-hooks/set-state-in-effect */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, Search } from 'lucide-react'
import { formatProcessKitMaterialsSummary } from '@/lib/cosmocoat/process-kit-materials'

export type ProcessKitComboboxOption = {
  id: string
  code: string
  name: string
  status: string
  materials: string[]
  otherNote: string | null
}

type ProcessKitComboboxProps = {
  value?: string
  onSelect: (kit: ProcessKitComboboxOption) => void
  placeholder?: string
  inputStyle?: React.CSSProperties
  disabled?: boolean
  selectedIds?: string[]
}

function defaultInputStyle(): React.CSSProperties {
  return {
    background: '#0E0E0A',
    border: '1px solid #2A2418',
    color: 'var(--foreground)',
  }
}

function formatKitLabel(kit: ProcessKitComboboxOption) {
  return `${kit.code} · ${kit.name}`
}

export function ProcessKitCombobox({
  value = '',
  onSelect,
  placeholder = '搜索工艺书编号或名称...',
  inputStyle = defaultInputStyle(),
  disabled = false,
  selectedIds = [],
}: ProcessKitComboboxProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [options, setOptions] = useState<ProcessKitComboboxOption[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedKit, setSelectedKit] = useState<ProcessKitComboboxOption | null>(null)

  const displayValue = open ? search : (selectedKit ? formatKitLabel(selectedKit) : '')

  const fetchOptions = useCallback(async (query: string) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ limit: '50' })
      if (query.trim()) params.set('q', query.trim())
      const res = await fetch(`/api/admin/cosmocoat/sample-orders/picker/process-kits?${params}`)
      const data = await res.json()
      if (res.ok) {
        setOptions((data.items ?? []).map((kit: ProcessKitComboboxOption) => ({
          id: kit.id,
          code: kit.code,
          name: kit.name,
          status: kit.status,
          materials: kit.materials ?? [],
          otherNote: kit.otherNote ?? null,
        })))
      }
    } catch {
      /* non-blocking */
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!value) {
      setSelectedKit(null)
      return
    }
    if (selectedKit?.id === value) return

    let cancelled = false
    ;(async () => {
      try {
        const params = new URLSearchParams({ q: value, limit: '50' })
        const res = await fetch(`/api/admin/cosmocoat/sample-orders/picker/process-kits?${params}`)
        const data = await res.json()
        if (cancelled || !res.ok) return
        const match = ((data.items ?? []) as ProcessKitComboboxOption[]).find(item => item.id === value)
        if (match) setSelectedKit(match)
      } catch {
        /* ignore */
      }
    })()

    return () => {
      cancelled = true
    }
  }, [value, selectedKit?.id])

  useEffect(() => {
    if (!open) return
    const timer = setTimeout(() => {
      fetchOptions(search)
    }, search.trim() ? 250 : 0)
    return () => clearTimeout(timer)
  }, [open, search, fetchOptions])

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false)
        setSearch('')
      }
    }
    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [])

  const visibleOptions = useMemo(
    () => options.filter(option => !selectedIds.includes(option.id)),
    [options, selectedIds],
  )

  const emptyMessage = useMemo(() => {
    if (loading) return '加载中...'
    if (options.length > 0 && visibleOptions.length === 0) return '所有匹配工艺书均已添加'
    return '未找到匹配工艺书'
  }, [loading, options.length, visibleOptions.length])

  function selectKit(kit: ProcessKitComboboxOption) {
    setSelectedKit(kit)
    onSelect(kit)
    setOpen(false)
    setSearch('')
  }

  return (
    <div ref={containerRef} className="relative max-w-md">
      <div className="relative">
        <Search
          size={13}
          className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
          style={{ color: 'var(--muted-foreground)' }}
        />
        <input
          value={displayValue}
          onChange={e => {
            setSearch(e.target.value)
            if (!open) setOpen(true)
          }}
          onFocus={() => {
            setOpen(true)
            setSearch('')
          }}
          placeholder={placeholder}
          disabled={disabled}
          className="w-full rounded-lg pl-8 pr-9 py-2 text-sm outline-none disabled:opacity-60"
          style={inputStyle}
        />
        <ChevronDown
          size={14}
          className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
          style={{ color: 'var(--muted-foreground)' }}
        />
      </div>

      {open && (
        <div
          className="absolute z-50 mt-1 w-full max-h-72 overflow-y-auto rounded-lg shadow-lg"
          style={{ background: '#0E0E0A', border: '1px solid #2A2418' }}
        >
          {visibleOptions.length === 0 ? (
            <div className="px-3 py-4 text-sm text-center" style={{ color: 'var(--muted-foreground)' }}>
              {emptyMessage}
            </div>
          ) : (
            visibleOptions.map(kit => (
              <button
                key={kit.id}
                type="button"
                onMouseDown={e => e.preventDefault()}
                onClick={() => selectKit(kit)}
                className="w-full px-3 py-2.5 text-left text-sm transition-colors hover:bg-[#111108]"
                style={{
                  borderBottom: '1px solid #1E1C15',
                  color: kit.id === value ? '#C9A96E' : 'var(--foreground)',
                }}
              >
                <div className="font-medium">{formatKitLabel(kit)}</div>
                <div className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                  适用材料：{formatProcessKitMaterialsSummary(kit.materials, kit.otherNote) ?? '—'}
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
