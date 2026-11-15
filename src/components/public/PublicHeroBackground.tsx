import Image from 'next/image'

/**
 * Shared backdrop — quiet Hong Kong nightscape with restrained champagne wash.
 * Soft mode is preferred for the public home hero (less stage, more room).
 */
export default function PublicHeroBackground({ intensity = 'full' }: { intensity?: 'full' | 'soft' }) {
  const soft = intensity === 'soft'
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <div className={soft ? 'absolute inset-0' : 'absolute inset-0 hero-city-zoom'}>
        <Image
          src="/marketing/hero-city-night.png"
          alt=""
          fill
          priority={intensity === 'full'}
          sizes="100vw"
          className="object-cover object-[center_42%]"
          style={{ opacity: soft ? 0.28 : 0.55, transform: soft ? 'scale(1.02)' : 'scale(1.08)' }}
        />
      </div>

      <div
        className="absolute inset-0"
        style={{
          background: soft
            ? 'linear-gradient(180deg, rgba(8,8,8,0.55) 0%, rgba(8,8,8,0.72) 45%, #080808 100%)'
            : 'linear-gradient(100deg, rgba(4,4,4,0.9) 0%, rgba(4,4,4,0.55) 38%, rgba(4,4,4,0.28) 58%, rgba(4,4,4,0.7) 100%), linear-gradient(180deg, rgba(4,4,4,0.4) 0%, transparent 32%, rgba(4,4,4,0.65) 72%, #040404 100%)',
        }}
      />

      {!soft && (
        <>
          <div
            className="absolute inset-0"
            style={{
              background:
                'linear-gradient(180deg, rgba(180,148,92,0.08) 0%, transparent 40%, rgba(180,148,92,0.06) 100%)',
              mixBlendMode: 'soft-light',
            }}
          />
          <div
            className="hero-orb hero-orb-a absolute rounded-full blur-3xl"
            style={{
              width: 'min(95vw, 52rem)',
              height: 'min(60vh, 36rem)',
              top: '-6%',
              left: '38%',
              transform: 'translateX(-50%)',
              background: 'radial-gradient(closest-side, rgba(201, 169, 110, 0.28) 0%, transparent 100%)',
            }}
          />
          <div className="hero-beam hero-beam-a absolute inset-0" />
          <div className="hero-perspective-grid absolute inset-0 opacity-40" />
          <div className="hero-fine-grid absolute inset-0" />
          <div className="hero-noise absolute inset-0" />
        </>
      )}

      {soft && (
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse 70% 50% at 50% 30%, rgba(201,169,110,0.06) 0%, transparent 70%)',
          }}
        />
      )}

      <div
        className="absolute bottom-0 left-0 right-0 h-px"
        style={{
          background: soft
            ? 'linear-gradient(90deg, transparent, rgba(201,169,110,0.25) 50%, transparent)'
            : 'linear-gradient(90deg, transparent, #C9A96E 40%, #F0D090 50%, #C9A96E 60%, transparent)',
        }}
      />
    </div>
  )
}
