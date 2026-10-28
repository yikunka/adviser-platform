import type { MetadataRoute } from 'next'
import { absoluteUrl, siteUrl } from '@/lib/seo'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/api/',
        '/admin/',
        '/en/admin/',
        '/zh/admin/',
        '/en/admin-login',
        '/zh/admin-login',
        '/en/dashboard/',
        '/zh/dashboard/',
        '/en/kyc',
        '/zh/kyc',
        '/en/login',
        '/zh/login',
        '/en/register',
        '/zh/register',
        '/sfsdiamond/dashboard/',
        '/sfsdiamond/login',
        '/sfsdiamond/register',
        '/sfsdiamond/forgot-password',
        '/sfsdiamond/reset-password',
        '/sfsdiamond/order',
      ],
    },
    sitemap: absoluteUrl('/sitemap.xml'),
    host: siteUrl.origin,
  }
}
