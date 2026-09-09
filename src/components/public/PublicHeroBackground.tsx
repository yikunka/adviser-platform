/**
 * Shared animated backdrop — cinematic black/gold fintech atmosphere.
 */
export default function PublicHeroBackground({ intensity = 'full' }: { intensity?: 'full' | 'soft' }) {
  const soft = intensity === 'soft'
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {/* Full-bleed visual plane */}
      <div
        className="absolute inset-0 opacity-[0.55]"
        style={{
          backgroundImage: 'url(/hero-bg.svg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center top',
        }}
      />

      {/* Deep vignette */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 80% 70% at 50% 40%, transparent 0%, #080808 72%), linear-gradient(180deg, rgba(8,8,8,0.2) 0%, transparent 30%, #080808 100%)',
        }}
      />

      {/* Primary gold bloom */}
      <div
        className="hero-orb hero-orb-a absolute rounded-full blur-3xl"
        style={{
          width: 'min(90vw, 48rem)',
          height: 'min(55vh, 32rem)',
          top: soft ? '-18%' : '-8%',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'radial-gradient(closest-side, rgba(201, 169, 110, 0.22) 0%, transparent 100%)',
          opacity: soft ? 0.55 : 0.9,
        }}
      />
      <div
        className="hero-orb hero-orb-b absolute rounded-full blur-3xl"
        style={{
          width: 'min(50vw, 26rem)',
          height: 'min(40vh, 22rem)',
          top: '15%',
          right: '-6%',
          background: 'radial-gradient(closest-side, rgba(240, 208, 144, 0.12) 0%, transparent 100%)',
        }}
      />

      {/* Diagonal light beams */}
      <div className="hero-beam hero-beam-a absolute inset-0" />
      <div className="hero-beam hero-beam-b absolute inset-0" />

      <div className="hero-perspective-grid absolute inset-0" />
      <div className="hero-fine-grid absolute inset-0" />
      <div className="hero-noise absolute inset-0" />
      <div className="hero-scanline" />

      {/* Corner brackets */}
      <div className="hero-frame absolute inset-4 md:inset-6 lg:inset-8 opacity-40" />

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
