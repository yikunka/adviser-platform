import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import { Scale, Target, Handshake, Building, PieChart, FileText, Phone, Mail, MapPin, Clock } from 'lucide-react'
import PublicPageHero from '@/components/public/PublicPageHero'

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

      {/* ── Positioning / Who We Are ── */}
      <section style={{ background: '#0A0A0A', borderTop: '1px solid #1E1A12' }}>
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-20 md:py-28">
          <div className="grid md:grid-cols-5 gap-10 items-start">
            <div className="md:col-span-2 space-y-3">
              <p className="text-xs uppercase tracking-widest" style={{ color: '#C9A96E' }}>
                {t('positioningEyebrow')}
              </p>
              <p
                className="text-xs px-2.5 py-1 rounded inline-block"
                style={{ color: '#9A8060', border: '1px solid #2A2418', background: 'rgba(201,169,110,0.06)' }}
              >
                {t('tcspLicence')}
              </p>
            </div>
            <div className="md:col-span-3 space-y-4">
              <p className="text-base md:text-lg leading-relaxed" style={{ color: '#F0EAD8' }}>
                {t('intro')}
              </p>
              <p className="text-sm leading-relaxed" style={{ color: '#7A7060' }}>
                {t('positioningDesc')}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Core Strategies ── */}
      <section style={{ background: '#0C0C0C', borderTop: '1px solid #1E1A12' }}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20 md:py-28">
          <div className="text-center mb-14 space-y-3">
            <p className="text-xs uppercase tracking-widest" style={{ color: '#C9A96E' }}>
              {t('coresEyebrow')}
            </p>
            <h2 className="font-display text-3xl md:text-4xl font-light" style={{ color: '#F0EAD8' }}>
              {t('coresTitle')}
            </h2>
          </div>
          <div className="grid sm:grid-cols-3 gap-6">
            {(['formation', 'financial', 'secretarial'] as const).map((core) => {
              const Icon = coreIcons[core]
              return (
                <div
                  key={core}
                  className="public-card-hover rounded-2xl p-7 flex flex-col gap-5"
                  style={{ background: '#141414', border: '1px solid #2A2418' }}
                >
                  <div style={{ height: '2px', width: '2rem', background: '#C9A96E', borderRadius: 1 }} />
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center"
                    style={{ background: 'rgba(201,169,110,0.1)', border: '1px solid rgba(201,169,110,0.18)' }}
                  >
                    <Icon size={20} style={{ color: '#C9A96E' }} />
                  </div>
                  <h3 className="font-display text-lg font-semibold leading-snug" style={{ color: '#F0EAD8' }}>
                    {t(`cores.${core}.title`)}
                  </h3>
                  <p className="text-sm leading-relaxed" style={{ color: '#7A7060' }}>
                    {t(`cores.${core}.desc`)}
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── Core Values ── */}
      <section style={{ background: '#0A0A0A', borderTop: '1px solid #1E1A12' }}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20 md:py-28">
          <h2 className="font-display text-2xl md:text-3xl font-light mb-10" style={{ color: '#F0EAD8' }}>
            {t('valuesTitle')}
          </h2>
          <div className="grid sm:grid-cols-3 gap-5 md:gap-6">
            {(['integrity', 'expertise', 'partnership'] as const).map((value) => {
              const Icon = valueIcons[value]
              return (
                <div
                  key={value}
                  className="public-card-hover rounded-2xl p-6 flex flex-col gap-4"
                  style={{ background: '#141414', border: '1px solid #2A2418' }}
                >
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center"
                    style={{ background: 'rgba(201,169,110,0.1)', border: '1px solid rgba(201,169,110,0.2)' }}
                  >
                    <Icon size={20} style={{ color: '#C9A96E' }} />
                  </div>
                  <h3 className="font-display text-lg font-medium" style={{ color: '#F0EAD8' }}>
                    {t(`values.${value}.title`)}
                  </h3>
                  <p className="text-sm leading-relaxed" style={{ color: '#7A7060' }}>
                    {t(`values.${value}.desc`)}
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── Office & Contact ── */}
      <section style={{ background: '#0C0C0C', borderTop: '1px solid #1E1A12' }}>
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-20 md:py-28">
          <h2 className="font-display text-2xl md:text-3xl font-light mb-10" style={{ color: '#F0EAD8' }}>
            {t('officeTitle')}
          </h2>
          <div
            className="rounded-2xl p-7 md:p-10 public-card-hover"
            style={{ background: '#141414', border: '1px solid #2A2418' }}
          >
            <div className="grid sm:grid-cols-2 gap-8">
              <div className="space-y-5">
                <div className="flex gap-3 items-start">
                  <MapPin size={16} style={{ color: '#C9A96E', marginTop: 2, flexShrink: 0 }} />
                  <div>
                    <p className="text-xs uppercase tracking-wider mb-0.5" style={{ color: '#7A7060' }}>
                      {t('address')}
                    </p>
                    <p className="text-sm leading-relaxed" style={{ color: '#9A8060' }}>
                      {t('addressValue')}
                    </p>
                  </div>
                </div>
                <div className="flex gap-3 items-start">
                  <Clock size={16} style={{ color: '#C9A96E', marginTop: 2, flexShrink: 0 }} />
                  <div>
                    <p className="text-xs uppercase tracking-wider mb-0.5" style={{ color: '#7A7060' }}>
                      {t('hours')}
                    </p>
                    <p className="text-sm" style={{ color: '#9A8060' }}>{t('hoursValue')}</p>
                  </div>
                </div>
              </div>
              <div className="space-y-5">
                <div className="flex gap-3 items-start">
                  <Phone size={16} style={{ color: '#C9A96E', marginTop: 2, flexShrink: 0 }} />
                  <div>
                    <p className="text-xs uppercase tracking-wider mb-0.5" style={{ color: '#7A7060' }}>
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
                      style={{ color: '#9A8060' }}
                    >
                      {t('teamPhone2')}
                    </a>
                  </div>
                </div>
                <div className="flex gap-3 items-start">
                  <Mail size={16} style={{ color: '#C9A96E', marginTop: 2, flexShrink: 0 }} />
                  <div>
                    <p className="text-xs uppercase tracking-wider mb-0.5" style={{ color: '#7A7060' }}>
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
              className="inline-flex items-center justify-center gap-2 px-8 py-3 rounded-lg text-sm font-semibold transition-opacity hover:opacity-90"
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
