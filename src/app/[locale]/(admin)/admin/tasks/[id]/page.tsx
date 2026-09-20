'use client'

/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Link } from '@/i18n/navigation'
import { shareTransferDocument } from '@/lib/work-tasks/share-transfer-docs'
import { WorkTaskPlaybook } from '@/components/work-tasks/WorkTaskPlaybook'
import type { WorkTaskKind } from '@/lib/work-tasks/playbook-steps'

type TaskKind = WorkTaskKind

const TASK_TITLE: Record<TaskKind, string> = {
  SHARE_TRANSFER: '股份转让',
  COMPANY_NAME_CHANGE: '公司/营业名称',
  REGISTERED_OFFICE_ADDRESS: '公司注册/营业地址',
  REGISTER_LOCATION: '登记册备存地点',
  ACCOUNTING_REFERENCE_DATE: '会计参照日',
}

const TASK_NOTE: Record<TaskKind, string> = {
  SHARE_TRANSFER: '下载后交税务局盖印。这项任务没有改股东纪录，也不会向公司注册处交表。',
  COMPANY_NAME_CHANGE: '下载特别决议和表格 NNC2 后交给公司注册处。这项任务没有改公司管理里的名称。',
  REGISTERED_OFFICE_ADDRESS: '下载表格 NR1 后交给公司注册处。这项任务没有改公司管理里的注册地址。',
  REGISTER_LOCATION: '下载董事会会议纪录和表格 NR2。NR2 交给公司注册处。这项任务没有改公司纪录的存放地点。',
  ACCOUNTING_REFERENCE_DATE: '下载成员会议纪录和表格 NAC4。NAC4 交给公司注册处。这项任务没有改公司的会计参照月。',
}

const FILE_LABEL: Record<string, string> = {
  'special-resolution': '特别决议（更改公司名称）',
  nnc2: 'NNC2 更改公司名称通知书',
  nr1: 'NR1 注册办事处地址更改通知书',
  nr2: 'NR2 登记册及公司纪录备存地点通知书',
  'board-minutes': '董事会会议纪录（登记册备存地点）',
  'board-minutes-ard': '成员会议纪录（会计参照日）',
  nac4: 'NAC4 更改会计参照日通知书',
}

type Party = {
  name?: string
  address?: string
  occupation?: string
}

type TaskFile = {
  id: string
  templateKey: string
  fileName: string
  storageKey: string
  fileSize: number
}

type TaskDetail = {
  id: string
  taskNumber: string
  kind: TaskKind
  createdAt: string
  payload: {
    companyNameEn?: string
    companyNameZh?: string
    companyNo?: string
    transferDate?: string
    numberOfShares?: number
    shareClass?: string
    consideration?: string
    transferor?: Party
    transferee?: Party
    directorName?: string
    newCompanyNameEn?: string
    newCompanyNameZh?: string
    changeDate?: string
    shareholderNames?: string[]
    brn?: string
    signatoryName?: string
    signatoryCapacity?: string
    signatoryDate?: string
    flat?: string
    building?: string
    street?: string
    district?: string
    effectiveDate?: string
    location?: string
    currentPeriodEnd?: string
    change?: string
    newPeriodEnd?: string
    resolutionDate?: string
    memberNames?: string[]
  }
  company: { nameEn: string; nameZh: string | null }
  createdBy: { nameEn: string }
  files: TaskFile[]
}

const card: React.CSSProperties = {
  background: 'var(--card)',
  border: '1px solid var(--border)',
  borderRadius: '0.75rem',
}

function fileUrl(storageKey: string, fileName: string) {
  const params = new URLSearchParams({ key: storageKey, filename: fileName, download: '1' })
  return `/api/files?${params.toString()}`
}

