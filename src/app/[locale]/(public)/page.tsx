'use client'

import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import {
  Building2,
  BarChart2,
  Globe,
  ArrowRight,
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
  const tContact = useTranslations('contact')

  return (
    <>
      {/* ── Quiet hero ── */}
      <section
        className="relative overflow-hidden min-h-[min(92svh,46rem)] flex flex-col"
        style={{ background: '#080808' }}
      >
        <PublicHeroBackground intensity="soft" />

        <div className="relative flex-1 mx-auto w-full max-w-3xl px-4 sm:px-6 lg:px-8 pt-20 md:pt-28 pb-16 flex flex-col justify-center text-center">
          <div className="public-fade-up flex justify-center mb-8">
            <Image
              src="/logo.png"
              width={48}
              height={48}
              alt=""
              priority
              className="opacity-95"
            />
          </div>

          <p
            className="public-fade-up public-fade-up-delay-1 font-display font-light tracking-[0.12em] uppercase mb-5"
            style={{
              color: '#C9A96E',
              fontSize: 'clamp(0.95rem, 1.8vw, 1.15rem)',
            }}
          >
            6AM Advisory
          </p>

          <h1
            className="public-fade-up public-fade-up-delay-2 font-display font-light leading-[1.25] mb-6"
            style={{
              fontSize: 'clamp(1.85rem, 4.2vw, 2.85rem)',
              color: '#F5F0E6',
              letterSpacing: '0.01em',
            }}
          >
            {t('heroTitleSub')}
          </h1>

          <p
            className="public-fade-up public-fade-up-delay-3 text-base md:text-lg leading-relaxed mx-auto max-w-xl mb-4"
            style={{ color: '#B8A890' }}
          >
            {t('heroSubtitle')}
          </p>

          <p
            className="public-fade-up public-fade-up-delay-3 text-sm leading-relaxed mx-auto max-w-md mb-10"
            style={{ color: '#8A7A60' }}
          >
            {t('heroMeet')}
          </p>

          <div className="public-fade-up public-fade-up-delay-4 flex flex-col sm:flex-row items-center justify-center gap-3 mb-8">
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 px-8 py-3.5 rounded-sm text-sm font-semibold tracking-wide transition-opacity hover:opacity-90"
              style={{ background: '#C9A96E', color: '#0C0C0C' }}
            >
              {t('heroCtaStart')}
              <ArrowRight size={15} />
            </Link>
            <Link
              href="/services"
              className="px-7 py-3.5 rounded-sm text-sm font-medium tracking-wide transition-colors hover:bg-[rgba(180,148,92,0.08)]"
              style={{
                border: '1px solid rgba(180,148,92,0.35)',
                color: '#D0C0A8',
              }}
            >
              {t('heroCtaLearn')}
            </Link>
          </div>

          <div
            className="public-fade-up public-fade-up-delay-4 flex flex-col sm:flex-row items-center justify-center gap-x-6 gap-y-2 text-sm"
            style={{ color: '#9A8A70' }}
          >
            <a href={`tel:${tContact('phoneValue')}`} className="hover:opacity-80 transition-opacity">
              {tContact('phoneValue')}
            </a>
            <span className="hidden sm:inline" style={{ color: '#3A3020' }}>
              ·
            </span>
            <a
              href={`mailto:${tContact('emailValue')}`}
              className="hover:opacity-80 transition-opacity"
            >
              {tContact('emailValue')}
            </a>
          </div>
        </div>

        <div
          className="relative border-t py-4 text-center"
          style={{ borderColor: 'rgba(201,169,110,0.15)' }}
        >
          <p className="text-xs tracking-wide" style={{ color: '#7A6A55' }}>
            {t('heroLicenceLine')}
          </p>
        </div>
      </section>

      {/* ── Meeting room: one-to-one ── */}
      <section style={{ background: '#0A0A0A' }}>
        <div className="grid md:grid-cols-2 min-h-[22rem] md:min-h-[28rem]">
          <div className="flex flex-col justify-center px-4 sm:px-8 lg:px-12 py-14 md:py-16 order-2 md:order-1">
            <p className="text-xs uppercase tracking-[0.22em] mb-4" style={{ color: '#C9A96E' }}>
              {t('meeting.eyebrow')}
            </p>
            <h2
              className="font-display font-light leading-snug mb-4"
              style={{ color: '#F5F0E6', fontSize: 'clamp(1.5rem, 3vw, 2.15rem)' }}
            >
              {t('meeting.title')}
            </h2>
            <p className="text-sm leading-relaxed max-w-md mb-8" style={{ color: '#A89880' }}>
              {t('meeting.desc')}
            </p>
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 text-sm w-fit transition-opacity hover:opacity-80"
              style={{ color: '#C9A96E' }}
            >
              {t('meeting.cta')}
              <ArrowRight size={14} />
            </Link>
          </div>
          <div className="relative min-h-[16rem] md:min-h-full order-1 md:order-2">
            <Image
              src="/marketing/office-meeting-room.jpg"
              alt={t('meeting.imageAlt')}
              fill
              sizes="(max-width: 768px) 100vw, 50vw"
              className="object-cover object-center"
              priority
            />
          </div>
        </div>
      </section>

      {/* ── Place: beside the high-speed rail ── */}
      <section className="relative overflow-hidden" style={{ background: '#080808' }}>
        <div className="relative w-full aspect-[16/9] md:aspect-[21/9] max-h-[28rem]">
          <Image
            src="/marketing/office-neighbourhood-hsr.jpg"
            alt={t('place.imageAlt')}
            fill
            sizes="100vw"
            className="object-cover object-[center_35%]"
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                'linear-gradient(180deg, rgba(8,8,8,0.12) 0%, rgba(8,8,8,0.2) 50%, rgba(8,8,8,0.88) 100%)',
            }}
          />
          <div className="absolute inset-x-0 bottom-0 px-4 sm:px-6 lg:px-8 pb-8 md:pb-10">
            <div className="mx-auto max-w-7xl space-y-1.5">
              <p className="text-xs uppercase tracking-[0.22em]" style={{ color: '#C9A96E' }}>
                {t('place.eyebrow')}
              </p>
              <p
                className="font-display font-light max-w-xl leading-snug"
                style={{ color: '#F5F0E6', fontSize: 'clamp(1.25rem, 2.5vw, 1.75rem)' }}
              >
                {t('place.title')}
              </p>
              <p className="text-sm max-w-lg leading-relaxed" style={{ color: '#B8A890' }}>
                {t('place.desc')}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Situations we handle ── */}
      <section style={{ background: '#0A0A0A' }}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20 md:py-24">
          <div className="mb-12 space-y-3 max-w-2xl">
            <p className="text-xs uppercase tracking-[0.22em]" style={{ color: '#C9A96E' }}>
              {t('engagement.eyebrow')}
            </p>
            <h2
              className="font-display font-light leading-snug"
              style={{ color: '#F5F0E6', fontSize: 'clamp(1.75rem, 3.5vw, 2.5rem)' }}
            >
              {t('engagement.title')}
            </h2>
            <p className="text-sm leading-relaxed" style={{ color: '#A89880' }}>
              {t('engagement.desc')}
            </p>
          </div>

          <div className="grid sm:grid-cols-3 gap-10 md:gap-12 mb-10">
            {(['holding', 'succession', 'governance'] as const).map((key) => (
              <div key={key} className="space-y-3">
                <h3 className="font-display text-xl font-light" style={{ color: '#F5F0E6' }}>
                  {t(`engagement.${key}.title`)}
                </h3>
                <p className="text-sm leading-relaxed" style={{ color: '#A89880' }}>
                  {t(`engagement.${key}.desc`)}
                </p>
              </div>
            ))}
          </div>

          <p className="text-sm leading-relaxed max-w-2xl" style={{ color: '#7A6A55' }}>
            {t('engagement.confidentiality')}
          </p>
        </div>
      </section>

      {/* ── How we work together ── */}
      <section style={{ background: '#080808' }}>
        <div className="public-section-rule" />
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20 md:py-24">
          <div className="max-w-2xl mb-12 space-y-3">
            <p className="text-xs uppercase tracking-[0.22em]" style={{ color: '#C9A96E' }}>
              {t('journeyEyebrow')}
            </p>
            <h2
              className="font-display font-light leading-snug"
              style={{ color: '#F5F0E6', fontSize: 'clamp(1.75rem, 3.5vw, 2.5rem)' }}
            >
              {t('journeyTitle')}
            </h2>
            <p className="text-sm leading-relaxed" style={{ color: '#A89880' }}>
              {t('journeyDesc')}
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-10 md:gap-12">
            {(
              [
                { key: 'onboard' as const, Icon: UserPlus },
                { key: 'kyc' as const, Icon: FileSearch },
                { key: 'ongoing' as const, Icon: RefreshCw },
              ]
            ).map(({ key, Icon }) => (
              <div key={key} className="space-y-3">
                <Icon size={18} style={{ color: '#C9A96E' }} />
                <h3 className="font-display text-lg" style={{ color: '#F5F0E6' }}>
                  {t(`journey.${key}.title`)}
                </h3>
                <p className="text-sm leading-relaxed" style={{ color: '#A89880' }}>
                  {t(`journey.${key}.desc`)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── What we do ── */}
      <section style={{ background: '#0A0A0A' }}>
        <div className="public-section-rule" />
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20 md:py-24">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-12">
            <div className="space-y-3 max-w-xl">
              <p className="text-xs uppercase tracking-[0.22em]" style={{ color: '#C9A96E' }}>
                {t('pillarsEyebrow')}
              </p>
              <h2
                className="font-display font-light leading-tight"
                style={{ color: '#F5F0E6', fontSize: 'clamp(1.75rem, 3.5vw, 2.5rem)' }}
              >
                {t('pillarsTitle')}
              </h2>
            </div>
            <Link
              href="/services"
              className="inline-flex items-center gap-2 text-sm"
              style={{ color: '#C9A96E' }}
            >
              {t('heroCtaLearn')} <ArrowRight size={14} />
            </Link>
          </div>

          <div className="space-y-0 border-t" style={{ borderColor: '#1E1A12' }}>
            {PILLAR_KEYS.map((key) => {
              const Icon = PILLAR_ICONS[key]
              return (
                <Link
                  key={key}
                  href={PILLAR_HREFS[key]}
                  className="group flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-8 py-8 border-b transition-colors hover:bg-[rgba(201,169,110,0.03)]"
                  style={{ borderColor: '#1E1A12' }}
                >
                  <Icon size={18} className="mt-1 shrink-0" style={{ color: '#C9A96E' }} />
                  <div className="min-w-0 flex-1 space-y-2">
                    <h3 className="font-display text-xl md:text-2xl font-light" style={{ color: '#F5F0E6' }}>
                      {t(`pillars.${key}.title`)}
                    </h3>
                    <p className="text-sm leading-relaxed max-w-2xl" style={{ color: '#A89880' }}>
                      {t(`pillars.${key}.desc`)}
                    </p>
                  </div>
                  <ArrowRight
                    size={16}
                    className="hidden sm:block mt-2 shrink-0 transition-transform group-hover:translate-x-1"
                    style={{ color: '#8A7A60' }}
                  />
                </Link>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── Closing ── */}
      <section style={{ background: '#080808' }}>
        <div className="public-section-rule" />
        <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8 py-20 md:py-28 text-center space-y-6">
          <h2
            className="font-display font-light"
            style={{ color: '#F5F0E6', fontSize: 'clamp(1.75rem, 3.5vw, 2.5rem)' }}
          >
            {t('ctaTitle')}
          </h2>
          <p className="text-sm leading-relaxed" style={{ color: '#A89880' }}>
            {t('ctaDesc')}
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 px-8 py-3.5 rounded-sm text-sm font-semibold transition-opacity hover:opacity-90"
              style={{ background: '#C9A96E', color: '#0C0C0C' }}
            >
              {tNav('contact')}
              <ArrowRight size={14} />
            </Link>
            <Link
              href="/about"
              className="text-sm transition-opacity hover:opacity-80"
              style={{ color: '#9A8A70' }}
            >
              {tNav('about')}
            </Link>
          </div>
        </div>
      </section>
    </>
  )
}
