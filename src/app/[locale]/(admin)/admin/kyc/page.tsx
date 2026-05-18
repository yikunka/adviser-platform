'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

type KYCDocument = {
  id: string
  fileName: string
  documentType: string
  status: string
}

type AMLHitResult = 'STRONG_HIT' | 'POTENTIAL_HIT' | 'WEAK_HIT'

type AMLAlert = {
  id: string
  result: AMLHitResult
  matchScore: number | null
  resolution: string
  reviewNotes: string | null
  amlRecord: {
    primaryName: string
    aliases: string[]
    nationality: string | null
    dateOfBirth: string | null
    listingReason: string | null
    source: { nameEn: string }
  }
}

type AMLData = {
  lastCheck: { checkedAt: string; result: string } | null
  alerts: AMLAlert[]
}

type KYCRecord = {
  id: string
  titlePrefix: string | null
  nameEn: string
  nameZh: string | null
  idType: string | null
  idNumber: string | null
  placeOfIssue: string | null
  placeOfBirth: string | null
  idExpiryDate: string | null
  dateOfBirth: string | null
  nationality: string | null
  homeAddress: string | null
  contactAddress: string | null
  homePhone: string | null
  workPhone: string | null
  mobile: string | null
  wechat: string | null
  email: string | null
  isUsCitizen: boolean | null
  isPep: boolean | null
  emergencyContact: string | null
  employmentStatus: string | null
  employerName: string | null
  employerAddress: string | null
  businessNatures: string[]
  position: string | null
  workingYears: number | null
  sourceOfFunds: string | null
  sourcesOfWealth: string[]
  annualIncome: string | null
  netAssetValue: string | null
  assetItems: string[]
  declarationSigned: boolean
  signatureName: string | null
  declarationDate: string | null
  kycStatus: string
  updatedAt: string
  kycDocuments: KYCDocument[]
  submittedByUser: { email: string; nameEn: string } | null
  companyLinks: Array<{
    company: { nameEn: string; clientUser: { email: string; nameEn: string } | null }
  }>
}

const STATUS_OPTIONS = ['', 'SUBMITTED', 'PENDING_INFO', 'APPROVED', 'REJECTED']

const AML_HIT_COLOR: Record<AMLHitResult, { bg: string; text: string; label: string }> = {
  STRONG_HIT:    { bg: 'rgba(239,68,68,0.12)',   text: '#ef4444', label: 'Strong Hit' },
  POTENTIAL_HIT: { bg: 'rgba(245,158,11,0.12)',  text: '#f59e0b', label: 'Potential Hit' },
  WEAK_HIT:      { bg: 'rgba(234,179,8,0.12)',   text: '#eab308', label: 'Weak Hit' },
}

const STATUS_COLOR: Record<string, string> = {
  DRAFT:        'bg-[rgba(120,113,108,0.15)] text-[#9A8060]',
  SUBMITTED:    'bg-[rgba(201,169,110,0.15)] text-[#C9A96E]',
  PENDING_INFO: 'bg-[rgba(245,158,11,0.12)] text-[#f59e0b]',
  APPROVED:     'bg-[rgba(16,185,129,0.12)] text-[#10b981]',
  REJECTED:     'bg-[rgba(239,68,68,0.12)] text-[#ef4444]',
}

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#C9A96E' }}>{title}</p>
      <div className="space-y-1">{children}</div>
    </div>
  )
}

function DetailRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null
  return (
    <div className="flex gap-2 text-sm">
      <span className="w-36 shrink-0" style={{ color: 'var(--muted-foreground)' }}>{label}</span>
      <span style={{ color: 'var(--foreground)' }}>{value}</span>
    </div>
  )
}

/** Portal client (submitter) or company-linked account holder. */
function clientPortalAccount(r: KYCRecord): { email: string | null; name: string | null } {
  const s = r.submittedByUser
  if (s?.email) return { email: s.email, name: s.nameEn }
  const u = r.companyLinks[0]?.company?.clientUser
  if (u?.email) return { email: u.email, name: u.nameEn }
  return { email: null, name: null }
}

