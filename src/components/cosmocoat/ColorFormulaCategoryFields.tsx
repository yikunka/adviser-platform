'use client'

import { useEffect, useMemo, useState } from 'react'
import type { CosColorFormulaCategory } from '@prisma/client'
import { COLOR_FORMULA_CATEGORIES } from '@/lib/cosmocoat/color-formula-categories'
import type { ColorFormulaFactoryProductOption } from '@/lib/cosmocoat/color-formula-factory-products'

export type { ColorFormulaFactoryProductOption as ColorFormulaSubcategoryOption }

type ColorFormulaCategoryFieldsProps = {
  category: CosColorFormulaCategory
  factoryProductId: string | null
  onCategoryChange: (category: CosColorFormulaCategory) => void
  onFactoryProductChange: (factoryProductId: string | null) => void
  onProductsLoaded?: (products: ColorFormulaFactoryProductOption[]) => void
  inputStyle?: React.CSSProperties
  showLabels?: boolean
  className?: string
}

function defaultInputStyle(): React.CSSProperties {
  return {
    background: '#0E0E0A',
    border: '1px solid #2A2418',
    color: 'var(--foreground)',
  }
}

export function ColorFormulaCategoryFields({
  category,
  factoryProductId,
  onCategoryChange,
  onFactoryProductChange,
  onProductsLoaded,
  inputStyle = defaultInputStyle(),
  showLabels = true,
  className = '',
}: ColorFormulaCategoryFieldsProps) {
  const [products, setProducts] = useState<ColorFormulaFactoryProductOption[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const res = await fetch('/api/admin/cosmocoat/color-formulas/factory-product-options')
        const data = await res.json()
        if (!cancelled && res.ok) {
          const items = data.items ?? []
          setProducts(items)
          onProductsLoaded?.(items)
        }
      } catch {
        /* ignore */
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [onProductsLoaded])

  const childOptions = useMemo(
    () => products.filter(item => item.parentCategory === category),
    [products, category],
  )

  const categoryLabel =
    COLOR_FORMULA_CATEGORIES.find(item => item.value === category)?.labelZh ?? category

  useEffect(() => {
    if (!factoryProductId) return
    const match = products.find(item => item.id === factoryProductId)
    if (match && match.parentCategory !== category) {
      onFactoryProductChange(null)
    }
  }, [category, factoryProductId, products, onFactoryProductChange])

  return (
    <div className={`grid sm:grid-cols-2 gap-3 ${className}`.trim()}>
      <div className="space-y-1.5">
        {showLabels && (
          <label className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>
            主类别
          </label>
        )}
        <select
          value={category}
          onChange={e => onCategoryChange(e.target.value as CosColorFormulaCategory)}
          className="w-full rounded-lg px-3 py-2.5 text-sm outline-none"
          style={inputStyle}
        >
          {COLOR_FORMULA_CATEGORIES.map(c => (
            <option key={c.value} value={c.value}>
              {c.labelZh}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1.5">
        {showLabels && (
          <label className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>
            适用产品
          </label>
        )}
        <select
          value={factoryProductId ?? ''}
          onChange={e => onFactoryProductChange(e.target.value || null)}
          disabled={loading}
          className="w-full rounded-lg px-3 py-2.5 text-sm outline-none disabled:opacity-60"
          style={inputStyle}
        >
          <option value="">
            {loading ? '加载中...' : `全部${categoryLabel}产品`}
          </option>
          {childOptions.map(option => (
            <option key={option.id} value={option.id}>
              {option.productCode} · {option.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}
