'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Link, useRouter } from '@/i18n/navigation'
import { Building2, Layers, Plus, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

type EntityGroup = {
  id: string
  name: string
  contactPerson?: string | null
  email?: string | null
  phone?: string | null
  _count: { companies: number; members: number }
}

export default function EntitiesPage() {
  const t = useTranslations('admin.entities')
  const router = useRouter()
  const [groups, setGroups] = useState<EntityGroup[]>([])
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)

  const fetchGroups = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/entity-groups?q=${encodeURIComponent(search)}&page=${page}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to load')
      setGroups(json.groups ?? [])
      setTotal(json.total ?? 0)
    } catch {
      toast.error(t('loadError'))
    } finally {
      setLoading(false)
    }
  }, [search, page, t])

  useEffect(() => {
    fetchGroups()
  }, [fetchGroups])

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: 'var(--foreground)' }}>
            <Layers size={24} style={{ color: '#C9A96E' }} />
            {t('title')}
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>{t('subtitle')}</p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/entities/import">
            <Button variant="outline">
              <Upload size={16} className="mr-1" />
              {t('bulkImport')}
            </Button>
          </Link>
          <Link href="/admin/entities/new">
            <Button>
              <Plus size={16} className="mr-1" />
              {t('add')}
            </Button>
          </Link>
        </div>
      </div>

      <Input
        placeholder={t('search')}
        value={search}
        onChange={e => { setSearch(e.target.value); setPage(1) }}
        className="max-w-xs"
      />

      {loading ? (
        <p style={{ color: 'var(--muted-foreground)' }}>{t('loading')}</p>
      ) : groups.length === 0 ? (
        <Card><CardContent className="p-8 text-center" style={{ color: 'var(--muted-foreground)' }}>{t('empty')}</CardContent></Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {groups.map(group => (
            <Card
              key={group.id}
              className="cursor-pointer transition-colors hover:border-[#C9A96E]/40"
              onClick={() => router.push(`/admin/entities/${group.id}`)}
            >
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="font-semibold" style={{ color: 'var(--foreground)' }}>{group.name}</h2>
                  <Badge variant="outline" style={{ borderColor: '#C9A96E', color: '#C9A96E' }}>
                    <Building2 size={12} className="mr-1" />
                    {group._count.companies}
                  </Badge>
                </div>
                {group.contactPerson && (
                  <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>{group.contactPerson}</p>
                )}
                {group.email && (
                  <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{group.email}</p>
                )}
                <p className="text-xs" style={{ color: '#7A7060' }}>
                  {t('memberCount', { count: group._count.members })}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {total > 20 && (
        <div className="flex justify-between items-center text-sm" style={{ color: 'var(--muted-foreground)' }}>
          <p>{t('total', { count: total })}</p>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={page === 1} onClick={() => setPage(p => p - 1)}>{t('prev')}</Button>
            <Button size="sm" variant="outline" disabled={page * 20 >= total} onClick={() => setPage(p => p + 1)}>{t('next')}</Button>
          </div>
        </div>
      )}
    </div>
  )
}
