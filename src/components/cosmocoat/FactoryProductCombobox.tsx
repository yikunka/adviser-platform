'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, Search } from 'lucide-react'
import type { FactoryProductPickerOption } from '@/lib/cosmocoat/factory-product-picker'

type FactoryProductComboboxProps = {
  value: string
  onChange: (productId: string) => void
  onProductSelect?: (product: FactoryProductPickerOption | null) => void
  recipeId?: string | null
  requireCurrentRecipe?: boolean
  placeholder?: string
  inputStyle?: React.CSSProperties
  disabled?: boolean
}

function defaultInputStyle(): React.CSSProperties {
  return {
    background: '#0E0E0A',
    border: '1px solid #2A2418',
    color: 'var(--foreground)',
  }
}

function formatProductLabel(product: FactoryProductPickerOption): string {
  return `${product.productCode} · ${product.name}`
}

export function FactoryProductCombobox({
  value,
  onChange,
  onProductSelect,
  recipeId,
  requireCurrentRecipe = true,
  placeholder = '搜索产品编号、名称或配方...',
  inputStyle = defaultInputStyle(),
  disabled = false,
}: FactoryProductComboboxProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [options, setOptions] = useState<FactoryProductPickerOption[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<FactoryProductPickerOption | null>(null)

  const displayValue = open ? search : (selectedProduct ? formatProductLabel(selectedProduct) : '')

  const fetchOptions = useCallback(async (query: string) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ limit: '50' })
      if (query.trim()) params.set('q', query.trim())
      if (recipeId) params.set('recipeId', recipeId)
      if (!requireCurrentRecipe) params.set('requireCurrentRecipe', 'false')
      const res = await fetch(`/api/admin/cosmocoat/factory-products/picker-options?${params}`)
      const data = await res.json()
      if (res.ok) {
        setOptions(data.items ?? [])
      }
    } catch {
      /* non-blocking */
    } finally {
      setLoading(false)
    }
  }, [recipeId, requireCurrentRecipe])

  useEffect(() => {
    if (!value) {
      setSelectedProduct(null)
      return
    }
    if (selectedProduct?.id === value) return

    let cancelled = false
    ;(async () => {
      try {
        const params = new URLSearchParams({ id: value, requireCurrentRecipe: 'false' })
        const res = await fetch(`/api/admin/cosmocoat/factory-products/picker-options?${params}`)
        const data = await res.json()
        if (cancelled || !res.ok) return
        const match = (data.items ?? [])[0] as FactoryProductPickerOption | undefined
        if (match) setSelectedProduct(match)
      } catch {
        /* ignore */
      }
    })()

    return () => {
      cancelled = true
    }
  }, [value, selectedProduct?.id])

  useEffect(() => {
    if (!open) return
    const timer = setTimeout(() => {
      fetchOptions(search)
    }, search.trim() ? 250 : 0)
    return () => clearTimeout(timer)
  }, [open, search, fetchOptions])

  useEffect(() => {
    if (!value || !recipeId || !selectedProduct) return
    if (selectedProduct.currentRecipe?.id !== recipeId) {
      onChange('')
      onProductSelect?.(null)
      setSelectedProduct(null)
    }
  }, [recipeId, value, selectedProduct, onChange, onProductSelect])

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
    if (loading) return '加载中...'
    if (recipeId) return '没有包含当前配方的产品'
    return '未找到匹配产品'
  }, [loading, recipeId])

  function selectProduct(product: FactoryProductPickerOption) {
    setSelectedProduct(product)
    onChange(product.id)
    onProductSelect?.(product)
    setOpen(false)
    setSearch('')
  }

  return (
    <div ref={containerRef} className="relative">
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
          className="w-full rounded-lg pl-8 pr-9 py-2.5 text-sm outline-none disabled:opacity-60"
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
          className="absolute z-50 mt-1 w-full max-h-60 overflow-y-auto rounded-lg shadow-lg"
          style={{ background: '#0E0E0A', border: '1px solid #2A2418' }}
        >
          {options.length === 0 ? (
            <div className="px-3 py-4 text-sm text-center" style={{ color: 'var(--muted-foreground)' }}>
              {emptyMessage}
            </div>
          ) : (
            options.map(product => (
              <button
                key={product.id}
                type="button"
                onMouseDown={e => e.preventDefault()}
                onClick={() => selectProduct(product)}
                className="w-full px-3 py-2.5 text-left text-sm transition-colors hover:bg-[#111108]"
                style={{
                  borderBottom: '1px solid #1E1C15',
                  color: product.id === value ? '#C9A96E' : 'var(--foreground)',
                }}
              >
                <div className="font-medium">{formatProductLabel(product)}</div>
                {product.currentRecipe && (
                  <div className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                    当前配方：{product.currentRecipe.code} · {product.currentRecipe.name}
                  </div>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
