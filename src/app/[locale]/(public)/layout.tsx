import type { Metadata } from 'next'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
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
      className={`tcsp-public theme-dark flex min-h-dvh flex-col antialiased ${GeistSans.variable} ${GeistMono.variable}`}
      style={{
        background: '#000000',
        color: '#FFFFFF',
        fontFamily: 'var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif',
      }}
    >
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-white focus:px-3 focus:py-2 focus:text-sm focus:font-semibold focus:text-black"
      >
        Skip to content
      </a>
      <PublicHeader />
      <main id="main-content" className="flex-1">
        {children}
      </main>
      <PublicFooter />
    </div>
  )
}
