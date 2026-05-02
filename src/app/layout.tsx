import type { Metadata } from 'next'
import { Geist, Cormorant_Garamond } from 'next/font/google'
import './globals.css'

const geist = Geist({ variable: '--font-sans', subsets: ['latin'] })
const cormorant = Cormorant_Garamond({
  variable: '--font-display',
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  style: ['normal', 'italic'],
})

export const metadata: Metadata = {
  title: '6AM Advisory — Hong Kong TCSP',
  description: 'Professional Hong Kong company formation, secretarial, accounting and advisory services.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html suppressHydrationWarning className={`${geist.variable} ${cormorant.variable} h-full antialiased`}>
      <body suppressHydrationWarning className="min-h-full flex flex-col bg-background text-foreground">
        {children}
      </body>
    </html>
  )
}
