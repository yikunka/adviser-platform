'use client'

/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useState } from 'react'
import { Link, useRouter } from '@/i18n/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { useAdminPermission } from '@/components/admin/AdminPermissionContext'
import { WorkTaskPlaybook } from '@/components/work-tasks/WorkTaskPlaybook'

type CompanyHit = { id: string; nameEn: string; nameZh: string | null; companyNumber: string | null }
type DirectorOption = { id: string; nameEn: string; nameZh: string | null }
type MemberOption = {
  nameEn: string
  nameZh: string
  status: string
  keyPersonId: string | null
  linkedCompanyId: string | null
  firstName?: string
  lastName?: string
  otherName?: string
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

export default function AuditorChangePage() {
  const router = useRouter()
  const canCreate = useAdminPermission('workTasks.create')
  const [companies, setCompanies] = useState<CompanyHit[]>([])
  const [companyId, setCompanyId] = useState('')
  const [companyNameEn, setCompanyNameEn] = useState('')
  const [companyNameZh, setCompanyNameZh] = useState('')
  const [companyNo, setCompanyNo] = useState('')
  const [brn, setBrn] = useState('')
  const [action, setAction] = useState<'APPOINT' | 'REMOVE' | 'RESIGN'>('APPOINT')
  const [auditorName, setAuditorName] = useState('')
  const [auditorAddress, setAuditorAddress] = useState('')
  const [effectiveDate, setEffectiveDate] = useState(todayIso)
  const [meetingDate, setMeetingDate] = useState(todayIso)
  const [meetingTime, setMeetingTime] = useState('10:00 a.m.')
  const [meetingPlace, setMeetingPlace] = useState('the registered office of the Company')
  const [directorName1, setDirectorName1] = useState('')
  const [directorName2, setDirectorName2] = useState('')
  const [shareholderName1, setShareholderName1] = useState('')
  const [shareholderName2, setShareholderName2] = useState('')
  const [signatoryName, setSignatoryName] = useState('')
  const [signatoryCapacity, setSignatoryCapacity] = useState<'DIRECTOR' | 'COMPANY_SECRETARY'>('DIRECTOR')
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
        setBrn(json.company.businessRegNumber ?? '')
        const directors: DirectorOption[] = Array.isArray(json.directors) ? json.directors : []
        const members: MemberOption[] = Array.isArray(json.members) ? json.members : []
        setDirectorName1(directors[0] ? (directors[0].nameZh || directors[0].nameEn) : '')
        setDirectorName2(directors[1] ? (directors[1].nameZh || directors[1].nameEn) : '')
        setSignatoryName(directors[0] ? (directors[0].nameZh || directors[0].nameEn) : '')
        const active = members.filter(member => member.status === 'ACTIVE')
        setShareholderName1(active[0] ? (active[0].nameZh || active[0].nameEn) : '')
        setShareholderName2(active[1] ? (active[1].nameZh || active[1].nameEn) : '')
      })
      .catch(cause => {
        toast.error(cause instanceof Error ? cause.message : '载入公司失败。')
      })
    return () => {
      cancelled = true
    }
  }, [companyId])

  async function submit() {
    if (!canCreate) {
      toast.error('没有生成权限。')
      return
    }
    if (!companyId || !auditorName.trim() || !signatoryName.trim()) {
      toast.error('请选择公司，并填写核数师和签署人。')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/admin/work-tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'AUDITOR_CHANGE',
          companyId,
          companyNameEn,
          companyNameZh,
          companyNo,
          brn,
          action,
          auditorName,
          auditorAddress,
          effectiveDate,
          meetingDate: action === 'REMOVE' ? meetingDate : '',
          meetingTime,
          meetingPlace,
          directorName1,
          directorName2,
          shareholderName1,
          shareholderName2,
          signatoryName,
          signatoryCapacity,
          signatoryDate,
          presentorNameZh,
          presentorNameEn,
          presentorAddress,
          presentorTel,
          presentorFax,
          presentorEmail,
          presentorReference,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || '生成文件失败。')
      toast.success(`已生成 ${json.taskNumber}`)
      router.push(`/admin/tasks/${json.id}`)
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : '生成文件失败。')
    } finally {
      setSaving(false)
    }
  }

  const label = 'mb-1 block text-sm'
  const button = action === 'APPOINT' ? '生成委任决议' : action === 'RESIGN' ? '生成 NA2' : '生成免任通知、决议和 NA1'

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-5 p-6">
      <div>
        <Link href="/admin/tasks" className="text-sm" style={{ color: 'var(--muted-foreground)' }}>工作任务</Link>
        <h1 className="mt-2 text-xl font-semibold" style={{ color: 'var(--foreground)' }}>任免核数师</h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--muted-foreground)' }}>
          委任生成书面决议。免任生成拟免任通知、普通决议和表格 NA1。辞任生成表格 NA2。不会改公司档案里的核数师纪录。
        </p>
      </div>
      <WorkTaskPlaybook kind="AUDITOR_CHANGE" />
      <section className="grid gap-4 p-5 sm:grid-cols-2" style={card}>
        <label className="text-sm sm:col-span-2">
          <span className={label} style={{ color: 'var(--muted-foreground)' }}>公司</span>
          <select className={inputClass} style={inputStyle()} value={companyId} onChange={event => setCompanyId(event.target.value)}>
            <option value="">选择公司</option>
            {companies.map(company => (
              <option key={company.id} value={company.id}>{company.nameZh || company.nameEn}</option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className={label} style={{ color: 'var(--muted-foreground)' }}>事项</span>
          <select className={inputClass} style={inputStyle()} value={action} onChange={event => setAction(event.target.value as 'APPOINT' | 'REMOVE' | 'RESIGN')}>
            <option value="APPOINT">委任</option>
            <option value="REMOVE">免任</option>
            <option value="RESIGN">辞任</option>
          </select>
        </label>
        <label className="text-sm">
          <span className={label} style={{ color: 'var(--muted-foreground)' }}>生效日期</span>
          <input type="date" className={inputClass} style={inputStyle()} value={effectiveDate} onChange={event => setEffectiveDate(event.target.value)} />
        </label>
        <label className="text-sm sm:col-span-2">
          <span className={label} style={{ color: 'var(--muted-foreground)' }}>核数师名称</span>
          <input className={inputClass} style={inputStyle()} value={auditorName} onChange={event => setAuditorName(event.target.value)} />
        </label>
        <label className="text-sm sm:col-span-2">
          <span className={label} style={{ color: 'var(--muted-foreground)' }}>核数师地址</span>
          <input className={inputClass} style={inputStyle()} value={auditorAddress} onChange={event => setAuditorAddress(event.target.value)} />
        </label>
        {action === 'REMOVE' ? (
          <>
            <label className="text-sm">
              <span className={label} style={{ color: 'var(--muted-foreground)' }}>大会日期</span>
              <input type="date" className={inputClass} style={inputStyle()} value={meetingDate} onChange={event => setMeetingDate(event.target.value)} />
            </label>
            <label className="text-sm">
              <span className={label} style={{ color: 'var(--muted-foreground)' }}>时间</span>
              <input className={inputClass} style={inputStyle()} value={meetingTime} onChange={event => setMeetingTime(event.target.value)} />
            </label>
            <label className="text-sm sm:col-span-2">
              <span className={label} style={{ color: 'var(--muted-foreground)' }}>地点</span>
              <input className={inputClass} style={inputStyle()} value={meetingPlace} onChange={event => setMeetingPlace(event.target.value)} />
            </label>
          </>
        ) : null}
        <label className="text-sm">
          <span className={label} style={{ color: 'var(--muted-foreground)' }}>董事 1</span>
          <input className={inputClass} style={inputStyle()} value={directorName1} onChange={event => setDirectorName1(event.target.value)} />
        </label>
        <label className="text-sm">
          <span className={label} style={{ color: 'var(--muted-foreground)' }}>董事 2</span>
          <input className={inputClass} style={inputStyle()} value={directorName2} onChange={event => setDirectorName2(event.target.value)} />
        </label>
        <label className="text-sm">
          <span className={label} style={{ color: 'var(--muted-foreground)' }}>股东 1</span>
          <input className={inputClass} style={inputStyle()} value={shareholderName1} onChange={event => setShareholderName1(event.target.value)} />
        </label>
        <label className="text-sm">
          <span className={label} style={{ color: 'var(--muted-foreground)' }}>股东 2</span>
          <input className={inputClass} style={inputStyle()} value={shareholderName2} onChange={event => setShareholderName2(event.target.value)} />
        </label>
        <label className="text-sm">
          <span className={label} style={{ color: 'var(--muted-foreground)' }}>表格签署人</span>
          <input className={inputClass} style={inputStyle()} value={signatoryName} onChange={event => setSignatoryName(event.target.value)} />
        </label>
        <label className="text-sm">
          <span className={label} style={{ color: 'var(--muted-foreground)' }}>身份</span>
          <select className={inputClass} style={inputStyle()} value={signatoryCapacity} onChange={event => setSignatoryCapacity(event.target.value as 'DIRECTOR' | 'COMPANY_SECRETARY')}>
            <option value="DIRECTOR">董事</option>
            <option value="COMPANY_SECRETARY">公司秘书</option>
          </select>
        </label>
        <label className="text-sm">
          <span className={label} style={{ color: 'var(--muted-foreground)' }}>签署日期</span>
          <input type="date" className={inputClass} style={inputStyle()} value={signatoryDate} onChange={event => setSignatoryDate(event.target.value)} />
        </label>
      </section>
      <section className="grid gap-4 p-5 sm:grid-cols-2" style={card}>
        <h2 className="text-sm font-semibold sm:col-span-2" style={{ color: 'var(--foreground)' }}>提交人</h2>
        <label className="text-sm"><span className={label} style={{ color: 'var(--muted-foreground)' }}>提交人英文名称</span><input className={inputClass} style={inputStyle()} value={presentorNameEn} onChange={event => setPresentorNameEn(event.target.value)} /></label>
        <label className="text-sm"><span className={label} style={{ color: 'var(--muted-foreground)' }}>提交人中文名称</span><input className={inputClass} style={inputStyle()} value={presentorNameZh} onChange={event => setPresentorNameZh(event.target.value)} /></label>
        <label className="text-sm sm:col-span-2"><span className={label} style={{ color: 'var(--muted-foreground)' }}>地址</span><input className={inputClass} style={inputStyle()} value={presentorAddress} onChange={event => setPresentorAddress(event.target.value)} /></label>
        <label className="text-sm"><span className={label} style={{ color: 'var(--muted-foreground)' }}>电话</span><input className={inputClass} style={inputStyle()} value={presentorTel} onChange={event => setPresentorTel(event.target.value)} /></label>
        <label className="text-sm"><span className={label} style={{ color: 'var(--muted-foreground)' }}>传真</span><input className={inputClass} style={inputStyle()} value={presentorFax} onChange={event => setPresentorFax(event.target.value)} /></label>
        <label className="text-sm"><span className={label} style={{ color: 'var(--muted-foreground)' }}>电邮</span><input className={inputClass} style={inputStyle()} value={presentorEmail} onChange={event => setPresentorEmail(event.target.value)} /></label>
        <label className="text-sm"><span className={label} style={{ color: 'var(--muted-foreground)' }}>档号</span><input className={inputClass} style={inputStyle()} value={presentorReference} onChange={event => setPresentorReference(event.target.value)} /></label>
      </section>
      <div>
        <Button type="button" disabled={saving || !canCreate} onClick={() => void submit()}>
          {saving ? '生成中…' : button}
        </Button>
      </div>
    </div>
  )
}
