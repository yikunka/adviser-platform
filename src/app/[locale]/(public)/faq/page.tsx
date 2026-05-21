import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import PublicPageHero from '@/components/public/PublicPageHero'
import FAQList from './FAQList'
import { absoluteUrl } from '@/lib/seo'

type MetadataProps = { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: MetadataProps): Promise<Metadata> {
  const { locale } = await params
  const path = `/${locale}/faq`
  const title = 'FAQ'
  const description = 'Frequently asked questions about 6AM Advisory company formation, company secretarial, accounting and compliance services.'

  return {
    title,
    description,
    alternates: {
      canonical: path,
      languages: { en: '/en/faq', zh: '/zh/faq' },
    },
    openGraph: {
      title: `${title} | 6AM Advisory`,
      description,
      url: absoluteUrl(path),
      type: 'website',
    },
  }
}

export default async function FAQPage() {
  const t = await getTranslations('faq')

  return (
    <div>
      <PublicPageHero title={t('title')} subtitle={t('subtitle')} />
      <section
        className="py-16 md:py-20 border-t"
        style={{ background: '#0A0A0A', borderColor: '#1E1A12' }}
      >
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <FAQList />
        </div>
      </section>
    </div>
  )
}
