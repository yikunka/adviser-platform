import Image from 'next/image'

/**
 * Flat dark backdrop with real photography — no decorative gradients (skill Design Values).
 */
export default function PublicHeroBackground({ intensity = 'full' }: { intensity?: 'full' | 'soft' }) {
  const soft = intensity === 'soft'
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden tcsp-noise" aria-hidden>
      <div className="absolute inset-0">
        <Image
          src="/marketing/hero-city-night.png"
          alt=""
          fill
          priority={intensity === 'full'}
          sizes="100vw"
          className="object-cover object-[center_42%]"
          style={{ opacity: soft ? 0.22 : 0.4 }}
        />
      </div>
      <div
        className="absolute inset-0"
        style={{ background: soft ? 'rgba(0,0,0,0.72)' : 'rgba(0,0,0,0.55)' }}
      />
      <div className="absolute inset-0" style={{ background: '#000000', opacity: soft ? 0.35 : 0.2 }} />
    </div>
  )
}
