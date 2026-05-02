import type { Metadata } from 'next'
import './globals.css'

// 不使用 next/font/google：构建时会请求 fonts.googleapis.com，国内/无出口机器会失败。
// 字体栈在 globals.css 的 html 上定义（接近 Geist / Cormorant Garamond 观感）。

export const metadata: Metadata = {
  title: '6AM Advisory — Hong Kong TCSP',
  description: 'Professional Hong Kong company formation, secretarial, accounting and advisory services.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html suppressHydrationWarning className="h-full antialiased">
      <body suppressHydrationWarning className="min-h-full flex flex-col bg-background text-foreground">
        {children}
      </body>
    </html>
  )
}
