'use client'

import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import {
  Building2,
  BarChart2,
  Globe,
  ArrowRight,
  ShieldCheck,
  Clock,
  Users,
  Check,
  BadgeCheck,
  ScanSearch,
  MapPin,
  UserPlus,
  FileSearch,
  RefreshCw,
} from 'lucide-react'
import PublicHeroBackground from '@/components/public/PublicHeroBackground'

const PILLAR_KEYS = ['secretarial', 'accounting', 'advisory'] as const
const PILLAR_ICONS = { secretarial: Building2, accounting: BarChart2, advisory: Globe } as const
const PILLAR_HREFS = {
  secretarial: '/services#secretarial',
  accounting: '/services#accounting',
  advisory: '/services#advisory',
} as const

export default function HomePage() {
  const t = useTranslations('home')
  const tNav = useTranslations('nav')
  const tS = useTranslations('services')

  return (
    <>
      {/* ── Hero ── */}
      <section className="relative overflow-hidden min-h-[min(92vh,52rem)] flex flex-col justify-center" style={{ background: '#080808' }}>
        <PublicHeroBackground />
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(ellipse 70% 55% at 50% 20%, rgba(201,169,110,0.09) 0%, transparent 62%), linear-gradient(180deg, transparent 55%, #0A0A0A 100%)',
          }}
        />

        <div className="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-20 md:py-28 flex flex-col items-center text-center gap-6">
          {/* Brand as hero signal */}
          <div className="public-fade-up flex flex-col items-center gap-4">
            <Image
              src="/logo.png"
              width={56}
              height={56}
              alt=""
              priority
              className="drop-shadow-[0_0_24px_rgba(201,169,110,0.25)]"
            />
            <p
              className="font-display text-2xl sm:text-3xl md:text-4xl font-semibold tracking-[0.04em]"
              style={{ color: '#F5F0E6' }}
            >
              {t('heroTitleHighlight')}
            </p>
          </div>

          <h1
            className="public-fade-up public-fade-up-delay-1 font-display font-light leading-[1.15] tracking-tight gold-shimmer max-w-4xl px-2"
            style={{ fontStyle: 'italic', fontSize: 'clamp(1.65rem, 4.2vw, 3.35rem)' }}
          >
            {t('heroTitleSub')}
          </h1>

          <p
            className="public-fade-up public-fade-up-delay-2 text-base md:text-lg max-w-2xl leading-relaxed"
            style={{ color: '#A89880' }}
          >
            {t('heroSubtitle')}
          </p>

          <div
            className="public-fade-up public-fade-up-delay-3 inline-flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs tracking-wide"
            style={{
              color: '#C9A96E',
              border: '1px solid rgba(201,169,110,0.28)',
              background: 'rgba(201,169,110,0.07)',
            }}
          >
            <BadgeCheck size={14} aria-hidden />
            {t('heroTrustBadge')}
          </div>

          <div className="public-fade-up public-fade-up-delay-4 flex flex-wrap items-center justify-center gap-3 mt-1">
            <Link
              href="/register"
              className="flex items-center gap-2 px-7 py-3 rounded-md text-sm font-semibold transition-opacity hover:opacity-90"
              style={{ background: '#C9A96E', color: '#0C0C0C' }}
            >
              {t('heroCtaStart')}
              <ArrowRight size={15} />
            </Link>
            <Link
              href="/services"
              className="px-7 py-3 rounded-md text-sm font-medium transition-colors"
              style={{ border: '1px solid #3A3020', color: '#C9B896' }}
            >
              {t('heroCtaLearn')}
            </Link>
          </div>
        </div>
      </section>

      {/* ── Trust strip ── */}
      <section style={{ background: '#0A0A0A' }}>
        <div className="public-section-rule" />
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-14 md:py-16">
          <p className="text-xs uppercase tracking-[0.28em] text-center mb-10" style={{ color: '#C9A96E' }}>
            {t('trustStrip.eyebrow')}
          </p>
          <div className="grid md:grid-cols-3 gap-5">
            {(
              [
                { key: 'licensed' as const, Icon: BadgeCheck },
                { key: 'aml' as const, Icon: ScanSearch },
                { key: 'hk' as const, Icon: MapPin },
              ]
            ).map(({ key, Icon }) => (
              <div
                key={key}
                className="public-panel public-card-hover rounded-xl px-6 py-6 flex gap-4 items-start"
              >
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: 'rgba(201,169,110,0.1)', border: '1px solid rgba(201,169,110,0.2)' }}
                >
                  <Icon size={18} style={{ color: '#C9A96E' }} />
                </div>
                <div>
                  <p className="text-sm font-semibold mb-1" style={{ color: '#F5F0E6' }}>
                    {t(`trustStrip.${key}.title`)}
                  </p>
                  <p className="text-sm leading-relaxed" style={{ color: '#A89880' }}>
                    {t(`trustStrip.${key}.desc`)}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-12 flex flex-wrap justify-center gap-x-12 gap-y-6">
            <TrustStat value="500+" label={t('stat.companies')} />
            <TrustStat value="15+" label={t('stat.years')} />
            <TrustStat value="TCSP" label={t('stat.license')} />
          </div>
        </div>
      </section>

      {/* ── Service pillars ── */}
      <section style={{ background: '#0C0C0C' }}>
        <div className="public-section-rule" />
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20 md:py-28">
          <div className="text-center mb-14 space-y-3">
            <p className="text-xs uppercase tracking-[0.28em]" style={{ color: '#C9A96E' }}>
              {t('pillarsEyebrow')}
            </p>
            <h2 className="font-display text-3xl md:text-5xl font-light" style={{ color: '#F5F0E6' }}>
              {t('pillarsTitle')}
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-5">
            {PILLAR_KEYS.map((key) => {
              const Icon = PILLAR_ICONS[key]
              const bullets = t.raw(`pillars.${key}.bullets`) as string[]
              return (
                <Link
                  key={key}
                  href={PILLAR_HREFS[key]}
                  className="public-panel public-card-hover rounded-xl p-7 flex flex-col gap-5 group"
                >
                  <div className="flex items-center justify-between">
                    <div
                      className="w-11 h-11 rounded-xl flex items-center justify-center"
                      style={{ background: 'rgba(201,169,110,0.1)', border: '1px solid rgba(201,169,110,0.18)' }}
                    >
                      <Icon size={20} style={{ color: '#C9A96E' }} />
                    </div>
                    <ArrowRight
                      size={16}
                      className="opacity-40 group-hover:opacity-100 transition-opacity"
                      style={{ color: '#C9A96E' }}
                    />
                  </div>
                  <div>
                    <h3 className="font-display text-xl font-semibold leading-snug mb-2" style={{ color: '#F5F0E6' }}>
                      {t(`pillars.${key}.title`)}
                    </h3>
                    <p className="text-sm leading-relaxed" style={{ color: '#A89880' }}>
                      {t(`pillars.${key}.desc`)}
                    </p>
                  </div>
                  <ul className="space-y-2 pt-1 border-t" style={{ borderColor: '#2A2418' }}>
                    {bullets.map((item) => (
                      <li key={item} className="flex gap-2 text-sm" style={{ color: '#C9B896' }}>
                        <Check size={14} className="shrink-0 mt-0.5" style={{ color: '#C9A96E' }} />
                        {item}
                      </li>
                    ))}
                  </ul>
                </Link>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── Compliance journey ── */}
      <section style={{ background: '#0A0A0A' }}>
        <div className="public-section-rule" />
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20 md:py-28">
          <div className="max-w-2xl mb-12 space-y-3">
            <p className="text-xs uppercase tracking-[0.28em]" style={{ color: '#C9A96E' }}>
              {t('journeyEyebrow')}
            </p>
            <h2 className="font-display text-3xl md:text-4xl font-light leading-snug" style={{ color: '#F5F0E6' }}>
              {t('journeyTitle')}
            </h2>
            <p className="text-sm md:text-base leading-relaxed" style={{ color: '#A89880' }}>
              {t('journeyDesc')}
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-5 relative">
            {(
              [
                { key: 'onboard' as const, Icon: UserPlus, step: '01' },
                { key: 'kyc' as const, Icon: FileSearch, step: '02' },
                { key: 'ongoing' as const, Icon: RefreshCw, step: '03' },
              ]
            ).map(({ key, Icon, step }, idx) => (
              <div key={key} className="relative">
                {idx < 2 ? (
                  <div
                    className="hidden md:block absolute top-10 left-[calc(100%-0.5rem)] w-[calc(100%-2rem)] h-px z-0"
                    style={{
                      background: 'linear-gradient(90deg, rgba(201,169,110,0.35), rgba(201,169,110,0.05))',
                    }}
                    aria-hidden
                  />
                ) : null}
                <div className="public-panel public-card-hover relative z-10 rounded-xl p-6 md:p-7 space-y-4">
                  <div className="flex items-center justify-between">
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center"
                      style={{ background: 'rgba(201,169,110,0.1)', border: '1px solid rgba(201,169,110,0.2)' }}
                    >
                      <Icon size={18} style={{ color: '#C9A96E' }} />
                    </div>
                    <span className="font-display text-2xl font-light" style={{ color: 'rgba(201,169,110,0.35)' }}>
                      {step}
                    </span>
                  </div>
                  <h3 className="font-display text-lg font-semibold" style={{ color: '#F5F0E6' }}>
                    {t(`journey.${key}.title`)}
                  </h3>
                  <p className="text-sm leading-relaxed" style={{ color: '#A89880' }}>
                    {t(`journey.${key}.desc`)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Why choose us ── */}
      <section style={{ background: '#0C0C0C' }}>
        <div className="public-section-rule" />
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20 md:py-28">
          <div className="grid md:grid-cols-2 gap-12 md:gap-16 items-center">
            <div className="space-y-6">
              <p className="text-xs uppercase tracking-[0.28em]" style={{ color: '#C9A96E' }}>
                {t('whyEyebrow')}
              </p>
              <h2 className="font-display text-3xl md:text-5xl font-light leading-snug" style={{ color: '#F5F0E6' }}>
                {t('whyTitle')}
              </h2>
              <p className="text-sm md:text-base leading-relaxed" style={{ color: '#A89880' }}>
                {t('whyDesc')}
              </p>
              <Link
                href="/about"
                className="inline-flex items-center gap-2 text-sm font-medium transition-opacity hover:opacity-80"
                style={{ color: '#C9A96E' }}
              >
                {tNav('about')} <ArrowRight size={14} />
              </Link>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {(
                [
                  { Icon: ShieldCheck, label: t('why.compliance') },
                  { Icon: Clock, label: t('why.responsive') },
                  { Icon: Users, label: t('why.team') },
                  { Icon: Globe, label: t('why.bilingual') },
                ]
              ).map(({ Icon, label }) => (
                <div key={label} className="public-panel public-card-hover rounded-xl p-5 flex flex-col gap-3">
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center"
                    style={{ background: 'rgba(201,169,110,0.1)' }}
                  >
                    <Icon size={16} style={{ color: '#C9A96E' }} />
                  </div>
                  <p className="text-sm font-medium" style={{ color: '#F5F0E6' }}>
                    {label}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Packages + CTA ── */}
      <section style={{ background: '#0A0A0A' }}>
        <div className="public-section-rule" />
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20 md:py-28">
          <div className="text-center mb-14 space-y-3">
            <div style={{ width: 32, height: 1, background: '#C9A96E', margin: '0 auto' }} />
            <h2 className="font-display text-3xl md:text-5xl font-light leading-snug" style={{ color: '#F5F0E6' }}>
              {t('ctaTitle')}
            </h2>
            <p className="text-sm leading-relaxed max-w-md mx-auto" style={{ color: '#A89880' }}>
              {t('ctaDesc')}
            </p>
          </div>

          <div className="grid sm:grid-cols-3 gap-5 mb-14">
            {(['basic', 'professional', 'premium'] as const).map((tier, idx) => (
              <div
                key={tier}
                className={`public-card-hover rounded-xl p-7 flex flex-col gap-5 ${idx === 1 ? '' : 'public-panel'}`}
                style={
                  idx === 1
                    ? {
                        background: 'linear-gradient(165deg, #1C1710 0%, #14110C 100%)',
                        border: '1px solid #C9A96E',
                      }
                    : undefined
                }
              >
                {idx === 1 && (
                  <p className="text-xs uppercase tracking-widest" style={{ color: '#C9A96E' }}>
                    {tS('tiers.popular')}
                  </p>
                )}
                <div>
                  <h3 className="font-display text-2xl font-semibold" style={{ color: '#F5F0E6' }}>
                    {tS(`tiers.${tier}`)}
                  </h3>
                  <p className="text-xs mt-1 leading-relaxed" style={{ color: '#A89880' }}>
                    {tS(`tiers.${tier}Desc`)}
                  </p>
                </div>
                <ul className="space-y-2.5 flex-1">
                  {(tS.raw(`tiers.${tier}Items`) as string[]).map((item: string, i: number) => (
                    <li key={i} className="flex gap-2.5 text-sm" style={{ color: '#C9B896' }}>
                      <Check size={14} className="shrink-0 mt-0.5" style={{ color: '#C9A96E' }} />
                      {item}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/register"
                  className="flex items-center justify-center py-2.5 rounded-md text-sm font-semibold transition-opacity hover:opacity-90"
                  style={
                    idx === 1
                      ? { background: '#C9A96E', color: '#0C0C0C' }
                      : { border: '1px solid #3A3020', color: '#C9B896' }
                  }
                >
                  {tS('getStarted')}
                </Link>
              </div>
            ))}
          </div>

          <div className="text-center">
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 px-8 py-3 rounded-md text-sm font-semibold transition-opacity hover:opacity-90"
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

function TrustStat({ value, label }: { value: string; label: string }) {
  return (
    <div className="text-center min-w-[7rem]">
      <p className="font-display text-3xl md:text-4xl font-semibold" style={{ color: '#C9A96E' }}>
        {value}
      </p>
      <p className="text-xs mt-1.5 uppercase tracking-widest" style={{ color: '#8A7A68' }}>
        {label}
      </p>
    </div>
  )
}
