'use client'

import type { CSSProperties } from 'react'
import {
  RECIPE_QC_TEST_ITEMS,
  type RecipeQcTestItemId,
  type QcTestItemResults,
} from '@/lib/cosmocoat/recipe-qc-tests'

type InputStyle = CSSProperties

type RecipeQcSectionProps = {
  qcTestItems: RecipeQcTestItemId[]
  qcTestStandard: string
  qcTestItemResults: QcTestItemResults
  onToggleQcTestItem: (id: RecipeQcTestItemId) => void
  onQcTestStandardChange: (value: string) => void
  onQcTestItemResultChange: (id: RecipeQcTestItemId, value: string) => void
  inputStyle: InputStyle
  title?: string
  description?: string
  recipeViscosity?: string | null
  recipeViscosityUnit?: string | null
  customStandardLabel?: string
  customStandardPlaceholder?: string
  resultPlaceholder?: string
}

export function RecipeQcSection({
  qcTestItems,
  qcTestStandard,
  qcTestItemResults,
  onToggleQcTestItem,
  onQcTestStandardChange,
  onQcTestItemResultChange,
  inputStyle,
  title = 'QC（质量控制）',
  description,
  recipeViscosity,
  recipeViscosityUnit,
  customStandardLabel = '其他测试标准',
  customStandardPlaceholder = '补充测试标准（可选）',
  resultPlaceholder = '如：合格 / 实测值',
}: RecipeQcSectionProps) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold" style={{ color: '#C9A96E' }}>{title}</h3>
        {description && (
          <p className="text-xs mt-1" style={{ color: 'var(--muted-foreground)' }}>{description}</p>
        )}
      </div>
      <div className="space-y-3">
        <label className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>测试项目</label>
        <div className="space-y-2">
          {RECIPE_QC_TEST_ITEMS.map(item => {
            const checked = qcTestItems.includes(item.id)
            return (
              <div
                key={item.id}
                className="flex flex-wrap items-center gap-3 rounded-lg px-3 py-2"
                style={{ background: checked ? '#111108' : 'transparent', border: '1px solid #2A2418' }}
              >
                <label
                  className="flex items-center gap-2 cursor-pointer text-sm shrink-0 min-w-[140px]"
                  style={{ color: 'var(--foreground)' }}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => onToggleQcTestItem(item.id)}
                    className="rounded border-[#2A2418] accent-[#C9A96E]"
                  />
                  {item.label}
                  {item.id === 'VISCOSITY' && recipeViscosity && (
                    <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                      ({recipeViscosity}{recipeViscosityUnit ? ` ${recipeViscosityUnit}` : ''})
                    </span>
                  )}
                </label>
                {checked && (
                  <input
                    type="text"
                    value={qcTestItemResults[item.id] ?? ''}
                    onChange={e => onQcTestItemResultChange(item.id, e.target.value)}
                    className="flex-1 min-w-[160px] rounded-lg px-3 py-1.5 text-sm outline-none"
                    style={inputStyle}
                    placeholder={resultPlaceholder}
                  />
                )}
              </div>
            )
          })}
        </div>
        <label className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>{customStandardLabel}</label>
        <textarea
          value={qcTestStandard}
          onChange={e => onQcTestStandardChange(e.target.value)}
          rows={4}
          className="w-full rounded-lg px-3 py-2 text-sm outline-none resize-y"
          style={inputStyle}
          placeholder={customStandardPlaceholder}
        />
      </div>
    </div>
  )
}
