'use client'

import { type KeyboardEvent, type Ref, useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { Check, ChevronDown, ChevronRight, FolderTree, Search } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { getAccountHierarchy } from '@/lib/financial/account-tree'
import { cn } from '@/lib/utils'

export type AccountPickerOption = {
  id: string
  code: string
  name: string
  type: string
  level?: number
  parentId?: string | null
  sortOrder?: number
  balanceDebit?: number
  balanceCredit?: number
}

export type AccountComboboxSpecialOption = {
  id: string
  label: string
  description?: string
  accent?: string
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
  options?: AccountPickerOption[]
  specialOptions?: AccountComboboxSpecialOption[]
  emptyMessage?: string
  dialogMode?: boolean
  dialogTitle?: string
}

function formatAccountLabel(account: AccountPickerOption): string {
  return `${account.code} - ${account.name}`
}

const ACCOUNT_TYPE_META: Record<string, { label: string; accent: string; background: string }> = {
  ASSET: { label: '资产', accent: '#38bdf8', background: 'rgba(56,189,248,0.12)' },
  NON_CURRENT_ASSET: { label: '长期资产', accent: '#22d3ee', background: 'rgba(34,211,238,0.12)' },
  LIABILITY: { label: '负债', accent: '#f59e0b', background: 'rgba(245,158,11,0.13)' },
  NON_CURRENT_LIABILITY: { label: '长期负债', accent: '#fb7185', background: 'rgba(251,113,133,0.12)' },
  EQUITY: { label: '权益', accent: '#a78bfa', background: 'rgba(167,139,250,0.12)' },
  REVENUE: { label: '收入', accent: '#34d399', background: 'rgba(52,211,153,0.12)' },
  EXPENSE: { label: '费用', accent: '#f87171', background: 'rgba(248,113,113,0.12)' },
  CGS: { label: '成本', accent: '#fb923c', background: 'rgba(251,146,60,0.12)' },
  CURRENT_ACCOUNT: { label: '往来', accent: '#2dd4bf', background: 'rgba(45,212,191,0.12)' },
}

type RenderOption =
  | {
    kind: 'special'
    id: string
    label: string
    description?: string
    accent: string
    searchText: string
  }
  | {
    kind: 'account'
    id: string
    account: AccountPickerOption
    label: string
    level: number
    typeLabel: string
    accent: string
    background: string
    searchText: string
  }

function accountTypeMeta(type: string) {
  return ACCOUNT_TYPE_META[type] ?? { label: type, accent: '#C9A96E', background: 'rgba(201,169,110,0.12)' }
}

function money(value: number | null | undefined) {
  return Number(value ?? 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function accountBalanceLabel(account: AccountPickerOption) {
  const debit = Number(account.balanceDebit ?? 0)
  const credit = Number(account.balanceCredit ?? 0)
  if (debit > 0) return `借方余额 ${money(debit)}`
  if (credit > 0) return `贷方余额 ${money(credit)}`
  return '余额 0.00'
}

function isSelectableJournalAccount(account: AccountPickerOption, accounts: AccountPickerOption[]) {
  if (account.level === 2 || account.level === 3) return true
  if (account.level !== 1) return false
  return !accounts.some(row => row.parentId === account.id)
}

type AccountTreeNode = AccountPickerOption & { children: AccountTreeNode[] }

function getVisibleNodes(nodes: AccountTreeNode[], expandedIds: Set<string>): AccountTreeNode[] {
  const result: AccountTreeNode[] = []
  function visit(list: AccountTreeNode[]) {
    for (const node of list) {
      result.push(node)
      if (node.children.length > 0 && expandedIds.has(node.id)) visit(node.children)
    }
  }
  visit(nodes)
  return result
}

function filterAccountTree(nodes: AccountTreeNode[], query: string): AccountTreeNode[] {
  const normalizedQuery = query.trim().toLowerCase()
  if (!normalizedQuery) return nodes

  const visit = (node: AccountTreeNode): AccountTreeNode | null => {
    const selfMatches = `${node.code} ${node.name} ${node.type}`.toLowerCase().includes(normalizedQuery)
    const children = node.children.map(visit).filter((child): child is AccountTreeNode => Boolean(child))
    if (!selfMatches && children.length === 0) return null
    return { ...node, children }
  }

  return nodes.map(visit).filter((node): node is AccountTreeNode => Boolean(node))
}

function AccountTreeRows({
  nodes,
  accounts,
  value,
  expandedIds,
  onToggle,
  onSelect,
  depth = 0,
  highlightedId,
}: {
  nodes: AccountTreeNode[]
  accounts: AccountPickerOption[]
  value: string
  expandedIds: Set<string>
  onToggle: (accountId: string) => void
  onSelect: (account: AccountPickerOption) => void
  depth?: number
  highlightedId?: string | null
}) {
  return (
    <>
      {nodes.map(node => {
        const meta = accountTypeMeta(node.type)
        const hasChildren = node.children.length > 0
        const expanded = expandedIds.has(node.id)
        const selectable = isSelectableJournalAccount(node, accounts)
        const selected = node.id === value
        const highlighted = node.id === highlightedId
        const showBalance = !hasChildren

        return (
          <div key={node.id} data-tree-node-id={node.id}>
            <div
              className={cn(
                'grid grid-cols-[auto_1fr_auto_auto] items-center gap-2 rounded-md px-2 py-1.5 text-sm',
                selected ? 'bg-[#2A2418] text-[#FFF7E6]' : highlighted ? 'bg-[#1E1A12] text-[#FFF7E6]' : 'text-[#EADDC3]',
                selectable ? 'hover:bg-[#1E1A12]' : 'opacity-80',
              )}
              style={{ paddingLeft: `${8 + depth * 18}px` }}
            >
              <button
                type="button"
                onClick={() => hasChildren && onToggle(node.id)}
                disabled={!hasChildren}
                className="grid size-6 place-items-center rounded text-[#B8AD98] disabled:opacity-30"
                aria-label={expanded ? '收起下级科目' : '展开下级科目'}
              >
                {hasChildren ? (
                  expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />
                ) : (
                  <span className="size-3" />
                )}
              </button>

              <button
                type="button"
                disabled={!selectable}
                onClick={() => onSelect(node)}
                className="min-w-0 text-left disabled:cursor-not-allowed"
                title={selectable ? `${node.code} - ${node.name}` : '该科目有下级，请选择可入账的明细科目'}
              >
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className="block size-2.5 shrink-0 rounded-full ring-2 ring-black/20"
                    style={{ background: meta.accent }}
                  />
                  <span className="truncate font-medium">{node.code} - {node.name}</span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2 pl-4 text-xs">
                  <span
                    className="rounded px-1.5 py-0.5 font-medium"
                    style={{ background: meta.background, color: meta.accent }}
                  >
                    {meta.label}
                  </span>
                  <span className="text-[#8F846F]">第 {node.level} 级</span>
                  {!selectable && <span className="text-[#8F846F]">选择下级明细科目</span>}
                </div>
              </button>

              {showBalance ? (
                <div className="whitespace-nowrap rounded border border-[#2A2418] bg-[#0B0B08] px-2 py-1 text-right text-xs font-medium text-[#C9A96E]">
                  {accountBalanceLabel(node)}
                </div>
              ) : (
                <div className="hidden sm:block" />
              )}

              <div className="grid size-6 place-items-center">
                {selected ? <Check size={15} className="text-[#C9A96E]" /> : null}
              </div>
            </div>
            {hasChildren && expanded ? (
              <AccountTreeRows
                nodes={node.children}
                accounts={accounts}
                value={value}
                expandedIds={expandedIds}
                onToggle={onToggle}
                onSelect={onSelect}
                depth={depth + 1}
                highlightedId={highlightedId}
              />
            ) : null}
          </div>
        )
      })}
    </>
  )
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
  options: localOptions,
  specialOptions = [],
  emptyMessage: emptyMessageProp,
  dialogMode = false,
  dialogTitle = '选择会计科目',
}: AccountComboboxProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const listboxRef = useRef<HTMLDivElement>(null)
  const dialogListRef = useRef<HTMLDivElement>(null)
  const listboxId = useId()
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [options, setOptions] = useState<AccountPickerOption[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedAccount, setSelectedAccount] = useState<AccountPickerOption | null>(null)
  const [highlightedIndex, setHighlightedIndex] = useState(0)
  const [treeDialogOpen, setTreeDialogOpen] = useState(false)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [dialogHighlightedId, setDialogHighlightedId] = useState<string | null>(null)

  const selectedSpecialOption = useMemo(
    () => specialOptions.find(option => option.id === value) ?? null,
    [specialOptions, value],
  )
  const selectedLocalAccount = useMemo(
    () => localOptions?.find(account => account.id === value) ?? null,
    [localOptions, value],
  )

  const displayValue = open
    ? search
    : !value
      ? ''
      : selectedSpecialOption
      ? selectedSpecialOption.label
      : selectedLocalAccount
        ? formatAccountLabel(selectedLocalAccount)
        : selectedAccount
          ? formatAccountLabel(selectedAccount)
          : ''

  const fetchOptions = useCallback(
    async (query: string, options?: { tree?: boolean }) => {
      if (localOptions) return
      if (!companyId) {
        setOptions([])
        return
      }
      setLoading(true)
      try {
        const params = new URLSearchParams({ companyId, limit: options?.tree ? '500' : '50' })
        if (options?.tree) params.set('mode', 'tree')
        if (query.trim() && !options?.tree) params.set('q', query.trim())
        const res = await fetch(`/api/admin/financial/accounts/picker-options?${params}`)
        const data = await res.json()
        if (res.ok) {
          const items = data.items ?? []
          setOptions(items)
          if (options?.tree) {
            setExpandedIds(new Set(
              items
                .filter((account: AccountPickerOption) => !account.parentId)
                .map((account: AccountPickerOption) => account.id),
            ))
          }
        }
      } catch {
        /* non-blocking */
      } finally {
        setLoading(false)
      }
    },
    [companyId, localOptions],
  )

  useEffect(() => {
    if (localOptions || selectedSpecialOption || !value || value === 'NONE') return
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
  }, [value, companyId, selectedAccount?.id, selectedSpecialOption, localOptions])

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

  const renderOptions = useMemo<RenderOption[]>(() => {
    const query = search.trim().toLowerCase()
    const accountRows = (localOptions ?? options).map(account => {
      const meta = accountTypeMeta(account.type)
      const label = formatAccountLabel(account)
      const searchText = `${label} ${account.type} ${meta.label}`.toLowerCase()
      return {
        kind: 'account' as const,
        id: account.id,
        account,
        label,
        level: Math.max(1, account.level ?? 1),
        typeLabel: meta.label,
        accent: meta.accent,
        background: meta.background,
        searchText,
      }
    })
    const specialRows = specialOptions.map(option => ({
      kind: 'special' as const,
      id: option.id,
      label: option.label,
      description: option.description,
      accent: option.accent ?? '#C9A96E',
      searchText: `${option.label} ${option.description ?? ''}`.toLowerCase(),
    }))
    return [...specialRows, ...accountRows].filter(option => !query || option.searchText.includes(query))
  }, [localOptions, options, search, specialOptions])

  const activeHighlightedIndex = renderOptions.length === 0
    ? 0
    : Math.min(highlightedIndex, renderOptions.length - 1)

  const emptyMessage = useMemo(() => {
    if (!companyId) return '请先选择客户公司'
    if (loading) return '加载中...'
    return emptyMessageProp ?? '未找到匹配科目'
  }, [companyId, emptyMessageProp, loading])

  const treeAccounts = useMemo(() => {
    return (localOptions ?? options)
      .filter(account => (account.level ?? 1) <= 3)
      .map(account => ({
        ...account,
        level: Math.max(1, account.level ?? 1),
        sortOrder: account.sortOrder ?? 0,
        parentId: account.parentId ?? null,
      }))
  }, [localOptions, options])

  const treeNodes = useMemo(() => {
    return filterAccountTree(getAccountHierarchy(treeAccounts) as AccountTreeNode[], search)
  }, [search, treeAccounts])

  const activeExpandedIds = useMemo(() => {
    if (!search.trim()) return expandedIds
    const next = new Set(expandedIds)
    for (const account of treeAccounts) {
      if (account.parentId) next.add(account.parentId)
    }
    return next
  }, [expandedIds, search, treeAccounts])

  useEffect(() => {
    if (!listboxRef.current) return
    const el = listboxRef.current.querySelector<HTMLElement>('[data-highlighted="true"]')
    el?.scrollIntoView({ block: 'nearest' })
  }, [open, activeHighlightedIndex])

  useEffect(() => {
    if (!dialogHighlightedId || !dialogListRef.current) return
    const el = dialogListRef.current.querySelector<HTMLElement>(`[data-tree-node-id="${dialogHighlightedId}"]`)
    el?.scrollIntoView({ block: 'nearest' })
  }, [dialogHighlightedId])

  function selectAccount(account: AccountPickerOption) {
    setSelectedAccount(account)
    onChange(account.id)
    setOpen(false)
    setTreeDialogOpen(false)
    setSearch('')
  }

  function selectOption(option: RenderOption) {
    if (option.kind === 'special') {
      setSelectedAccount(null)
      onChange(option.id)
      setOpen(false)
      setSearch('')
      return
    }
    selectAccount(option.account)
  }

  function toggleExpanded(accountId: string) {
    setExpandedIds(current => {
      const next = new Set(current)
      if (next.has(accountId)) next.delete(accountId)
      else next.add(accountId)
      return next
    })
  }

  if (dialogMode) {
    return (
      <>
        <Button
          type="button"
          variant="outline"
          disabled={disabled || !companyId}
          onClick={() => {
            setSearch('')
            setHighlightedIndex(0)
            setDialogHighlightedId(null)
            setTreeDialogOpen(true)
            void fetchOptions('', { tree: true })
          }}
          onKeyDown={event => {
            if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
              onInputKeyDown?.(event as unknown as KeyboardEvent<HTMLInputElement>)
            }
          }}
          className={cn(
            'h-9 w-full justify-between gap-2 rounded-lg border px-3 py-2 text-left text-sm font-normal',
            'focus-visible:border-[#C9A96E] focus-visible:ring-3 focus-visible:ring-[#C9A96E]/25',
            inputClassName,
          )}
        >
          <span className="flex min-w-0 items-center gap-2">
            <FolderTree size={14} className="shrink-0 text-[#9F927B]" />
            <span className={cn('truncate', !displayValue && 'text-[#9F927B]')}>
              {displayValue || placeholder}
            </span>
          </span>
          <ChevronDown size={14} className="shrink-0 text-[#9F927B]" />
        </Button>

        <Dialog
          open={treeDialogOpen}
          onOpenChange={next => {
            if (next) {
              setSearch('')
              setHighlightedIndex(0)
              setDialogHighlightedId(null)
              void fetchOptions('', { tree: true })
            }
            setTreeDialogOpen(next)
          }}
        >
          <DialogContent className="financial-modal max-h-[88vh] overflow-hidden border-[#2A2418] bg-[#11110E] text-[#FFF7E6] shadow-2xl ring-[#3A3428] sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle className="text-[#FFF7E6]">{dialogTitle}</DialogTitle>
              <DialogDescription className="text-[#B8AD98]">
                通过树形层级浏览一级、二级、三级科目，也可以输入编码或名称搜索。
              </DialogDescription>
            </DialogHeader>

            <div className="relative">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-[#9F927B]"
              />
              <input
                value={search}
                onChange={event => {
                  setSearch(event.target.value)
                  setDialogHighlightedId(null)
                }}
                onKeyDown={event => {
                  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                    event.preventDefault()
                    const visibleNodes = getVisibleNodes(treeNodes, activeExpandedIds)
                    if (visibleNodes.length === 0) return
                    const currentIndex = dialogHighlightedId
                      ? visibleNodes.findIndex(n => n.id === dialogHighlightedId)
                      : -1
                    const nextIndex = event.key === 'ArrowDown'
                      ? (currentIndex + 1) % visibleNodes.length
                      : (currentIndex - 1 + visibleNodes.length) % visibleNodes.length
                    setDialogHighlightedId(visibleNodes[nextIndex].id)
                    return
                  }
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    if (!dialogHighlightedId) return
                    const visibleNodes = getVisibleNodes(treeNodes, activeExpandedIds)
                    const node = visibleNodes.find(n => n.id === dialogHighlightedId)
                    if (!node) return
                    if (node.children.length > 0) {
                      toggleExpanded(node.id)
                    } else if (isSelectableJournalAccount(node, treeAccounts)) {
                      selectAccount(node)
                    }
                  }
                }}
                placeholder="输入科目编码或名称搜索..."
                autoFocus
                className={cn(
                  'h-10 w-full rounded-lg border border-[#2A2418] bg-[#0E0E0A] py-2 pl-9 pr-3 text-sm text-[#FFF7E6] outline-none placeholder:text-[#9F927B]',
                  'focus-visible:border-[#C9A96E] focus-visible:ring-3 focus-visible:ring-[#C9A96E]/25',
                )}
              />
            </div>

            <div ref={dialogListRef} className="max-h-[56vh] overflow-y-auto rounded-lg border border-[#2A2418] bg-[#0B0B08] p-1.5">
              {treeNodes.length === 0 ? (
                <div className="px-3 py-8 text-center text-sm text-[#B8AD98]">
                  {emptyMessage}
                </div>
              ) : (
                <AccountTreeRows
                  nodes={treeNodes}
                  accounts={treeAccounts}
                  value={value}
                  expandedIds={activeExpandedIds}
                  onToggle={toggleExpanded}
                  onSelect={selectAccount}
                  highlightedId={dialogHighlightedId}
                />
              )}
            </div>
          </DialogContent>
        </Dialog>
      </>
    )
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
            setHighlightedIndex(0)
          }}
          onKeyDown={event => {
            if (event.key === 'ArrowDown') {
              event.preventDefault()
              if (!open) {
                setOpen(true)
                setSearch('')
                setHighlightedIndex(0)
                return
              }
              setHighlightedIndex(index => (
                renderOptions.length ? (Math.min(index, renderOptions.length - 1) + 1) % renderOptions.length : 0
              ))
              return
            }
            if (event.key === 'ArrowUp') {
              event.preventDefault()
              if (!open) {
                setOpen(true)
                setSearch('')
                setHighlightedIndex(0)
                return
              }
              setHighlightedIndex(index => (
                renderOptions.length ? (Math.min(index, renderOptions.length - 1) - 1 + renderOptions.length) % renderOptions.length : 0
              ))
              return
            }
            if (event.key === 'Enter' && open) {
              event.preventDefault()
              const option = renderOptions[activeHighlightedIndex]
              if (option) selectOption(option)
              return
            }
            if (event.key === 'Escape' && open) {
              event.preventDefault()
              setOpen(false)
              setSearch('')
              return
            }
            onInputKeyDown?.(event)
          }}
          placeholder={placeholder}
          disabled={disabled || !companyId}
          role="combobox"
          aria-expanded={open}
          aria-controls={open ? listboxId : undefined}
          aria-activedescendant={open && renderOptions[activeHighlightedIndex] ? `${listboxId}-${renderOptions[activeHighlightedIndex].id}` : undefined}
          aria-autocomplete="list"
          className={cn(
            'h-9 w-full rounded-lg border pl-8 pr-9 py-2 text-sm outline-none transition-colors disabled:opacity-60',
            'focus-visible:border-[#C9A96E] focus-visible:ring-3 focus-visible:ring-[#C9A96E]/25',
            inputClassName,
          )}
        />
        <ChevronDown
          size={14}
          className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[#9F927B]"
        />
      </div>

      {open && (
        <div
          ref={listboxRef}
          id={listboxId}
          role="listbox"
          className="financial-account-combobox-dropdown absolute z-50 mt-1 w-full min-w-0 max-h-72 overflow-y-auto rounded-lg border border-[#2A2418] bg-[#11110E] p-1.5 text-[#FFF7E6] shadow-xl sm:min-w-80"
        >
          {renderOptions.length === 0 ? (
            <div className="px-3 py-4 text-center text-sm text-[#B8AD98]">
              {emptyMessage}
            </div>
          ) : (
            renderOptions.map((option, index) => (
              <button
                key={option.id}
                id={`${listboxId}-${option.id}`}
                type="button"
                role="option"
                aria-selected={option.id === value}
                data-selected={option.id === value ? 'true' : undefined}
                data-highlighted={index === activeHighlightedIndex ? 'true' : undefined}
                onMouseDown={e => e.preventDefault()}
                onMouseEnter={() => setHighlightedIndex(index)}
                onClick={() => selectOption(option)}
                className="flex w-full items-start gap-2.5 rounded-md px-2.5 py-2.5 text-left text-sm text-[#FFF7E6] transition-colors hover:bg-[#1E1A12] data-[highlighted=true]:bg-[#1E1A12]"
              >
                <span
                  className="mt-1 block size-2.5 shrink-0 rounded-full ring-2 ring-black/20"
                  style={{ background: option.accent }}
                />
                <div
                  className="min-w-0 flex-1"
                  style={{ paddingLeft: option.kind === 'account' ? `${(option.level - 1) * 10}px` : undefined }}
                >
                  <div className="truncate font-medium">{option.label}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                    {option.kind === 'account' ? (
                      <>
                        <span
                          className="rounded px-1.5 py-0.5 font-medium"
                          style={{ background: option.background, color: option.accent }}
                        >
                          {option.typeLabel}
                        </span>
                        <span className="font-mono text-[#8F846F]">{option.account.type}</span>
                      </>
                    ) : (
                      <span className="financial-account-combobox-muted">{option.description}</span>
                    )}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
