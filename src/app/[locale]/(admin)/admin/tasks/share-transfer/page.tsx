'use client'

/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useState } from 'react'
import { useRouter } from '@/i18n/navigation'
import { Link } from '@/i18n/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { useAdminPermission } from '@/components/admin/AdminPermissionContext'
import { naturalPersonNameSurnameFirst } from '@/lib/work-tasks/person-name'
import { SHARE_TRANSFER_DOCUMENTS, type ShareTransferDocumentKey } from '@/lib/work-tasks/share-transfer-docs'
import { WorkTaskPlaybook } from '@/components/work-tasks/WorkTaskPlaybook'

type CompanyHit = {
  id: string
  nameEn: string
  nameZh: string | null
  companyCode: string | null
  companyNumber: string | null
  registeredAddress?: string | null
}

type MemberOption = {
  id: string
  nameEn: string
  nameZh: string
  address: string
  occupation: string
  shareClass: string
  status: string
  sharesHeld: number | null
  certificateNo: string
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
  position: string | null
}

type PartyDraft = {
  name: string
  address: string
  occupation: string
  keyPersonId: string | null
  companyId: string | null
  memberId: string | null
}

const emptyParty: PartyDraft = {
  name: '',
  address: '',
  occupation: '',
  keyPersonId: null,
  companyId: null,
  memberId: null,
}

const card: React.CSSProperties = {
  background: 'var(--card)',
  border: '1px solid var(--border)',
  borderRadius: '0.75rem',
}

const inputClass = 'w-full rounded-lg px-3 py-2 text-sm outline-none'

function inputStyle(): React.CSSProperties {
  return {
    background: '#0F0D08',
    border: '1px solid var(--border-subtle)',
    color: 'var(--foreground)',
  }
}

function todayIso() {
  const date = new Date()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span style={{ color: 'var(--muted-foreground)' }}>{label}</span>
      {children}
    </label>
  )
}

