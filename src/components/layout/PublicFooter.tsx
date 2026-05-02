import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'

const QUICK_LINKS = [
  ['/',         'home'    ],
  ['/services', 'services'],
  ['/about',    'about'   ],
  ['/contact',  'contact' ],
  ['/faq',      'faq'     ],
] as const

export default function PublicFooter() {
  const t = useTranslations('footer')
  const tNav = useTranslations('nav')

  return (
    <footer style={{ background: '#080808' }}>
      {/* Gold accent line */}
      <div style={{ height: '1px', background: 'linear-gradient(90deg, transparent, #C9A96E 30%, #F0D090 50%, #C9A96E 70%, transparent)' }} />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-14">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10">

          {/* Brand column */}
          <div className="space-y-4">
            <Link href="/" className="flex items-center gap-2.5">
              <Image src="/logo.png" alt="" width={30} height={30} className="object-contain" />
              <Image
                src="/logo_text.avif"
                alt="6AM Advisory"
                width={120}
                height={30}
                className="object-contain"
                style={{ filter: 'brightness(1.1)' }}
              />
            </Link>
            <p className="text-sm leading-relaxed" style={{ color: '#7A7060' }}>{t('tagline')}</p>
            <p
              className="text-xs px-2.5 py-1.5 rounded inline-block"
              style={{ color: '#9A8060', border: '1px solid #2A2418', background: 'rgba(201,169,110,0.06)' }}
            >
              {t('tcspNote')}
            </p>
          </div>

          {/* Quick links */}
          <div>
            <h3
              className="text-xs font-semibold uppercase tracking-widest mb-4"
              style={{ color: '#C9A96E' }}
            >
              {t('quickLinks')}
            </h3>
            <ul className="space-y-2.5">
              {QUICK_LINKS.map(([href, key]) => (
                <li key={key}>
                  <Link
                    href={href}
                    className="public-link-hover text-sm transition-colors"
                    style={{ color: '#7A7060' }}
                  >
                    {tNav(key)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3
              className="text-xs font-semibold uppercase tracking-widest mb-4"
              style={{ color: '#C9A96E' }}
            >
              {t('contact')}
            </h3>
            <ul className="space-y-2.5 text-sm" style={{ color: '#7A7060' }}>
              <li style={{ lineHeight: 1.6 }}>{t('address')}</li>
              <li>
                <a
                  href={`tel:${t('phone')}`}
                  className="public-link-hover transition-colors"
                >
                  {t('phone')}
                </a>
              </li>
              <li>
                <a
                  href={`mailto:${t('email')}`}
                  className="public-link-hover transition-colors"
                >
                  {t('email')}
                </a>
              </li>
              <li className="text-xs" style={{ color: '#4A4030' }}>{t('hours')}</li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div
          className="mt-12 pt-6 flex flex-col sm:flex-row justify-between items-center gap-3 text-xs"
          style={{ borderTop: '1px solid #1E1A12', color: '#4A4030' }}
        >
          <p>{t('copyright')}</p>
          <div className="flex gap-5">
            <Link href="/privacy" className="public-link-hover transition-colors">{t('privacy')}</Link>
            <Link href="/terms"   className="public-link-hover transition-colors">{t('terms')}</Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
