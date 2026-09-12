'use client'

import { useEffect, useState } from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  fieldClassName,
  inputStyle,
  selectContentClassName,
  selectItemClassName,
} from '@/components/admin/financial/subledger/config'

export type PartyOption = {
  id: string
  code: string
  name: string
  paymentTermsDays: number
}

export function PartySelect({
  companyId,
  role,
  value,
  onChange,
  placeholder = '选择往来单位',
  refreshKey = 0,
}: {
  companyId: string
  role: 'customer' | 'supplier' | 'all'
  value: string
  onChange: (partyId: string, party?: PartyOption) => void
  placeholder?: string
  refreshKey?: number
}) {
  const [options, setOptions] = useState<PartyOption[]>([])

  useEffect(() => {
    const params = new URLSearchParams({ companyId })
    if (role !== 'all') params.set('role', role)
    fetch(`/api/admin/financial/parties?${params}`)
      .then(async res => {
        const data = await res.json()
        if (res.ok) setOptions(data.parties ?? [])
      })
      .catch(() => {})
  }, [companyId, role, refreshKey])

  return (
    <Select
      value={value || undefined}
      onValueChange={id => {
        if (!id) return
        onChange(id, options.find(option => option.id === id))
      }}
    >
      <SelectTrigger className={`w-full ${fieldClassName}`} style={inputStyle}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className={selectContentClassName}>
        {options.length === 0 ? (
          <div className="px-3 py-2 text-sm text-[var(--text-dim)]">暂无可选单位，请先在「往来单位」中创建</div>
        ) : (
          options.map(option => (
            <SelectItem key={option.id} value={option.id} className={selectItemClassName}>
              <span className="font-mono text-xs text-[#C9A96E]">{option.code}</span>
              <span>{option.name}</span>
            </SelectItem>
          ))
        )}
      </SelectContent>
    </Select>
  )
}
