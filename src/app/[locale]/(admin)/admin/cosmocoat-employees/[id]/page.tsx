'use client'

/* eslint-disable react-hooks/set-state-in-effect */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import { Link, useRouter } from '@/i18n/navigation'
import { toast } from 'sonner'
import { ArrowLeft, Download, Eye, FileText, Save, Trash2, Upload } from 'lucide-react'
import { DatePickerPopover } from '@/components/ui/date-picker-popover'
import { resolveCosEmployeeBirthInfo } from '@/lib/cosmocoat/employee-birth-info'
import {
  extractBirthDateFromCosEmployeeIdCard,
  validateCosEmployeeIdCardNumber,
} from '@/lib/cosmocoat/employee-id-card'
import type { CosEmployeeFileRow, CosEmployeeRow } from '@/lib/cosmocoat/employees'
import { COS_EMPLOYEE_FILE_TYPE_LABELS, COS_EMPLOYEE_TYPE_LABELS } from '@/lib/cosmocoat/employee-labels'
import type { CosEmployeeFileType, CosEmployeeType } from '@prisma/client'

type FormState = {
  code: string
  name: string
  employeeType: CosEmployeeType
  phone: string
  email: string
  position: string
  department: string
  idCardNumber: string
  birthDate: string
  hireDate: string
  notes: string
  isActive: boolean
}

type PendingEmployeeFile = {
  file: File
  notes: string
}

const EMPLOYEE_FILE_SECTIONS: Array<{
  fileType: CosEmployeeFileType
  title: string
  hint: string
}> = [
  {
    fileType: 'LABOR_CONTRACT',
    title: '劳动合同',
    hint: '上传、查看与下载员工劳动合同',
  },
  {
    fileType: 'RESUME',
    title: '简历',
    hint: '上传、查看与下载员工简历',
  },
  {
    fileType: 'ID_CARD',
    title: '身份证',
    hint: '上传、查看与下载身份证照片或扫描件',
  },
]

const card: React.CSSProperties = {
  background: 'var(--card)',
  border: '1px solid var(--border)',
  borderRadius: '0.75rem',
}

function inputStyle(): React.CSSProperties {
  return {
    background: '#0E0E0A',
    border: '1px solid #2A2418',
    color: 'var(--foreground)',
  }
}

function Field({ label, hint, children, className = '' }: { label: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      <label className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>{label}</label>
      {hint && <p className="text-[11px]" style={{ color: '#756A58' }}>{hint}</p>}
      {children}
    </div>
  )
}

