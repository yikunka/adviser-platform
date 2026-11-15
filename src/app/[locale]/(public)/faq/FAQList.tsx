'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { ChevronDown } from 'lucide-react'

const FAQ_GROUPS = [
  {
    groupKey: 'incorporation',
    keys: ['incorporation', 'foreign', 'director', 'timeline', 'fees'],
  },
  {
    groupKey: 'compliance',
    keys: ['kyc', 'secretary', 'financialStmt', 'annualFiling', 'aml'],
  },
  {
    groupKey: 'services',
    keys: ['address', 'dormant', 'wfoe', 'documents'],
  },
] as const

const GROUP_LABEL_KEYS = ['groupIncorporation', 'groupCompliance', 'groupServices'] as const

function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div
      className="border-b last:border-b-0"
      style={{ borderColor: 'rgba(42, 36, 24, 0.9)' }}
    >
      <button
        type="button"
        className="w-full flex justify-between items-start gap-4 py-5 text-left group"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        <span className="font-medium text-sm md:text-base pr-2" style={{ color: '#F5F0E6' }}>
          {question}
        </span>
        <ChevronDown
          size={20}
          className="shrink-0 mt-0.5 transition-transform duration-200"
          style={{ color: '#C9A96E', transform: open ? 'rotate(180deg)' : undefined }}
        />
      </button>
      {open && (
        <div className="pb-5 text-sm leading-relaxed" style={{ color: '#A89880' }}>
          {answer}
        </div>
      )}
    </div>
  )
}

export default function FAQList() {
  const t = useTranslations('faq')
  const [activeGroup, setActiveGroup] = useState<string>('incorporation')

  const activeGroupData = FAQ_GROUPS.find(g => g.groupKey === activeGroup)!

  return (
    <div className="space-y-6">
      {/* Tab bar */}
      <div className="flex flex-wrap gap-2">
        {FAQ_GROUPS.map(({ groupKey }, idx) => (
          <button
            key={groupKey}
            onClick={() => setActiveGroup(groupKey)}
            className="text-xs px-4 py-2 rounded-lg transition-all"
            style={
              activeGroup === groupKey
                ? { background: '#C9A96E', color: '#0C0C0C', fontWeight: 600 }
                : { background: '#141414', border: '1px solid #2A2418', color: '#7A7060' }
            }
          >
            {t(GROUP_LABEL_KEYS[idx])}
          </button>
        ))}
      </div>

      {/* FAQ cards */}
      <div
        className="public-panel rounded-xl overflow-hidden"
      >
        <div className="px-5 md:px-8">
          {activeGroupData.keys.map((key) => (
            <FAQItem
              key={key}
              question={t(`items.${key}.q`)}
              answer={t(`items.${key}.a`)}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
