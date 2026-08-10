import type { MetadataRoute } from 'next'
import { absoluteUrl } from '@/lib/seo'

type SitemapRoute = {
  path: string
  priority: number
  image?: string
}

const publicRoutes: SitemapRoute[] = [
  { path: '/en', priority: 1 },
  { path: '/en/services', priority: 0.85 },
  { path: '/en/about', priority: 0.75 },
  { path: '/en/faq', priority: 0.65 },
  { path: '/en/contact', priority: 0.7 },
  { path: '/zh', priority: 1 },
  { path: '/zh/services', priority: 0.85 },
  { path: '/zh/about', priority: 0.75 },
  { path: '/zh/faq', priority: 0.65 },
  { path: '/zh/contact', priority: 0.7 },
  { path: '/sfsdiamond', priority: 0.95 },
  { path: '/sfsdiamond/memorial-diamonds', priority: 0.85 },
  { path: '/sfsdiamond/technology', priority: 0.8 },
  { path: '/sfsdiamond/qa', priority: 0.7 },
  { path: '/sfsdiamond/about', priority: 0.7 },
]

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date()

  return publicRoutes.map(route => ({
    url: absoluteUrl(route.path),
    lastModified,
    changeFrequency: 'weekly' as const,
    priority: route.priority,
    images: route.image ? [absoluteUrl(route.image)] : undefined,
  }))
}
