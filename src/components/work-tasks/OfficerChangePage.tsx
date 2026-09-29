'use client'

/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useState } from 'react'
import { Link, useRouter } from '@/i18n/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { useAdminPermission } from '@/components/admin/AdminPermissionContext'
import { naturalPersonNameSurnameFirst } from '@/lib/work-tasks/person-name'
import { WorkTaskPlaybook } from '@/components/work-tasks/WorkTaskPlaybook'
import type { WorkTaskKind } from '@/lib/work-tasks/playbook-steps'

type OfficerKind = 'OFFICER_RESIGNATION' | 'OFFICER_CESSATION' | 'OFFICER_APPOINTMENT' | 'OFFICER_PARTICULARS'

const COPY: Record<OfficerKind, { title: string; hint: string; button: string }> = {
  OFFICER_RESIGNATION: {
    title: '秘书及董事辞任（ND4）',
    hint: '生成辞任信和表格 ND4（可由辞任人递交）。公司停任申报请另用「秘书及董事停任（ND2A）」。不会改公司管理里的董事或秘书纪录。',
    button: '生成辞任信和 ND4',
  },
  OFFICER_CESSATION: {
    title: '秘书及董事停任（ND2A）',
    hint: '生成辞任信和公司申报停任的表格 ND2A（停任后 15 日内递交）。不会改公司管理里的董事或秘书纪录。',
    button: '生成辞任信和 ND2A',
  },
  OFFICER_APPOINTMENT: {
    title: '委派公司秘书及董事',
    hint: '生成出任同意书、董事书面决议和表格 ND2A。自然人董事的通常住址仍须另填 PI-ND2A。不会改公司管理里的委任纪录。',
    button: '生成同意书、决议和 ND2A',
  },
  OFFICER_PARTICULARS: {
    title: '更改公司秘书及董事详情',
    hint: '生成表格 ND2B。不会改公司管理里已登记的姓名或地址。',
    button: '生成 ND2B',
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

type CompanyHit = { id: string; nameEn: string; nameZh: string | null; companyNumber: string | null }
type DirectorOption = {
  id: string
  nameEn: string
  nameZh: string
  isCorporation: boolean
  address: string
  idNumber: string
  nationality: string
  email: string
  firstName: string
  lastName: string
  otherName: string
}
type PersonHit = {
  id: string
  firstName?: string | null
  lastName?: string | null
  otherName?: string | null
  nameEn: string
  nameZh: string | null
  kycCode: string | null
  homeAddress: string | null
  contactAddress: string | null
  idNumber?: string | null
  nationality?: string | null
  email?: string | null
}

export function OfficerChangePage({ kind }: { kind: OfficerKind }) {
  const router = useRouter()
  const canCreate = useAdminPermission('workTasks.create')
  const copy = COPY[kind]
  const [companies, setCompanies] = useState<CompanyHit[]>([])
  const [people, setPeople] = useState<PersonHit[]>([])
  const [companyId, setCompanyId] = useState('')
  const [companyNameEn, setCompanyNameEn] = useState('')
  const [companyNameZh, setCompanyNameZh] = useState('')
  const [companyNo, setCompanyNo] = useState('')
  const [brn, setBrn] = useState('')
  const [directors, setDirectors] = useState<DirectorOption[]>([])
  const [office, setOffice] = useState<'DIRECTOR' | 'COMPANY_SECRETARY' | 'ALTERNATE_DIRECTOR'>('DIRECTOR')
  const [personKind, setPersonKind] = useState<'NATURAL' | 'CORPORATE'>('NATURAL')
  const [nameEn, setNameEn] = useState('')
  const [nameZh, setNameZh] = useState('')
  const [surname, setSurname] = useState('')
  const [otherNames, setOtherNames] = useState('')
  const [hkid, setHkid] = useState('')
  const [passport, setPassport] = useState('')
  const [passportPlace, setPassportPlace] = useState('')
  const [idNumber, setIdNumber] = useState('')
  const [nationality, setNationality] = useState('')
  const [email, setEmail] = useState('')
  const [flat, setFlat] = useState('')
  const [building, setBuilding] = useState('')
  const [street, setStreet] = useState('')
  const [district, setDistrict] = useState('')
  const [country, setCountry] = useState('Hong Kong')
  const [effectiveDate, setEffectiveDate] = useState(todayIso)
  const [resignationNotice, setResignationNotice] = useState<'GIVEN' | 'SENT_ALTERNATIVE' | 'NOT_REQUIRED'>('NOT_REQUIRED')
  const [directorName1, setDirectorName1] = useState('')
  const [directorName2, setDirectorName2] = useState('')
  const [tcspLicence, setTcspLicence] = useState('')
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
        if (cancelled) return
        setCompanies(Array.isArray(json.companies) ? json.companies : [])
        setPeople(Array.isArray(json.people) ? json.people : [])
      })
      .catch(() => {
        if (!cancelled) toast.error('载入公司或自然人列表失败。')
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
        const nextDirectors: DirectorOption[] = Array.isArray(json.directors) ? json.directors : []
        setDirectors(nextDirectors)
        const first = nextDirectors[0]
        const second = nextDirectors[1]
        setDirectorName1(first ? (first.nameZh || first.nameEn) : '')
        setDirectorName2(second ? (second.nameZh || second.nameEn) : '')
        setSignatoryName(first ? (first.nameZh || first.nameEn) : '')
      })
      .catch(cause => {
        toast.error(cause instanceof Error ? cause.message : '载入公司失败。')
      })
    return () => {
      cancelled = true
    }
  }, [companyId])

  function applyDirector(id: string) {
    const director = directors.find(item => item.id === id)
    if (!director) return
    setPersonKind(director.isCorporation ? 'CORPORATE' : 'NATURAL')
    setNameEn(director.nameEn)
    setNameZh(director.nameZh)
    setSurname(director.lastName)
    setOtherNames([director.firstName, director.otherName].filter(Boolean).join(' '))
    setIdNumber(director.idNumber)
    setHkid(director.idNumber)
    setNationality(director.nationality)
    setEmail(director.email)
    setStreet(director.address)
  }

  function applyPerson(id: string) {
    const person = people.find(item => item.id === id)
    if (!person) return
    setPersonKind('NATURAL')
    setNameEn(naturalPersonNameSurnameFirst(person))
    setNameZh(person.nameZh || '')
    setSurname(person.lastName || '')
    setOtherNames([person.firstName, person.otherName].filter(Boolean).join(' '))
    setIdNumber(person.idNumber || '')
    setHkid(person.idNumber || '')
    setNationality(person.nationality || '')
    setEmail(person.email || '')
    setStreet(person.contactAddress || person.homeAddress || '')
  }

  function applySixAmSecretary() {
    setOffice('COMPANY_SECRETARY')
    setPersonKind('CORPORATE')
    setNameEn('6AM Advisory Limited')
    setNameZh('')
    setFlat('RM7')
    setBuilding('20F Boss Commercial Centre')
    setStreet('28 Ferry Street')
    setDistrict('Yau Ma Tei KLN')
    setCountry('Hong Kong')
    setEmail('kennywong@6amadvise.com')
  }

  async function submit() {
    if (!canCreate) {
      toast.error('没有生成权限。')
      return
    }
    if (!companyId || !nameEn.trim() || !signatoryName.trim()) {
      toast.error('请选择公司，并填写当事人和签署人。')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/admin/work-tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind,
          companyId,
          companyNameEn,
          companyNameZh,
          companyNo,
          brn,
          office,
          personKind,
          nameEn,
          nameZh,
          surname,
          otherNames,
          hkid,
          passport,
          passportPlace,
          idNumber,
          nationality,
          email,
          flat,
          building,
          street,
          district,
          country,
          effectiveDate,
          ...(kind === 'OFFICER_RESIGNATION' ? { resignationNotice } : {}),
          signatoryName,
          signatoryCapacity,
          signatoryDate,
          directorName1,
          directorName2,
          tcspLicence,
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

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-5 p-6">
      <div>
        <Link href="/admin/tasks" className="text-sm" style={{ color: 'var(--muted-foreground)' }}>工作任务</Link>
        <h1 className="mt-2 text-xl font-semibold" style={{ color: 'var(--foreground)' }}>{copy.title}</h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--muted-foreground)' }}>{copy.hint}</p>
      </div>

      <WorkTaskPlaybook kind={kind as WorkTaskKind} />

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
          <span className={label} style={{ color: 'var(--muted-foreground)' }}>身分 Capacity</span>
          <select
            className={inputClass}
            style={inputStyle()}
            value={office}
            onChange={event => setOffice(event.target.value as 'DIRECTOR' | 'COMPANY_SECRETARY' | 'ALTERNATE_DIRECTOR')}
          >
            <option value="COMPANY_SECRETARY">公司秘书 Company Secretary</option>
            <option value="DIRECTOR">董事 Director</option>
            <option value="ALTERNATE_DIRECTOR">候補董事 Alternate Director</option>
          </select>
        </label>
        <label className="text-sm">
          <span className={label} style={{ color: 'var(--muted-foreground)' }}>自然人／法人</span>
          <select className={inputClass} style={inputStyle()} value={personKind} onChange={event => setPersonKind(event.target.value as 'NATURAL' | 'CORPORATE')}>
            <option value="NATURAL">自然人</option>
            <option value="CORPORATE">法人团体</option>
          </select>
        </label>
        <label className="text-sm">
          <span className={label} style={{ color: 'var(--muted-foreground)' }}>生效日期</span>
          <input type="date" className={inputClass} style={inputStyle()} value={effectiveDate} onChange={event => setEffectiveDate(event.target.value)} />
        </label>
        {kind === 'OFFICER_RESIGNATION' ? (
          <label className="text-sm sm:col-span-2">
            <span className={label} style={{ color: 'var(--muted-foreground)' }}>ND4 第3项 辞职通知 Notice of Resignation</span>
            <select
              className={inputClass}
              style={inputStyle()}
              value={resignationNotice}
              onChange={event => setResignationNotice(event.target.value as 'GIVEN' | 'SENT_ALTERNATIVE' | 'NOT_REQUIRED')}
            >
              <option value="GIVEN">须发通知，并已按规定发出</option>
              <option value="SENT_ALTERNATIVE">须发通知，但未按规定发出（已送交／电邮／留在注册办事处）</option>
              <option value="NOT_REQUIRED">无须向公司发出辞职通知</option>
            </select>
          </label>
        ) : null}
        {kind === 'OFFICER_APPOINTMENT' ? (
          <button type="button" className="text-left text-sm self-end pb-2" style={{ color: '#3b82f6' }} onClick={applySixAmSecretary}>
            填入 6AM Advisory Limited 为公司秘书
          </button>
        ) : null}
      </section>

      <section className="grid gap-4 p-5 sm:grid-cols-2" style={card}>
        <h2 className="text-sm font-semibold sm:col-span-2" style={{ color: 'var(--foreground)' }}>当事人</h2>
        <label className="text-sm">
          <span className={label} style={{ color: 'var(--muted-foreground)' }}>从现任董事选取</span>
          <select className={inputClass} style={inputStyle()} defaultValue="" onChange={event => applyDirector(event.target.value)}>
            <option value="">可选</option>
            {directors.map(director => (
              <option key={director.id} value={director.id}>{director.nameZh || director.nameEn}</option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className={label} style={{ color: 'var(--muted-foreground)' }}>从自然人选取</span>
          <select className={inputClass} style={inputStyle()} defaultValue="" onChange={event => applyPerson(event.target.value)}>
            <option value="">可选</option>
            {people.map(person => (
              <option key={person.id} value={person.id}>
                {person.kycCode ? `${person.nameZh || person.nameEn} · ${person.kycCode}` : (person.nameZh || person.nameEn)}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className={label} style={{ color: 'var(--muted-foreground)' }}>英文姓名／名称</span>
          <input className={inputClass} style={inputStyle()} value={nameEn} onChange={event => setNameEn(event.target.value)} />
        </label>
        <label className="text-sm">
          <span className={label} style={{ color: 'var(--muted-foreground)' }}>中文姓名／名称</span>
          <input className={inputClass} style={inputStyle()} value={nameZh} onChange={event => setNameZh(event.target.value)} />
        </label>
        <label className="text-sm">
          <span className={label} style={{ color: 'var(--muted-foreground)' }}>英文姓氏</span>
          <input className={inputClass} style={inputStyle()} value={surname} onChange={event => setSurname(event.target.value)} />
        </label>
        <label className="text-sm">
          <span className={label} style={{ color: 'var(--muted-foreground)' }}>英文名字</span>
          <input className={inputClass} style={inputStyle()} value={otherNames} onChange={event => setOtherNames(event.target.value)} />
        </label>
        <label className="text-sm">
          <span className={label} style={{ color: 'var(--muted-foreground)' }}>香港身分证部分号码</span>
          <input className={inputClass} style={inputStyle()} value={hkid} onChange={event => setHkid(event.target.value)} />
        </label>
        <label className="text-sm">
          <span className={label} style={{ color: 'var(--muted-foreground)' }}>护照部分号码</span>
          <input className={inputClass} style={inputStyle()} value={passport} onChange={event => setPassport(event.target.value)} />
        </label>
        <label className="text-sm">
          <span className={label} style={{ color: 'var(--muted-foreground)' }}>护照签发地</span>
          <input className={inputClass} style={inputStyle()} value={passportPlace} onChange={event => setPassportPlace(event.target.value)} />
        </label>
        <label className="text-sm">
          <span className={label} style={{ color: 'var(--muted-foreground)' }}>国籍</span>
          <input className={inputClass} style={inputStyle()} value={nationality} onChange={event => setNationality(event.target.value)} />
        </label>
        <label className="text-sm sm:col-span-2">
          <span className={label} style={{ color: 'var(--muted-foreground)' }}>电邮</span>
          <input className={inputClass} style={inputStyle()} value={email} onChange={event => setEmail(event.target.value)} />
        </label>
        <label className="text-sm"><span className={label} style={{ color: 'var(--muted-foreground)' }}>室／楼／座</span><input className={inputClass} style={inputStyle()} value={flat} onChange={event => setFlat(event.target.value)} /></label>
        <label className="text-sm"><span className={label} style={{ color: 'var(--muted-foreground)' }}>大厦</span><input className={inputClass} style={inputStyle()} value={building} onChange={event => setBuilding(event.target.value)} /></label>
        <label className="text-sm"><span className={label} style={{ color: 'var(--muted-foreground)' }}>街道</span><input className={inputClass} style={inputStyle()} value={street} onChange={event => setStreet(event.target.value)} /></label>
        <label className="text-sm"><span className={label} style={{ color: 'var(--muted-foreground)' }}>区</span><input className={inputClass} style={inputStyle()} value={district} onChange={event => setDistrict(event.target.value)} /></label>
        <label className="text-sm"><span className={label} style={{ color: 'var(--muted-foreground)' }}>国家／地区</span><input className={inputClass} style={inputStyle()} value={country} onChange={event => setCountry(event.target.value)} /></label>
        <label className="text-sm"><span className={label} style={{ color: 'var(--muted-foreground)' }}>TCSP 牌照编号（秘书）</span><input className={inputClass} style={inputStyle()} value={tcspLicence} onChange={event => setTcspLicence(event.target.value)} /></label>
      </section>

      <section className="grid gap-4 p-5 sm:grid-cols-2" style={card}>
        <h2 className="text-sm font-semibold sm:col-span-2" style={{ color: 'var(--foreground)' }}>签署</h2>
        <label className="text-sm">
          <span className={label} style={{ color: 'var(--muted-foreground)' }}>现任董事 1（决议）</span>
          <input className={inputClass} style={inputStyle()} value={directorName1} onChange={event => setDirectorName1(event.target.value)} />
        </label>
        <label className="text-sm">
          <span className={label} style={{ color: 'var(--muted-foreground)' }}>现任董事 2</span>
          <input className={inputClass} style={inputStyle()} value={directorName2} onChange={event => setDirectorName2(event.target.value)} />
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
          {saving ? '生成中…' : copy.button}
        </Button>
      </div>
    </div>
  )
}
