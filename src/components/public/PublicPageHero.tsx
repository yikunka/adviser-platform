import Image from 'next/image'
import PublicHeroBackground from '@/components/public/PublicHeroBackground'

type Props = {
  title: string
  subtitle: string
  eyebrow?: string
  showBrand?: boolean
}

/**
 * Dramatic inner-page hero — left-weighted brand + title.
 */
export default function PublicPageHero({ title, subtitle, eyebrow, showBrand = true }: Props) {
  return (
    <section className="relative overflow-hidden min-h-[18rem] md:min-h-[22rem]" style={{ background: '#060606' }}>
      <PublicHeroBackground intensity="soft" />
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 md:py-24">
        <div className="max-w-3xl">
          {showBrand ? (
            <div className="public-fade-up flex items-center gap-2.5 mb-6">
              <Image src="/logo.png" width={28} height={28} alt="" className="opacity-95" />
              <span className="font-mono-public text-[11px] tracking-[0.3em] uppercase" style={{ color: '#C9A96E' }}>
                6AM Advisory
              </span>
            </div>
          ) : null}
          {eyebrow ? (
            <p
              className="public-fade-up public-fade-up-delay-1 font-mono-public text-[11px] uppercase tracking-[0.3em] mb-4"
              style={{ color: '#C9A96E' }}
            >
              {eyebrow}
            </p>
          ) : null}
          <h1
            className="public-fade-up public-fade-up-delay-2 font-display font-light leading-[1.08] tracking-tight"
            style={{ color: '#F7F1E4', fontSize: 'clamp(2.4rem, 5.5vw, 4rem)' }}
          >
            {title}
          </h1>
          <div
            className="public-fade-up public-fade-up-delay-3 mt-5 h-px w-20"
            style={{ background: 'linear-gradient(90deg, #C9A96E, transparent)' }}
          />
          <p
            className="public-fade-up public-fade-up-delay-4 mt-5 text-base md:text-lg max-w-2xl leading-relaxed"
            style={{ color: '#B8A890' }}
          >
            {subtitle}
          </p>
        </div>
      </div>
    </section>
  )
}
