'use client'

import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'

const QUICK_LINKS = [
  ['/', 'home'],
  ['/services', 'services'],
  ['/about', 'about'],
  ['/contact', 'contact'],
  ['/faq', 'faq'],
] as const

export default function PublicFooter() {
  const t = useTranslations('footer')
  const tNav = useTranslations('nav')

  return (
    <footer style={{ background: '#000000' }}>
      <div className="h-px bg-[#272727]" />

      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-14 md:py-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10 md:gap-12">
          <div className="space-y-4">
            <Link href="/" className="flex items-center gap-2.5">
              <Image src="/logo.png" alt="" width={30} height={30} className="object-contain" />
              <Image
                src="/logo_text.avif"
                alt="6AM Advisory"
                width={120}
                height={30}
                className="object-contain"
                style={{ filter: 'grayscale(1) brightness(1.35)' }}
              />
            </Link>
            <p className="text-sm leading-6 max-w-sm text-[#9B9B9B] text-pretty">
              {t('tagline')}
            </p>
            <p className="inline-block rounded-md border border-[#272727] bg-[#181818] px-2.5 py-1.5 text-xs leading-5 text-[#9B9B9B]">
              {t('tcspNote')}
            </p>
          </div>

          <div>
            <h3 className="mb-4 text-xs font-semibold tracking-[0.16em] uppercase text-white">
              {t('quickLinks')}
            </h3>
            <ul className="space-y-2.5">
              {QUICK_LINKS.map(([href, key]) => (
                <li key={key}>
                  <Link
                    href={href}
                    className="text-sm text-[#9B9B9B] transition-colors duration-300 hover:text-white"
                  >
                    {tNav(key)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="mb-4 text-xs font-semibold tracking-[0.16em] uppercase text-white">
              {t('contact')}
            </h3>
            <ul className="space-y-2.5 text-sm text-[#9B9B9B]">
              <li className="leading-6">{t('address')}</li>
              <li>
                <a href={`tel:${t('phone')}`} className="transition-colors duration-300 hover:text-white">
                  {t('phone')}
                </a>
              </li>
              <li>
                <a href={`mailto:${t('email')}`} className="transition-colors duration-300 hover:text-white">
                  {t('email')}
                </a>
              </li>
              <li className="text-xs text-[#666666]">{t('hours')}</li>
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-[#272727] pt-6 text-xs text-[#666666] sm:flex-row">
          <p>{t('copyright')}</p>
          <div className="flex gap-5">
            <Link href="/privacy" className="transition-colors duration-300 hover:text-white">
              {t('privacy')}
            </Link>
            <Link href="/terms" className="transition-colors duration-300 hover:text-white">
              {t('terms')}
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
