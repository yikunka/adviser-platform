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
  { path: '/cosmocoat', priority: 0.95 },
  { path: '/cosmocoat/about', priority: 0.75 },
  { path: '/cosmocoat/products', priority: 0.9 },
  { path: '/cosmocoat/supporting', priority: 0.75 },
]

const cosmoProductPids = [
  '1791543',
  '1791541',
  '1791539',
  '1791537',
  '1791533',
  '1314593',
  '1314591',
  '1314589',
  '1224565',
  '1224563',
  '439905',
  '439903',
  '367407',
  '24142',
  '24518',
  '367403',
]

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date()
  const productRoutes: SitemapRoute[] = cosmoProductPids.map(pid => ({
    path: `/cosmocoat/products/${pid}`,
    priority: 0.65,
  }))

  return [...publicRoutes, ...productRoutes].map(route => ({
    url: absoluteUrl(route.path),
    lastModified,
    changeFrequency: route.path.includes('/products/') ? 'monthly' : 'weekly',
    priority: route.priority,
    images: route.image ? [absoluteUrl(route.image)] : undefined,
  }))
}
