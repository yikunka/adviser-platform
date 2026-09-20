'use client'

/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useState } from 'react'
import { Link, useRouter } from '@/i18n/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { useAdminPermission } from '@/components/admin/AdminPermissionContext'
import { REGISTER_ITEMS, type RegisterItemKey } from '@/lib/work-tasks/register-items'
import { WorkTaskPlaybook } from '@/components/work-tasks/WorkTaskPlaybook'

export type CompanyRecordKind = 'REGISTERED_OFFICE_ADDRESS' | 'REGISTER_LOCATION' | 'ACCOUNTING_REFERENCE_DATE'

const COPY: Record<CompanyRecordKind, { title: string; hint: string; button: string }> = {
  REGISTERED_OFFICE_ADDRESS: {
    title: '公司注册/营业地址',
    hint: '填写新的注册办事处地址，生成表格 NR1。不会改公司管理里的地址。',
    button: '生成 NR1',
  },
  REGISTER_LOCATION: {
    title: '登记册备存地点',
    hint: '选择要申报的登记册和备存地点，生成董事会会议纪录和表格 NR2。不会改公司纪录。',
    button: '生成会议纪录和 NR2',
  },
  ACCOUNTING_REFERENCE_DATE: {
    title: '会计参照日',
    hint: '填写现行会计期终结日和新的会计参照日，生成表格 NAC4。不会改公司的会计参照月。',
    button: '生成 NAC4',
  },
}

const card: React.CSSProperties = {
  background: 'var(--card)',
  border: '1px solid var(--border)',
  borderRadius: '0.75rem',
}
const inputClass = 'w-full rounded-md px-3 py-2 text-sm'
const inputStyle = (): React.CSSProperties => ({
  background: 'var(--background)',
  border: '1px solid var(--border)',
  color: 'var(--foreground)',
})

