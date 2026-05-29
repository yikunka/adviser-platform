'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Link } from '@/i18n/navigation'

const fieldStyle: React.CSSProperties = {
  width: '100%',
  background: '#0A0A0A',
  border: '1px solid #2A2418',
  color: '#F0EAD8',
  borderRadius: '0.375rem',
  padding: '0.5rem 0.75rem',
  fontSize: '0.875rem',
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '0.75rem',
  fontWeight: 500,
  color: '#7A7060',
  marginBottom: '0.375rem',
}

export default function NewEntityGroupPage() {
  const t = useTranslations('admin.entities')
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    name: '',
    contactPerson: '',
    email: '',
    phone: '',
    address: '',
    notes: '',
  })

  function setField(key: string, value: string) {
    setForm(f => ({ ...f, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch('/api/admin/entity-groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')
      toast.success(t('createSuccess'))
      router.push(`/admin/entities/${data.id}`)
    } catch {
      toast.error(t('createError'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 max-w-xl space-y-6">
      <div>
        <Link href="/admin/entities" className="text-sm" style={{ color: '#C9A96E' }}>← {t('back')}</Link>
        <h1 className="text-2xl font-bold mt-2" style={{ color: 'var(--foreground)' }}>{t('newTitle')}</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label style={labelStyle}>{t('name')} *</label>
          <Input value={form.name} onChange={e => setField('name', e.target.value)} required style={fieldStyle} />
        </div>
        <div>
          <label style={labelStyle}>{t('contactPerson')}</label>
          <Input value={form.contactPerson} onChange={e => setField('contactPerson', e.target.value)} style={fieldStyle} />
        </div>
        <div>
          <label style={labelStyle}>{t('email')}</label>
          <Input type="email" value={form.email} onChange={e => setField('email', e.target.value)} style={fieldStyle} />
        </div>
        <div>
          <label style={labelStyle}>{t('phone')}</label>
          <Input value={form.phone} onChange={e => setField('phone', e.target.value)} style={fieldStyle} />
        </div>
        <div>
          <label style={labelStyle}>{t('address')}</label>
          <Input value={form.address} onChange={e => setField('address', e.target.value)} style={fieldStyle} />
        </div>
        <div>
          <label style={labelStyle}>{t('notes')}</label>
          <textarea
            value={form.notes}
            onChange={e => setField('notes', e.target.value)}
            rows={3}
            style={{ ...fieldStyle, resize: 'vertical' }}
          />
        </div>
        <Button type="submit" disabled={loading}>{loading ? t('saving') : t('save')}</Button>
      </form>
    </div>
  )
}
