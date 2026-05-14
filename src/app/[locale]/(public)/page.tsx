'use client'

import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { Building2, BarChart2, Globe, ArrowRight, ShieldCheck, Clock, Users, Check } from 'lucide-react'
import PublicHeroBackground from '@/components/public/PublicHeroBackground'

/* ── Service pillar card ── */
function ServicePillar({
  Icon,
  title,
  desc,
  href,
}: {
  Icon: React.ElementType
  title: string
  desc: string
  href: string
}) {
  return (
    <Link
      href={href}
      className="public-card-hover rounded-2xl p-7 flex flex-col gap-4 group"
      style={{
        background: '#141414',
        border: '1px solid #2A2418',
      }}
    >
      {/* Gold top accent */}
      <div style={{ height: '2px', width: '2rem', background: '#C9A96E', borderRadius: 1 }} />
      <div
        className="w-11 h-11 rounded-xl flex items-center justify-center"
        style={{ background: 'rgba(201,169,110,0.1)', border: '1px solid rgba(201,169,110,0.18)' }}
      >
        <Icon size={20} style={{ color: '#C9A96E' }} />
      </div>
      <h3
        className="font-display text-xl font-semibold leading-snug"
        style={{ color: '#F0EAD8' }}
      >
        {title}
      </h3>
      <p className="text-sm leading-relaxed" style={{ color: '#7A7060' }}>{desc}</p>
    </Link>
  )
}

/* ── Trust stat ── */
function TrustStat({ value, label }: { value: string; label: string }) {
  return (
    <div className="text-center px-6">
      <p className="font-display text-4xl font-semibold" style={{ color: '#C9A96E' }}>{value}</p>
      <p className="text-xs mt-1 uppercase tracking-widest" style={{ color: '#7A7060' }}>{label}</p>
    </div>
  )
}

