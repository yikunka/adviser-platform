'use client'

import { useState } from 'react'

export type DiamondDetail = {
  code?: string
  carat?: string
  shape?: string
  type?: string
  ringSize?: string
  chainLength?: string
  design?: string
  metal?: string
  cut?: string
  size?: string
  mountStyle?: string
}

const GOLD   = '#C9A96E'
const DARK   = '#1A1A1A'
const MUTED  = '#6B5E4A'
const BORDER = '#EDE7D8'
const BG     = '#FAFAF8'

function Row({ label, value }: { label: string; value?: string }) {
  if (!value) return null
  return (
    <div className="flex gap-3 py-2.5 border-b last:border-b-0 text-sm" style={{ borderColor: BORDER }}>
      <span className="w-32 flex-shrink-0 font-medium" style={{ color: MUTED }}>{label}</span>
      <span style={{ color: DARK }}>{value}</span>
    </div>
  )
}

function Modal({ diamond, index, onClose }: { diamond: DiamondDetail; index: number; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(10,8,5,0.6)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl"
        style={{ background: '#fff' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-5 flex items-center justify-between" style={{ background: 'rgba(201,169,110,0.08)', borderBottom: `1px solid ${BORDER}` }}>
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
              style={{ background: GOLD, color: '#0A0805' }}
            >
              {index + 1}
            </div>
            <div>
              {diamond.code && (
                <p className="text-xs font-mono font-semibold tracking-wider mb-0.5" style={{ color: GOLD }}>
                  {diamond.code}
                </p>
              )}
              <p className="font-bold text-base" style={{ fontFamily: 'Georgia, serif', color: DARK }}>
                {[diamond.carat && `${diamond.carat} ct`, diamond.shape].filter(Boolean).join(' · ') || `#${index + 1}`}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-lg transition-all hover:bg-black/5"
            style={{ color: MUTED }}
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-4">
          <Row label="Carat"      value={diamond.carat ? `${diamond.carat} ct` : undefined} />
          <Row label="Shape"      value={diamond.shape} />
          <Row label="Setting"    value={diamond.type} />
          <Row label="Ring Size"  value={diamond.ringSize} />
          <Row
            label={diamond.type === 'Bracelet' ? 'Bracelet Length' : 'Necklace Length'}
            value={diamond.chainLength}
          />
          <Row label="Design"     value={diamond.design} />
          <Row label="Metal"      value={diamond.metal} />
          <Row label="Cut"        value={diamond.cut} />
          <Row label="Size"       value={diamond.size} />
          <Row label="Mount"      value={diamond.mountStyle} />
        </div>

        <div className="px-6 pb-5">
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-full text-sm font-semibold transition-all hover:opacity-90"
            style={{ background: DARK, color: '#F5F0E8' }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

export default function DiamondCards({
  diamonds,
  cardBg = BG,
  textColor = DARK,
  mutedColor = MUTED,
  borderColor = BORDER,
}: {
  diamonds: DiamondDetail[]
  cardBg?: string
  textColor?: string
  mutedColor?: string
  borderColor?: string
}) {
  const [selected, setSelected] = useState<number | null>(null)

  return (
    <>
      <div className="space-y-2">
        {diamonds.map((d, i) => {
          const summary = [d.carat && `${d.carat} ct`, d.shape, d.type].filter(Boolean).join(' · ')
          const detail  = [d.design, d.metal, d.ringSize && `Size ${d.ringSize}`, d.chainLength && `Length ${d.chainLength}`].filter(Boolean).join(' · ')
          return (
            <button
              key={i}
              type="button"
              onClick={() => setSelected(i)}
              className="w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all hover:opacity-80 group"
              style={{ background: cardBg, border: `1px solid ${borderColor}` }}
            >
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                style={{ background: 'rgba(201,169,110,0.15)', color: GOLD }}
              >
                {i + 1}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: textColor }}>
                  {summary || `Diamond #${i + 1}`}
                </p>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  {d.code && (
                    <span className="text-xs font-mono font-semibold tracking-wide" style={{ color: GOLD }}>
                      {d.code}
                    </span>
                  )}
                  {detail && (
                    <p className="text-xs truncate" style={{ color: mutedColor }}>{detail}</p>
                  )}
                </div>
              </div>
              <span className="text-xs flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: GOLD }}>
                View ›
              </span>
            </button>
          )
        })}
      </div>

      {selected !== null && (
        <Modal
          diamond={diamonds[selected]}
          index={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  )
}
