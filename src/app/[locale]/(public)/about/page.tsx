import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import { Scale, Target, Handshake, Building, PieChart, FileText, Phone, Mail, MapPin, Clock } from 'lucide-react'
import PublicPageHero from '@/components/public/PublicPageHero'
import { absoluteUrl } from '@/lib/seo'

type MetadataProps = { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: MetadataProps): Promise<Metadata> {
  const { locale } = await params
  const path = `/${locale}/about`
  const title = 'About 6AM Advisory'
  const description = 'Meet 6AM Advisory, a Hong Kong corporate services team supporting company formation, compliance, accounting and business advisory work.'

  return {
    title,
    description,
    alternates: {
      canonical: path,
      languages: { en: '/en/about', zh: '/zh/about' },
    },
    openGraph: {
      title,
      description,
      url: absoluteUrl(path),
      type: 'website',
    },
  }
}

const valueIcons = {
  integrity: Scale,
  expertise: Target,
  partnership: Handshake,
} as const

const coreIcons = {
  formation: Building,
  financial: PieChart,
  secretarial: FileText,
} as const

export default async function AboutPage() {
  const t = await getTranslations('about')

  return (
    <div>
      <PublicPageHero title={t('title')} subtitle={t('subtitle')} />

      <section style={{ background: '#0A0A0A' }}>
        <div className="public-section-rule" />
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-20 md:py-28">
          <div className="grid md:grid-cols-5 gap-10 items-start">
            <div className="md:col-span-2 space-y-3">
              <p className="text-xs uppercase tracking-[0.28em]" style={{ color: '#C9A96E' }}>
                {t('positioningEyebrow')}
              </p>
              <p
                className="text-xs px-2.5 py-1.5 rounded-md inline-block"
                style={{
                  color: '#C9A96E',
                  border: '1px solid rgba(201,169,110,0.28)',
                  background: 'rgba(201,169,110,0.07)',
                }}
              >
                {t('tcspLicence')}
              </p>
            </div>
            <div className="md:col-span-3 space-y-4">
              <p className="text-base md:text-lg leading-relaxed" style={{ color: '#F5F0E6' }}>
                {t('intro')}
              </p>
              <p className="text-sm leading-relaxed" style={{ color: '#A89880' }}>
                {t('positioningDesc')}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section style={{ background: '#0C0C0C' }}>
        <div className="public-section-rule" />
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20 md:py-28">
          <div className="text-center mb-14 space-y-3">
            <p className="text-xs uppercase tracking-[0.28em]" style={{ color: '#C9A96E' }}>
              {t('coresEyebrow')}
            </p>
            <h2 className="font-display text-3xl md:text-4xl font-light" style={{ color: '#F5F0E6' }}>
              {t('coresTitle')}
            </h2>
          </div>
          <div className="grid sm:grid-cols-3 gap-5">
            {(['formation', 'financial', 'secretarial'] as const).map((core) => {
              const Icon = coreIcons[core]
              return (
                <div
                  key={core}
                  className="public-panel public-card-hover rounded-xl p-7 flex flex-col gap-5"
                >
                  <div style={{ height: '2px', width: '2rem', background: '#C9A96E', borderRadius: 1 }} />
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center"
                    style={{ background: 'rgba(201,169,110,0.1)', border: '1px solid rgba(201,169,110,0.18)' }}
                  >
                    <Icon size={20} style={{ color: '#C9A96E' }} />
                  </div>
                  <h3 className="font-display text-lg font-semibold leading-snug" style={{ color: '#F5F0E6' }}>
                    {t(`cores.${core}.title`)}
                  </h3>
                  <p className="text-sm leading-relaxed" style={{ color: '#A89880' }}>
                    {t(`cores.${core}.desc`)}
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      <section style={{ background: '#0A0A0A' }}>
        <div className="public-section-rule" />
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20 md:py-28">
          <h2 className="font-display text-2xl md:text-3xl font-light mb-10" style={{ color: '#F5F0E6' }}>
            {t('valuesTitle')}
          </h2>
          <div className="grid sm:grid-cols-3 gap-5">
            {(['integrity', 'expertise', 'partnership'] as const).map((value) => {
              const Icon = valueIcons[value]
              return (
                <div
                  key={value}
                  className="public-panel public-card-hover rounded-xl p-6 flex flex-col gap-4"
                >
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center"
                    style={{ background: 'rgba(201,169,110,0.1)', border: '1px solid rgba(201,169,110,0.2)' }}
                  >
                    <Icon size={20} style={{ color: '#C9A96E' }} />
                  </div>
                  <h3 className="font-display text-lg font-medium" style={{ color: '#F5F0E6' }}>
                    {t(`values.${value}.title`)}
                  </h3>
                  <p className="text-sm leading-relaxed" style={{ color: '#A89880' }}>
                    {t(`values.${value}.desc`)}
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      <section style={{ background: '#0C0C0C' }}>
        <div className="public-section-rule" />
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-20 md:py-28">
          <h2 className="font-display text-2xl md:text-3xl font-light mb-10" style={{ color: '#F5F0E6' }}>
            {t('officeTitle')}
          </h2>
          <div className="public-panel public-card-hover rounded-xl p-7 md:p-10">
            <div className="grid sm:grid-cols-2 gap-8">
              <div className="space-y-5">
                <div className="flex gap-3 items-start">
                  <MapPin size={16} style={{ color: '#C9A96E', marginTop: 2, flexShrink: 0 }} />
                  <div>
                    <p className="text-xs uppercase tracking-wider mb-0.5" style={{ color: '#8A7A68' }}>
                      {t('address')}
                    </p>
                    <p className="text-sm leading-relaxed" style={{ color: '#C9B896' }}>
                      {t('addressValue')}
                    </p>
                  </div>
                </div>
                <div className="flex gap-3 items-start">
                  <Clock size={16} style={{ color: '#C9A96E', marginTop: 2, flexShrink: 0 }} />
                  <div>
                    <p className="text-xs uppercase tracking-wider mb-0.5" style={{ color: '#8A7A68' }}>
                      {t('hours')}
                    </p>
                    <p className="text-sm" style={{ color: '#C9B896' }}>{t('hoursValue')}</p>
                  </div>
                </div>
              </div>
              <div className="space-y-5">
                <div className="flex gap-3 items-start">
                  <Phone size={16} style={{ color: '#C9A96E', marginTop: 2, flexShrink: 0 }} />
                  <div>
                    <p className="text-xs uppercase tracking-wider mb-0.5" style={{ color: '#8A7A68' }}>
                      {t('phone')}
                    </p>
                    <a
                      href={`tel:${t('phoneValue')}`}
                      className="public-link-hover text-sm block"
                      style={{ color: '#C9A96E' }}
                    >
                      {t('phoneValue')}
                    </a>
                    <a
                      href={`tel:${t('teamPhone2')}`}
                      className="public-link-hover text-sm block mt-0.5"
                      style={{ color: '#C9B896' }}
                    >
                      {t('teamPhone2')}
                    </a>
                  </div>
                </div>
                <div className="flex gap-3 items-start">
                  <Mail size={16} style={{ color: '#C9A96E', marginTop: 2, flexShrink: 0 }} />
                  <div>
                    <p className="text-xs uppercase tracking-wider mb-0.5" style={{ color: '#8A7A68' }}>
                      {t('email')}
                    </p>
                    <a
                      href={`mailto:${t('emailValue')}`}
                      className="public-link-hover text-sm"
                      style={{ color: '#C9A96E' }}
                    >
                      {t('emailValue')}
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="text-center mt-10">
            <Link
              href="/contact"
              className="inline-flex items-center justify-center gap-2 px-8 py-3 rounded-md text-sm font-semibold transition-opacity hover:opacity-90"
              style={{ background: '#C9A96E', color: '#0C0C0C' }}
            >
              {t('contactUs')}
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
