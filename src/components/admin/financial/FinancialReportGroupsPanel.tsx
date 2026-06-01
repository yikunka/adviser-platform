'use client'

/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useMemo, useState } from 'react'
import { FileBarChart, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useFinancialWorkspace, type FinancialCompanyInfo } from '@/components/admin/financial/FinancialCompanyContext'
import { FinancialReportGroupReportsPanel } from '@/components/admin/financial/FinancialReportsPanel'

type ReportGroup = {
  id: string
  name: string
  notes: string | null
  companies: { company: FinancialCompanyInfo }[]
}

export function FinancialReportGroupsPanel() {
  const { companies } = useFinancialWorkspace()
  const [groups, setGroups] = useState<ReportGroup[]>([])
  const [selectedGroupId, setSelectedGroupId] = useState('')
  const [name, setName] = useState('')
  const [selectedCompanyIds, setSelectedCompanyIds] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const selectedGroup = useMemo(
    () => groups.find(group => group.id === selectedGroupId) ?? null,
    [groups, selectedGroupId],
  )

  async function loadGroups() {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/financial/report-groups')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load report groups')
      const nextGroups = Array.isArray(data.groups) ? data.groups : []
      setGroups(nextGroups)
      setSelectedGroupId(current => current || nextGroups[0]?.id || '')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load report groups')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadGroups()
  }, [])

  function toggleCompany(companyId: string) {
    setSelectedCompanyIds(current => {
      const next = new Set(current)
      if (next.has(companyId)) {
        next.delete(companyId)
      } else {
        next.add(companyId)
      }
      return Array.from(next)
    })
  }

  async function createGroup(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) {
      toast.error('Enter a group name')
      return
    }
    if (selectedCompanyIds.length === 0) {
      toast.error('Select at least one company')
      return
    }

    setSaving(true)
    try {
      const res = await fetch('/api/admin/financial/report-groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, companyIds: selectedCompanyIds }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to create report group')
      setGroups(current => [...current.filter(group => group.id !== data.id), data].sort((a, b) => a.name.localeCompare(b.name)))
      setSelectedGroupId(data.id)
      setName('')
      setSelectedCompanyIds([])
      toast.success('Report group created')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create report group')
    } finally {
      setSaving(false)
    }
  }

  async function deleteGroup(groupId: string) {
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/financial/report-groups/${groupId}`, { method: 'DELETE' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Failed to delete report group')
      setGroups(current => current.filter(group => group.id !== groupId))
      setSelectedGroupId(current => current === groupId ? '' : current)
      toast.success('Report group deleted')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete report group')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-lg border border-[#2A2418] bg-card p-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold" style={{ color: 'var(--foreground)' }}>
            Consolidated Report Groups
          </h2>
          <p className="text-xs mt-1" style={{ color: 'var(--muted-foreground)' }}>
            Reporting-only company portfolios. Journals and ledgers remain company-scoped.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={loadGroups} disabled={loading || saving}>
          Refresh
        </Button>
      </div>

      <form onSubmit={createGroup} className="grid gap-3 lg:grid-cols-[minmax(220px,280px)_1fr_auto] lg:items-start">
        <Input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Group name"
          className="h-9"
          style={{ background: '#0E0E0A', border: '1px solid #2A2418' }}
        />
        <div className="flex gap-2 overflow-x-auto pb-1">
          {companies.map(company => {
            const checked = selectedCompanyIds.includes(company.id)
            return (
              <button
                key={company.id}
                type="button"
                onClick={() => toggleCompany(company.id)}
                className="shrink-0 rounded-md border px-3 py-2 text-left text-xs"
                style={{
                  minWidth: 190,
                  borderColor: checked ? '#C9A96E' : '#2A2418',
                  background: checked ? 'rgba(201,169,110,0.10)' : '#0E0E0A',
                  color: checked ? '#FFF7E6' : 'var(--foreground)',
                }}
              >
                <span className="block truncate font-medium">{company.nameEn}</span>
                <span className="block truncate" style={{ color: checked ? '#C9A96E' : 'var(--muted-foreground)' }}>
                  {company.companyCode ?? company.id}
                </span>
              </button>
            )
          })}
        </div>
        <Button type="submit" size="sm" disabled={saving || companies.length === 0}>
          <Plus size={14} className="mr-2" />
          Create
        </Button>
      </form>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {loading ? (
          <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>Loading groups...</p>
        ) : groups.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>No report groups yet.</p>
        ) : (
          groups.map(group => {
            const active = group.id === selectedGroupId
            return (
              <div
                key={group.id}
                className="flex shrink-0 items-center gap-2 rounded-md border px-3 py-2"
                style={{
                  minWidth: 240,
                  borderColor: active ? '#C9A96E' : '#2A2418',
                  background: active ? 'rgba(201,169,110,0.10)' : '#0E0E0A',
                }}
              >
                <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setSelectedGroupId(group.id)}>
                  <span className="block truncate text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                    {group.name}
                  </span>
                  <span className="block truncate text-xs" style={{ color: 'var(--muted-foreground)' }}>
                    {group.companies.length} companies
                  </span>
                </button>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="size-8"
                  onClick={() => deleteGroup(group.id)}
                  disabled={saving}
                  title="Delete report group"
                >
                  <Trash2 size={14} />
                </Button>
              </div>
            )
          })
        )}
      </div>

      {selectedGroup ? (
        <div className="border-t border-[#2A2418] pt-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-medium" style={{ color: '#C9A96E' }}>
            <FileBarChart size={15} />
            {selectedGroup.name}
          </div>
          <FinancialReportGroupReportsPanel group={selectedGroup} />
        </div>
      ) : null}
    </div>
  )
}
