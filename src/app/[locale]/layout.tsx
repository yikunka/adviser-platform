import { NextIntlClientProvider } from 'next-intl'
import { getMessages } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { routing } from '@/i18n/routing'
import { Toaster } from '@/components/ui/sonner'
import { HtmlLang } from '@/components/HtmlLang'
import Providers from './Providers'

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params

  if (!routing.locales.includes(locale as 'zh' | 'en')) {
    notFound()
  }

  const messages = await getMessages()

  return (
    <NextIntlClientProvider messages={messages}>
      <Providers>
        <HtmlLang lang={locale} />
        {children}
        <Toaster richColors position="top-right" />
      </Providers>
    </NextIntlClientProvider>
  )
}
