'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'

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

export default function FAQList() {
  const t = useTranslations('faq')
  const [activeGroup, setActiveGroup] = useState<string>('incorporation')
  const [activeKey, setActiveKey] = useState<string>(FAQ_GROUPS[0].keys[0])

  const activeGroupData = FAQ_GROUPS.find(g => g.groupKey === activeGroup)!
  const activeQuestion = t(`${activeKey}.q`)
  const activeAnswer = t(`${activeKey}.a`)

  return (
    <div className="grid gap-8 md:grid-cols-12">
      <aside className="md:col-span-4 space-y-6">
        <div className="flex flex-col gap-2">
          {FAQ_GROUPS.map(({ groupKey }, idx) => (
            <button
              key={groupKey}
              type="button"
              onClick={() => {
                setActiveGroup(groupKey)
                setActiveKey(FAQ_GROUPS[idx].keys[0])
              }}
              className={`rounded-md px-3 py-2 text-left text-sm font-semibold transition-colors duration-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9B9B9B] ${
                activeGroup === groupKey
                  ? 'bg-white text-black'
                  : 'bg-[#181818] text-[#9B9B9B] hover:text-white border border-[#272727]'
              }`}
            >
              {t(GROUP_LABEL_KEYS[idx])}
            </button>
          ))}
        </div>

        <ul className="space-y-1 border-t border-[#272727] pt-4">
          {activeGroupData.keys.map(key => (
            <li key={key}>
              <button
                type="button"
                onClick={() => setActiveKey(key)}
                className={`w-full rounded-md px-3 py-2 text-left text-sm transition-colors duration-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9B9B9B] ${
                  activeKey === key
                    ? 'bg-[#1F1F1F] text-white'
                    : 'text-[#9B9B9B] hover:text-white'
                }`}
              >
                {t(`${key}.q`)}
              </button>
            </li>
          ))}
        </ul>
      </aside>

      <article className="md:col-span-8 rounded-xl border border-[#272727] bg-[#181818] p-6 md:p-8 min-h-[16rem]">
        <h2 className="text-xl md:text-2xl font-semibold tracking-tight text-white text-balance mb-4">
          {activeQuestion}
        </h2>
        <p className="text-sm md:text-base leading-7 text-[#9B9B9B] text-pretty">
          {activeAnswer}
        </p>
      </article>
    </div>
  )
}
