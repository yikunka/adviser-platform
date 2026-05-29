'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Link, useRouter } from '@/i18n/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import type { EntityGroupTemplate } from '@/lib/entity-groups/templates'

type GroupDetail = {
  id: string
  name: string
  contactPerson?: string | null
  email?: string | null
  phone?: string | null
  address?: string | null
  notes?: string | null
  companies: {
    id: string
    companyCode?: string | null
    nameEn: string
    nameZh?: string | null
    companyNumber?: string | null
    status: string
  }[]
  members: { user: { id: string; nameEn: string; email: string } }[]
}

const fieldStyle: React.CSSProperties = {
  width: '100%',
  background: '#0A0A0A',
  border: '1px solid #2A2418',
  color: '#F0EAD8',
  borderRadius: '0.375rem',
  padding: '0.5rem 0.75rem',
  fontSize: '0.875rem',
}

export default function EntityGroupDetailPage() {
  const { id } = useParams<{ id: string }>()
  const t = useTranslations('admin.entities')
  const router = useRouter()
  const [group, setGroup] = useState<GroupDetail | null>(null)
  const [templates, setTemplates] = useState<EntityGroupTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name: '',
    contactPerson: '',
    email: '',
    phone: '',
    address: '',
    notes: '',
  })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [groupRes, tplRes] = await Promise.all([
        fetch(`/api/admin/entity-groups/${id}`),
        fetch('/api/admin/entity-groups/templates'),
      ])
      const groupJson = await groupRes.json()
      if (!groupRes.ok) throw new Error(groupJson.error)
      setGroup(groupJson)
      setForm({
        name: groupJson.name ?? '',
        contactPerson: groupJson.contactPerson ?? '',
        email: groupJson.email ?? '',
        phone: groupJson.phone ?? '',
        address: groupJson.address ?? '',
        notes: groupJson.notes ?? '',
      })
      const tplJson = await tplRes.json()
      setTemplates(tplJson.templates ?? [])
    } catch {
      toast.error(t('loadError'))
    } finally {
      setLoading(false)
    }
  }, [id, t])

  useEffect(() => {
    load()
  }, [load])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/entity-groups/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error()
      toast.success(t('saveSuccess'))
      load()
    } catch {
      toast.error(t('saveError'))
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <p className="p-6" style={{ color: 'var(--muted-foreground)' }}>{t('loading')}</p>
  if (!group) return <p className="p-6" style={{ color: 'var(--muted-foreground)' }}>{t('notFound')}</p>

  return (
    <div className="p-6 space-y-6">
      <Link href="/admin/entities" className="text-sm" style={{ color: '#C9A96E' }}>← {t('back')}</Link>

      <form onSubmit={handleSave} className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardContent className="p-4 space-y-3">
            <h2 className="font-semibold" style={{ color: 'var(--foreground)' }}>{t('details')}</h2>
            <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} style={fieldStyle} placeholder={t('name')} />
            <Input value={form.contactPerson} onChange={e => setForm(f => ({ ...f, contactPerson: e.target.value }))} style={fieldStyle} placeholder={t('contactPerson')} />
            <Input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} style={fieldStyle} placeholder={t('email')} />
            <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} style={fieldStyle} placeholder={t('phone')} />
            <Input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} style={fieldStyle} placeholder={t('address')} />
            <textarea
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              rows={3}
              style={{ ...fieldStyle, resize: 'vertical' }}
              placeholder={t('notes')}
            />
            <Button type="submit" disabled={saving}>{saving ? t('saving') : t('save')}</Button>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold" style={{ color: 'var(--foreground)' }}>{t('companiesInGroup')}</h2>
                <Link href={`/admin/companies/new?groupId=${id}`}>
                  <Button size="sm" variant="outline">{t('addCompany')}</Button>
                </Link>
              </div>
              {group.companies.length === 0 ? (
                <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>{t('noCompanies')}</p>
              ) : (
                <ul className="space-y-2">
                  {group.companies.map(c => (
                    <li
                      key={c.id}
                      className="flex items-center justify-between p-2 rounded cursor-pointer hover:bg-[#1A1A12]"
                      onClick={() => router.push(`/admin/companies/${c.id}`)}
                    >
                      <div>
                        <p className="font-medium text-sm" style={{ color: 'var(--foreground)' }}>{c.nameEn}</p>
                        <p className="text-xs" style={{ color: '#C9A96E' }}>{c.companyCode ?? '—'}</p>
                      </div>
                      <Badge variant="outline">{c.status}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-2">
              <h2 className="font-semibold text-sm" style={{ color: 'var(--foreground)' }}>{t('templates')}</h2>
              {templates.map(tpl => (
                <div key={tpl.id} className="text-xs p-2 rounded" style={{ background: '#1A1A12', color: 'var(--muted-foreground)' }}>
                  <p className="font-medium" style={{ color: '#C9A96E' }}>{tpl.name}</p>
                  <p>{tpl.description}</p>
                  <p className="mt-1">{tpl.slots.length} {t('slots')}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </form>
    </div>
  )
}
