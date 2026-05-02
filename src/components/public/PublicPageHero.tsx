import PublicHeroBackground from '@/components/public/PublicHeroBackground'

type Props = {
  title: string
  subtitle: string
  eyebrow?: string
}

/**
 * Consistent top-of-page hero for Services, About, Contact, FAQ (matches home theme).
 */
export default function PublicPageHero({ title, subtitle, eyebrow }: Props) {
  return (
    <section
      className="relative overflow-hidden"
      style={{ background: '#0C0C0C' }}
    >
      <PublicHeroBackground />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 50% 40% at 50% 0%, rgba(201, 169, 110, 0.05) 0%, transparent 55%)',
        }}
      />
      <div className="relative mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-20 md:py-28 text-center">
        {eyebrow ? (
          <p
            className="text-xs uppercase tracking-[0.3em] mb-4"
            style={{ color: '#C9A96E' }}
          >
            {eyebrow}
          </p>
        ) : null}
        <h1
          className="font-display text-4xl md:text-5xl lg:text-6xl font-light leading-[1.12] tracking-tight"
          style={{ color: '#F0EAD8' }}
        >
          {title}
        </h1>
        <p
          className="mt-5 text-base md:text-lg max-w-2xl mx-auto leading-relaxed"
          style={{ color: '#7A7060' }}
        >
          {subtitle}
        </p>
      </div>
    </section>
  )
}
