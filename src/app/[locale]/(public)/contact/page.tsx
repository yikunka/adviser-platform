import { getTranslations } from 'next-intl/server'
import PublicPageHero from '@/components/public/PublicPageHero'
import ContactForm from './ContactForm'

export default async function ContactPage() {
  const t = await getTranslations('contact')

  return (
    <div>
      <PublicPageHero title={t('title')} subtitle={t('subtitle')} />
      <section
        className="py-16 md:py-20 border-t"
        style={{ background: '#0A0A0A', borderColor: '#1E1A12' }}
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <ContactForm />
        </div>
      </section>
    </div>
  )
}