function todayIso() {
  const now = new Date()
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

function suggestedPeriodEnd(month: number | null | undefined) {
  if (!month || month < 1 || month > 12) return ''
  const now = new Date()
  let year = now.getFullYear()
  const endThisYear = new Date(year, month, 0)
  if (endThisYear.getTime() > now.getTime()) year -= 1
  const day = new Date(year, month, 0).getDate()
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${year}-${pad(month)}-${pad(day)}`
}

type CompanyHit = { id: string; nameEn: string; nameZh: string | null; companyNumber: string | null }

export function CompanyRecordChangePage({ kind }: { kind: CompanyRecordKind }) {
  const router = useRouter()
  const canCreate = useAdminPermission('workTasks.create')
  const copy = COPY[kind]
  const [companies, setCompanies] = useState<CompanyHit[]>([])
  const [companyId, setCompanyId] = useState('')
  const [companyNameEn, setCompanyNameEn] = useState('')
  const [companyNameZh, setCompanyNameZh] = useState('')
  const [companyNo, setCompanyNo] = useState('')
  const [brn, setBrn] = useState('')
  const [currentAddress, setCurrentAddress] = useState('')
  const [flat, setFlat] = useState('')
  const [building, setBuilding] = useState('')
  const [street, setStreet] = useState('')
  const [district, setDistrict] = useState('')
  const [effectiveDate, setEffectiveDate] = useState(todayIso)
  const [newEmail, setNewEmail] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [registers, setRegisters] = useState<RegisterItemKey[]>([])
  const [location, setLocation] = useState<'OTHER' | 'REGISTERED_OFFICE'>('OTHER')
  const [remarks, setRemarks] = useState('')
  const [currentPeriodEnd, setCurrentPeriodEnd] = useState('')
  const [change, setChange] = useState<'SHORTEN' | 'EXTEND'>('SHORTEN')
  const [newPeriodEnd, setNewPeriodEnd] = useState('')
  const [extensionReason, setExtensionReason] = useState<'NONE_IN_FIVE_YEARS' | 'HOLDING_COMPANY' | 'MEMBERS_RESOLUTION'>('NONE_IN_FIVE_YEARS')
  const [resolutionDate, setResolutionDate] = useState(todayIso)
  const [signatoryName, setSignatoryName] = useState('')
  const [signatoryCapacity, setSignatoryCapacity] = useState<'DIRECTOR' | 'COMPANY_SECRETARY' | 'MANAGER' | 'AUTHORIZED_REPRESENTATIVE'>('DIRECTOR')
  const [signatoryDate, setSignatoryDate] = useState(todayIso)
  const [presentorNameZh, setPresentorNameZh] = useState('')
  const [presentorNameEn, setPresentorNameEn] = useState('6AM Advisory Limited')
  const [presentorAddress, setPresentorAddress] = useState('RM7 20F Boss Commercial Centre 28 Ferry Street Yau Ma Tei KLN HK')
  const [presentorTel, setPresentorTel] = useState('65600073')
  const [presentorFax, setPresentorFax] = useState('')
  const [presentorEmail, setPresentorEmail] = useState('kennywong@6amadvise.com')
  const [presentorReference, setPresentorReference] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch('/api/admin/work-tasks/context?scope=options')
      .then(res => res.json())
      .then(json => {
        if (!cancelled) setCompanies(Array.isArray(json.companies) ? json.companies : [])
      })
      .catch(() => {
        if (!cancelled) toast.error('载入公司列表失败。')
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!companyId) return
    let cancelled = false
    fetch(`/api/admin/work-tasks/context?companyId=${companyId}`)
      .then(async res => {
        const json = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(json.error || '载入公司失败。')
        return json
      })
      .then(json => {
        if (cancelled) return
        setCompanyNameEn(json.company.nameEn ?? '')
        setCompanyNameZh(json.company.nameZh ?? '')
        setCompanyNo(json.company.companyNumber ?? '')
        setBrn(json.company.businessRegNumber || json.company.companyNumber || '')
        setCurrentAddress(json.company.registeredAddress ?? '')
        setCurrentPeriodEnd(suggestedPeriodEnd(json.company.financialYearEndMonth))
        const directors = Array.isArray(json.directors) ? json.directors as { nameEn: string; nameZh: string | null }[] : []
        const director = directors[0]
        setSignatoryName(director ? (director.nameZh || director.nameEn) : '')
        setSignatoryCapacity('DIRECTOR')
      })
      .catch(cause => {
        toast.error(cause instanceof Error ? cause.message : '载入公司失败。')
      })
    return () => {
      cancelled = true
    }
  }, [companyId])

  function toggleRegister(key: RegisterItemKey) {
    setRegisters(current => current.includes(key) ? current.filter(item => item !== key) : [...current, key])
  }

  async function submit() {
    if (!canCreate) {
      toast.error('没有生成权限。')
      return
    }
    if (!companyId || !companyNameEn || !signatoryName.trim()) {
      toast.error('请选择公司，并填写签署人。')
      return
    }
    const presentor = {
      presentorNameZh, presentorNameEn, presentorAddress, presentorTel, presentorFax, presentorEmail, presentorReference,
    }
    const common = {
      kind,
      companyId,
      companyNameEn,
      companyNameZh,
      companyNo,
      brn,
      signatoryName,
      signatoryCapacity: kind === 'REGISTER_LOCATION' ? signatoryCapacity : (signatoryCapacity === 'MANAGER' || signatoryCapacity === 'AUTHORIZED_REPRESENTATIVE' ? 'DIRECTOR' : signatoryCapacity),
      signatoryDate,
      ...presentor,
    }
    const body = kind === 'REGISTERED_OFFICE_ADDRESS'
      ? { ...common, flat, building, street, district, effectiveDate, newEmail, newPhone }
      : kind === 'REGISTER_LOCATION'
        ? { ...common, registers, location, flat, building, street, district, effectiveDate, remarks }
        : { ...common, currentPeriodEnd, change, newPeriodEnd, extensionReason: change === 'EXTEND' ? extensionReason : '', resolutionDate }
    setSaving(true)
    try {
      const res = await fetch('/api/admin/work-tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || '生成失败。')
      router.push(`/admin/tasks/${json.id}`)
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : '生成失败。')
    } finally {
      setSaving(false)
    }
  }

  const label = 'block text-xs mb-1'
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
      <div>
        <Link href="/admin/tasks" className="text-sm" style={{ color: 'var(--muted-foreground)' }}>工作任务</Link>
        <h1 className="mt-2 text-xl font-semibold" style={{ color: 'var(--foreground)' }}>{copy.title}</h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--muted-foreground)' }}>{copy.hint}</p>
      </div>

      <WorkTaskPlaybook kind={kind} />

      <section className="grid gap-4 p-5" style={card}>
        <label className="text-sm">
          <span className={label} style={{ color: 'var(--muted-foreground)' }}>公司</span>
          <select className={inputClass} style={inputStyle()} value={companyId} onChange={event => setCompanyId(event.target.value)}>
            <option value="">选择公司</option>
            {companies.map(company => (
              <option key={company.id} value={company.id}>{company.nameZh || company.nameEn}{company.companyNumber ? ` · ${company.companyNumber}` : ''}</option>
            ))}
          </select>
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            <span className={label} style={{ color: 'var(--muted-foreground)' }}>英文名称</span>
            <input className={inputClass} style={inputStyle()} value={companyNameEn} onChange={event => setCompanyNameEn(event.target.value)} />
          </label>
          <label className="text-sm">
            <span className={label} style={{ color: 'var(--muted-foreground)' }}>中文名称</span>
            <input className={inputClass} style={inputStyle()} value={companyNameZh} onChange={event => setCompanyNameZh(event.target.value)} />
          </label>
          <label className="text-sm">
            <span className={label} style={{ color: 'var(--muted-foreground)' }}>公司编号</span>
            <input className={inputClass} style={inputStyle()} value={companyNo} onChange={event => setCompanyNo(event.target.value)} />
          </label>
          <label className="text-sm">
            <span className={label} style={{ color: 'var(--muted-foreground)' }}>商业登记号码</span>
            <input className={inputClass} style={inputStyle()} value={brn} onChange={event => setBrn(event.target.value)} />
          </label>
        </div>
        {currentAddress ? <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>现有注册地址：{currentAddress}</p> : null}
      </section>

      {kind !== 'ACCOUNTING_REFERENCE_DATE' ? (
        <section className="grid gap-3 p-5" style={card}>
          {kind === 'REGISTER_LOCATION' ? (
            <>
              <fieldset className="grid gap-2">
                <legend className="text-xs mb-1" style={{ color: 'var(--muted-foreground)' }}>申报的登记册</legend>
                {REGISTER_ITEMS.map(item => (
                  <label key={item.key} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={registers.includes(item.key)} onChange={() => toggleRegister(item.key)} />
                    {item.label}
                  </label>
                ))}
              </fieldset>
              <label className="text-sm">
                <span className={label} style={{ color: 'var(--muted-foreground)' }}>备存地点</span>
                <select className={inputClass} style={inputStyle()} value={location} onChange={event => setLocation(event.target.value as 'OTHER' | 'REGISTERED_OFFICE')}>
                  <option value="OTHER">其他地址（不是注册办事处）</option>
                  <option value="REGISTERED_OFFICE">改为备存于注册办事处</option>
                </select>
              </label>
            </>
          ) : null}
          {kind === 'REGISTERED_OFFICE_ADDRESS' || location === 'OTHER' ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm"><span className={label} style={{ color: 'var(--muted-foreground)' }}>室 / 楼 / 座</span><input className={inputClass} style={inputStyle()} value={flat} onChange={event => setFlat(event.target.value)} /></label>
              <label className="text-sm"><span className={label} style={{ color: 'var(--muted-foreground)' }}>大厦</span><input className={inputClass} style={inputStyle()} value={building} onChange={event => setBuilding(event.target.value)} /></label>
              <label className="text-sm sm:col-span-2"><span className={label} style={{ color: 'var(--muted-foreground)' }}>街道 / 屋苑 / 地段 / 村</span><input className={inputClass} style={inputStyle()} value={street} onChange={event => setStreet(event.target.value)} /></label>
              <label className="text-sm"><span className={label} style={{ color: 'var(--muted-foreground)' }}>区</span><input className={inputClass} style={inputStyle()} value={district} onChange={event => setDistrict(event.target.value)} /></label>
            </div>
          ) : null}
          <label className="text-sm">
            <span className={label} style={{ color: 'var(--muted-foreground)' }}>生效日期</span>
            <input type="date" className={inputClass} style={inputStyle()} value={effectiveDate} onChange={event => setEffectiveDate(event.target.value)} />
          </label>
          {kind === 'REGISTERED_OFFICE_ADDRESS' ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm"><span className={label} style={{ color: 'var(--muted-foreground)' }}>新电邮（可留空）</span><input className={inputClass} style={inputStyle()} value={newEmail} onChange={event => setNewEmail(event.target.value)} /></label>
              <label className="text-sm"><span className={label} style={{ color: 'var(--muted-foreground)' }}>新香港电话（可留空）</span><input className={inputClass} style={inputStyle()} value={newPhone} onChange={event => setNewPhone(event.target.value)} /></label>
            </div>
          ) : (
            <label className="text-sm"><span className={label} style={{ color: 'var(--muted-foreground)' }}>备注（可留空）</span><textarea className={inputClass} style={inputStyle()} rows={2} value={remarks} onChange={event => setRemarks(event.target.value)} /></label>
          )}
        </section>
      ) : (
        <section className="grid gap-3 p-5" style={card}>
          <label className="text-sm">
            <span className={label} style={{ color: 'var(--muted-foreground)' }}>现行或对上会计参照期的终结日期</span>
            <input type="date" className={inputClass} style={inputStyle()} value={currentPeriodEnd} onChange={event => setCurrentPeriodEnd(event.target.value)} />
          </label>
          <label className="text-sm">
            <span className={label} style={{ color: 'var(--muted-foreground)' }}>变更</span>
            <select className={inputClass} style={inputStyle()} value={change} onChange={event => setChange(event.target.value as 'SHORTEN' | 'EXTEND')}>
              <option value="SHORTEN">缩短会计参照期</option>
              <option value="EXTEND">延长会计参照期</option>
            </select>
          </label>
          <label className="text-sm">
            <span className={label} style={{ color: 'var(--muted-foreground)' }}>新的会计参照期终结日期</span>
            <input type="date" className={inputClass} style={inputStyle()} value={newPeriodEnd} onChange={event => setNewPeriodEnd(event.target.value)} />
          </label>
          {change === 'EXTEND' ? (
            <label className="text-sm">
              <span className={label} style={{ color: 'var(--muted-foreground)' }}>过去五年内曾否延长</span>
              <select className={inputClass} style={inputStyle()} value={extensionReason} onChange={event => setExtensionReason(event.target.value as typeof extensionReason)}>
                <option value="NONE_IN_FIVE_YEARS">过去五年没有为延长而更改过</option>
                <option value="HOLDING_COMPANY">新日期与控股公司的会计参照日相同</option>
                <option value="MEMBERS_RESOLUTION">已获成员决议批准</option>
              </select>
            </label>
          ) : null}
          <label className="text-sm">
            <span className={label} style={{ color: 'var(--muted-foreground)' }}>董事决议日期</span>
            <input type="date" className={inputClass} style={inputStyle()} value={resolutionDate} onChange={event => setResolutionDate(event.target.value)} />
          </label>
        </section>
      )}

      <section className="grid gap-3 p-5" style={card}>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="text-sm sm:col-span-1">
            <span className={label} style={{ color: 'var(--muted-foreground)' }}>签署人</span>
            <input className={inputClass} style={inputStyle()} value={signatoryName} onChange={event => setSignatoryName(event.target.value)} />
          </label>
          <label className="text-sm">
            <span className={label} style={{ color: 'var(--muted-foreground)' }}>身份</span>
            <select className={inputClass} style={inputStyle()} value={signatoryCapacity} onChange={event => setSignatoryCapacity(event.target.value as typeof signatoryCapacity)}>
              <option value="DIRECTOR">董事</option>
              <option value="COMPANY_SECRETARY">公司秘书</option>
              {kind === 'REGISTER_LOCATION' ? <option value="MANAGER">经理</option> : null}
              {kind === 'REGISTER_LOCATION' ? <option value="AUTHORIZED_REPRESENTATIVE">获授权代表</option> : null}
            </select>
          </label>
          <label className="text-sm">
            <span className={label} style={{ color: 'var(--muted-foreground)' }}>签署日期</span>
            <input type="date" className={inputClass} style={inputStyle()} value={signatoryDate} onChange={event => setSignatoryDate(event.target.value)} />
          </label>
        </div>
        <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>提交人资料已填默认，可改。</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm"><span className={label} style={{ color: 'var(--muted-foreground)' }}>提交人英文名称</span><input className={inputClass} style={inputStyle()} value={presentorNameEn} onChange={event => setPresentorNameEn(event.target.value)} /></label>
          <label className="text-sm"><span className={label} style={{ color: 'var(--muted-foreground)' }}>提交人中文名称</span><input className={inputClass} style={inputStyle()} value={presentorNameZh} onChange={event => setPresentorNameZh(event.target.value)} /></label>
          <label className="text-sm sm:col-span-2"><span className={label} style={{ color: 'var(--muted-foreground)' }}>地址</span><input className={inputClass} style={inputStyle()} value={presentorAddress} onChange={event => setPresentorAddress(event.target.value)} /></label>
          <label className="text-sm"><span className={label} style={{ color: 'var(--muted-foreground)' }}>电话</span><input className={inputClass} style={inputStyle()} value={presentorTel} onChange={event => setPresentorTel(event.target.value)} /></label>
          <label className="text-sm"><span className={label} style={{ color: 'var(--muted-foreground)' }}>传真</span><input className={inputClass} style={inputStyle()} value={presentorFax} onChange={event => setPresentorFax(event.target.value)} /></label>
          <label className="text-sm"><span className={label} style={{ color: 'var(--muted-foreground)' }}>电邮</span><input className={inputClass} style={inputStyle()} value={presentorEmail} onChange={event => setPresentorEmail(event.target.value)} /></label>
          <label className="text-sm"><span className={label} style={{ color: 'var(--muted-foreground)' }}>档号</span><input className={inputClass} style={inputStyle()} value={presentorReference} onChange={event => setPresentorReference(event.target.value)} /></label>
        </div>
        <Button type="button" disabled={saving || !canCreate} onClick={() => void submit()}>{saving ? '生成中…' : copy.button}</Button>
      </section>
    </div>
  )
}
