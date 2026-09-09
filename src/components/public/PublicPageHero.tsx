import Image from 'next/image'
import PublicHeroBackground from '@/components/public/PublicHeroBackground'

type Props = {
  title: string
  subtitle: string
  eyebrow?: string
  showBrand?: boolean
}

/**
 * Consistent top-of-page hero for Services, About, Contact, FAQ.
 */
export default function PublicPageHero({ title, subtitle, eyebrow, showBrand = true }: Props) {
  return (
    <section className="relative overflow-hidden" style={{ background: '#0A0A0A' }}>
      <PublicHeroBackground />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 55% 45% at 50% 0%, rgba(201, 169, 110, 0.07) 0%, transparent 60%)',
        }}
      />
      <div className="relative mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-16 md:py-24 text-center">
        {showBrand ? (
          <div className="public-fade-up flex items-center justify-center gap-2.5 mb-6">
            <Image src="/logo.png" width={28} height={28} alt="" className="opacity-90" />
            <span
              className="font-display text-sm tracking-[0.2em] uppercase"
              style={{ color: '#C9A96E' }}
            >
              6AM Advisory
            </span>
          </div>
        ) : null}
        {eyebrow ? (
          <p
            className="public-fade-up public-fade-up-delay-1 text-xs uppercase tracking-[0.28em] mb-4"
            style={{ color: '#C9A96E' }}
          >
            {eyebrow}
          </p>
        ) : null}
        <h1
          className="public-fade-up public-fade-up-delay-2 font-display text-4xl md:text-5xl lg:text-[3.25rem] font-light leading-[1.12] tracking-tight"
          style={{ color: '#F5F0E6' }}
        >
          {title}
        </h1>
        <div
          className="public-fade-up public-fade-up-delay-3 mx-auto mt-5 h-px w-16"
          style={{
            background: 'linear-gradient(90deg, transparent, #C9A96E, transparent)',
          }}
        />
        <p
          className="public-fade-up public-fade-up-delay-4 mt-5 text-base md:text-lg max-w-2xl mx-auto leading-relaxed"
          style={{ color: '#A89880' }}
        >
          {subtitle}
        </p>
      </div>
    </section>
  )
}
