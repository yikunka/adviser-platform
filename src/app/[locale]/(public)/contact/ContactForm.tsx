'use client'

import { useState } from 'react'
import Image from 'next/image'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

const schema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email().max(255),
  phone: z.string().max(20).optional(),
  subject: z.string().min(1).max(200),
  message: z.string().min(10).max(2000),
})
type FormData = z.infer<typeof schema>

const fieldClass =
  'border-[#272727] bg-[#181818] text-[#FFFFFF] placeholder:text-[#666666] focus-visible:border-[#9B9B9B] focus-visible:ring-[#9B9B9B]/30'

export default function ContactForm() {
  const t = useTranslations('contact')
  const params = useParams()
  const locale = (params.locale as string) ?? 'zh'
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  const form = useForm<FormData>({ resolver: zodResolver(schema) })

  async function onSubmit(data: FormData) {
    setLoading(true)
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, locale }),
      })
      if (!res.ok) throw new Error()
      setSent(true)
      toast.success(t('sentSuccess'))
    } catch {
      toast.error(t('sentError'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="grid md:grid-cols-2 gap-12 md:gap-16">
      <div>
        <h2
          className="text-xl font-semibold font-display tracking-tight mb-6"
          style={{ color: '#FFFFFF' }}
        >
          {t('formTitle')}
        </h2>
        {sent ? (
          <div
            className="p-6 rounded-2xl border"
            style={{
              background: '#181818',
              borderColor: '#272727',
            }}
          >
            <p className="font-medium" style={{ color: '#9B9B9B' }}>
              {t('sentSuccess')}
            </p>
            <p className="text-sm mt-1" style={{ color: '#9B9B9B' }}>
              {t('sentDesc')}
            </p>
          </div>
        ) : (
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="name" className="text-[#9B9B9B]">
                  {t('name')}
                </Label>
                <Input id="name" className={fieldClass} {...form.register('name')} />
                {form.formState.errors.name && (
                  <p className="text-sm text-red-400">{form.formState.errors.name.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="phone" className="text-[#9B9B9B]">
                  {t('phone')}
                </Label>
                <Input id="phone" type="tel" className={fieldClass} {...form.register('phone')} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-[#9B9B9B]">
                {t('email')}
              </Label>
              <Input id="email" type="email" className={fieldClass} {...form.register('email')} />
              {form.formState.errors.email && (
                <p className="text-sm text-red-400">{form.formState.errors.email.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="subject" className="text-[#9B9B9B]">
                {t('subject')}
              </Label>
              <Input id="subject" className={fieldClass} {...form.register('subject')} />
              {form.formState.errors.subject && (
                <p className="text-sm text-red-400">{form.formState.errors.subject.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="message" className="text-[#9B9B9B]">
                {t('message')}
              </Label>
              <Textarea
                id="message"
                rows={5}
                className={fieldClass + ' min-h-[120px] py-2'}
                {...form.register('message')}
              />
              {form.formState.errors.message && (
                <p className="text-sm text-red-400">{form.formState.errors.message.message}</p>
              )}
            </div>
            <Button
              type="submit"
              className="w-full h-10 font-semibold"
              style={{ background: '#FFFFFF', color: '#000000' }}
              disabled={loading}
            >
              {loading ? t('sending') : t('send')}
            </Button>
          </form>
        )}
      </div>

      <div className="space-y-6">
        <h2
          className="text-xl font-semibold font-display tracking-tight"
          style={{ color: '#FFFFFF' }}
        >
          {t('officeTitle')}
        </h2>
        <div
          className="h-px w-10 mb-2"
          style={{ background: 'linear-gradient(90deg, #9B9B9B, transparent)' }}
        />
        <div className="relative w-full aspect-[4/3] overflow-hidden rounded-sm">
          <Image
            src="/marketing/office-front-door.jpg"
            alt={t('doorImageAlt')}
            fill
            sizes="(max-width: 768px) 100vw, 40vw"
            className="object-cover object-center"
          />
        </div>
        <dl className="space-y-5 text-sm">
          <div>
            <dt className="text-xs uppercase tracking-wider mb-1" style={{ color: '#9B9B9B' }}>
              {t('address')}
            </dt>
            <dd style={{ color: '#9B9B9B' }}>{t('addressValue')}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wider mb-1" style={{ color: '#9B9B9B' }}>
              {t('phone')}
            </dt>
            <dd>
              <a
                href={`tel:${t('phoneValue')}`}
                className="public-link-hover transition-colors"
                style={{ color: '#9B9B9B' }}
              >
                {t('phoneValue')}
              </a>
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wider mb-1" style={{ color: '#9B9B9B' }}>
              {t('emailLabel')}
            </dt>
            <dd>
              <a
                href={`mailto:${t('emailValue')}`}
                className="public-link-hover transition-colors"
                style={{ color: '#9B9B9B' }}
              >
                {t('emailValue')}
              </a>
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wider mb-1" style={{ color: '#9B9B9B' }}>
              {t('hours')}
            </dt>
            <dd style={{ color: '#9B9B9B' }}>{t('hoursValue')}</dd>
          </div>
        </dl>
      </div>
    </div>
  )
}