export default function KYCQueuePage() {
  const t = useTranslations('admin.kyc')
  const [records, setRecords] = useState<KYCRecord[]>([])
  const [filterStatus, setFilterStatus] = useState('SUBMITTED')
  const [selected, setSelected] = useState<KYCRecord | null>(null)
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [amlData, setAmlData] = useState<AMLData | null>(null)
  const [amlLoading, setAmlLoading] = useState(false)

  const fetchRecords = useCallback(async () => {
    const res = await fetch(`/api/admin/kyc?status=${filterStatus}`)
    const json = await res.json()
    setRecords(json.records ?? [])
  }, [filterStatus])

  // eslint-disable-next-line react-hooks/set-state-in-effect -- fetchRecords updates state after the async request resolves.
  useEffect(() => { fetchRecords() }, [fetchRecords])

  async function fetchAML(id: string) {
    setAmlData(null)
    setAmlLoading(true)
    try {
      const res = await fetch(`/api/admin/kyc/${id}/aml`)
      if (res.ok) setAmlData(await res.json())
    } finally {
      setAmlLoading(false)
    }
  }

  async function runAMLScreen() {
    if (!selected) return
    setAmlLoading(true)
    try {
      const res = await fetch(`/api/admin/kyc/${selected.id}/aml`, { method: 'POST' })
      if (res.ok) setAmlData(await res.json())
      else toast.error('AML screening failed')
    } finally {
      setAmlLoading(false)
    }
  }

  async function doAction(action: 'APPROVE' | 'REJECT' | 'REQUEST_INFO' | 'CANCEL_APPROVAL') {
    if (!selected) return
    if (action === 'REJECT' && !reason.trim()) {
      toast.error(t('reasonRequired'))
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/kyc/${selected.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, reason }),
      })
      if (!res.ok) { toast.error(t('actionFailed')); return }
      toast.success(t('actionSuccess'))
      setSelected(null)
      setReason('')
      fetchRecords()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>{t('title')}</h1>

      <div className="flex gap-2 flex-wrap">
        {STATUS_OPTIONS.map(s => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            className="px-3 py-1.5 rounded-full text-sm font-medium transition-colors"
            style={
              filterStatus === s
                ? { background: 'rgba(201,169,110,0.2)', color: '#C9A96E', border: '1px solid #C9A96E' }
                : { background: '#1E1A12', color: '#7A7060', border: '1px solid #2A2418' }
            }
          >
            {s || t('all')}
          </button>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Left: list */}
        <Card>
          <CardContent className="p-0">
            <ul className="divide-y divide-[#2A2418]">
              {records.length === 0 ? (
                <li className="px-4 py-8 text-center text-sm" style={{ color: 'var(--muted-foreground)' }}>{t('empty')}</li>
              ) : records.map((r) => {
                const client = clientPortalAccount(r)
                return (
                <li
                  key={r.id}
                  onClick={() => { setSelected(r); setReason(''); fetchAML(r.id) }}
                  className="px-4 py-3 cursor-pointer transition-colors"
                  style={{
                    background: selected?.id === r.id ? 'rgba(201,169,110,0.08)' : 'transparent',
                  }}
                  onMouseEnter={e => { if (selected?.id !== r.id) (e.currentTarget as HTMLElement).style.background = '#1A1A12' }}
                  onMouseLeave={e => { if (selected?.id !== r.id) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                >
                  <div className="flex justify-between items-start">
                    <div className="min-w-0">
                      <p className="font-medium" style={{ color: 'var(--foreground)' }}>{r.nameEn}</p>
                      <p className="text-xs truncate" style={{ color: '#C9A96E' }} title={client.email ?? undefined}>
                        {client.email ?? '—'}
                      </p>
                      <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                        {r.companyLinks[0]?.company.nameEn ?? '—'} · {new Date(r.updatedAt).toLocaleDateString()}
                      </p>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOR[r.kycStatus] ?? ''}`}>
                      {r.kycStatus}
                    </span>
                  </div>
                </li>
                )
              })}
            </ul>
          </CardContent>
        </Card>

        {/* Right: detail + action panel */}
        {selected && (
          <Card className="overflow-y-auto max-h-[80vh]">
            <CardContent className="pt-6 space-y-5">
              <div className="flex items-center gap-3 flex-wrap">
                <h3 className="font-semibold text-lg" style={{ color: 'var(--foreground)' }}>
                  {selected.titlePrefix ? `${selected.titlePrefix} ` : ''}{selected.nameEn}
                  {selected.nameZh ? ` (${selected.nameZh})` : ''}
                </h3>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOR[selected.kycStatus] ?? ''}`}>
                  {selected.kycStatus}
                </span>
              </div>

              {(() => {
                const c = clientPortalAccount(selected)
                if (!c.email) {
                  return (
                    <p className="text-xs rounded-lg px-3 py-2" style={{ background: 'rgba(120,113,108,0.12)', color: 'var(--muted-foreground)' }}>
                      {t('clientEmail')}: —
                    </p>
                  )
                }
                return (
                  <div
                    className="rounded-lg px-3 py-2 text-sm"
                    style={{ background: 'rgba(201,169,110,0.1)', border: '1px solid #2A2418' }}
                  >
                    <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--muted-foreground)' }}>
                      {t('clientAccount')}
                    </span>
                    <p className="mt-0.5 break-all" style={{ color: '#C9A96E' }}>{c.email}</p>
                    {c.name ? <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>{c.name}</p> : null}
                  </div>
                )
              })()}

              {/* Identity */}
              <DetailSection title="Identity">
                <DetailRow label="ID Type" value={selected.idType} />
                <DetailRow label="ID Number" value={selected.idNumber} />
                <DetailRow label="Place of Issue" value={selected.placeOfIssue} />
                <DetailRow label="ID Expiry" value={selected.idExpiryDate ? new Date(selected.idExpiryDate).toLocaleDateString() : null} />
                <DetailRow label="Date of Birth" value={selected.dateOfBirth ? new Date(selected.dateOfBirth).toLocaleDateString() : null} />
                <DetailRow label="Place of Birth" value={selected.placeOfBirth} />
                <DetailRow label="Nationality" value={selected.nationality} />
                <DetailRow label="US Citizen" value={selected.isUsCitizen == null ? null : selected.isUsCitizen ? 'Yes' : 'No'} />
                <DetailRow label="PEP" value={selected.isPep == null ? null : selected.isPep ? 'Yes' : 'No'} />
              </DetailSection>

              {/* Contact */}
              <DetailSection title="Contact">
                <DetailRow label="Email" value={selected.email} />
                <DetailRow label="Mobile" value={selected.mobile} />
                <DetailRow label="Home Phone" value={selected.homePhone} />
                <DetailRow label="Work Phone" value={selected.workPhone} />
                <DetailRow label="WeChat" value={selected.wechat} />
                <DetailRow label="Home Address" value={selected.homeAddress} />
                <DetailRow label="Contact Address" value={selected.contactAddress} />
                <DetailRow label="Emergency Contact" value={selected.emergencyContact} />
              </DetailSection>

              {/* Employment */}
              <DetailSection title="Employment">
                <DetailRow label="Status" value={selected.employmentStatus} />
                <DetailRow label="Employer" value={selected.employerName} />
                <DetailRow label="Employer Address" value={selected.employerAddress} />
                <DetailRow label="Position" value={selected.position} />
                <DetailRow label="Working Years" value={selected.workingYears != null ? String(selected.workingYears) : null} />
                <DetailRow label="Business Natures" value={selected.businessNatures?.join(', ') || null} />
              </DetailSection>

              {/* Finance */}
              <DetailSection title="Financial">
                <DetailRow label="Source of Funds" value={selected.sourceOfFunds} />
                <DetailRow label="Sources of Wealth" value={selected.sourcesOfWealth?.join(', ') || null} />
                <DetailRow label="Annual Income" value={selected.annualIncome} />
                <DetailRow label="Net Asset Value" value={selected.netAssetValue} />
                <DetailRow label="Assets" value={selected.assetItems?.join(', ') || null} />
              </DetailSection>

              {/* Documents */}
              {selected.kycDocuments?.length > 0 && (
                <DetailSection title="Documents">
                  <ul className="space-y-1">
                    {selected.kycDocuments.map(doc => (
                      <li key={doc.id} className="flex justify-between text-sm">
                        <span style={{ color: 'var(--foreground)' }}>{doc.fileName}</span>
                        <span style={{ color: 'var(--muted-foreground)' }}>{doc.documentType} · {doc.status}</span>
                      </li>
                    ))}
                  </ul>
                </DetailSection>
              )}

              {/* AML Screening */}
              <div className="border-t pt-4" style={{ borderColor: '#2A2418' }}>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#C9A96E' }}>AML Screening</p>
                  <Button
                    variant="outline"
                    disabled={amlLoading}
                    onClick={runAMLScreen}
                    className="text-xs h-7 px-3"
                    style={{ borderColor: '#2A2418', color: amlLoading ? 'var(--muted-foreground)' : '#C9A96E' }}
                  >
                    {amlLoading ? 'Screening…' : 'Run Screen'}
                  </Button>
                </div>

                {amlData && (
                  <div className="space-y-2">
                    {amlData.lastCheck && (
                      <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                        Last screened: {new Date(amlData.lastCheck.checkedAt).toLocaleString()}
                        {' · '}
                        <span style={{
                          color: amlData.lastCheck.result === 'CLEAR' ? '#10b981'
                            : amlData.lastCheck.result === 'STRONG_HIT' ? '#ef4444'
                            : amlData.lastCheck.result === 'POTENTIAL_HIT' ? '#f59e0b'
                            : '#eab308',
                          fontWeight: 600,
                        }}>
                          {amlData.lastCheck.result.replace('_', ' ')}
                        </span>
                      </p>
                    )}

                    {amlData.alerts.length === 0 ? (
                      <p className="text-xs rounded-lg px-3 py-2" style={{ background: 'rgba(16,185,129,0.08)', color: '#10b981' }}>
                        No sanctions hits found
                      </p>
                    ) : (
                      <ul className="space-y-2">
                        {amlData.alerts.map(alert => {
                          const color = AML_HIT_COLOR[alert.result]
                          return (
                            <li
                              key={alert.id}
                              className="rounded-lg px-3 py-2.5 text-sm space-y-1.5"
                              style={{ background: color.bg, border: `1px solid ${color.text}33` }}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <span className="font-semibold" style={{ color: 'var(--foreground)' }}>
                                  {alert.amlRecord.primaryName}
                                </span>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <span
                                    className="px-1.5 py-0.5 rounded text-xs font-semibold"
                                    style={{ background: color.bg, color: color.text, border: `1px solid ${color.text}66` }}
                                  >
                                    {color.label}
                                  </span>
                                  {alert.matchScore != null && (
                                    <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                                      {(alert.matchScore * 100).toFixed(0)}%
                                    </span>
                                  )}
                                </div>
                              </div>

                              {alert.amlRecord.aliases.length > 0 && (
                                <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                                  <span className="font-medium">Aliases:</span> {alert.amlRecord.aliases.slice(0, 3).join(', ')}
                                  {alert.amlRecord.aliases.length > 3 ? ` +${alert.amlRecord.aliases.length - 3} more` : ''}
                                </p>
                              )}

                              <div className="flex gap-3 text-xs" style={{ color: 'var(--muted-foreground)' }}>
                                {alert.amlRecord.nationality && <span>Nationality: {alert.amlRecord.nationality}</span>}
                                {alert.amlRecord.dateOfBirth && (
                                  <span>DOB: {new Date(alert.amlRecord.dateOfBirth).toLocaleDateString()}</span>
                                )}
                              </div>

                              {alert.amlRecord.listingReason && (
                                <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                                  <span className="font-medium">Reason:</span> {alert.amlRecord.listingReason}
                                </p>
                              )}

                              <div className="flex items-center justify-between">
                                <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                                  Source: {alert.amlRecord.source.nameEn}
                                </span>
                                <span
                                  className="text-xs px-1.5 py-0.5 rounded"
                                  style={{
                                    background: alert.resolution === 'PENDING' ? 'rgba(120,113,108,0.15)' : 'rgba(16,185,129,0.1)',
                                    color: alert.resolution === 'PENDING' ? '#9A8060' : '#10b981',
                                  }}
                                >
                                  {alert.resolution}
                                </span>
                              </div>
                            </li>
                          )
                        })}
                      </ul>
                    )}
                  </div>
                )}

                {!amlData && !amlLoading && (
                  <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                    Click &quot;Run Screen&quot; to check sanctions lists
                  </p>
                )}
              </div>

              {/* Actions */}
              <div className="border-t pt-4" style={{ borderColor: '#2A2418' }}>
                {selected.kycStatus === 'SUBMITTED' || selected.kycStatus === 'PENDING_INFO' ? (
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <label className="text-sm font-medium" style={{ color: 'var(--muted-foreground)' }}>{t('rejectReason')}</label>
                      <textarea
                        className="w-full rounded-md px-3 py-2 text-sm"
                        style={{ background: '#0A0A0A', border: '1px solid #2A2418', color: 'var(--foreground)', outline: 'none' }}
                        rows={3}
                        placeholder={t('reasonPlaceholder')}
                        value={reason}
                        onChange={e => setReason(e.target.value)}
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button disabled={loading} onClick={() => doAction('APPROVE')} className="bg-green-600 hover:bg-green-700">
                        {t('approve')}
                      </Button>
                      <Button variant="outline" disabled={loading} onClick={() => doAction('REQUEST_INFO')}>
                        {t('requestInfo')}
                      </Button>
                      <Button
                        variant="outline"
                        disabled={loading}
                        onClick={() => doAction('REJECT')}
                        style={{ color: '#ef4444', borderColor: 'rgba(239,68,68,0.3)' }}
                      >
                        {t('reject')}
                      </Button>
                    </div>
                  </div>
                ) : selected.kycStatus === 'APPROVED' ? (
                  <div className="space-y-3">
                    <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                      {t('approvedCanCancel', { defaultValue: 'This KYC is approved. You can cancel the approval and return it to the submitted queue.' })}
                    </p>
                    <Button
                      variant="outline"
                      disabled={loading}
                      onClick={() => doAction('CANCEL_APPROVAL')}
                      style={{ color: '#f59e0b', borderColor: 'rgba(245,158,11,0.35)' }}
                    >
                      {t('cancelApproval', { defaultValue: 'Cancel Approved' })}
                    </Button>
                  </div>
                ) : (
                  <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>{t('alreadyProcessed')}</p>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