function fileSizeLabel(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export default function WorkTaskDetailPage() {
  const params = useParams<{ id: string }>()
  const [task, setTask] = useState<TaskDetail | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const id = params.id
    if (!id) return
    let cancelled = false
    fetch(`/api/admin/work-tasks/${id}`)
        .then(async res => {
          const json = await res.json().catch(() => ({}))
          if (!res.ok) throw new Error(json.error || '载入任务失败。')
          return json.task as TaskDetail
        })
        .then(next => {
          if (!cancelled) setTask(next)
        })
        .catch(cause => {
          if (!cancelled) setError(cause instanceof Error ? cause.message : '载入任务失败。')
        })
    return () => {
      cancelled = true
    }
  }, [params.id])

  const payload = task?.payload

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
      <div>
        <Link href="/admin/tasks" className="text-sm" style={{ color: 'var(--muted-foreground)' }}>工作任务</Link>
        <h1 className="mt-2 text-xl font-semibold" style={{ color: 'var(--foreground)' }}>
          {task ? TASK_TITLE[task.kind] : '工作任务'} {task?.taskNumber ?? ''}
        </h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--muted-foreground)' }}>
          {task ? TASK_NOTE[task.kind] : ''}
        </p>
      </div>

      {task ? <WorkTaskPlaybook kind={task.kind} /> : null}

      {error ? <p className="text-sm text-red-400">{error}</p> : null}

      {payload && task?.kind === 'COMPANY_NAME_CHANGE' ? (
        <section className="grid gap-2 p-5 text-sm" style={card}>
          <p>现有公司：{payload.companyNameZh || payload.companyNameEn || task.company.nameEn}</p>
          <p>公司编号：{payload.companyNo || '—'}</p>
          <p>新英文名称：{payload.newCompanyNameEn || '—'}</p>
          <p>新中文名称：{payload.newCompanyNameZh || '—'}</p>
          <p>决议日期：{payload.changeDate}</p>
          <p>股东：{(payload.shareholderNames ?? []).filter(Boolean).join('、') || '—'}</p>
          <p>NNC2 签署：{payload.signatoryName || '—'}（{payload.signatoryCapacity === 'COMPANY_SECRETARY' ? '公司秘书' : '董事'}）{payload.signatoryDate}</p>
          <p style={{ color: 'var(--muted-foreground)' }}>由 {task.createdBy.nameEn} 生成</p>
        </section>
      ) : null}

      {payload && task?.kind === 'SHARE_TRANSFER' ? (
        <section className="grid gap-2 p-5 text-sm" style={card}>
          <p>公司：{payload.companyNameZh || payload.companyNameEn || task?.company.nameEn}</p>
          <p>公司编号：{payload.companyNo || '—'}</p>
          <p>转让日期：{payload.transferDate}</p>
          <p>转出：{payload.transferor?.name}　转入：{payload.transferee?.name}</p>
          <p>股份：{payload.numberOfShares} {payload.shareClass}　代价：HK${payload.consideration}</p>
          <p>董事：{payload.directorName}</p>
          <p style={{ color: 'var(--muted-foreground)' }}>由 {task?.createdBy.nameEn} 生成</p>
        </section>
      ) : null}

      {payload && task && task.kind !== 'SHARE_TRANSFER' && task.kind !== 'COMPANY_NAME_CHANGE' ? (
        <section className="grid gap-2 p-5 text-sm" style={card}>
          <p>公司：{payload.companyNameZh || payload.companyNameEn || task.company.nameEn}</p>
          <p>公司编号：{payload.companyNo || '—'}</p>
          {task.kind === 'ACCOUNTING_REFERENCE_DATE' ? (
            <>
              <p>现行会计期终结：{payload.currentPeriodEnd || '—'}</p>
              <p>{payload.change === 'EXTEND' ? '延长' : '缩短'}至：{payload.newPeriodEnd || '—'}</p>
              <p>成员决议日期：{payload.resolutionDate || '—'}</p>
              <p>成员：{(payload.memberNames ?? []).filter(Boolean).join('、') || '—'}</p>
            </>
          ) : (
            <>
              <p>生效日期：{payload.effectiveDate || '—'}</p>
              <p>
                {task.kind === 'REGISTER_LOCATION' && payload.location === 'REGISTERED_OFFICE'
                  ? '改为备存于注册办事处'
                  : [payload.flat, payload.building, payload.street, payload.district].filter(Boolean).join('，') || '—'}
              </p>
            </>
          )}
          <p>签署：{payload.signatoryName || '—'} {payload.signatoryDate || ''}</p>
          <p style={{ color: 'var(--muted-foreground)' }}>由 {task.createdBy.nameEn} 生成</p>
        </section>
      ) : null}

      <section className="p-5" style={card}>
        <h2 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>下载文件</h2>
        <ul className="mt-3 flex flex-col gap-2">
          {(task?.files ?? []).map(file => {
            const doc = shareTransferDocument(file.templateKey)
            const label = FILE_LABEL[file.templateKey] ?? doc?.label ?? file.fileName
            return (
              <li key={file.id} className="flex items-center justify-between gap-3 text-sm">
                <span>
                  {label}
                  <span className="ml-2" style={{ color: 'var(--muted-foreground)' }}>{fileSizeLabel(file.fileSize)}</span>
                </span>
                <a href={fileUrl(file.storageKey, file.fileName)} className="shrink-0" style={{ color: '#3b82f6' }}>
                  下载
                </a>
              </li>
            )
          })}
        </ul>
      </section>
    </div>
  )
}
