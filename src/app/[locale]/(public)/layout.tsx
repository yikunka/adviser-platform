import type { Metadata } from 'next'
import PublicHeader from '@/components/layout/PublicHeader'
import PublicFooter from '@/components/layout/PublicFooter'
import { absoluteUrl, sixAmSeo } from '@/lib/seo'

type Props = {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: Omit<Props, 'children'>): Promise<Metadata> {
  const { locale } = await params
  const canonical = `/${locale}`

  return {
    title: sixAmSeo.title,
    description: sixAmSeo.description,
    keywords: sixAmSeo.keywords,
    alternates: {
      canonical,
      languages: {
        en: '/en',
        zh: '/zh',
      },
    },
    openGraph: {
      title: sixAmSeo.title,
      description: sixAmSeo.description,
      url: absoluteUrl(canonical),
      siteName: '6AM Advisory',
      type: 'website',
      locale: locale === 'zh' ? 'zh_HK' : 'en_HK',
      images: [{ url: absoluteUrl(sixAmSeo.image), width: 1200, height: 630, alt: '6AM Advisory' }],
    },
    twitter: {
      card: 'summary_large_image',
      title: sixAmSeo.title,
      description: sixAmSeo.description,
      images: [absoluteUrl(sixAmSeo.image)],
    },
  }
}

export default function PublicLayout({ children }: Props) {
  return (
    <div
      style={{ background: '#0C0C0C', color: '#F0EAD8' }}
      className="theme-dark flex min-h-screen flex-col"
    >
      <PublicHeader />
      <main className="flex-1">{children}</main>
      <PublicFooter />
    </div>
  )
}
