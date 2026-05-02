/**
 * Shared animated backdrop for the marketing site hero & inner page headers.
 */
export default function PublicHeroBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {/* Soft primary glow — slow drift */}
      <div
        className="hero-orb hero-orb-a absolute rounded-full opacity-80 blur-3xl"
        style={{
          width: 'min(80vw, 42rem)',
          height: 'min(50vh, 28rem)',
          top: '-12%',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'radial-gradient(closest-side, rgba(201, 169, 110, 0.12) 0%, transparent 100%)',
        }}
      />
      <div
        className="hero-orb hero-orb-b absolute rounded-full opacity-60 blur-3xl"
        style={{
          width: 'min(60vw, 28rem)',
          height: 'min(40vh, 20rem)',
          top: '8%',
          right: '-8%',
          background: 'radial-gradient(closest-side, rgba(201, 169, 110, 0.07) 0%, transparent 100%)',
        }}
      />
      <div
        className="hero-orb hero-orb-c absolute rounded-full opacity-50 blur-3xl"
        style={{
          width: 'min(50vw, 24rem)',
          height: 'min(35vh, 18rem)',
          bottom: '5%',
          left: '-5%',
          background: 'radial-gradient(closest-side, rgba(240, 234, 216, 0.04) 0%, transparent 100%)',
        }}
      />
      {/* Subtle perspective grid — fades to edges */}
      <div className="hero-perspective-grid absolute inset-0" />
      {/* Shimmer at bottom rule */}
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
