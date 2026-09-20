'use client'

/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useState } from 'react'
import { Link } from '@/i18n/navigation'

type TaskRow = {
  id: string
  taskNumber: string
  createdAt: string
  company: { id: string; nameEn: string; nameZh: string | null }
  fileCount: number
  transferDate: string
  transferorName: string
  transfereeName: string
  numberOfShares: number | null
}

type RecordRow = {
  id: string
  taskNumber: string
  kind: string
  company: { id: string; nameEn: string; nameZh: string | null }
  summary: string
  effectiveDate: string
}

const RECORD_LABEL: Record<string, string> = {
  REGISTERED_OFFICE_ADDRESS: '公司注册/营业地址',
  REGISTER_LOCATION: '登记册备存地点',
  ACCOUNTING_REFERENCE_DATE: '会计参照日',
}

type NameChangeRow = {
  id: string
  taskNumber: string
  company: { id: string; nameEn: string; nameZh: string | null }
  changeDate: string
  newCompanyNameEn: string
  newCompanyNameZh: string
}

const card: React.CSSProperties = {
  background: 'var(--card)',
  border: '1px solid var(--border)',
  borderRadius: '0.75rem',
}

export default function WorkTasksPage() {
  const [tasks, setTasks] = useState<TaskRow[]>([])
  const [nameChanges, setNameChanges] = useState<NameChangeRow[]>([])
  const [records, setRecords] = useState<RecordRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    fetch('/api/admin/work-tasks')
      .then(async res => {
        const json = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(json.error || '载入任务失败。')
        return json
      })
      .then(json => {
        if (!cancelled) setTasks(Array.isArray(json.tasks) ? json.tasks : [])
      })
      .catch(cause => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : '载入任务失败。')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    fetch('/api/admin/work-tasks?kind=COMPANY_NAME_CHANGE')
      .then(async res => {
        const json = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(json.error || '载入任务失败。')
        return json
      })
      .then(json => {
        if (!cancelled) setNameChanges(Array.isArray(json.tasks) ? json.tasks : [])
      })
      .catch(cause => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : '载入任务失败。')
      })
    fetch('/api/admin/work-tasks?kind=COMPANY_RECORD')
      .then(async res => {
        const json = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(json.error || '载入任务失败。')
        return json
      })
      .then(json => {
        if (!cancelled) setRecords(Array.isArray(json.tasks) ? json.tasks : [])
      })
      .catch(cause => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : '载入任务失败。')
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 p-6">
      <div>
        <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>请选择任务类型</h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--muted-foreground)' }}>
          点蓝色任务，填写资料后生成文件，下载再交到政府部门。文件只存在这项任务里。
        </p>
      </div>

      <section className="p-5" style={card}>
        <h2 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>成员/股东的变更</h2>
        <Link
          href="/admin/tasks/share-transfer"
          className="mt-3 inline-block text-sm font-medium"
          style={{ color: '#3b82f6' }}
        >
          股份转让
        </Link>
      </section>

      <section className="p-5" style={card}>
        <h2 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>公司资料的变更</h2>
        <Link
          href="/admin/tasks/company-name-change"
          className="mt-3 block text-sm font-medium"
          style={{ color: '#3b82f6' }}
        >
          公司/营业名称
        </Link>
        <Link href="/admin/tasks/registered-office" className="mt-2 block text-sm font-medium" style={{ color: '#3b82f6' }}>
          公司注册/营业地址
        </Link>
        <Link href="/admin/tasks/register-location" className="mt-2 block text-sm font-medium" style={{ color: '#3b82f6' }}>
          登记册备存地点
        </Link>
        <Link href="/admin/tasks/accounting-reference-date" className="mt-2 block text-sm font-medium" style={{ color: '#3b82f6' }}>
          会计参照日
        </Link>
      </section>

      <section className="p-5" style={card}>
        <h2 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>已生成的股份转让</h2>
        {loading ? <p className="mt-3 text-sm" style={{ color: 'var(--muted-foreground)' }}>载入中…</p> : null}
        {error ? <p className="mt-3 text-sm text-red-400">{error}</p> : null}
        {!loading && !error && tasks.length === 0 ? (
          <p className="mt-3 text-sm" style={{ color: 'var(--muted-foreground)' }}>还没有生成过。</p>
        ) : null}
        {tasks.length > 0 ? (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr style={{ color: 'var(--muted-foreground)' }}>
                  <th className="py-2 pr-3 font-medium">编号</th>
                  <th className="py-2 pr-3 font-medium">公司</th>
                  <th className="py-2 pr-3 font-medium">转出</th>
                  <th className="py-2 pr-3 font-medium">转入</th>
                  <th className="py-2 pr-3 font-medium">日期</th>
                  <th className="py-2 font-medium"> </th>
                </tr>
              </thead>
              <tbody>
                {tasks.map(task => (
                  <tr key={task.id} style={{ borderTop: '1px solid var(--border)' }}>
                    <td className="py-2 pr-3 font-mono text-xs" style={{ color: 'var(--muted-foreground)' }}>{task.taskNumber}</td>
                    <td className="py-2 pr-3">{task.company.nameZh || task.company.nameEn}</td>
                    <td className="py-2 pr-3">{task.transferorName}</td>
                    <td className="py-2 pr-3">{task.transfereeName}</td>
                    <td className="py-2 pr-3 whitespace-nowrap">{task.transferDate}</td>
                    <td className="py-2 text-right">
                      <Link href={`/admin/tasks/${task.id}`} className="text-sm" style={{ color: '#3b82f6' }}>查看</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>

      <section className="p-5" style={card}>
        <h2 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>已生成的公司名称变更</h2>
        {!loading && !error && nameChanges.length === 0 ? (
          <p className="mt-3 text-sm" style={{ color: 'var(--muted-foreground)' }}>还没有生成过。</p>
        ) : null}
        {nameChanges.length > 0 ? (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr style={{ color: 'var(--muted-foreground)' }}>
                  <th className="py-2 pr-3 font-medium">编号</th>
                  <th className="py-2 pr-3 font-medium">现有公司</th>
                  <th className="py-2 pr-3 font-medium">新名称</th>
                  <th className="py-2 pr-3 font-medium">日期</th>
                  <th className="py-2 font-medium"> </th>
                </tr>
              </thead>
              <tbody>
                {nameChanges.map(task => (
                  <tr key={task.id} style={{ borderTop: '1px solid var(--border)' }}>
                    <td className="py-2 pr-3 font-mono text-xs" style={{ color: 'var(--muted-foreground)' }}>{task.taskNumber}</td>
                    <td className="py-2 pr-3">{task.company.nameZh || task.company.nameEn}</td>
                    <td className="py-2 pr-3">{task.newCompanyNameZh || task.newCompanyNameEn}</td>
                    <td className="py-2 pr-3 whitespace-nowrap">{task.changeDate}</td>
                    <td className="py-2 text-right">
                      <Link href={`/admin/tasks/${task.id}`} className="text-sm" style={{ color: '#3b82f6' }}>查看</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>

      <section className="p-5" style={card}>
        <h2 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>已生成的地址、登记册及会计参照日</h2>
        {!loading && !error && records.length === 0 ? (
          <p className="mt-3 text-sm" style={{ color: 'var(--muted-foreground)' }}>还没有生成过。</p>
        ) : null}
        {records.length > 0 ? (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr style={{ color: 'var(--muted-foreground)' }}>
                  <th className="py-2 pr-3 font-medium">编号</th>
                  <th className="py-2 pr-3 font-medium">任务</th>
                  <th className="py-2 pr-3 font-medium">公司</th>
                  <th className="py-2 pr-3 font-medium">内容</th>
                  <th className="py-2 font-medium"> </th>
                </tr>
              </thead>
              <tbody>
                {records.map(task => (
                  <tr key={task.id} style={{ borderTop: '1px solid var(--border)' }}>
                    <td className="py-2 pr-3 font-mono text-xs" style={{ color: 'var(--muted-foreground)' }}>{task.taskNumber}</td>
                    <td className="py-2 pr-3">{RECORD_LABEL[task.kind] ?? task.kind}</td>
                    <td className="py-2 pr-3">{task.company.nameZh || task.company.nameEn}</td>
                    <td className="py-2 pr-3">{task.summary || task.effectiveDate}</td>
                    <td className="py-2 text-right">
                      <Link href={`/admin/tasks/${task.id}`} className="text-sm" style={{ color: '#3b82f6' }}>查看</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
    </div>
  )
}
