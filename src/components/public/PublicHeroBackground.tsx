import Image from 'next/image'

/**
 * Shared animated backdrop — HK nightscape + cinematic black/gold fintech layers.
 */
export default function PublicHeroBackground({ intensity = 'full' }: { intensity?: 'full' | 'soft' }) {
  const soft = intensity === 'soft'
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {/* Full-bleed city nightscape */}
      <Image
        src="/marketing/hero-city-night.png"
        alt=""
        fill
        priority={intensity === 'full'}
        sizes="100vw"
        className="object-cover object-[center_35%]"
        style={{ opacity: soft ? 0.38 : 0.62 }}
      />

      {/* Subtle SVG geometry on top of photo */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: 'url(/hero-bg.svg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center top',
          opacity: soft ? 0.18 : 0.28,
          mixBlendMode: 'screen',
        }}
      />

      {/* Readability wash — keep brand text legible */}
      <div
        className="absolute inset-0"
        style={{
          background: soft
            ? 'linear-gradient(90deg, rgba(6,6,6,0.82) 0%, rgba(6,6,6,0.55) 48%, rgba(6,6,6,0.72) 100%), linear-gradient(180deg, rgba(6,6,6,0.45) 0%, transparent 35%, rgba(6,6,6,0.88) 100%)'
            : 'linear-gradient(105deg, rgba(6,6,6,0.78) 0%, rgba(6,6,6,0.35) 42%, rgba(6,6,6,0.55) 68%, rgba(6,6,6,0.82) 100%), linear-gradient(180deg, rgba(6,6,6,0.35) 0%, transparent 28%, rgba(6,6,6,0.75) 78%, #060606 100%)',
        }}
      />

      {/* Gold atmosphere bloom */}
      <div
        className="hero-orb hero-orb-a absolute rounded-full blur-3xl"
        style={{
          width: 'min(90vw, 48rem)',
          height: 'min(55vh, 32rem)',
          top: soft ? '-18%' : '-8%',
          left: '42%',
          transform: 'translateX(-50%)',
          background: 'radial-gradient(closest-side, rgba(201, 169, 110, 0.2) 0%, transparent 100%)',
          opacity: soft ? 0.45 : 0.75,
        }}
      />
      <div
        className="hero-orb hero-orb-b absolute rounded-full blur-3xl"
        style={{
          width: 'min(50vw, 26rem)',
          height: 'min(40vh, 22rem)',
          top: '18%',
          right: '-4%',
          background: 'radial-gradient(closest-side, rgba(240, 208, 144, 0.1) 0%, transparent 100%)',
        }}
      />

      <div className="hero-beam hero-beam-a absolute inset-0" />
      <div className="hero-beam hero-beam-b absolute inset-0" />

      <div className="hero-perspective-grid absolute inset-0 opacity-70" />
      <div className="hero-fine-grid absolute inset-0" />
      <div className="hero-noise absolute inset-0" />
      <div className="hero-scanline" />

      <div className="hero-frame absolute inset-4 md:inset-6 lg:inset-8 opacity-35" />

      <div
        className="absolute bottom-0 left-0 right-0 h-px"
        style={{
          background: 'linear-gradient(90deg, transparent, #2A2418 20%, #2A2418 80%, transparent)',
        }}
      />
      <div className="hero-line-shimmer absolute bottom-0 left-0 h-px w-full" />
    </div>
  )
}
