import type { Metadata } from 'next'

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
  title: '6AM Advisory | Hong Kong Company Formation, TCSP & Corporate Services',
  description:
    '6AM Advisory provides Hong Kong company formation, company secretarial, accounting, compliance and business advisory services for founders and international businesses.',
  keywords: [
    '6AM Advisory',
    '6amadvise',
    'Hong Kong company formation',
    'Hong Kong TCSP',
    'company secretary Hong Kong',
    'accounting services Hong Kong',
    'business advisory Hong Kong',
  ],
  image: '/logo.png',
}

export const sfsSeo = {
  title: 'SFS Diamond | Memorial Diamonds from Ashes and Hair in Hong Kong',
  description:
    'SFS Diamond creates certified lab-grown memorial diamonds from cremated ashes or hair using CVD technology, with secure tracking and bespoke jewellery in Hong Kong.',
  keywords: [
    'SFS Diamond',
    'memorial diamond Hong Kong',
    'diamonds from ashes',
    'ashes to diamonds',
    'hair to diamond',
    'lab grown memorial diamond',
    'CVD diamond Hong Kong',
  ],
  image: '/sfsdiamond/hero-diamond.jpg',
}
