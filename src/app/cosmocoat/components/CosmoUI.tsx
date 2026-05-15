import { MONO, RED, CYAN } from '../lib/theme'

export function SectionLabel({
  children,
  color = CYAN,
}: {
  children: React.ReactNode
  color?: string
}) {
  return (
    <p className="text-[11px] font-bold tracking-[0.35em] uppercase mb-4" style={{ color, fontFamily: MONO }}>
      {'// '}{children}
    </p>
  )
}

export function RedLine({ align = 'left' }: { align?: 'left' | 'right' }) {
  return (
    <div
      className={`w-16 h-px my-5 ${align === 'right' ? 'ml-auto' : ''}`}
      style={{
        background:
          align === 'right'
            ? `linear-gradient(270deg, ${RED}, transparent)`
            : `linear-gradient(90deg, ${RED}, transparent)`,
        boxShadow: `0 0 8px ${RED}`,
      }}
    />
  )
}
