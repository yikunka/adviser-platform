'use client'

/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useState } from 'react'
import { Link, useRouter } from '@/i18n/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { useAdminPermission } from '@/components/admin/AdminPermissionContext'
import { naturalPersonNameSurnameFirst } from '@/lib/work-tasks/person-name'
import { WorkTaskPlaybook } from '@/components/work-tasks/WorkTaskPlaybook'

type CompanyHit = {
  id: string
  nameEn: string
  nameZh: string | null
  companyCode: string | null
  companyNumber: string | null
}

type MemberOption = {
  id: string
  nameEn: string
  nameZh: string
  status: string
  sharesHeld: number | null
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

function memberName(member: MemberOption) {
  if (member.keyPersonId && !member.linkedCompanyId) {
    return naturalPersonNameSurnameFirst(member) || member.nameEn
  }
  return member.nameZh || member.nameEn
}

export default function CompanyNameChangePage() {
  const router = useRouter()
  const canCreate = useAdminPermission('workTasks.create')
  const [companies, setCompanies] = useState<CompanyHit[]>([])
  const [companyId, setCompanyId] = useState('')
  const [companyNameEn, setCompanyNameEn] = useState('')
  const [companyNameZh, setCompanyNameZh] = useState('')
  const [companyNo, setCompanyNo] = useState('')
  const [newCompanyNameEn, setNewCompanyNameEn] = useState('')
  const [newCompanyNameZh, setNewCompanyNameZh] = useState('')
  const [changeDate, setChangeDate] = useState(todayIso)
  const [shareholderNames, setShareholderNames] = useState(['', '', '', ''])
  const [brn, setBrn] = useState('')
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
        setBrn(json.company.businessRegNumber || json.company.companyNumber || '')
        const directors = Array.isArray(json.directors) ? json.directors as { nameEn: string; nameZh: string | null }[] : []
        const director = directors[0]
        setSignatoryName(director ? (director.nameZh || director.nameEn) : '')
        setSignatoryCapacity('DIRECTOR')
        const members = (Array.isArray(json.members) ? json.members : []) as MemberOption[]
        const current = members.filter(member => member.status !== 'TRANSFERRED_OUT' && member.sharesHeld !== 0)
        const names = [0, 1, 2, 3].map(index => current[index] ? memberName(current[index]) : '')
        setShareholderNames(names)
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
    if (!companyId || !companyNameEn || (!newCompanyNameEn.trim() && !newCompanyNameZh.trim()) || !signatoryName.trim()) {
      toast.error('请选择公司，填写新的公司名称，以及签署人。')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/admin/work-tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'COMPANY_NAME_CHANGE',
          companyId,
          companyNameEn,
          companyNameZh,
          companyNo,
          newCompanyNameEn,
          newCompanyNameZh,
          changeDate,
          shareholderNames,
          brn,
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
      if (!res.ok) throw new Error(json.error || '生成失败。')
      router.push(`/admin/tasks/${json.id}`)
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : '生成失败。')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
      <div>
        <Link href="/admin/tasks" className="text-sm" style={{ color: 'var(--muted-foreground)' }}>工作任务</Link>
        <h1 className="mt-2 text-xl font-semibold" style={{ color: 'var(--foreground)' }}>公司/营业名称</h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--muted-foreground)' }}>
          生成更改公司名称的特别决议，以及公司注册处表格 NNC2。只存在这项任务里，不会改公司管理里的名称。有几位股东就留几个签名位，没有股东就不留。某一语言没有名称时，NNC2 会填 NIL；只改一种语言时，另一种名称会原样保留。
        </p>
      </div>

      <WorkTaskPlaybook kind="COMPANY_NAME_CHANGE" />

      <section className="flex flex-col gap-3 p-5" style={card}>
        <label className="flex flex-col gap-1 text-sm">
          <span style={{ color: 'var(--muted-foreground)' }}>公司</span>
          <select
            className={inputClass}
            style={inputStyle()}
            value={companyId}
            onChange={event => {
              const nextId = event.target.value
              setCompanyId(nextId)
              if (!nextId) {
                setCompanyNameEn('')
                setCompanyNameZh('')
                setCompanyNo('')
                setBrn('')
                setSignatoryName('')
                setShareholderNames(['', '', '', ''])
              }
            }}
          >
            <option value="">从公司管理选择</option>
            {companies.map(company => (
              <option key={company.id} value={company.id}>
                {(company.nameZh || company.nameEn)}{company.companyCode ? ` · ${company.companyCode}` : ''}
              </option>
            ))}
          </select>
        </label>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            <span style={{ color: 'var(--muted-foreground)' }}>现有英文名称</span>
            <input className={inputClass} style={inputStyle()} value={companyNameEn} onChange={event => setCompanyNameEn(event.target.value)} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span style={{ color: 'var(--muted-foreground)' }}>现有中文名称</span>
            <input className={inputClass} style={inputStyle()} value={companyNameZh} onChange={event => setCompanyNameZh(event.target.value)} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span style={{ color: 'var(--muted-foreground)' }}>公司编号</span>
            <input className={inputClass} style={inputStyle()} value={companyNo} onChange={event => setCompanyNo(event.target.value)} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span style={{ color: 'var(--muted-foreground)' }}>商业登记号码</span>
            <input className={inputClass} style={inputStyle()} value={brn} onChange={event => setBrn(event.target.value)} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span style={{ color: 'var(--muted-foreground)' }}>决议日期</span>
            <input className={inputClass} style={inputStyle()} type="date" value={changeDate} onChange={event => setChangeDate(event.target.value)} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span style={{ color: 'var(--muted-foreground)' }}>新英文名称</span>
            <input className={inputClass} style={inputStyle()} value={newCompanyNameEn} onChange={event => setNewCompanyNameEn(event.target.value)} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span style={{ color: 'var(--muted-foreground)' }}>新中文名称</span>
            <input className={inputClass} style={inputStyle()} value={newCompanyNameZh} onChange={event => setNewCompanyNameZh(event.target.value)} />
          </label>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {shareholderNames.map((name, index) => (
            <label key={index} className="flex flex-col gap-1 text-sm">
              <span style={{ color: 'var(--muted-foreground)' }}>股东 {index + 1}</span>
              <input
                className={inputClass}
                style={inputStyle()}
                value={name}
                onChange={event => {
                  const next = [...shareholderNames]
                  next[index] = event.target.value
                  setShareholderNames(next)
                }}
              />
            </label>
          ))}
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            <span style={{ color: 'var(--muted-foreground)' }}>NNC2 签署人</span>
            <input className={inputClass} style={inputStyle()} value={signatoryName} onChange={event => setSignatoryName(event.target.value)} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span style={{ color: 'var(--muted-foreground)' }}>签署身份</span>
            <select className={inputClass} style={inputStyle()} value={signatoryCapacity} onChange={event => setSignatoryCapacity(event.target.value as 'DIRECTOR' | 'COMPANY_SECRETARY')}>
              <option value="DIRECTOR">董事</option>
              <option value="COMPANY_SECRETARY">公司秘书</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span style={{ color: 'var(--muted-foreground)' }}>签署日期</span>
            <input className={inputClass} style={inputStyle()} type="date" value={signatoryDate} onChange={event => setSignatoryDate(event.target.value)} />
          </label>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <p className="md:col-span-2 text-sm" style={{ color: 'var(--muted-foreground)' }}>提交人资料（公司注册处用来通知领取更改名称证明书，已填默认，可改）</p>
          <label className="flex flex-col gap-1 text-sm">
            <span style={{ color: 'var(--muted-foreground)' }}>提交人中文名称</span>
            <input className={inputClass} style={inputStyle()} value={presentorNameZh} onChange={event => setPresentorNameZh(event.target.value)} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span style={{ color: 'var(--muted-foreground)' }}>提交人英文名称</span>
            <input className={inputClass} style={inputStyle()} value={presentorNameEn} onChange={event => setPresentorNameEn(event.target.value)} />
          </label>
          <label className="flex flex-col gap-1 text-sm md:col-span-2">
            <span style={{ color: 'var(--muted-foreground)' }}>提交人地址</span>
            <input className={inputClass} style={inputStyle()} value={presentorAddress} onChange={event => setPresentorAddress(event.target.value)} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span style={{ color: 'var(--muted-foreground)' }}>电话</span>
            <input className={inputClass} style={inputStyle()} value={presentorTel} onChange={event => setPresentorTel(event.target.value)} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span style={{ color: 'var(--muted-foreground)' }}>传真</span>
            <input className={inputClass} style={inputStyle()} value={presentorFax} onChange={event => setPresentorFax(event.target.value)} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span style={{ color: 'var(--muted-foreground)' }}>电邮</span>
            <input className={inputClass} style={inputStyle()} value={presentorEmail} onChange={event => setPresentorEmail(event.target.value)} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span style={{ color: 'var(--muted-foreground)' }}>档号</span>
            <input className={inputClass} style={inputStyle()} value={presentorReference} onChange={event => setPresentorReference(event.target.value)} />
          </label>
        </div>
        <div>
          <Button disabled={saving || !canCreate} onClick={() => void submit()}>
            {saving ? '生成中…' : '生成特别决议及 NNC2'}
          </Button>
        </div>
      </section>
    </div>
  )
}
