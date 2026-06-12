'use client'

import { useEffect, useState } from 'react'
import type { DimensionType } from '@/lib/financial/dimensions'

export type DimensionOption = { id: string; code: string; name: string }

/**
 * 轻量维度下拉（成本中心 / 项目），用于凭证分录行。
 * 原生 select，紧凑、不抢占 AccountCombobox 的键盘导航。
 */
export function DimensionSelect({
  companyId,
  type,
  value,
  onChange,
  className = '',
  refreshKey = 0,
}: {
  companyId: string
  type: DimensionType
  value: string
  onChange: (id: string) => void
  className?: string
  refreshKey?: number
}) {
  const [options, setOptions] = useState<DimensionOption[]>([])

  useEffect(() => {
    if (!companyId) return
    let cancelled = false
    fetch(`/api/admin/financial/dimensions?type=${type}&companyId=${companyId}`)
      .then(async res => {
        const data = await res.json()
        if (!cancelled && res.ok) setOptions(data.dimensions ?? [])
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [companyId, type, refreshKey])

  return (
    <select
      value={value}
      onChange={event => onChange(event.target.value)}
      disabled={!companyId}
      className={`w-full rounded-lg px-2 py-2 text-sm outline-none disabled:opacity-60 ${className}`}
    >
      <option value="">—</option>
      {options.map(option => (
        <option key={option.id} value={option.id}>
          {option.code} · {option.name}
        </option>
      ))}
    </select>
  )
}
