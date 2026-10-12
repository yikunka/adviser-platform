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
const PILLAR_NUMS = { secretarial: '01', accounting: '02', advisory: '03' } as const

export default function HomePage() {
  const t = useTranslations('home')
  const tNav = useTranslations('nav')
  const tS = useTranslations('services')

  const marqueeItems = [
    t('trustStrip.licensed.title'),
    t('heroTrustBadge'),
    t('trustStrip.aml.title'),
    t('trustStrip.hk.title'),
    '500+ ' + t('stat.companies'),
    '15+ ' + t('stat.years'),
  ]

  return (
    <>
      {/* ── Cinematic hero ── */}
      <section
        className="relative overflow-hidden min-h-[min(100svh,58rem)] flex flex-col"
        style={{ background: '#060606' }}
      >
        <PublicHeroBackground />

        <div className="relative flex-1 mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 pt-14 md:pt-20 pb-10 flex flex-col justify-center">
          <div className="grid lg:grid-cols-[1.05fr_0.95fr] gap-10 lg:gap-14 items-center">
            {/* Left: brand-dominant copy */}
            <div className="space-y-6 text-left">
              <div className="public-fade-up flex items-center gap-3">
                <div className="relative w-12 h-12 flex items-center justify-center">
                  <span className="public-brand-ring" aria-hidden />
                  <Image
                    src="/logo.png"
                    width={40}
                    height={40}
                    alt=""
                    priority
                    className="relative drop-shadow-[0_0_28px_rgba(201,169,110,0.55)]"
                  />
                </div>
                <span
                  className="font-mono-public text-[11px] uppercase tracking-[0.28em] px-2.5 py-1 rounded-sm"
                  style={{
                    color: '#E8D5B0',
                    border: '1px solid rgba(180,148,92,0.45)',
                    background: 'rgba(180,148,92,0.08)',
                  }}
                >
                  Hong Kong · TCSP TC010556
                </span>
              </div>

              <div className="public-fade-up public-fade-up-delay-1 space-y-0">
                <p
                  className="font-display font-semibold leading-[0.88] tracking-tight public-stat-blast"
                  style={{
                    fontSize: 'clamp(4.2rem, 12vw, 8rem)',
                    filter: 'drop-shadow(0 0 40px rgba(201,169,110,0.35))',
                  }}
                >
                  6AM
                </p>
                <p
                  className="font-display font-light tracking-[0.28em] uppercase mt-1"
                  style={{
                    color: '#F0D090',
                    fontSize: 'clamp(1.15rem, 2.6vw, 1.9rem)',
                    textShadow: '0 0 24px rgba(201,169,110,0.35)',
                  }}
                >
                  Advisory
                </p>
              </div>

              <h1
                className="public-fade-up public-fade-up-delay-2 font-display font-light leading-[1.2] max-w-xl"
                style={{
                  fontStyle: 'italic',
                  fontSize: 'clamp(1.45rem, 3.2vw, 2.35rem)',
                  color: '#F2E8D5',
                  letterSpacing: '0.01em',
                }}
              >
                {t('heroTitleSub')}
              </h1>

              <p
                className="public-fade-up public-fade-up-delay-3 text-base md:text-lg max-w-lg leading-relaxed"
                style={{ color: '#B8A890' }}
              >
                {t('heroSubtitle')}
              </p>

              <div className="public-fade-up public-fade-up-delay-4 flex flex-wrap items-center gap-3 pt-1">
                <Link
                  href="/contact"
                  className="group flex items-center gap-2 px-9 py-4 rounded-sm text-sm font-semibold tracking-wide transition-all hover:opacity-95"
                  style={{
                    background: 'linear-gradient(135deg, #C8A971 0%, #B4945C 55%, #9A7A48 100%)',
                    color: '#0C0C0C',
                  }}
                >
                  {t('heroCtaStart')}
                  <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
                </Link>
                <Link
                  href="/services"
                  className="px-7 py-4 rounded-sm text-sm font-medium tracking-wide transition-all hover:bg-[rgba(180,148,92,0.1)]"
                  style={{
                    border: '1px solid rgba(180,148,92,0.45)',
                    color: '#E8D5B0',
                    background: 'rgba(180,148,92,0.05)',
                    backdropFilter: 'blur(8px)',
                  }}
                >
                  {t('heroCtaLearn')}
                </Link>
              </div>

              {/* Mobile cyber visual */}
              <div
                className="public-fade-up public-fade-up-delay-4 md:hidden relative mt-4 rounded-sm overflow-hidden aspect-[16/10]"
                style={{
                  border: '1px solid rgba(201,169,110,0.4)',
                  boxShadow: '0 0 40px rgba(201,169,110,0.2)',
                }}
              >
                <Image
                  src="/marketing/hero-tcsp-cyber.png"
                  alt=""
                  fill
                  sizes="100vw"
                  className="object-cover object-center"
                />
                <div
                  className="absolute inset-0"
                  style={{
                    background: 'linear-gradient(180deg, transparent 25%, rgba(6,6,6,0.8) 100%)',
                  }}
                />
                <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
                  <span className="font-mono-public text-[10px] uppercase tracking-[0.22em]" style={{ color: '#E8D5B0' }}>
                    TC010556 · Private Desk
                  </span>
                  <span className="font-mono-public text-[10px]" style={{ color: '#C9A96E' }}>
                    CONFIDENTIAL
                  </span>
                </div>
              </div>
            </div>

            {/* Right: TCSP cyber visual + compliance console */}
            <div className="public-fade-up public-fade-up-delay-2 hidden md:block">
              <div className="public-console relative rounded-sm overflow-hidden">
                <div className="relative aspect-[4/5] w-full max-h-[34rem]">
                  <Image
                    src="/marketing/hero-tcsp-cyber.png"
                    alt="Professional TCSP compliance and cyber security visual"
                    fill
                    priority
                    sizes="(max-width: 1024px) 50vw, 440px"
                    className="object-cover object-center"
                  />
                  <div
                    className="absolute inset-0"
                    style={{
                      background:
                        'linear-gradient(180deg, rgba(6,6,6,0.05) 0%, rgba(6,6,6,0.15) 45%, rgba(6,6,6,0.88) 82%, #080808 100%)',
                    }}
                  />
                  <div
                    className="absolute -top-16 -right-12 w-56 h-56 rounded-full blur-3xl public-console-live"
                    style={{ background: 'rgba(240,208,144,0.22)' }}
                    aria-hidden
                  />

                  <div className="absolute inset-x-0 bottom-0 p-5 md:p-6 space-y-3.5">
                    <div className="flex items-center justify-between">
                      <p className="font-mono-public text-[10px] uppercase tracking-[0.28em]" style={{ color: '#C9B896' }}>
                        Private Compliance Desk
                      </p>
                      <span className="font-mono-public text-[10px]" style={{ color: '#E8D5B0' }}>
                        TC010556
                      </span>
                    </div>

                    <ConsoleRow label="TCSP Licence" value="TC010556" ok />
                    <ConsoleRow label="AMLO Cap. 615" value="COMPLIANT" ok />
                    <ConsoleRow label="Private KYC / AML" value="DISCREET" ok />
                    <ConsoleRow label="Ongoing Stewardship" value="ACTIVE" ok />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Marquee trust strip */}
        <div
          className="relative border-t overflow-hidden"
          style={{
            borderColor: 'rgba(201,169,110,0.25)',
            background: 'linear-gradient(90deg, rgba(8,8,8,0.92), rgba(20,16,10,0.9), rgba(8,8,8,0.92))',
          }}
        >
          <div className="public-marquee-track py-4 gap-12">
            {[...marqueeItems, ...marqueeItems].map((item, i) => (
              <span
                key={`${item}-${i}`}
                className="flex items-center gap-12 shrink-0 font-mono-public text-xs uppercase tracking-[0.24em]"
                style={{ color: '#D0C0A8' }}
              >
                <span style={{ color: '#F0D090' }}>◆</span>
                {item}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── Impact stats band ── */}
      <section className="public-impact-band relative">
        <Image
          src="/marketing/hero-city-night.png"
          alt=""
          fill
          sizes="100vw"
          className="object-cover object-[center_55%] opacity-70"
        />
        <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 md:py-20">
          <div className="grid grid-cols-3 gap-4 md:gap-10 text-center">
            {[
              { v: '500+', l: t('stat.companies') },
              { v: '15+', l: t('stat.years') },
              { v: 'TC010556', l: t('stat.license') },
            ].map((s) => (
              <div key={s.v} className="space-y-2">
                <p className="public-stat-blast font-display font-semibold leading-none" style={{ fontSize: 'clamp(2.5rem, 8vw, 5.5rem)' }}>
                  {s.v}
                </p>
                <p className="font-mono-public text-[10px] md:text-xs uppercase tracking-[0.28em]" style={{ color: '#D0C0A8' }}>
                  {s.l}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Trust detail ── */}
      <section style={{ background: '#0A0A0A' }}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 md:py-20">
          <div className="grid md:grid-cols-3 gap-8 md:gap-10">
            {(
              [
                { key: 'licensed' as const, Icon: BadgeCheck },
                { key: 'aml' as const, Icon: ScanSearch },
                { key: 'hk' as const, Icon: MapPin },
              ]
            ).map(({ key, Icon }, idx) => (
              <div
                key={key}
                className="space-y-3 md:border-l md:pl-8 first:md:border-l-0 first:md:pl-0"
                style={{ borderColor: '#2A2418' }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-sm flex items-center justify-center"
                    style={{
                      background: 'rgba(201,169,110,0.12)',
                      border: '1px solid rgba(201,169,110,0.35)',
                      boxShadow: '0 0 24px rgba(201,169,110,0.12)',
                    }}
                  >
                    <Icon size={18} style={{ color: '#F0D090' }} />
                  </div>
                  <span className="font-mono-public text-[10px]" style={{ color: '#6A5E4E' }}>
                    0{idx + 1}
                  </span>
                </div>
                <p className="font-display text-xl md:text-2xl font-medium" style={{ color: '#F5F0E6' }}>
                  {t(`trustStrip.${key}.title`)}
                </p>
                <p className="text-sm leading-relaxed" style={{ color: '#B8A890' }}>
                  {t(`trustStrip.${key}.desc`)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Services: editorial rows ── */}
      <section style={{ background: '#080808' }}>
        <div className="public-section-rule" />
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20 md:py-28">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-10">
            <div className="space-y-3">
              <p className="font-mono-public text-[11px] uppercase tracking-[0.3em]" style={{ color: '#C9A96E' }}>
                {t('pillarsEyebrow')}
              </p>
              <h2
                className="font-display font-light leading-tight"
                style={{ color: '#F5F0E6', fontSize: 'clamp(2rem, 4vw, 3.25rem)' }}
              >
                {t('pillarsTitle')}
              </h2>
            </div>
            <Link
              href="/services"
              className="inline-flex items-center gap-2 text-sm font-medium"
              style={{ color: '#C9A96E' }}
            >
              {t('heroCtaLearn')} <ArrowRight size={14} />
            </Link>
          </div>

          <div className="border-t" style={{ borderColor: '#1E1A12' }}>
            {PILLAR_KEYS.map((key) => {
              const Icon = PILLAR_ICONS[key]
              const bullets = t.raw(`pillars.${key}.bullets`) as string[]
              return (
                <Link
                  key={key}
                  href={PILLAR_HREFS[key]}
                  className="public-service-row group grid md:grid-cols-[5rem_1fr_auto] gap-4 md:gap-8 items-start md:items-center py-8 md:py-10"
                >
                  <span
                    className="font-display text-4xl md:text-5xl font-light public-stat-blast opacity-80"
                  >
                    {PILLAR_NUMS[key]}
                  </span>
                  <div className="space-y-3 min-w-0">
                    <div className="flex items-center gap-3">
                      <Icon size={18} style={{ color: '#C9A96E' }} />
                      <h3 className="font-display text-2xl md:text-3xl font-medium" style={{ color: '#F5F0E6' }}>
                        {t(`pillars.${key}.title`)}
                      </h3>
                    </div>
                    <p className="text-sm md:text-base max-w-2xl leading-relaxed" style={{ color: '#A89880' }}>
                      {t(`pillars.${key}.desc`)}
                    </p>
                    <div className="flex flex-wrap gap-x-5 gap-y-1.5 pt-1">
                      {bullets.map((item) => (
                        <span key={item} className="text-xs md:text-sm flex items-center gap-1.5" style={{ color: '#C9B896' }}>
                          <Check size={12} style={{ color: '#C9A96E' }} />
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                  <span
                    className="hidden md:inline-flex items-center justify-center w-11 h-11 rounded-full border transition-all group-hover:translate-x-1"
                    style={{ borderColor: 'rgba(201,169,110,0.35)', color: '#C9A96E' }}
                  >
                    <ArrowRight size={16} />
                  </span>
                </Link>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── Compliance journey: vertical rail ── */}
      <section style={{ background: '#0A0A0A' }}>
        <div className="public-section-rule" />
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20 md:py-28">
          <div className="grid lg:grid-cols-[0.9fr_1.1fr] gap-12 lg:gap-20">
            <div className="space-y-4 lg:sticky lg:top-28 lg:self-start">
              <p className="font-mono-public text-[11px] uppercase tracking-[0.3em]" style={{ color: '#C9A96E' }}>
                {t('journeyEyebrow')}
              </p>
              <h2
                className="font-display font-light leading-snug"
                style={{ color: '#F5F0E6', fontSize: 'clamp(1.85rem, 3.5vw, 2.75rem)' }}
              >
                {t('journeyTitle')}
              </h2>
              <p className="text-sm md:text-base leading-relaxed" style={{ color: '#A89880' }}>
                {t('journeyDesc')}
              </p>
            </div>

            <div className="relative pl-8 md:pl-10 space-y-0">
              <div
                className="absolute left-[11px] md:left-[15px] top-3 bottom-3 w-px"
                style={{ background: 'linear-gradient(180deg, #C9A96E, rgba(201,169,110,0.15))' }}
                aria-hidden
              />
              {(
                [
                  { key: 'onboard' as const, Icon: UserPlus, step: '01' },
                  { key: 'kyc' as const, Icon: FileSearch, step: '02' },
                  { key: 'ongoing' as const, Icon: RefreshCw, step: '03' },
                ]
              ).map(({ key, Icon, step }) => (
                <div key={key} className="relative pb-10 last:pb-0">
                  <div
                    className="absolute left-[-29px] md:left-[-33px] top-1.5 w-6 h-6 rounded-full flex items-center justify-center"
                    style={{ background: '#0A0A0A', border: '1px solid #C9A96E' }}
                  >
                    <span className="public-pulse-dot !w-2 !h-2" />
                  </div>
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <div className="flex items-center gap-2.5">
                      <Icon size={16} style={{ color: '#C9A96E' }} />
                      <h3 className="font-display text-xl font-semibold" style={{ color: '#F5F0E6' }}>
                        {t(`journey.${key}.title`)}
                      </h3>
                    </div>
                    <span className="font-mono-public text-xs" style={{ color: 'rgba(201,169,110,0.45)' }}>
                      {step}
                    </span>
                  </div>
                  <p className="text-sm leading-relaxed max-w-md" style={{ color: '#A89880' }}>
                    {t(`journey.${key}.desc`)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Why ── */}
      <section style={{ background: '#080808' }}>
        <div className="public-section-rule" />
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20 md:py-28">
          <div className="grid md:grid-cols-2 gap-12 md:gap-16 items-center">
            <div className="space-y-6">
              <p className="font-mono-public text-[11px] uppercase tracking-[0.3em]" style={{ color: '#C9A96E' }}>
                {t('whyEyebrow')}
              </p>
              <h2
                className="font-display font-light leading-snug"
                style={{ color: '#F5F0E6', fontSize: 'clamp(2rem, 4vw, 3.25rem)' }}
              >
                {t('whyTitle')}
              </h2>
              <p className="text-sm md:text-base leading-relaxed" style={{ color: '#A89880' }}>
                {t('whyDesc')}
              </p>
              <Link
                href="/about"
                className="inline-flex items-center gap-2 text-sm font-medium"
                style={{ color: '#C9A96E' }}
              >
                {tNav('about')} <ArrowRight size={14} />
              </Link>
            </div>

            <div className="grid grid-cols-2 gap-px" style={{ background: '#2A2418' }}>
              {(
                [
                  { Icon: ShieldCheck, label: t('why.compliance') },
                  { Icon: Clock, label: t('why.responsive') },
                  { Icon: Users, label: t('why.team') },
                  { Icon: Globe, label: t('why.bilingual') },
                ]
              ).map(({ Icon, label }) => (
                <div
                  key={label}
                  className="p-6 md:p-8 flex flex-col gap-4 transition-colors hover:bg-[rgba(201,169,110,0.05)]"
                  style={{ background: '#0C0C0C' }}
                >
                  <Icon size={20} style={{ color: '#C9A96E' }} />
                  <p className="font-display text-base md:text-lg" style={{ color: '#F5F0E6' }}>
                    {label}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Packages ── */}
      <section style={{ background: '#0A0A0A' }}>
        <div className="public-section-rule" />
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20 md:py-28">
          <div className="mb-12 space-y-3 max-w-xl">
            <p className="font-mono-public text-[11px] uppercase tracking-[0.3em]" style={{ color: '#C9A96E' }}>
              {tS('tiers.eyebrow')}
            </p>
            <h2
              className="font-display font-light leading-snug"
              style={{ color: '#F5F0E6', fontSize: 'clamp(2rem, 4vw, 3rem)' }}
            >
              {t('ctaTitle')}
            </h2>
            <p className="text-sm leading-relaxed" style={{ color: '#A89880' }}>
              {t('ctaDesc')}
            </p>
          </div>

          <div className="grid sm:grid-cols-3 gap-4 mb-6">
            {(['basic', 'professional', 'premium'] as const).map((tier, idx) => (
              <div
                key={tier}
                className="public-card-hover rounded-sm p-7 flex flex-col gap-5"
                style={
                  idx === 1
                    ? {
                        background: 'linear-gradient(165deg, #1E1810 0%, #120F0A 100%)',
                        border: '1px solid #C9A96E',
                        boxShadow: '0 0 40px rgba(201,169,110,0.1)',
                      }
                    : {
                        background: '#0E0C0A',
                        border: '1px solid #2A2418',
                      }
                }
              >
                {idx === 1 && (
                  <p className="font-mono-public text-[10px] uppercase tracking-[0.28em]" style={{ color: '#C9A96E' }}>
                    {tS('tiers.popular')}
                  </p>
                )}
                <div>
                  <h3 className="font-display text-2xl font-semibold" style={{ color: '#F5F0E6' }}>
                    {tS(`tiers.${tier}`)}
                  </h3>
                  <p className="text-xs mt-1.5 leading-relaxed" style={{ color: '#A89880' }}>
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
                  className="flex items-center justify-center py-2.5 rounded-sm text-sm font-semibold transition-opacity hover:opacity-90"
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
        </div>
      </section>

      {/* ── Closing band ── */}
      <section className="public-cta-band relative overflow-hidden">
        <div className="public-section-rule" />
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-24 md:py-32 text-center">
          <p
            className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 font-display font-semibold select-none"
            style={{
              fontSize: 'clamp(5rem, 18vw, 14rem)',
              color: 'rgba(201,169,110,0.04)',
              letterSpacing: '-0.04em',
            }}
            aria-hidden
          >
            6AM
          </p>
          <p className="font-mono-public text-[11px] uppercase tracking-[0.35em] mb-5 relative" style={{ color: '#C9A96E' }}>
            {t('heroTrustBadge')}
          </p>
          <h2
            className="font-display font-light relative mb-8"
            style={{ color: '#F5F0E6', fontSize: 'clamp(2rem, 5vw, 3.5rem)' }}
          >
            {t('ctaTitle')}
          </h2>
          <Link
            href="/contact"
            className="relative inline-flex items-center gap-2 px-10 py-4 rounded-sm text-sm font-semibold tracking-wide hover:opacity-95"
            style={{
              background: 'linear-gradient(135deg, #C8A971, #B4945C)',
              color: '#0C0C0C',
            }}
          >
            {tNav('contact')} <ArrowRight size={14} />
          </Link>
        </div>
      </section>
    </>
  )
}

function ConsoleRow({ label, value, ok }: { label: string; value: string; ok?: boolean }) {
  return (
    <div
      className="flex items-center justify-between gap-4 py-2.5 px-3 rounded-sm"
      style={{
        background: 'rgba(0,0,0,0.45)',
        border: '1px solid rgba(201,169,110,0.28)',
        backdropFilter: 'blur(6px)',
      }}
    >
      <span className="font-mono-public text-[11px]" style={{ color: '#A89880' }}>
        {label}
      </span>
      <span
        className="font-mono-public text-[11px] tracking-wider font-semibold"
        style={{ color: ok ? '#F0D090' : '#E8C87A' }}
      >
        {value}
      </span>
    </div>
  )
}
