'use client'

import { useState, useRef, useEffect } from 'react'
import { ChevronDown, X } from 'lucide-react'

interface CategoryComboFieldProps {
  label?: string
  value: string
  categories: string[]
  placeholder?: string
  onChange: (value: string) => void
  required?: boolean
}

export function CategoryComboField({
  label,
  value,
  categories,
  placeholder = '输入或选择分类',
  onChange,
  required,
}: CategoryComboFieldProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const wrapperRef = useRef<HTMLDivElement>(null)
  const filteredCategories = categories.filter(c =>
    c.toLowerCase().includes(searchTerm.toLowerCase())
  )

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSelect = (category: string) => {
    onChange(category)
    setIsOpen(false)
    setSearchTerm('')
  }

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    onChange('')
    setIsOpen(false)
  }

  const hasValue = !!value.trim()

  return (
    <div className="space-y-1.5" ref={wrapperRef}>
      {label && (
        <label className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>
          {label} {required && <span style={{ color: '#E57373' }}>*</span>}
        </label>
      )}
      <div className="relative">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={value}
            onChange={e => onChange(e.target.value)}
            placeholder={placeholder}
            required={required}
            className="w-full rounded-lg px-3 py-2.5 text-sm outline-none transition-colors"
            style={{ background: '#0E0E0A', border: '1px solid #2A2418', color: 'var(--foreground)' }}
            onFocus={() => setIsOpen(true)}
          />
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="flex items-center gap-1 px-3 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition-opacity hover:opacity-85"
            style={{ background: isOpen ? '#C9A96E' : 'rgba(201,169,110,0.12)', color: isOpen ? '#0A0805' : '#C9A96E', border: '1px solid rgba(201,169,110,0.25)' }}
          >
            {hasValue ? value : '选择分类'}
            <ChevronDown size={14} />
          </button>
          {hasValue && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1.5 rounded-md hover:bg-[#1E1C14] transition-colors"
              style={{ color: 'var(--muted-foreground)' }}
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Dropdown Menu */}
        {isOpen && (
          <div
            className="absolute top-full left-0 right-0 mt-1 max-h-60 overflow-y-auto rounded-lg z-50"
            style={{ background: '#111111', border: '1px solid #2A2418', boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}
          >
            {/* Search */}
            {categories.length >= 8 && (
              <div className="p-2 border-b" style={{ borderBottom: '1px solid #2A2418' }}>
                <input
                  type="text"
                  placeholder={`搜索 ${categories.length} 个分类...`}
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full rounded px-2 py-1.5 text-sm outline-none"
                  style={{ background: '#0E0E0A', border: '1px solid #2A2418', color: 'var(--foreground)' }}
                />
              </div>
            )}

            {/* Categories List */}
            {filteredCategories.length === 0 ? (
              <div className="py-6 text-center text-sm" style={{ color: '#5A5040' }}>
                没有找到匹配的分类
              </div>
            ) : (
              <ul className="py-1">
                {filteredCategories.map(category => (
                  <li key={category}>
                    <button
                      type="button"
                      onClick={() => handleSelect(category)}
                      className="w-full px-3 py-2.5 text-left text-sm transition-colors flex items-center justify-between"
                      style={{
                        background: value === category ? 'rgba(201,169,110,0.15)' : 'transparent',
                        color: value === category ? '#C9A96E' : 'var(--muted-foreground)',
                      }}
                      onMouseEnter={e => {
                        if (value !== category) {
                          e.currentTarget.style.background = '#1E1C14'
                        }
                      }}
                      onMouseLeave={e => {
                        if (value !== category) {
                          e.currentTarget.style.background = 'transparent'
                        }
                      }}
                    >
                      <span>{category}</span>
                      {value === category && (
                        <span style={{ color: '#C9A96E' }}>✓</span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