export default function ShareTransferPage() {
  const router = useRouter()
  const canCreate = useAdminPermission('workTasks.create')
  const [companies, setCompanies] = useState<CompanyHit[]>([])
  const [people, setPeople] = useState<PersonHit[]>([])
  const [companyId, setCompanyId] = useState('')
  const [companyNameEn, setCompanyNameEn] = useState('')
  const [companyNameZh, setCompanyNameZh] = useState('')
  const [companyNo, setCompanyNo] = useState('')
  const [members, setMembers] = useState<MemberOption[]>([])
  const [directors, setDirectors] = useState<DirectorOption[]>([])
  const [transferDate, setTransferDate] = useState(todayIso)
  const [transferor, setTransferor] = useState<PartyDraft>(emptyParty)
  const [transferee, setTransferee] = useState<PartyDraft>(emptyParty)
  const [numberOfShares, setNumberOfShares] = useState('')
  const [shareClass, setShareClass] = useState('Ordinary')
  const [parValue, setParValue] = useState('1.00')
  const [consideration, setConsideration] = useState('')
  const [shareNumbers, setShareNumbers] = useState('')
  const [oldCertNo, setOldCertNo] = useState('')
  const [newCertNo, setNewCertNo] = useState('')
  const [directorName, setDirectorName] = useState('')
  const [paidStatus, setPaidStatus] = useState<'Fully paid' | 'Partly paid'>('Fully paid')
  const [paidAmount, setPaidAmount] = useState('')
  const [useCommonSeal, setUseCommonSeal] = useState(false)
  const [documents, setDocuments] = useState<ShareTransferDocumentKey[]>(
    SHARE_TRANSFER_DOCUMENTS.filter(doc => doc.defaultOn).map(doc => doc.key),
  )
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
        setUseCommonSeal(Boolean(json.company.hasCompanyRoundSeal))
        setMembers(Array.isArray(json.members) ? json.members : [])
        setDirectors(Array.isArray(json.directors) ? json.directors : [])
        setTransferor(emptyParty)
        setTransferee(emptyParty)
        setDirectorName('')
      })
      .catch(cause => {
        toast.error(cause instanceof Error ? cause.message : '载入公司失败。')
      })
    return () => {
      cancelled = true
    }
  }, [companyId])

  function personLabel(person: PersonHit) {
    const name = person.nameZh || person.nameEn
    return person.kycCode ? `${name} · ${person.kycCode}` : name
  }

  function applyPerson(personId: string, target: 'transferor' | 'transferee') {
    const setParty = target === 'transferor' ? setTransferor : setTransferee
    if (!personId) {
      setParty(current => ({ ...current, keyPersonId: null, memberId: null, companyId: null }))
      return
    }
    const person = people.find(item => item.id === personId)
    if (!person) return
    setParty({
      name: naturalPersonNameSurnameFirst(person),
      address: person.contactAddress || person.homeAddress || '',
      occupation: person.position || '',
      keyPersonId: person.id,
      companyId: null,
      memberId: null,
    })
  }

  function applyMember(memberId: string, target: 'transferor' | 'transferee') {
    const setParty = target === 'transferor' ? setTransferor : setTransferee
    if (!memberId) {
      setParty(current => ({ ...current, memberId: null }))
      return
    }
    const member = members.find(item => item.id === memberId)
    if (!member) return
    const party: PartyDraft = {
      name: member.keyPersonId && !member.linkedCompanyId
        ? naturalPersonNameSurnameFirst(member)
        : member.nameEn,
      address: member.address,
      occupation: member.occupation,
      keyPersonId: member.keyPersonId,
      companyId: member.linkedCompanyId,
      memberId: member.id,
    }
    if (target === 'transferor') {
      setTransferor(party)
      if (member.certificateNo) setOldCertNo(member.certificateNo)
      if (member.shareClass) setShareClass(member.shareClass)
      if (member.sharesHeld && member.sharesHeld > 0) setNumberOfShares(String(member.sharesHeld))
    } else {
      setTransferee(party)
    }
  }

  function toggleDocument(key: ShareTransferDocumentKey) {
    setDocuments(current => current.includes(key) ? current.filter(item => item !== key) : [...current, key])
  }

  async function submit() {
    if (!canCreate) {
      toast.error('没有生成权限。')
      return
    }
    const shares = Number(numberOfShares)
    if (!companyId || !transferor.name || !transferee.name || !directorName || !consideration || !Number.isInteger(shares) || shares <= 0) {
      toast.error('请选择公司，并填写双方、董事、股数和代价。')
      return
    }
    if (documents.length === 0) {
      toast.error('请至少选一份文件。')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/admin/work-tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          companyNameEn,
          companyNameZh,
          companyNo,
          transferDate,
          transferor,
          transferee,
          numberOfShares: shares,
          shareClass,
          parValue,
          consideration,
          shareNumbers,
          oldCertNo,
          newCertNo,
          directorName,
          paidStatus,
          paidAmount,
          useCommonSeal,
          documents,
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

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-5 p-6">
      <div>
        <Link href="/admin/tasks" className="text-sm" style={{ color: 'var(--muted-foreground)' }}>工作任务</Link>
        <h1 className="mt-2 text-xl font-semibold" style={{ color: 'var(--foreground)' }}>股份转让</h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--muted-foreground)' }}>
          生成转让文书、买卖票据、董事决议和新股票，下载后交税务局盖印。不会改股东纪录，也不写入公司文件库。近三个月账目、审计报告和章程仍要向客户收取。
        </p>
      </div>

      <WorkTaskPlaybook kind="SHARE_TRANSFER" />

      <section className="grid gap-3 p-5" style={card}>
        <Field label="公司">
          <select
            className={inputClass}
            style={inputStyle()}
            value={companyId}
            onChange={event => {
              const nextId = event.target.value
              setCompanyId(nextId)
              if (!nextId) {
                setMembers([])
                setDirectors([])
                setCompanyNameEn('')
                setCompanyNameZh('')
                setCompanyNo('')
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
        </Field>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="英文名称">
            <input className={inputClass} style={inputStyle()} value={companyNameEn} onChange={event => setCompanyNameEn(event.target.value)} />
          </Field>
          <Field label="中文名称">
            <input className={inputClass} style={inputStyle()} value={companyNameZh} onChange={event => setCompanyNameZh(event.target.value)} />
          </Field>
          <Field label="公司编号">
            <input className={inputClass} style={inputStyle()} value={companyNo} onChange={event => setCompanyNo(event.target.value)} />
          </Field>
        </div>
      </section>

      <section className="grid gap-4 p-5 md:grid-cols-2" style={card}>
        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold">转出方</h2>
          <Field label="自然人管理">
            <select className={inputClass} style={inputStyle()} value={transferor.keyPersonId ?? ''} onChange={event => applyPerson(event.target.value, 'transferor')}>
              <option value="">手工输入</option>
              {people.map(person => (
                <option key={person.id} value={person.id}>{personLabel(person)}</option>
              ))}
            </select>
          </Field>
          <Field label="本公司成员">
            <select className={inputClass} style={inputStyle()} value={transferor.memberId ?? ''} onChange={event => applyMember(event.target.value, 'transferor')}>
              <option value="">手工输入</option>
              {members.map(member => (
                <option key={member.id} value={member.id}>
                  {member.nameEn}{member.sharesHeld != null ? ` · ${member.sharesHeld} 股` : ''}
                </option>
              ))}
            </select>
          </Field>
          <Field label="姓名">
            <input className={inputClass} style={inputStyle()} value={transferor.name} onChange={event => setTransferor({ ...transferor, name: event.target.value })} />
          </Field>
          <Field label="地址">
            <input className={inputClass} style={inputStyle()} value={transferor.address} onChange={event => setTransferor({ ...transferor, address: event.target.value })} />
          </Field>
          <Field label="职业">
            <input className={inputClass} style={inputStyle()} value={transferor.occupation} onChange={event => setTransferor({ ...transferor, occupation: event.target.value })} />
          </Field>
        </div>
        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold">转入方</h2>
          <Field label="自然人管理">
            <select className={inputClass} style={inputStyle()} value={transferee.keyPersonId ?? ''} onChange={event => applyPerson(event.target.value, 'transferee')}>
              <option value="">手工输入</option>
              {people.map(person => (
                <option key={person.id} value={person.id}>{personLabel(person)}</option>
              ))}
            </select>
          </Field>
          <Field label="本公司成员">
            <select className={inputClass} style={inputStyle()} value={transferee.memberId ?? ''} onChange={event => applyMember(event.target.value, 'transferee')}>
              <option value="">手工输入</option>
              {members.map(member => (
                <option key={member.id} value={member.id}>{member.nameEn}</option>
              ))}
            </select>
          </Field>
          <Field label="姓名">
            <input className={inputClass} style={inputStyle()} value={transferee.name} onChange={event => setTransferee({ ...transferee, name: event.target.value })} />
          </Field>
          <Field label="地址">
            <input className={inputClass} style={inputStyle()} value={transferee.address} onChange={event => setTransferee({ ...transferee, address: event.target.value })} />
          </Field>
          <Field label="职业">
            <input className={inputClass} style={inputStyle()} value={transferee.occupation} onChange={event => setTransferee({ ...transferee, occupation: event.target.value })} />
          </Field>
        </div>
      </section>

      <section className="grid gap-3 p-5 md:grid-cols-2" style={card}>
        <Field label="转让日期">
          <input type="date" className={inputClass} style={inputStyle()} value={transferDate} onChange={event => setTransferDate(event.target.value)} />
        </Field>
        <Field label="董事">
          <select
            className={inputClass}
            style={inputStyle()}
            value={directors.find(director => director.nameEn === directorName)?.id ?? ''}
            onChange={event => {
              const director = directors.find(item => item.id === event.target.value)
              setDirectorName(director?.nameEn ?? '')
            }}
          >
            <option value="">选择董事</option>
            {directors.map(director => (
              <option key={director.id} value={director.id}>{director.nameZh || director.nameEn}</option>
            ))}
          </select>
        </Field>
        <Field label="董事姓名（印在决议和股票上）">
          <input className={inputClass} style={inputStyle()} value={directorName} onChange={event => setDirectorName(event.target.value)} />
        </Field>
        <Field label="股数">
          <input className={inputClass} style={inputStyle()} inputMode="numeric" value={numberOfShares} onChange={event => setNumberOfShares(event.target.value)} />
        </Field>
        <Field label="股份类别">
          <input className={inputClass} style={inputStyle()} value={shareClass} onChange={event => setShareClass(event.target.value)} />
        </Field>
        <Field label="每股面值">
          <input className={inputClass} style={inputStyle()} value={parValue} onChange={event => setParValue(event.target.value)} />
        </Field>
        <Field label="代价（只填数字，模板已有 HK$）">
          <input className={inputClass} style={inputStyle()} value={consideration} onChange={event => setConsideration(event.target.value)} />
        </Field>
        <Field label="股份编号">
          <input className={inputClass} style={inputStyle()} value={shareNumbers} placeholder="例如 1-100" onChange={event => setShareNumbers(event.target.value)} />
        </Field>
        <Field label="旧股票编号">
          <input className={inputClass} style={inputStyle()} value={oldCertNo} onChange={event => setOldCertNo(event.target.value)} />
        </Field>
        <Field label="新股票编号">
          <input className={inputClass} style={inputStyle()} value={newCertNo} onChange={event => setNewCertNo(event.target.value)} />
        </Field>
        <Field label="缴足情况">
          <select className={inputClass} style={inputStyle()} value={paidStatus} onChange={event => setPaidStatus(event.target.value as 'Fully paid' | 'Partly paid')}>
            <option value="Fully paid">Fully paid</option>
            <option value="Partly paid">Partly paid</option>
          </select>
        </Field>
        <Field label="已缴金额（空则跟代价）">
          <input className={inputClass} style={inputStyle()} value={paidAmount} onChange={event => setPaidAmount(event.target.value)} />
        </Field>
        <label className="flex items-center gap-2 text-sm md:col-span-2">
          <input type="checkbox" checked={useCommonSeal} onChange={event => setUseCommonSeal(event.target.checked)} />
          股票用公司圆印签署
        </label>
        {shareClass.trim().toLowerCase() !== 'ordinary' ? (
          <p className="text-sm md:col-span-2" style={{ color: 'var(--muted-foreground)' }}>
            董事决议模板写的是 Ordinary。类别不是普通股时，下载后要改决议里的股份类别。
          </p>
        ) : null}
      </section>

      <section className="flex flex-col gap-2 p-5" style={card}>
        <h2 className="text-sm font-semibold">生成哪些文件</h2>
        {SHARE_TRANSFER_DOCUMENTS.map(doc => (
          <label key={doc.key} className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-1"
              checked={documents.includes(doc.key)}
              onChange={() => toggleDocument(doc.key)}
            />
            <span>
              {doc.label}
              <span className="ml-2" style={{ color: 'var(--muted-foreground)' }}>{doc.hint}</span>
            </span>
          </label>
        ))}
      </section>

      <div className="flex items-center gap-3">
        <Button type="button" disabled={!canCreate || saving} onClick={submit}>
          {saving ? '生成中…' : '生成文件'}
        </Button>
        {!canCreate ? <span className="text-sm" style={{ color: 'var(--muted-foreground)' }}>没有生成权限。</span> : null}
      </div>
    </div>
  )
}
