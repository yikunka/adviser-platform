import type { Metadata } from 'next'
import { SFS_PUBLIC_WEBSITE } from '@/lib/sfs/sales-contact'

export const siteUrl = (() => {
  const raw = process.env.NEXT_PUBLIC_APP_URL || 'https://www.6amadvise.com'
  try {
    return new URL(raw)
  } catch {
    return new URL('https://www.6amadvise.com')
  }
})()

export function absoluteUrl(path = '/') {
  return new URL(path, siteUrl).toString()
}

/** Public SFS Diamond site origin (never inherit 6AM `NEXT_PUBLIC_APP_URL`). */
export const sfsSiteUrl = (() => {
  const raw = process.env.NEXT_PUBLIC_SFS_URL || SFS_PUBLIC_WEBSITE
  try {
    return new URL(raw)
  } catch {
    return new URL(SFS_PUBLIC_WEBSITE)
  }
})()

export function sfsAbsoluteUrl(path = '/') {
  return new URL(path, sfsSiteUrl).toString()
}

/**
 * Per-page SFS public metadata: absolute title (never inherits 6AM template),
 * canonical + og:url for this path on sfsdiamonds.com.
 */
export function sfsPageMetadata({
  title,
  description,
  path,
  image,
  index = true,
}: {
  /** Short page title, or full absolute title if it already contains `|`. */
  title: string
  description: string
  /** App path, e.g. `/sfsdiamond/technology`. */
  path: string
  image?: string
  index?: boolean
}): Metadata {
  const absoluteTitle = title.includes('|') ? title : `${title} | SFS Diamond`
  const url = sfsAbsoluteUrl(path)
  const imageUrl = sfsAbsoluteUrl(image ?? sfsSeo.image)

  return {
    title: { absolute: absoluteTitle },
    description,
    alternates: { canonical: path },
    openGraph: {
      title: absoluteTitle,
      description,
      url,
      siteName: 'SFS Diamond',
      type: 'website',
      locale: 'en_HK',
      images: [{ url: imageUrl, width: 1200, height: 630, alt: absoluteTitle }],
    },
    twitter: {
      card: 'summary_large_image',
      title: absoluteTitle,
      description,
      images: [imageUrl],
    },
    ...(index
      ? {}
      : {
          robots: { index: false, follow: false },
        }),
  }
}

type BrandSeo = {
  title: string
  description: string
  path: string
  image: string
  keywords: string[]
  locale?: string
}

export function brandMetadata({
  title,
  description,
  path,
  image,
  keywords,
  locale,
}: BrandSeo): Metadata {
  const url = absoluteUrl(path)
  const imageUrl = absoluteUrl(image)

  return {
    title,
    description,
    metadataBase: siteUrl,
    applicationName: title.split('|')[0]?.trim() || title,
    keywords,
    alternates: {
      canonical: path,
    },
    openGraph: {
      title,
      description,
      url,
      siteName: title,
      type: 'website',
      locale,
      images: [
        {
          url: imageUrl,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [imageUrl],
    },
  }
}

export const sixAmSeo = {
  title: '6AM Advisory | Private Hong Kong TCSP for Families & Principals',
  description:
    'Licensed Hong Kong TCSP TC010556 — discreet company secretarial, accounting, compliance and structuring services for private companies, family offices and principals.',
  keywords: [
    '6AM Advisory',
    '6amadvise',
    'Hong Kong TCSP TC010556',
    'family office company secretary Hong Kong',
    'private company secretarial Hong Kong',
    'Hong Kong holding company formation',
    'Hong Kong company formation',
  ],
  image: '/logo.png',
}

export const sfsSeo = {
  title: 'SFS Diamond | Memorial Diamond OEM & White-label Manufacturing',
  description:
    'Factory-backed CVD memorial diamond OEM and white-label manufacturing for brands — certification, packaging, optional jewellery finishing, trial orders, and production tracking.',
  keywords: [
    'SFS Diamond',
    'memorial diamond OEM',
    'white label memorial diamond',
    'CVD diamond manufacturer',
    'diamonds from ashes OEM',
    'ashes to diamonds factory',
    'memorial diamond white label',
    'lab grown memorial diamond OEM',
  ],
  image: '/sfsdiamond/hero-diamond.jpg',
}