function fileUrl(storageKey: string, fileName?: string, download = false) {
  const params = new URLSearchParams({ key: storageKey })
  if (download) params.set('download', '1')
  if (fileName) params.set('filename', fileName)
  return `/api/files?${params.toString()}`
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

async function uploadEmployeeFileRequest(
  employeeId: string,
  fileType: CosEmployeeFileType,
  file: File,
  notes?: string,
) {
  const fd = new FormData()
  fd.append('file', file)
  fd.append('fileType', fileType)
  if (notes?.trim()) fd.append('notes', notes.trim())
  const res = await fetch(`/api/admin/cosmocoat/employees/${employeeId}/files`, {
    method: 'POST',
    body: fd,
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json.error ?? '上传失败')
}

function appendFormDataValue(
  formData: FormData,
  key: string,
  value: string | boolean | null | undefined,
) {
  if (value === undefined) return
  formData.append(key, value === null ? '' : String(value))
}

function PendingEmployeeFilesSection({
  fileType,
  title,
  hint,
  value,
  onChange,
}: {
  fileType: CosEmployeeFileType
  title: string
  hint: string
  value: PendingEmployeeFile | null
  onChange: (value: PendingEmployeeFile | null) => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)

  return (
    <div className="space-y-3 rounded-md p-4" style={{ background: '#0A0A0A', border: '1px solid #2A2418' }}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>{title}</h3>
          <p className="text-xs mt-1" style={{ color: 'var(--muted-foreground)' }}>{hint}</p>
        </div>
        <FileText size={16} style={{ color: '#C9A96E' }} />
      </div>

      <Field label="备注（可选）">
        <input
          value={value?.notes ?? ''}
          onChange={e => {
            if (!value) return
            onChange({ ...value, notes: e.target.value })
          }}
          disabled={!value}
          maxLength={500}
          placeholder="版本、生效日期等"
          className="w-full rounded-lg px-3 py-2 text-sm outline-none disabled:opacity-50"
          style={inputStyle()}
        />
      </Field>

      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp"
          className="hidden"
          onChange={e => {
            const file = e.target.files?.[0]
            if (!file) return
            onChange({ file, notes: value?.notes ?? '' })
          }}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs"
          style={{ border: '1px solid #2A2418', color: 'var(--foreground)' }}
        >
          <Upload size={13} />
          {value ? '更换文件' : '选择文件'}
        </button>
        {value && (
          <button
            type="button"
            onClick={() => {
              onChange(null)
              if (fileRef.current) fileRef.current.value = ''
            }}
            className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs"
            style={{ border: '1px solid #5A3030', color: '#E57373' }}
          >
            <Trash2 size={12} />
            移除
          </button>
        )}
        <span className="text-[11px]" style={{ color: '#756A58' }}>PDF、Word、JPG、PNG、WEBP，最大 10 MB</span>
      </div>

      <p className="text-xs" style={{ color: value ? 'var(--foreground)' : 'var(--muted-foreground)' }}>
        {value ? `已选择：${value.file.name}（随员工档案一并保存）` : `尚未选择${COS_EMPLOYEE_FILE_TYPE_LABELS[fileType]}文件`}
      </p>
    </div>
  )
}

function EmployeeFilesSection({
  employeeId,
  fileType,
  title,
  hint,
  files,
  onRefresh,
}: {
  employeeId: string
  fileType: CosEmployeeFileType
  title: string
  hint: string
  files: CosEmployeeFileRow[]
  onRefresh: () => void
}) {
  const [uploading, setUploading] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [notes, setNotes] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleUpload(fileList: FileList | null) {
    const file = fileList?.[0]
    if (!file) return
    setUploading(true)
    try {
      await uploadEmployeeFileRequest(employeeId, fileType, file, notes)
      toast.success('文件已上传')
      setNotes('')
      if (fileRef.current) fileRef.current.value = ''
      onRefresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '上传失败')
    } finally {
      setUploading(false)
    }
  }

  async function handleDelete(fileId: string) {
    if (!window.confirm('确定删除此文件？')) return
    setDeletingId(fileId)
    try {
      const res = await fetch(`/api/admin/cosmocoat/employees/${employeeId}/files/${fileId}`, { method: 'DELETE' })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error ?? '删除失败')
      toast.success('文件已删除')
      onRefresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '删除失败')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="space-y-3 rounded-md p-4" style={{ background: '#0A0A0A', border: '1px solid #2A2418' }}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>{title}</h3>
          <p className="text-xs mt-1" style={{ color: 'var(--muted-foreground)' }}>{hint}</p>
        </div>
        <FileText size={16} style={{ color: '#C9A96E' }} />
      </div>

      <div className="space-y-2">
        <Field label="备注（可选）">
          <input
            value={notes}
            onChange={e => setNotes(e.target.value)}
            maxLength={500}
            placeholder="版本、生效日期等"
            className="w-full rounded-lg px-3 py-2 text-sm outline-none"
            style={inputStyle()}
          />
        </Field>
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp"
            className="hidden"
            onChange={e => handleUpload(e.target.files)}
          />
          <button
            type="button"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs disabled:opacity-50"
            style={{ border: '1px solid #2A2418', color: 'var(--foreground)' }}
          >
            <Upload size={13} />
            {uploading ? '上传中...' : '上传文件'}
          </button>
          <span className="text-[11px]" style={{ color: '#756A58' }}>PDF、Word、JPG、PNG、WEBP，最大 10 MB</span>
        </div>
      </div>

      {files.length === 0 ? (
        <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>暂无{COS_EMPLOYEE_FILE_TYPE_LABELS[fileType]}文件</p>
      ) : (
        <div className="space-y-2">
          {files.map(file => (
            <div
              key={file.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md px-3 py-2"
              style={{ background: '#111108', border: '1px solid #1E1C15' }}
            >
              <div className="min-w-0">
                <div className="text-sm truncate" style={{ color: 'var(--foreground)' }}>{file.fileName}</div>
                <div className="text-[11px] mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                  {formatFileSize(file.fileSize)}
                  {file.notes ? ` · ${file.notes}` : ''}
                  {file.uploadedBy?.nameEn || file.uploadedBy?.email
                    ? ` · ${file.uploadedBy.nameEn ?? file.uploadedBy.email}`
                    : ''}
                  · {new Date(file.createdAt).toLocaleDateString('zh-HK')}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={fileUrl(file.storageKey, file.fileName)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs"
                  style={{ border: '1px solid #2A2418', color: '#C9A96E' }}
                >
                  <Eye size={12} /> 查看
                </a>
                <a
                  href={fileUrl(file.storageKey, file.fileName, true)}
                  download={file.fileName}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs"
                  style={{ border: '1px solid #2A2418', color: '#C9A96E' }}
                >
                  <Download size={12} /> 下载
                </a>
                <button
                  type="button"
                  disabled={deletingId === file.id}
                  onClick={() => handleDelete(file.id)}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs disabled:opacity-50"
                  style={{ border: '1px solid #5A3030', color: '#E57373' }}
                >
                  <Trash2 size={12} />
                  {deletingId === file.id ? '删除中' : '删除'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function AdminCosmoCoatEmployeeDetailPage() {
  const params = useParams()
  const router = useRouter()
  const employeeId = params.id as string
  const isNew = employeeId === 'new'

  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [employee, setEmployee] = useState<CosEmployeeRow | null>(null)
  const [pendingFiles, setPendingFiles] = useState<Record<CosEmployeeFileType, PendingEmployeeFile | null>>({
    LABOR_CONTRACT: null,
    RESUME: null,
    ID_CARD: null,
  })
  const [birthDateManuallyEdited, setBirthDateManuallyEdited] = useState(false)
  const [idCardError, setIdCardError] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>({
    code: '',
    name: '',
    employeeType: 'PRODUCTION',
    phone: '',
    email: '',
    position: '',
    department: '',
    idCardNumber: '',
    birthDate: '',
    hireDate: '',
    notes: '',
    isActive: true,
  })
  const birthInfo = resolveCosEmployeeBirthInfo(form.birthDate)
  const birthDateToYear = new Date().getFullYear()

  const fetchEmployee = useCallback(async () => {
    if (isNew) return
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/cosmocoat/employees/${employeeId}`)
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? '加载员工详情失败')
        return
      }
      const row = data.employee as CosEmployeeRow
      const savedBirthDate = row.birthDate ? row.birthDate.slice(0, 10) : ''
      const extractedBirthDate = extractBirthDateFromCosEmployeeIdCard(row.idCardNumber)
      setEmployee(row)
      setBirthDateManuallyEdited(
        Boolean(savedBirthDate && (!extractedBirthDate || savedBirthDate !== extractedBirthDate)),
      )
      setIdCardError(null)
      setForm({
        code: row.code,
        name: row.name,
        employeeType: row.employeeType,
        phone: row.phone ?? '',
        email: row.email ?? '',
        position: row.position ?? '',
        department: row.department ?? '',
        idCardNumber: row.idCardNumber ?? '',
        birthDate: row.birthDate ? row.birthDate.slice(0, 10) : '',
        hireDate: row.hireDate ? row.hireDate.slice(0, 10) : '',
        notes: row.notes ?? '',
        isActive: row.isActive,
      })
    } catch {
      toast.error('加载员工详情失败')
    } finally {
      setLoading(false)
    }
  }, [employeeId, isNew])

  useEffect(() => {
    fetchEmployee()
  }, [fetchEmployee])

  function patch<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  function handleIdCardNumberChange(value: string) {
    const normalized = value.trim().toUpperCase()
    setForm(prev => {
      const next = { ...prev, idCardNumber: normalized }
      if (!birthDateManuallyEdited) {
        const extractedBirthDate = extractBirthDateFromCosEmployeeIdCard(normalized)
        if (extractedBirthDate) next.birthDate = extractedBirthDate
      }
      return next
    })
    setIdCardError(normalized ? validateCosEmployeeIdCardNumber(normalized) : null)
  }

  function handleBirthDateChange(value: string) {
    setBirthDateManuallyEdited(true)
    patch('birthDate', value)
  }

  function patchPendingFile(fileType: CosEmployeeFileType, value: PendingEmployeeFile | null) {
    setPendingFiles(prev => ({ ...prev, [fileType]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) {
      toast.error('请填写员工姓名')
      return
    }

    const idCardValidationError = validateCosEmployeeIdCardNumber(form.idCardNumber)
    if (idCardValidationError) {
      setIdCardError(idCardValidationError)
      toast.error(idCardValidationError)
      return
    }

    setSaving(true)
    try {
      const payload = {
        code: form.code.trim() || undefined,
        name: form.name.trim(),
        employeeType: form.employeeType,
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        position: form.position.trim() || null,
        department: form.department.trim() || null,
        idCardNumber: form.idCardNumber.trim() || null,
        birthDate: form.birthDate ? new Date(form.birthDate).toISOString() : null,
        hireDate: form.hireDate ? new Date(form.hireDate).toISOString() : null,
        notes: form.notes.trim(),
        isActive: form.isActive,
      }

      const createFormData = isNew ? new FormData() : null
      if (createFormData) {
        for (const [key, value] of Object.entries(payload)) {
          appendFormDataValue(createFormData, key, value)
        }
        for (const section of EMPLOYEE_FILE_SECTIONS) {
          const pending = pendingFiles[section.fileType]
          if (!pending) continue
          createFormData.append(`file_${section.fileType}`, pending.file)
          if (pending.notes.trim()) createFormData.append(`notes_${section.fileType}`, pending.notes.trim())
        }
      }

      const res = await fetch(
        isNew ? '/api/admin/cosmocoat/employees' : `/api/admin/cosmocoat/employees/${employeeId}`,
        isNew
          ? {
              method: 'POST',
              body: createFormData!,
            }
          : {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
            },
      )
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? '保存失败')
        return
      }

      if (isNew) {
        const createdId = data.employee.id as string
        const hasFiles = EMPLOYEE_FILE_SECTIONS.some(section => pendingFiles[section.fileType])
        toast.success(hasFiles ? '员工已创建，文件已上传' : '员工已创建')
        router.push(`/admin/cosmocoat-employees/${createdId}`)
      } else {
        toast.success('员工资料已更新')
        setEmployee(data.employee)
      }
    } catch {
      toast.error('保存失败')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (isNew || !window.confirm(`确定删除员工「${form.name}」？此操作不可撤销。`)) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/admin/cosmocoat/employees/${employeeId}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? '删除失败')
        return
      }
      toast.success('员工已删除')
      router.push('/admin/cosmocoat-employees')
    } catch {
      toast.error('删除失败')
    } finally {
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <p style={{ color: 'var(--muted-foreground)' }}>加载中...</p>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/cosmocoat-employees"
            className="inline-flex items-center gap-1.5 text-sm"
            style={{ color: 'var(--muted-foreground)' }}
          >
            <ArrowLeft size={16} />
            返回列表
          </Link>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>
            {isNew ? '新建员工' : `员工详情 · ${employee?.code ?? form.code}`}
          </h1>
        </div>
        {!isNew && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm disabled:opacity-50"
            style={{ border: '1px solid #5A3030', color: '#E57373' }}
          >
            <Trash2 size={14} />
            {deleting ? '删除中...' : '删除员工'}
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="p-5 space-y-4" style={card}>
          <h2 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>基本信息</h2>

          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="员工编码" hint={isNew ? '留空则自动生成（如 YG0001）' : undefined}>
              <input
                value={form.code}
                onChange={e => patch('code', e.target.value)}
                maxLength={32}
                placeholder={isNew ? '自动生成' : undefined}
                className="w-full rounded-lg px-3 py-2.5 text-sm outline-none"
                style={inputStyle()}
              />
            </Field>
            <Field label="姓名 *">
              <input
                value={form.name}
                onChange={e => patch('name', e.target.value)}
                required
                maxLength={200}
                className="w-full rounded-lg px-3 py-2.5 text-sm outline-none"
                style={inputStyle()}
              />
            </Field>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="员工类型 *">
              <select
                value={form.employeeType}
                onChange={e => patch('employeeType', e.target.value as CosEmployeeType)}
                className="w-full rounded-lg px-3 py-2.5 text-sm outline-none"
                style={inputStyle()}
              >
                {(Object.keys(COS_EMPLOYEE_TYPE_LABELS) as CosEmployeeType[]).map(type => (
                  <option key={type} value={type}>{COS_EMPLOYEE_TYPE_LABELS[type]}</option>
                ))}
              </select>
            </Field>
            <Field label="状态">
              <select
                value={form.isActive ? 'active' : 'inactive'}
                onChange={e => patch('isActive', e.target.value === 'active')}
                className="w-full rounded-lg px-3 py-2.5 text-sm outline-none"
                style={inputStyle()}
              >
                <option value="active">在职</option>
                <option value="inactive">停用</option>
              </select>
            </Field>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="职位">
              <input
                value={form.position}
                onChange={e => patch('position', e.target.value)}
                maxLength={100}
                className="w-full rounded-lg px-3 py-2.5 text-sm outline-none"
                style={inputStyle()}
              />
            </Field>
            <Field label="部门">
              <input
                value={form.department}
                onChange={e => patch('department', e.target.value)}
                maxLength={100}
                className="w-full rounded-lg px-3 py-2.5 text-sm outline-none"
                style={inputStyle()}
              />
            </Field>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="电话">
              <input
                value={form.phone}
                onChange={e => patch('phone', e.target.value)}
                maxLength={50}
                className="w-full rounded-lg px-3 py-2.5 text-sm outline-none"
                style={inputStyle()}
              />
            </Field>
            <Field label="邮箱">
              <input
                value={form.email}
                onChange={e => patch('email', e.target.value)}
                maxLength={200}
                type="email"
                className="w-full rounded-lg px-3 py-2.5 text-sm outline-none"
                style={inputStyle()}
              />
            </Field>
          </div>

          <Field label="身份证号" hint="支持 15 位或 18 位；填写后自动提取出生日期并计算五行、生肖">
            <input
              value={form.idCardNumber}
              onChange={e => handleIdCardNumberChange(e.target.value)}
              maxLength={18}
              placeholder="请输入身份证号码"
              className="w-full rounded-lg px-3 py-2.5 text-sm outline-none"
              style={{
                ...inputStyle(),
                borderColor: idCardError ? '#5A3030' : '#2A2418',
              }}
            />
            {idCardError && (
              <p className="text-[11px]" style={{ color: '#E57373' }}>{idCardError}</p>
            )}
          </Field>

          <div className="grid sm:grid-cols-3 gap-4">
            <Field label="出生日期" hint={birthDateManuallyEdited ? '已手动修改，不再随身份证号自动更新' : '可由身份证号自动填充'}>
              <DatePickerPopover
                value={form.birthDate}
                onChange={handleBirthDateChange}
                placeholder="选择出生日期"
                toYear={birthDateToYear}
                className="w-full rounded-lg px-3 py-2.5 text-sm outline-none"
                style={inputStyle()}
              />
            </Field>
            <Field label="五行" hint="根据出生日主自动计算">
              <div
                className="w-full rounded-lg px-3 py-2.5 text-sm"
                style={{ ...inputStyle(), color: birthInfo ? 'var(--foreground)' : 'var(--muted-foreground)' }}
                aria-live="polite"
              >
                {birthInfo ? `${birthInfo.fiveElement}（${birthInfo.dayMaster}日主）` : '填写出生日期后显示'}
              </div>
            </Field>
            <Field label="生肖" hint="只读系统生成">
              <div
                className="w-full rounded-lg px-3 py-2.5 text-sm"
                style={{ ...inputStyle(), color: birthInfo ? 'var(--foreground)' : 'var(--muted-foreground)' }}
                aria-live="polite"
              >
                {birthInfo ? birthInfo.zodiac : '填写出生日期后显示'}
              </div>
            </Field>
          </div>

          <Field label="入职日期">
            <DatePickerPopover
              value={form.hireDate}
              onChange={value => patch('hireDate', value)}
              placeholder="选择入职日期"
              className="w-full rounded-lg px-3 py-2.5 text-sm outline-none"
              style={inputStyle()}
            />
          </Field>

          <Field label="备注">
            <textarea
              value={form.notes}
              onChange={e => patch('notes', e.target.value)}
              maxLength={2000}
              rows={3}
              className="w-full rounded-lg px-3 py-2.5 text-sm outline-none resize-y"
              style={inputStyle()}
            />
          </Field>
        </div>

        {isNew ? (
          <div className="p-5 space-y-4" style={card}>
            <div>
              <h2 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>文件资料</h2>
              <p className="text-xs mt-1" style={{ color: 'var(--muted-foreground)' }}>
                可先选择文件，创建员工时会与员工档案一并保存。
              </p>
            </div>
            {EMPLOYEE_FILE_SECTIONS.map(section => (
              <PendingEmployeeFilesSection
                key={section.fileType}
                fileType={section.fileType}
                title={section.title}
                hint={section.hint}
                value={pendingFiles[section.fileType]}
                onChange={value => patchPendingFile(section.fileType, value)}
              />
            ))}
          </div>
        ) : employee && (
          <div className="p-5 space-y-4" style={card}>
            <h2 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>文件资料</h2>
            <EmployeeFilesSection
              employeeId={employeeId}
              fileType="LABOR_CONTRACT"
              title="劳动合同"
              hint="上传、查看与下载员工劳动合同"
              files={employee.laborContracts ?? []}
              onRefresh={fetchEmployee}
            />
            <EmployeeFilesSection
              employeeId={employeeId}
              fileType="RESUME"
              title="简历"
              hint="上传、查看与下载员工简历"
              files={employee.resumes ?? []}
              onRefresh={fetchEmployee}
            />
            <EmployeeFilesSection
              employeeId={employeeId}
              fileType="ID_CARD"
              title="身份证"
              hint="上传、查看与下载身份证照片或扫描件"
              files={employee.idCards ?? []}
              onRefresh={fetchEmployee}
            />
          </div>
        )}

        {!isNew && employee && (
          <div className="p-5 space-y-2 text-xs" style={card}>
            <div style={{ color: 'var(--muted-foreground)' }}>
              创建时间：{new Date(employee.createdAt).toLocaleString('zh-HK')}
            </div>
            <div style={{ color: 'var(--muted-foreground)' }}>
              最后更新：{new Date(employee.updatedAt).toLocaleString('zh-HK')}
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Link
            href="/admin/cosmocoat-employees"
            className="px-4 py-2 rounded-lg text-sm"
            style={{ border: '1px solid #2A2418', color: 'var(--foreground)' }}
          >
            取消
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
            style={{ background: '#C9A96E', color: '#0A0805' }}
          >
            <Save size={14} />
            {saving ? '保存中...' : isNew ? '创建员工' : '保存更改'}
          </button>
        </div>
      </form>
    </div>
  )
}
