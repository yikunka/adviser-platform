'use client'

import { type KeyboardEvent, type Ref, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, Search } from 'lucide-react'

export type AccountPickerOption = {
  id: string
  code: string
  name: string
  type: string
}

type AccountComboboxProps = {
  value: string
  companyId: string
  onChange: (accountId: string) => void
  placeholder?: string
  inputClassName?: string
  disabled?: boolean
  inputRef?: Ref<HTMLInputElement>
  onInputKeyDown?: (event: KeyboardEvent<HTMLInputElement>) => void
}

function formatAccountLabel(account: AccountPickerOption): string {
  return `${account.code} - ${account.name}`
}

export function AccountCombobox({
  value,
  companyId,
  onChange,
  placeholder = '搜索科目编码或名称...',
  inputClassName = '',
  disabled = false,
  inputRef,
  onInputKeyDown,
}: AccountComboboxProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [options, setOptions] = useState<AccountPickerOption[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedAccount, setSelectedAccount] = useState<AccountPickerOption | null>(null)

  const displayValue = open ? search : selectedAccount ? formatAccountLabel(selectedAccount) : ''

  const fetchOptions = useCallback(
    async (query: string) => {
      if (!companyId) {
        setOptions([])
        return
      }
      setLoading(true)
      try {
        const params = new URLSearchParams({ companyId, limit: '50' })
        if (query.trim()) params.set('q', query.trim())
        const res = await fetch(`/api/admin/financial/accounts/picker-options?${params}`)
        const data = await res.json()
        if (res.ok) {
          setOptions(data.items ?? [])
        }
      } catch {
        /* non-blocking */
      } finally {
        setLoading(false)
      }
    },
    [companyId],
  )

  useEffect(() => {
    if (!value || value === 'NONE') {
      setSelectedAccount(null)
      return
    }
    if (selectedAccount?.id === value) return

    let cancelled = false
    ;(async () => {
      try {
        const params = new URLSearchParams({ companyId, id: value })
        const res = await fetch(`/api/admin/financial/accounts/picker-options?${params}`)
        const data = await res.json()
        if (cancelled || !res.ok) return
        const match = (data.items ?? [])[0] as AccountPickerOption | undefined
        if (match) setSelectedAccount(match)
      } catch {
        /* ignore */
      }
    })()

    return () => {
      cancelled = true
    }
  }, [value, companyId, selectedAccount?.id])

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

  const emptyMessage = useMemo(() => {
    if (!companyId) return '请先选择客户公司'
    if (loading) return '加载中...'
    return '未找到匹配科目'
  }, [companyId, loading])

  function selectAccount(account: AccountPickerOption) {
    setSelectedAccount(account)
    onChange(account.id)
    setOpen(false)
    setSearch('')
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search
          size={13}
          className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-[#9F927B]"
        />
        <input
          ref={inputRef}
          value={displayValue}
          onChange={e => {
            setSearch(e.target.value)
            if (!open) setOpen(true)
          }}
          onFocus={() => {
            setOpen(true)
            setSearch('')
          }}
          onKeyDown={event => {
            if (open && (event.key === 'Enter' || event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
              return
            }
            onInputKeyDown?.(event)
          }}
          placeholder={placeholder}
          disabled={disabled || !companyId}
          className={`w-full rounded-lg pl-8 pr-9 py-2 text-sm outline-none disabled:opacity-60 ${inputClassName}`}
        />
        <ChevronDown
          size={14}
          className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[#9F927B]"
        />
      </div>

      {open && (
        <div className="financial-account-combobox-dropdown absolute z-50 mt-1 w-full max-h-60 overflow-y-auto rounded-lg border border-[#2A2418] bg-[#11110E] text-[#FFF7E6] shadow-lg">
          {options.length === 0 ? (
            <div className="px-3 py-4 text-center text-sm text-[#B8AD98]">
              {emptyMessage}
            </div>
          ) : (
            options.map(account => (
              <button
                key={account.id}
                type="button"
                data-selected={account.id === value ? 'true' : undefined}
                onMouseDown={e => e.preventDefault()}
                onClick={() => selectAccount(account)}
                className="w-full border-b border-[#1E1C15] px-3 py-2.5 text-left text-sm text-[#FFF7E6] transition-colors hover:bg-[#1E1A12]"
              >
                <div className="font-medium">{formatAccountLabel(account)}</div>
                <div className="mt-0.5 text-xs text-[#B8AD98]">
                  {account.type}
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
