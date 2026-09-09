import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import {
  Check, Building2, BarChart2, Globe, Landmark, Ship, CreditCard, ShieldCheck, ArrowRight
} from 'lucide-react'
import PublicPageHero from '@/components/public/PublicPageHero'
import { absoluteUrl } from '@/lib/seo'

type MetadataProps = { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: MetadataProps): Promise<Metadata> {
  const { locale } = await params
  const path = `/${locale}/services`
  const title = 'Hong Kong Corporate Services'
  const description = 'Company formation, company secretary, accounting, compliance and business advisory services for Hong Kong and offshore companies.'

  return {
    title,
    description,
    alternates: {
      canonical: path,
      languages: { en: '/en/services', zh: '/zh/services' },
    },
    openGraph: {
      title: `${title} | 6AM Advisory`,
      description,
      url: absoluteUrl(path),
      type: 'website',
    },
  }
}

function TickList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-3">
      {items.map((item, i) => (
        <li key={i} className="flex gap-3 text-sm leading-relaxed" style={{ color: '#C9B896' }}>
          <Check className="shrink-0 mt-0.5" size={16} strokeWidth={2.5} style={{ color: '#C9A96E' }} aria-hidden />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  )
}

function SectionDivider() {
  return <div className="public-section-rule" />
}

export default async function ServicesPage() {
  const t = await getTranslations('services')
  const tHome = await getTranslations('home')
  const processItems = [
    { number: '01', title: tHome('process.1.title'), desc: tHome('process.1.desc') },
    { number: '02', title: tHome('process.2.title'), desc: tHome('process.2.desc') },
    { number: '03', title: tHome('process.3.title'), desc: tHome('process.3.desc') },
    { number: '04', title: tHome('process.4.title'), desc: tHome('process.4.desc') },
    { number: '05', title: tHome('process.5.title'), desc: tHome('process.5.desc') },
    { number: '06', title: tHome('process.6.title'), desc: tHome('process.6.desc') },
  ]

  const CORE_SERVICES = [
    { key: 'secretarial', Icon: Building2, num: '01' },
    { key: 'accounting',  Icon: BarChart2, num: '02' },
    { key: 'advisory',    Icon: Globe,     num: '03' },
  ] as const

  const OTHER_SERVICES = [
    { key: 'wfoe',       Icon: Landmark   },
    { key: 'bvi',        Icon: Ship       },
    { key: 'bank',       Icon: CreditCard },
    { key: 'compliance', Icon: ShieldCheck },
  ] as const

  return (
    <div>
      <PublicPageHero title={t('title')} subtitle={t('subtitle')} />

      {/* ══════════════════════════════════
          Overview — 3 core service anchors
      ══════════════════════════════════ */}
      <section style={{ background: '#0C0C0C', borderBottom: '1px solid #1E1A12' }}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
          <div className="grid sm:grid-cols-3 gap-4">
            {CORE_SERVICES.map(({ key, Icon, num }) => (
              <a
                key={key}
                href={`#${key}`}
                className="public-panel public-card-hover flex items-center gap-4 rounded-xl px-5 py-4"
                style={{ textDecoration: 'none' }}
              >
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: 'rgba(201,169,110,0.1)', border: '1px solid rgba(201,169,110,0.15)' }}
                >
                  <Icon size={18} style={{ color: '#C9A96E' }} />
                </div>
                <div>
                  <p className="text-xs" style={{ color: 'rgba(201,169,110,0.5)' }}>{num}</p>
                  <p className="text-sm font-medium" style={{ color: '#F5F0E6' }}>{t(`${key}.title`)}</p>
                </div>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════
          01 — Company Secretarial
      ══════════════════════════════════ */}
      <section id="secretarial" style={{ background: '#0A0A0A' }}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20 md:py-28 space-y-16">
          {/* Top: intro + service list */}
          <div className="grid md:grid-cols-2 gap-12 md:gap-20 items-start">
            {/* Left: heading + intro + virtual office */}
            <div className="space-y-6">
              <p className="text-xs uppercase tracking-widest" style={{ color: '#C9A96E' }}>01</p>
              <h2 className="font-display text-3xl md:text-4xl font-light" style={{ color: '#F5F0E6' }}>
                {t('secretarial.title')}
              </h2>
              <p className="text-sm leading-relaxed" style={{ color: '#A89880' }}>
                {t('secretarial.intro')}
              </p>
              {/* Virtual office callout */}
              <div
                className="rounded-xl p-5 flex gap-4 items-start"
                style={{ background: 'rgba(201,169,110,0.06)', border: '1px solid rgba(201,169,110,0.2)' }}
              >
                <Building2 size={18} style={{ color: '#C9A96E', flexShrink: 0, marginTop: 2 }} />
                <div>
                  <p className="text-sm font-semibold" style={{ color: '#F5F0E6' }}>
                    {t('secretarial.virtualOfficeTitle')}
                  </p>
                  <p className="text-xs mt-1 leading-relaxed" style={{ color: '#A89880' }}>
                    {t('secretarial.virtualOfficeDesc')}
                  </p>
                </div>
              </div>
            </div>
            {/* Right: service items */}
            <div>
              <TickList items={t.raw('secretarial.items') as string[]} />
            </div>
          </div>

          {/* Three-scale horizontal cards */}
          <div>
            <p className="text-xs uppercase tracking-widest mb-6" style={{ color: '#C9A96E' }}>
              {t('secretarial.tiersEyebrow')}
            </p>
            <div className="grid sm:grid-cols-3 gap-5">
              {(['startup', 'sme', 'large'] as const).map((tier) => (
                <div
                  key={tier}
                  className="public-panel public-card-hover rounded-xl p-6 flex flex-col gap-4"
                >
                  <div className="flex items-baseline justify-between">
                    <span className="text-sm font-semibold" style={{ color: '#F5F0E6' }}>
                      {t(`secretarial.${tier}.label`)}
                    </span>
                    <span
                      className="text-xs px-2 py-0.5 rounded"
                      style={{ background: 'rgba(201,169,110,0.1)', color: '#C9A96E', border: '1px solid rgba(201,169,110,0.2)' }}
                    >
                      {t(`secretarial.${tier}.size`)}
                    </span>
                  </div>
                  <ul className="space-y-2 flex-1">
                    {(t.raw(`secretarial.${tier}.items`) as string[]).map((item, i) => (
                      <li key={i} className="flex gap-2 text-xs leading-relaxed" style={{ color: '#A89880' }}>
                        <span style={{ color: '#C9A96E', flexShrink: 0 }}>·</span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          {/* Six-step company formation process */}
          <div>
            <div className="text-center mb-10 space-y-3">
              <p className="text-xs uppercase tracking-widest" style={{ color: '#C9A96E' }}>
                {tHome('processEyebrow')}
              </p>
              <h3 className="font-display text-2xl md:text-3xl font-light" style={{ color: '#F5F0E6' }}>
                {tHome('processTitle')}
              </h3>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {processItems.map((item) => (
                <div
                  key={item.number}
                  className="public-panel public-card-hover rounded-xl p-6 flex gap-4 items-start"
                >
                  <span
                    className="text-2xl font-display font-light shrink-0"
                    style={{ color: 'rgba(201,169,110,0.35)', lineHeight: 1 }}
                  >
                    {item.number}
                  </span>
                  <div>
                    <p className="text-sm font-semibold mb-1" style={{ color: '#F5F0E6' }}>
                      {item.title}
                    </p>
                    <p className="text-xs leading-relaxed" style={{ color: '#A89880' }}>
                      {item.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <SectionDivider />

      {/* ══════════════════════════════════
          02 — Accounting & Tax
      ══════════════════════════════════ */}
      <section id="accounting" style={{ background: '#0C0C0C' }}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20 md:py-28">
          <div className="grid md:grid-cols-2 gap-12 md:gap-20 items-start">
            {/* Left: heading + intro + tools note */}
            <div className="space-y-6">
              <p className="text-xs uppercase tracking-widest" style={{ color: '#C9A96E' }}>02</p>
              <h2 className="font-display text-3xl md:text-4xl font-light" style={{ color: '#F5F0E6' }}>
                {t('accounting.title')}
              </h2>
              <p className="text-sm leading-relaxed" style={{ color: '#A89880' }}>
                {t('accounting.intro')}
              </p>
              <p
                className="text-xs leading-relaxed px-4 py-3 rounded-lg"
                style={{ background: '#141414', border: '1px solid #2A2418', color: '#7A7060' }}
              >
                <BarChart2 size={12} className="inline mr-1.5" style={{ color: '#C9A96E' }} aria-hidden />
                {t('accounting.toolsNote')}
              </p>
            </div>
            {/* Right: service items */}
            <div>
              <TickList items={t.raw('accounting.items') as string[]} />
            </div>
          </div>
        </div>
      </section>

      <SectionDivider />

      {/* ══════════════════════════════════
          03 — Business Advisory
      ══════════════════════════════════ */}
      <section id="advisory" style={{ background: '#0A0A0A' }}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20 md:py-28">
          <div className="grid md:grid-cols-2 gap-12 md:gap-20 items-start">
            {/* Left: heading + intro + CTA */}
            <div className="space-y-6">
              <p className="text-xs uppercase tracking-widest" style={{ color: '#C9A96E' }}>03</p>
              <h2 className="font-display text-3xl md:text-4xl font-light" style={{ color: '#F5F0E6' }}>
                {t('advisory.title')}
              </h2>
              <p className="text-sm leading-relaxed" style={{ color: '#A89880' }}>
                {t('advisory.intro')}
              </p>
              <Link
                href="/contact"
                className="inline-flex items-center gap-2 text-sm font-medium transition-opacity hover:opacity-80"
                style={{ color: '#C9A96E' }}
              >
                {t('getStarted')} <ArrowRight size={14} />
              </Link>
            </div>
            {/* Right: service items */}
            <div>
              <TickList items={t.raw('advisory.items') as string[]} />
            </div>
          </div>
        </div>
      </section>

      <SectionDivider />

      {/* ══════════════════════════════════
          04 — Extended Services
      ══════════════════════════════════ */}
      <section style={{ background: '#0A0A0A' }}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20 md:py-28">
          <div className="text-center mb-14 space-y-3">
            <p className="text-xs uppercase tracking-widest" style={{ color: '#C9A96E' }}>
              {t('otherEyebrow')}
            </p>
            <h2 className="font-display text-3xl md:text-4xl font-light" style={{ color: '#F5F0E6' }}>
              {t('otherTitle')}
            </h2>
            <p className="text-sm leading-relaxed max-w-xl mx-auto" style={{ color: '#A89880' }}>
              {t('otherSubtitle')}
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {OTHER_SERVICES.map(({ key, Icon }) => (
              <div
                key={key}
                className="public-panel public-card-hover rounded-xl p-6 flex flex-col gap-4"
              >
                <div style={{ height: '2px', width: '2rem', background: '#C9A96E', borderRadius: 1 }} />
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ background: 'rgba(201,169,110,0.1)', border: '1px solid rgba(201,169,110,0.15)' }}
                >
                  <Icon size={18} style={{ color: '#C9A96E' }} />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider mb-0.5" style={{ color: '#A89880' }}>
                    {t(`other.${key}.subtitle`)}
                  </p>
                  <h3 className="font-display text-base font-semibold" style={{ color: '#F5F0E6' }}>
                    {t(`other.${key}.title`)}
                  </h3>
                </div>
                <p className="text-xs leading-relaxed flex-1" style={{ color: '#A89880' }}>
                  {t(`other.${key}.desc`)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <SectionDivider />

      {/* ══════════════════════════════════
          06 — Service Packages
      ══════════════════════════════════ */}
      <section style={{ background: '#0C0C0C' }}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20 md:py-28">
          <div className="text-center mb-14 space-y-3">
            <p className="text-xs uppercase tracking-widest" style={{ color: '#C9A96E' }}>
              {t('tiers.eyebrow')}
            </p>
            <h2 className="font-display text-3xl md:text-4xl font-light" style={{ color: '#F5F0E6' }}>
              {t('tiers.title')}
            </h2>
          </div>
          <div className="grid sm:grid-cols-3 gap-6 mb-12">
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
                    {t('tiers.popular')}
                  </p>
                )}
                <div>
                  <h3 className="font-display text-2xl font-semibold" style={{ color: '#F5F0E6' }}>
                    {t(`tiers.${tier}`)}
                  </h3>
                  <p className="text-xs mt-1 leading-relaxed" style={{ color: '#A89880' }}>
                    {t(`tiers.${tier}Desc`)}
                  </p>
                </div>
                <ul className="space-y-2.5 flex-1">
                  {(t.raw(`tiers.${tier}Items`) as string[]).map((item, i) => (
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
                      : { border: '1px solid #3A3020', color: '#9A8060' }
                  }
                >
                  {t('getStarted')}
                </Link>
              </div>
            ))}
          </div>

          {/* Bottom CTA */}
          <div className="text-center">
            <p className="text-sm mb-5" style={{ color: '#A89880' }}>
              {t('tiers.customNote')}
            </p>
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 px-8 py-3 rounded-md text-sm font-semibold transition-all"
              style={{ background: '#C9A96E', color: '#0C0C0C' }}
            >
              {t('getStarted')} <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
