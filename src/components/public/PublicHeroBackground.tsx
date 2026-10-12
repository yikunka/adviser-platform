import Image from 'next/image'

/**
 * Shared animated backdrop — restrained HK nightscape + matte champagne layers
 * for a private-bank / high-net-worth feel.
 */
export default function PublicHeroBackground({ intensity = 'full' }: { intensity?: 'full' | 'soft' }) {
  const soft = intensity === 'soft'
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {/* Full-bleed city — slow ken burns zoom */}
      <div className="absolute inset-0 hero-city-zoom">
        <Image
          src="/marketing/hero-city-night.png"
          alt=""
          fill
          priority={intensity === 'full'}
          sizes="100vw"
          className="object-cover object-[center_40%] scale-110"
          style={{ opacity: soft ? 0.42 : 0.62 }}
        />
      </div>

      {/* Color grade: muted champagne lift */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(180deg, rgba(180,148,92,0.08) 0%, transparent 40%, rgba(180,148,92,0.06) 100%)',
          mixBlendMode: 'soft-light',
        }}
      />

      <div
        className="absolute inset-0"
        style={{
          backgroundImage: 'url(/hero-bg.svg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center top',
          opacity: soft ? 0.12 : 0.18,
          mixBlendMode: 'screen',
        }}
      />

      {/* Deeper wash — quieter, more private-desk atmosphere */}
      <div
        className="absolute inset-0"
        style={{
          background: soft
            ? 'linear-gradient(90deg, rgba(4,4,4,0.86) 0%, rgba(4,4,4,0.5) 55%, rgba(4,4,4,0.72) 100%), linear-gradient(180deg, rgba(4,4,4,0.45) 0%, transparent 40%, rgba(4,4,4,0.92) 100%)'
            : 'linear-gradient(100deg, rgba(4,4,4,0.9) 0%, rgba(4,4,4,0.55) 38%, rgba(4,4,4,0.28) 58%, rgba(4,4,4,0.7) 100%), linear-gradient(180deg, rgba(4,4,4,0.4) 0%, transparent 32%, rgba(4,4,4,0.65) 72%, #040404 100%)',
        }}
      />

      <div
        className="hero-orb hero-orb-a absolute rounded-full blur-3xl"
        style={{
          width: 'min(95vw, 52rem)',
          height: 'min(60vh, 36rem)',
          top: soft ? '-20%' : '-6%',
          left: '38%',
          transform: 'translateX(-50%)',
          background: 'radial-gradient(closest-side, rgba(201, 169, 110, 0.32) 0%, transparent 100%)',
          opacity: soft ? 0.5 : 0.95,
        }}
      />
      <div
        className="hero-orb hero-orb-b absolute rounded-full blur-3xl"
        style={{
          width: 'min(55vw, 30rem)',
          height: 'min(45vh, 24rem)',
          top: '12%',
          right: '-8%',
          background: 'radial-gradient(closest-side, rgba(240, 208, 144, 0.18) 0%, transparent 100%)',
        }}
      />

      <div className="hero-beam hero-beam-a absolute inset-0" />
      <div className="hero-beam hero-beam-b absolute inset-0" />

      <div className="hero-perspective-grid absolute inset-0 opacity-60" />
      <div className="hero-fine-grid absolute inset-0" />
      <div className="hero-noise absolute inset-0" />
      <div className="hero-scanline" />

      <div className="hero-frame absolute inset-3 md:inset-5 lg:inset-7 opacity-50" />

      <div
        className="absolute bottom-0 left-0 right-0 h-px"
        style={{
          background: 'linear-gradient(90deg, transparent, #C9A96E 40%, #F0D090 50%, #C9A96E 60%, transparent)',
        }}
      />
      <div className="hero-line-shimmer absolute bottom-0 left-0 h-px w-full" />
    </div>
  )
}
