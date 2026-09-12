import type { Metadata } from 'next'
import { absoluteUrl, siteUrl, sixAmSeo } from '@/lib/seo'
import './globals.css'

// 不使用 next/font/google：构建时会请求 fonts.googleapis.com，国内/无出口机器会失败。
// 字体栈在 globals.css 的 html 上定义（接近 Geist / Cormorant Garamond 观感）。

export const metadata: Metadata = {
  metadataBase: siteUrl,
  title: {
    default: sixAmSeo.title,
    template: '%s | 6AM Advisory',
  },
  description: sixAmSeo.description,
  applicationName: '6AM Advisory',
  keywords: sixAmSeo.keywords,
  authors: [{ name: '6AM Advisory' }],
  creator: '6AM Advisory',
  publisher: '6AM Advisory',
  alternates: {
    canonical: '/',
    languages: {
      en: '/en',
      zh: '/zh',
    },
  },
  openGraph: {
    title: sixAmSeo.title,
    description: sixAmSeo.description,
    url: absoluteUrl('/'),
    siteName: '6AM Advisory',
    type: 'website',
    images: [{ url: absoluteUrl(sixAmSeo.image), width: 1200, height: 630, alt: '6AM Advisory' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: sixAmSeo.title,
    description: sixAmSeo.description,
    images: [absoluteUrl(sixAmSeo.image)],
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html suppressHydrationWarning className="h-full antialiased">
      <body suppressHydrationWarning className="min-h-full flex flex-col bg-background text-foreground">
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('6am-platform-theme');if(t!=='day'&&t!=='night')return;var c=t==='day'?'theme-day':'theme-dark';document.documentElement.classList.add(c);if(t==='night')document.documentElement.classList.add('dark');document.documentElement.setAttribute('data-ui-theme',t);document.documentElement.style.colorScheme=t==='day'?'light':'dark';}catch(e){}})();`,
          }}
        />
        {children}
      </body>
    </html>
  )
}
