import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import PublicPageHero from '@/components/public/PublicPageHero'
import ContactForm from './ContactForm'
import { absoluteUrl } from '@/lib/seo'

type MetadataProps = { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: MetadataProps): Promise<Metadata> {
  const { locale } = await params
  const path = `/${locale}/contact`
  const title = 'Contact 6AM Advisory'
  const description = 'Contact 6AM Advisory for Hong Kong company formation, accounting, company secretarial, compliance and business advisory support.'

  return {
    title,
    description,
    alternates: {
      canonical: path,
      languages: { en: '/en/contact', zh: '/zh/contact' },
    },
    openGraph: {
      title,
      description,
      url: absoluteUrl(path),
      type: 'website',
    },
  }
}

export default async function ContactPage() {
  const t = await getTranslations('contact')

  return (
    <div>
      <PublicPageHero title={t('title')} subtitle={t('subtitle')} />
      <section style={{ background: '#0A0A0A' }}>
        <div className="public-section-rule" />
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 md:py-20">
          <ContactForm />
        </div>
      </section>
    </div>
  )
}
