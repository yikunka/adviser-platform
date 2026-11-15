import Image from 'next/image'
import PublicHeroBackground from '@/components/public/PublicHeroBackground'

type Props = {
  title: string
  subtitle: string
  eyebrow?: string
  showBrand?: boolean
}

/**
 * Inner-page hero — left-weighted brand + gradient heading (skill Design Values).
 */
export default function PublicPageHero({ title, subtitle, eyebrow, showBrand = true }: Props) {
  return (
    <section className="relative overflow-hidden min-h-[18rem] md:min-h-[22rem]" style={{ background: '#000000' }}>
      <PublicHeroBackground intensity="soft" />
      <div className="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-16 md:py-24">
        <div className="max-w-[42rem]">
          {showBrand ? (
            <div className="public-hero-brand flex items-center gap-3 mb-6">
              <Image src="/logo.png" width={28} height={28} alt="" className="opacity-95" />
              <span className="text-xs font-medium tracking-[0.2em] uppercase text-[#9B9B9B]">
                6AM Advisory
              </span>
            </div>
          ) : null}
          {eyebrow ? (
            <p className="public-hero-brand text-xs font-medium tracking-[0.2em] uppercase text-[#9B9B9B] mb-4">
              {eyebrow}
            </p>
          ) : null}
          <h1 className="public-hero-title tcsp-hero-heading text-4xl md:text-5xl lg:text-6xl font-semibold tracking-tight leading-none">
            {title}
          </h1>
          <div className="public-hero-sub mt-5 h-px w-16 bg-[#313131]" />
          <p className="public-hero-sub mt-5 text-base md:text-lg max-w-xl leading-7 text-[#9B9B9B] text-pretty">
            {subtitle}
          </p>
        </div>
      </div>
    </section>
  )
}
