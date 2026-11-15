'use client'

import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import {
  Buildings,
  ChartBar,
  Globe,
  ArrowRight,
  UserPlus,
  MagnifyingGlass,
  ArrowsClockwise,
} from '@phosphor-icons/react'
import PublicHeroBackground from '@/components/public/PublicHeroBackground'
import PublicGsapMotion from '@/components/public/PublicGsapMotion'

const PILLAR_KEYS = ['secretarial', 'accounting', 'advisory'] as const
const PILLAR_ICONS = { secretarial: Buildings, accounting: ChartBar, advisory: Globe } as const
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
    <PublicGsapMotion variant="home">
      {/* Hero — left-weighted brand signal */}
      <section className="relative overflow-hidden min-h-[min(100dvh,46rem)] flex flex-col bg-black">
        <div className="public-hero-media absolute inset-0">
          <PublicHeroBackground intensity="soft" />
        </div>

        <div className="relative flex-1 mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 pt-20 md:pt-28 pb-16 flex flex-col justify-center">
          <div className="max-w-[42rem]">
            <div className="public-hero-brand flex items-center gap-3 mb-8">
              <Image src="/logo.png" width={40} height={40} alt="" priority className="opacity-95" />
              <p className="text-xs font-medium tracking-[0.2em] uppercase text-[#9B9B9B]">
                6AM Advisory
              </p>
            </div>

            <h1 className="public-hero-title tcsp-hero-heading text-4xl sm:text-5xl md:text-6xl font-semibold tracking-tight leading-none mb-6">
              {t('heroTitleSub')}
            </h1>

            <p className="public-hero-sub text-base md:text-lg leading-7 text-[#9B9B9B] max-w-xl mb-4 text-pretty">
              {t('heroSubtitle')}
            </p>

            <p className="public-hero-sub text-sm leading-6 text-[#666666] max-w-md mb-10 text-pretty">
              {t('heroMeet')}
            </p>

            <div className="public-hero-ctas flex flex-col sm:flex-row items-start gap-3 mb-8">
              <Link
                href="/contact"
                className="tcsp-btn-primary inline-flex items-center gap-2 rounded-md px-3 py-2 text-base font-semibold"
              >
                {t('heroCtaStart')}
                <ArrowRight size={16} weight="bold" />
              </Link>
              <Link
                href="/services"
                className="tcsp-btn-ghost inline-flex items-center rounded-md px-3 py-2 text-sm font-semibold"
              >
                {t('heroCtaLearn')}
              </Link>
            </div>

            <div className="public-hero-meta flex flex-col sm:flex-row items-start sm:items-center gap-x-6 gap-y-2 text-sm text-[#9B9B9B]">
              <a href={`tel:${tContact('phoneValue')}`} className="transition-colors duration-300 hover:text-white">
                {tContact('phoneValue')}
              </a>
              <span className="hidden sm:inline text-[#313131]">·</span>
              <a href={`mailto:${tContact('emailValue')}`} className="transition-colors duration-300 hover:text-white">
                {tContact('emailValue')}
              </a>
            </div>
          </div>
        </div>

        <div className="relative border-t border-[#272727] py-4">
          <p className="public-hero-meta mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 text-xs tracking-wide text-[#666666]">
            {t('heroLicenceLine')}
          </p>
        </div>
      </section>

      {/* Meeting — zigzag */}
      <section className="public-reveal bg-black">
        <div className="grid md:grid-cols-12 min-h-[22rem] md:min-h-[28rem]">
          <div className="public-reveal-item md:col-span-5 flex flex-col justify-center px-4 sm:px-8 lg:px-12 py-14 md:py-16 order-2 md:order-1">
            <p className="text-xs font-medium tracking-[0.2em] uppercase text-[#9B9B9B] mb-4">
              {t('meeting.eyebrow')}
            </p>
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-white leading-tight mb-4 text-balance">
              {t('meeting.title')}
            </h2>
            <p className="text-sm leading-6 text-[#9B9B9B] max-w-md mb-8 text-pretty">
              {t('meeting.desc')}
            </p>
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 text-sm font-semibold text-white transition-opacity duration-300 hover:opacity-80"
            >
              {t('meeting.cta')}
              <ArrowRight size={14} weight="bold" />
            </Link>
          </div>
          <div className="public-reveal-item relative min-h-[16rem] md:min-h-full md:col-span-7 order-1 md:order-2">
            <Image
              src="/marketing/office-meeting-room.jpg"
              alt={t('meeting.imageAlt')}
              fill
              sizes="(max-width: 768px) 100vw, 58vw"
              className="object-cover object-center"
              priority
            />
          </div>
        </div>
      </section>

      {/* Place */}
      <section className="public-reveal relative overflow-hidden bg-[#181818]">
        <div className="relative w-full aspect-[16/9] md:aspect-[21/9] max-h-[28rem]">
          <Image
            src="/marketing/office-neighbourhood-hsr.jpg"
            alt={t('place.imageAlt')}
            fill
            sizes="100vw"
            className="object-cover object-[center_35%] opacity-70"
          />
          <div className="absolute inset-0 bg-black/50" />
          <div className="absolute inset-x-0 bottom-0 px-4 sm:px-6 lg:px-8 pb-8 md:pb-10">
            <div className="public-reveal-item mx-auto max-w-6xl space-y-2">
              <p className="text-xs font-medium tracking-[0.2em] uppercase text-[#9B9B9B]">
                {t('place.eyebrow')}
              </p>
              <p className="text-2xl md:text-3xl font-semibold tracking-tight text-white max-w-xl leading-tight text-balance">
                {t('place.title')}
              </p>
              <p className="text-sm max-w-lg leading-6 text-[#9B9B9B] text-pretty">
                {t('place.desc')}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Engagement — asymmetric 2+1 */}
      <section className="public-reveal bg-black">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-20 md:py-24">
          <div className="public-reveal-item mb-12 max-w-xl space-y-3">
            <p className="text-xs font-medium tracking-[0.2em] uppercase text-[#9B9B9B]">
              {t('engagement.eyebrow')}
            </p>
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-white leading-tight text-balance">
              {t('engagement.title')}
            </h2>
            <p className="text-sm leading-6 text-[#9B9B9B] text-pretty">
              {t('engagement.desc')}
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 md:gap-10 mb-10">
            {(['holding', 'succession'] as const).map((key) => (
              <div key={key} className="public-reveal-item space-y-3 border-t border-[#272727] pt-6">
                <h3 className="text-xl font-semibold text-white tracking-tight">
                  {t(`engagement.${key}.title`)}
                </h3>
                <p className="text-sm leading-6 text-[#9B9B9B] text-pretty">
                  {t(`engagement.${key}.desc`)}
                </p>
              </div>
            ))}
            <div className="public-reveal-item md:col-span-2 space-y-3 border-t border-[#272727] pt-6 md:max-w-xl">
              <h3 className="text-xl font-semibold text-white tracking-tight">
                {t('engagement.governance.title')}
              </h3>
              <p className="text-sm leading-6 text-[#9B9B9B] text-pretty">
                {t('engagement.governance.desc')}
              </p>
            </div>
          </div>

          <p className="public-reveal-item text-sm leading-6 max-w-2xl text-[#666666] text-pretty">
            {t('engagement.confidentiality')}
          </p>
        </div>
      </section>

      {/* Journey — horizontal numbered strip */}
      <section className="public-reveal bg-[#181818]">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-20 md:py-24">
          <div className="public-reveal-item max-w-xl mb-12 space-y-3">
            <p className="text-xs font-medium tracking-[0.2em] uppercase text-[#9B9B9B]">
              {t('journeyEyebrow')}
            </p>
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-white leading-tight text-balance">
              {t('journeyTitle')}
            </h2>
            <p className="text-sm leading-6 text-[#9B9B9B] text-pretty">
              {t('journeyDesc')}
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-0 border border-[#272727] rounded-xl overflow-hidden">
            {(
              [
                { key: 'onboard' as const, Icon: UserPlus },
                { key: 'kyc' as const, Icon: MagnifyingGlass },
                { key: 'ongoing' as const, Icon: ArrowsClockwise },
              ]
            ).map(({ key, Icon }, i) => (
              <div
                key={key}
                className={`public-reveal-item space-y-3 bg-black p-6 md:p-8 ${
                  i < 2 ? 'border-b md:border-b-0 md:border-r border-[#272727]' : ''
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon size={18} className="text-white" weight="regular" />
                  <span className="text-xs font-medium text-[#666666] tabular-nums">0{i + 1}</span>
                </div>
                <h3 className="text-lg font-semibold text-white tracking-tight">
                  {t(`journey.${key}.title`)}
                </h3>
                <p className="text-sm leading-6 text-[#9B9B9B] text-pretty">
                  {t(`journey.${key}.desc`)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pillars — stacked rows not equal cards */}
      <section className="public-reveal bg-black">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-20 md:py-24">
          <div className="public-reveal-item flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-12">
            <div className="space-y-3 max-w-xl">
              <p className="text-xs font-medium tracking-[0.2em] uppercase text-[#9B9B9B]">
                {t('pillarsEyebrow')}
              </p>
              <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-white leading-tight text-balance">
                {t('pillarsTitle')}
              </h2>
            </div>
            <Link
              href="/services"
              className="inline-flex items-center gap-2 text-sm font-semibold text-white transition-opacity duration-300 hover:opacity-80"
            >
              {t('heroCtaLearn')} <ArrowRight size={14} weight="bold" />
            </Link>
          </div>

          <div className="border-t border-[#272727]">
            {PILLAR_KEYS.map((key) => {
              const Icon = PILLAR_ICONS[key]
              return (
                <Link
                  key={key}
                  href={PILLAR_HREFS[key]}
                  className="public-reveal-item group flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-8 py-8 border-b border-[#272727] transition-colors duration-300 hover:bg-[#181818]/40"
                >
                  <Icon size={18} className="mt-1 shrink-0 text-white" weight="regular" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <h3 className="text-xl md:text-2xl font-semibold tracking-tight text-white">
                      {t(`pillars.${key}.title`)}
                    </h3>
                    <p className="text-sm leading-6 max-w-2xl text-[#9B9B9B] text-pretty">
                      {t(`pillars.${key}.desc`)}
                    </p>
                  </div>
                  <ArrowRight
                    size={16}
                    className="hidden sm:block mt-2 shrink-0 text-[#666666] transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:translate-x-1 group-hover:text-white"
                    weight="bold"
                  />
                </Link>
              )
            })}
          </div>
        </div>
      </section>

      {/* Closing */}
      <section className="public-reveal bg-[#181818]">
        <div className="public-reveal-item mx-auto max-w-xl px-4 sm:px-6 lg:px-8 py-20 md:py-28 text-left md:text-center space-y-6">
          <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-white leading-tight text-balance">
            {t('ctaTitle')}
          </h2>
          <p className="text-sm leading-6 text-[#9B9B9B] text-pretty">
            {t('ctaDesc')}
          </p>
          <div className="flex flex-col sm:flex-row md:justify-center items-start md:items-center gap-3 pt-2">
            <Link
              href="/contact"
              className="tcsp-btn-primary inline-flex items-center gap-2 rounded-md px-3 py-2 text-base font-semibold"
            >
              {tNav('contact')}
              <ArrowRight size={14} weight="bold" />
            </Link>
            <Link
              href="/about"
              className="text-sm font-medium text-[#9B9B9B] transition-colors duration-300 hover:text-white"
            >
              {tNav('about')}
            </Link>
          </div>
        </div>
      </section>
    </PublicGsapMotion>
  )
}
