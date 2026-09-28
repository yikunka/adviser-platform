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
  address: string
  shareClass: string
  status: string
  sharesHeld: number | null
  keyPersonId: string | null
  linkedCompanyId: string | null
  firstName?: string
  lastName?: string
  otherName?: string
}

type DirectorOption = { id: string; nameEn: string; nameZh: string | null }

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

function memberLabel(member: MemberOption) {
  if (member.keyPersonId && !member.linkedCompanyId) {
    return naturalPersonNameSurnameFirst(member) || member.nameEn
  }
  return member.nameZh || member.nameEn
}

export default function ShareAllotmentPage() {
  const router = useRouter()
  const canCreate = useAdminPermission('workTasks.create')
  const [companies, setCompanies] = useState<CompanyHit[]>([])
  const [people, setPeople] = useState<PersonHit[]>([])
  const [companyId, setCompanyId] = useState('')
  const [companyNameEn, setCompanyNameEn] = useState('')
  const [companyNameZh, setCompanyNameZh] = useState('')
  const [companyNo, setCompanyNo] = useState('')
  const [brn, setBrn] = useState('')
  const [members, setMembers] = useState<MemberOption[]>([])
  const [directors, setDirectors] = useState<DirectorOption[]>([])
  const [allotmentDate, setAllotmentDate] = useState(todayIso)
  const [allotteeName, setAllotteeName] = useState('')
  const [allotteeNameZh, setAllotteeNameZh] = useState('')
  const [allotteeAddress, setAllotteeAddress] = useState('')
  const [numberOfShares, setNumberOfShares] = useState('')
  const [shareClass, setShareClass] = useState('Ordinary')
  const [currency, setCurrency] = useState('HKD')
  const [amountPaidPerShare, setAmountPaidPerShare] = useState('1.00')
  const [amountUnpaidPerShare, setAmountUnpaidPerShare] = useState('0')
  const [consideration, setConsideration] = useState('')
  const [paidStatus, setPaidStatus] = useState<'Fully paid' | 'Partly paid'>('Fully paid')
  const [certNo, setCertNo] = useState('')
  const [directorName1, setDirectorName1] = useState('')
  const [directorName2, setDirectorName2] = useState('')
  const [meetingTime, setMeetingTime] = useState('10:00 a.m.')
  const [meetingPlace, setMeetingPlace] = useState('the registered office of the Company')
  const [companySecretary, setCompanySecretary] = useState('6AM Advisory Limited')
  const [useCommonSeal, setUseCommonSeal] = useState(false)
  const [capitalIncreaseAmount, setCapitalIncreaseAmount] = useState('')
  const [issuedTotalNumber, setIssuedTotalNumber] = useState('')
  const [issuedTotalAmount, setIssuedTotalAmount] = useState('')
  const [issuedPaidUp, setIssuedPaidUp] = useState('')
  const [issuedUnpaid, setIssuedUnpaid] = useState('0')
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
        setUseCommonSeal(Boolean(json.company.hasCompanyRoundSeal))
        const nextMembers: MemberOption[] = Array.isArray(json.members) ? json.members : []
        setMembers(nextMembers)
        const nextDirectors: DirectorOption[] = Array.isArray(json.directors) ? json.directors : []
        setDirectors(nextDirectors)
        const first = nextDirectors[0]
        const second = nextDirectors[1]
        setDirectorName1(first ? (first.nameZh || first.nameEn) : '')
        setDirectorName2(second ? (second.nameZh || second.nameEn) : '')
        setSignatoryName(first ? (first.nameZh || first.nameEn) : '')
        setAllotteeName('')
        setAllotteeNameZh('')
        setAllotteeAddress('')
        const existing = nextMembers
          .filter(member => member.status === 'ACTIVE')
          .reduce((sum, member) => sum + (member.sharesHeld ?? 0), 0)
        setIssuedTotalNumber(existing > 0 ? String(existing) : '')
      })
      .catch(cause => {
        toast.error(cause instanceof Error ? cause.message : '载入公司失败。')
      })
    return () => {
      cancelled = true
    }
  }, [companyId])

  useEffect(() => {
    const shares = Number(numberOfShares)
    const paid = Number(amountPaidPerShare)
    if (!Number.isFinite(shares) || shares <= 0 || !Number.isFinite(paid)) return
    const total = (shares * paid).toFixed(2).replace(/\.00$/, '')
    setConsideration(current => current || total)
    setCapitalIncreaseAmount(current => current || total)
  }, [numberOfShares, amountPaidPerShare])

  useEffect(() => {
    const shares = Number(numberOfShares)
    const existing = members
      .filter(member => member.status === 'ACTIVE')
      .reduce((sum, member) => sum + (member.sharesHeld ?? 0), 0)
    if (!Number.isFinite(shares) || shares <= 0) return
    const after = existing + shares
    setIssuedTotalNumber(String(after))
    const paid = Number(amountPaidPerShare)
    if (Number.isFinite(paid)) {
      const amount = (after * paid).toFixed(2).replace(/\.00$/, '')
      setIssuedTotalAmount(amount)
      setIssuedPaidUp(amount)
    }
  }, [numberOfShares, amountPaidPerShare, members])

  function applyMember(memberId: string) {
    if (!memberId) return
    const member = members.find(item => item.id === memberId)
    if (!member) return
    setAllotteeName(memberLabel(member))
    setAllotteeNameZh(member.nameZh || '')
    setAllotteeAddress(member.address || '')
    if (member.shareClass) setShareClass(member.shareClass)
  }

  function applyPerson(personId: string) {
    if (!personId) return
    const person = people.find(item => item.id === personId)
    if (!person) return
    setAllotteeName(naturalPersonNameSurnameFirst(person))
    setAllotteeNameZh(person.nameZh || '')
    setAllotteeAddress(person.contactAddress || person.homeAddress || '')
  }

  async function submit() {
    if (!canCreate) {
      toast.error('没有生成权限。')
      return
    }
    const shares = Number(numberOfShares)
    if (!companyId || !allotteeName.trim() || !Number.isFinite(shares) || shares <= 0 || !directorName1.trim() || !signatoryName.trim()) {
      toast.error('请选择公司，并填写获配发者、股数、董事和签署人。')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/admin/work-tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'SHARE_ALLOTMENT',
          companyId,
          companyNameEn,
          companyNameZh,
          companyNo,
          brn,
          allotmentDate,
          allotteeName,
          allotteeNameZh,
          allotteeAddress,
          numberOfShares: shares,
          shareClass,
          currency,
          amountPaidPerShare,
          amountUnpaidPerShare: paidStatus === 'Fully paid' ? '0' : amountUnpaidPerShare,
          consideration: consideration || capitalIncreaseAmount,
          paidStatus,
          certNo,
          directorName1,
          directorName2,
          meetingTime,
          meetingPlace,
          companySecretary,
          useCommonSeal,
          capitalIncreaseAmount: capitalIncreaseAmount || consideration,
          issuedTotalNumber,
          issuedTotalAmount,
          issuedPaidUp,
          issuedUnpaid,
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

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-5 p-6">
      <div>
        <Link href="/admin/tasks" className="text-sm" style={{ color: 'var(--muted-foreground)' }}>工作任务</Link>
        <h1 className="mt-2 text-xl font-semibold" style={{ color: 'var(--foreground)' }}>配售新股</h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--muted-foreground)' }}>
          生成董事会会议纪录、股份申请表、新股票和表格 NSC1。下载后交公司注册处。不会改股东纪录，也不写入公司文件库。
        </p>
      </div>

      <WorkTaskPlaybook kind="SHARE_ALLOTMENT" />

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
          <span className={label} style={{ color: 'var(--muted-foreground)' }}>配发日期</span>
          <input type="date" className={inputClass} style={inputStyle()} value={allotmentDate} onChange={event => setAllotmentDate(event.target.value)} />
        </label>
        <label className="text-sm">
          <span className={label} style={{ color: 'var(--muted-foreground)' }}>股票编号</span>
          <input className={inputClass} style={inputStyle()} value={certNo} onChange={event => setCertNo(event.target.value)} />
        </label>
      </section>

      <section className="grid gap-4 p-5 sm:grid-cols-2" style={card}>
        <h2 className="text-sm font-semibold sm:col-span-2" style={{ color: 'var(--foreground)' }}>获配发股份者</h2>
        <label className="text-sm">
          <span className={label} style={{ color: 'var(--muted-foreground)' }}>从现有成员选取</span>
          <select className={inputClass} style={inputStyle()} defaultValue="" onChange={event => applyMember(event.target.value)}>
            <option value="">可选</option>
            {members.map(member => (
              <option key={member.id} value={member.id}>{memberLabel(member)}</option>
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
          <input className={inputClass} style={inputStyle()} value={allotteeName} onChange={event => setAllotteeName(event.target.value)} />
        </label>
        <label className="text-sm">
          <span className={label} style={{ color: 'var(--muted-foreground)' }}>中文姓名／名称</span>
          <input className={inputClass} style={inputStyle()} value={allotteeNameZh} onChange={event => setAllotteeNameZh(event.target.value)} />
        </label>
        <label className="text-sm sm:col-span-2">
          <span className={label} style={{ color: 'var(--muted-foreground)' }}>地址</span>
          <input className={inputClass} style={inputStyle()} value={allotteeAddress} onChange={event => setAllotteeAddress(event.target.value)} />
        </label>
      </section>

      <section className="grid gap-4 p-5 sm:grid-cols-2" style={card}>
        <h2 className="text-sm font-semibold sm:col-span-2" style={{ color: 'var(--foreground)' }}>配发详情</h2>
        <label className="text-sm">
          <span className={label} style={{ color: 'var(--muted-foreground)' }}>股数</span>
          <input className={inputClass} style={inputStyle()} value={numberOfShares} onChange={event => setNumberOfShares(event.target.value)} />
        </label>
        <label className="text-sm">
          <span className={label} style={{ color: 'var(--muted-foreground)' }}>股份类别</span>
          <input className={inputClass} style={inputStyle()} value={shareClass} onChange={event => setShareClass(event.target.value)} />
        </label>
        <label className="text-sm">
          <span className={label} style={{ color: 'var(--muted-foreground)' }}>货币</span>
          <input className={inputClass} style={inputStyle()} value={currency} onChange={event => setCurrency(event.target.value)} />
        </label>
        <label className="text-sm">
          <span className={label} style={{ color: 'var(--muted-foreground)' }}>缴付情况</span>
          <select className={inputClass} style={inputStyle()} value={paidStatus} onChange={event => setPaidStatus(event.target.value as 'Fully paid' | 'Partly paid')}>
            <option value="Fully paid">Fully paid</option>
            <option value="Partly paid">Partly paid</option>
          </select>
        </label>
        <label className="text-sm">
          <span className={label} style={{ color: 'var(--muted-foreground)' }}>每股已缴款额</span>
          <input className={inputClass} style={inputStyle()} value={amountPaidPerShare} onChange={event => setAmountPaidPerShare(event.target.value)} />
        </label>
        <label className="text-sm">
          <span className={label} style={{ color: 'var(--muted-foreground)' }}>每股未缴款额</span>
          <input className={inputClass} style={inputStyle()} value={amountUnpaidPerShare} onChange={event => setAmountUnpaidPerShare(event.target.value)} disabled={paidStatus === 'Fully paid'} />
        </label>
        <label className="text-sm">
          <span className={label} style={{ color: 'var(--muted-foreground)' }}>代价总额</span>
          <input className={inputClass} style={inputStyle()} value={consideration} onChange={event => setConsideration(event.target.value)} />
        </label>
        <label className="text-sm">
          <span className={label} style={{ color: 'var(--muted-foreground)' }}>已发行股本增加额（NSC1 第 3 项）</span>
          <input className={inputClass} style={inputStyle()} value={capitalIncreaseAmount} onChange={event => setCapitalIncreaseAmount(event.target.value)} />
        </label>
      </section>

      <section className="grid gap-4 p-5 sm:grid-cols-2" style={card}>
        <h2 className="text-sm font-semibold sm:col-span-2" style={{ color: 'var(--foreground)' }}>配发后股本说明（NSC1 第 6 项）</h2>
        <label className="text-sm">
          <span className={label} style={{ color: 'var(--muted-foreground)' }}>已发行股份总数</span>
          <input className={inputClass} style={inputStyle()} value={issuedTotalNumber} onChange={event => setIssuedTotalNumber(event.target.value)} />
        </label>
        <label className="text-sm">
          <span className={label} style={{ color: 'var(--muted-foreground)' }}>总款额</span>
          <input className={inputClass} style={inputStyle()} value={issuedTotalAmount} onChange={event => setIssuedTotalAmount(event.target.value)} />
        </label>
        <label className="text-sm">
          <span className={label} style={{ color: 'var(--muted-foreground)' }}>已缴总款额</span>
          <input className={inputClass} style={inputStyle()} value={issuedPaidUp} onChange={event => setIssuedPaidUp(event.target.value)} />
        </label>
        <label className="text-sm">
          <span className={label} style={{ color: 'var(--muted-foreground)' }}>未缴总款额</span>
          <input className={inputClass} style={inputStyle()} value={issuedUnpaid} onChange={event => setIssuedUnpaid(event.target.value)} />
        </label>
      </section>

      <section className="grid gap-4 p-5 sm:grid-cols-2" style={card}>
        <h2 className="text-sm font-semibold sm:col-span-2" style={{ color: 'var(--foreground)' }}>会议与签署</h2>
        <label className="text-sm">
          <span className={label} style={{ color: 'var(--muted-foreground)' }}>主席／董事 1</span>
          <select className={inputClass} style={inputStyle()} value={directorName1} onChange={event => setDirectorName1(event.target.value)}>
            <option value="">选择或手写</option>
            {directors.map(director => (
              <option key={director.id} value={director.nameZh || director.nameEn}>{director.nameZh || director.nameEn}</option>
            ))}
          </select>
          <input className={`${inputClass} mt-2`} style={inputStyle()} value={directorName1} onChange={event => setDirectorName1(event.target.value)} placeholder="手写姓名" />
        </label>
        <label className="text-sm">
          <span className={label} style={{ color: 'var(--muted-foreground)' }}>董事 2（可选）</span>
          <input className={inputClass} style={inputStyle()} value={directorName2} onChange={event => setDirectorName2(event.target.value)} />
        </label>
        <label className="text-sm">
          <span className={label} style={{ color: 'var(--muted-foreground)' }}>会议时间</span>
          <input className={inputClass} style={inputStyle()} value={meetingTime} onChange={event => setMeetingTime(event.target.value)} />
        </label>
        <label className="text-sm">
          <span className={label} style={{ color: 'var(--muted-foreground)' }}>会议地点</span>
          <input className={inputClass} style={inputStyle()} value={meetingPlace} onChange={event => setMeetingPlace(event.target.value)} />
        </label>
        <label className="text-sm">
          <span className={label} style={{ color: 'var(--muted-foreground)' }}>公司秘书</span>
          <input className={inputClass} style={inputStyle()} value={companySecretary} onChange={event => setCompanySecretary(event.target.value)} />
        </label>
        <label className="flex items-end gap-2 text-sm pb-2">
          <input type="checkbox" checked={useCommonSeal} onChange={event => setUseCommonSeal(event.target.checked)} />
          <span style={{ color: 'var(--muted-foreground)' }}>使用公司印章</span>
        </label>
        <label className="text-sm">
          <span className={label} style={{ color: 'var(--muted-foreground)' }}>NSC1 签署人</span>
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
        <h2 className="text-sm font-semibold sm:col-span-2" style={{ color: 'var(--foreground)' }}>提交人（NSC1）</h2>
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
          {saving ? '生成中…' : '生成会议纪录、申请表、股票和 NSC1'}
        </Button>
      </div>
    </div>
  )
}