export default function HomePage() {
  const t = useTranslations('home')
  const tNav = useTranslations('nav')
  const tS = useTranslations('services')

  const pillars = [
    { Icon: Building2, titleKey: 'pillars.secretarial.title', descKey: 'pillars.secretarial.desc', href: '/services#secretarial' },
    { Icon: BarChart2, titleKey: 'pillars.accounting.title',  descKey: 'pillars.accounting.desc',  href: '/services#accounting'  },
    { Icon: Globe,     titleKey: 'pillars.advisory.title',    descKey: 'pillars.advisory.desc',    href: '/services#advisory'    },
  ] as const

  return (
    <>
      {/* ── Hero ── */}
      <section
        className="relative overflow-hidden"
        style={{ background: '#0C0C0C' }}
      >
        <PublicHeroBackground />
<div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse 60% 50% at 50% 18%, rgba(201,169,110,0.06) 0%, transparent 65%)',
          }}
        />

        <div className="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-28 md:py-40 flex flex-col items-center text-center gap-7">
          {/* H1 — slogan, full width, no wrapping */}
          <h1
            className="font-display font-light leading-none tracking-tight whitespace-nowrap gold-shimmer"
            style={{ fontStyle: 'italic', fontSize: 'clamp(2rem, 5vw, 4.5rem)' }}
          >
            {t('heroTitleSub', { defaultValue: t('heroTitle') })}
          </h1>



          {/* Subtitle */}
          <p
            className="text-base md:text-lg max-w-xl leading-relaxed"
            style={{ color: '#7A7060' }}
          >
            {t('heroSubtitle')}
          </p>

          {/* CTAs */}
          <div className="flex flex-wrap items-center justify-center gap-4 mt-2">
            <Link
              href="/register"
              className="flex items-center gap-2 px-7 py-3 rounded-lg text-sm font-semibold transition-all"
              style={{ background: '#C9A96E', color: '#0C0C0C' }}
            >
              {t('heroCtaStart')}
              <ArrowRight size={15} />
            </Link>
            <Link
              href="/services"
              className="px-7 py-3 rounded-lg text-sm font-medium transition-all"
              style={{ border: '1px solid #3A3020', color: '#9A8060' }}
            >
              {t('heroCtaLearn')}
            </Link>
          </div>
        </div>
      </section>

      {/* ── Trust stats ── */}
      <section style={{ background: '#0A0A0A', borderTop: '1px solid #1E1A12', borderBottom: '1px solid #1E1A12' }}>
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex flex-wrap justify-center gap-y-8 divide-x" style={{ '--tw-divide-opacity': '1' } as React.CSSProperties}>
            <TrustStat value="500+" label={t('stat.companies', { defaultValue: '企業服務' })} />
            <TrustStat value="15+"  label={t('stat.years',     { defaultValue: '年行業經驗' })} />
            <TrustStat value="TCSP" label={t('stat.license',   { defaultValue: '持牌機構' })} />
          </div>
        </div>
      </section>

      {/* ── Service pillars ── */}
      <section style={{ background: '#0C0C0C' }}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-24">
          <div className="text-center mb-14 space-y-3">
            <p className="text-xs uppercase tracking-widest" style={{ color: '#C9A96E' }}>
              {t('pillarsEyebrow', { defaultValue: 'Our Services' })}
            </p>
            <h2
              className="font-display text-4xl md:text-5xl font-light"
              style={{ color: '#F0EAD8' }}
            >
              {t('pillarsTitle')}
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {pillars.map(({ Icon, titleKey, descKey, href }) => (
              <ServicePillar
                key={titleKey}
                Icon={Icon}
                title={t(titleKey)}
                desc={t(descKey)}
                href={href}
              />
            ))}
          </div>
        </div>
      </section>

      {/* ── Why choose us ── */}
      <section style={{ background: '#0C0C0C', borderTop: '1px solid #1E1A12' }}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-24">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <div className="space-y-6">
              <p className="text-xs uppercase tracking-widest" style={{ color: '#C9A96E' }}>
                {t('whyEyebrow', { defaultValue: 'Why 6AM Advisory' })}
              </p>
              <h2
                className="font-display text-4xl md:text-5xl font-light leading-snug"
                style={{ color: '#F0EAD8' }}
              >
                {t('whyTitle', { defaultValue: t('pillarsTitle') })}
              </h2>
              <p className="text-sm leading-relaxed" style={{ color: '#7A7060' }}>
                {t('whyDesc', { defaultValue: t('heroSubtitle') })}
              </p>
              <Link
                href="/about"
                className="inline-flex items-center gap-2 text-sm font-medium transition-colors"
                style={{ color: '#C9A96E' }}
              >
                {tNav('about')} <ArrowRight size={14} />
              </Link>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {[
                { Icon: ShieldCheck, label: t('why.compliance', { defaultValue: 'Compliance Focus' }) },
                { Icon: Clock,       label: t('why.responsive', { defaultValue: 'Fast Turnaround' }) },
                { Icon: Users,       label: t('why.team',       { defaultValue: 'Expert Team' }) },
                { Icon: Globe,       label: t('why.bilingual',  { defaultValue: 'Bilingual Service' }) },
              ].map(({ Icon, label }) => (
                <div
                  key={label}
                  className="rounded-xl p-5 flex flex-col gap-3"
                  style={{ background: '#141414', border: '1px solid #2A2418' }}
                >
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center"
                    style={{ background: 'rgba(201,169,110,0.1)' }}
                  >
                    <Icon size={16} style={{ color: '#C9A96E' }} />
                  </div>
                  <p className="text-sm font-medium" style={{ color: '#F0EAD8' }}>{label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Service Packages + CTA ── */}
      <section style={{ background: '#0A0A0A', borderTop: '1px solid #1E1A12' }}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-24">
          {/* Section header */}
          <div className="text-center mb-14 space-y-3">
            <div style={{ width: 32, height: 1, background: '#C9A96E', margin: '0 auto' }} />
            <h2
              className="font-display text-4xl md:text-5xl font-light leading-snug"
              style={{ color: '#F0EAD8' }}
            >
              {t('ctaTitle')}
            </h2>
            <p className="text-sm leading-relaxed max-w-md mx-auto" style={{ color: '#7A7060' }}>
              {t('ctaDesc')}
            </p>
          </div>

          {/* Pricing tiers */}
          <div className="grid sm:grid-cols-3 gap-6 mb-14">
            {(['basic', 'professional', 'premium'] as const).map((tier, idx) => (
              <div
                key={tier}
                className="public-card-hover rounded-2xl p-7 flex flex-col gap-5"
                style={{
                  background: idx === 1 ? '#1A1510' : '#141414',
                  border: idx === 1 ? '1px solid #C9A96E' : '1px solid #2A2418',
                }}
              >
                {idx === 1 && (
                  <p className="text-xs uppercase tracking-widest" style={{ color: '#C9A96E' }}>
                    {tS('tiers.popular')}
                  </p>
                )}
                <div>
                  <h3 className="font-display text-2xl font-semibold" style={{ color: '#F0EAD8' }}>
                    {tS(`tiers.${tier}`)}
                  </h3>
                  <p className="text-xs mt-1 leading-relaxed" style={{ color: '#7A7060' }}>
                    {tS(`tiers.${tier}Desc`)}
                  </p>
                </div>
                <ul className="space-y-2.5 flex-1">
                  {(tS.raw(`tiers.${tier}Items`) as string[]).map((item: string, i: number) => (
                    <li key={i} className="flex gap-2.5 text-sm" style={{ color: '#9A8060' }}>
                      <Check size={14} className="shrink-0 mt-0.5" style={{ color: '#C9A96E' }} />
                      {item}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/register"
                  className="flex items-center justify-center py-2.5 rounded-lg text-sm font-semibold transition-opacity hover:opacity-90"
                  style={
                    idx === 1
                      ? { background: '#C9A96E', color: '#0C0C0C' }
                      : { border: '1px solid #3A3020', color: '#9A8060' }
                  }
                >
                  {tS('getStarted')}
                </Link>
              </div>
            ))}
          </div>

          {/* CTA button */}
          <div className="text-center">
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 px-8 py-3 rounded-lg text-sm font-semibold transition-all"
              style={{ background: '#C9A96E', color: '#0C0C0C' }}
            >
              {tNav('contact')} <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </section>
    </>
  )
}
