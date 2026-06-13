import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { Prisma, type CosEmployeeFileType, type CosEmployeeType } from '@prisma/client'
import { requireRole } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'
import { logAudit } from '@/lib/audit/logger'
import {
  generateEmployeeCode,
  getEmployeeById,
  serializeEmployee,
} from '@/lib/cosmocoat/employees'
import { COS_EMPLOYEE_FIVE_ELEMENTS, employeeMatchesFiveElement } from '@/lib/cosmocoat/employee-filters'
import { deleteCosEmployeeFile, uploadCosEmployeeFile, validateCosEmployeeFile } from '@/lib/cosmocoat/employee-files'
import {
  extractBirthDateFromCosEmployeeIdCard,
  normalizeCosEmployeeIdCardNumber,
  validateCosEmployeeIdCardNumber,
} from '@/lib/cosmocoat/employee-id-card'
import { getOssConfigError } from '@/lib/storage/r2'

const PAGE_SIZE = 20
const FILE_TYPES: CosEmployeeFileType[] = ['LABOR_CONTRACT', 'RESUME', 'ID_CARD']

const FILE_TYPE_LABELS: Record<CosEmployeeFileType, string> = {
  LABOR_CONTRACT: '劳动合同',
  RESUME: '简历',
  ID_CARD: '身份证',
}

const createSchema = z.object({
  code: z.string().trim().min(1).max(32).optional(),
  name: z.string().trim().min(1).max(200),
  employeeType: z.enum(['INTERNAL', 'SALES', 'PRODUCTION', 'TECHNICAL']),
  phone: z.string().trim().max(50).optional().nullable(),
  email: z.string().trim().max(200).optional().nullable(),
  position: z.string().trim().max(100).optional().nullable(),
  department: z.string().trim().max(100).optional().nullable(),
  idCardNumber: z.string().trim().max(18).optional().nullable(),
  birthDate: z.string().datetime().nullable().optional(),
  hireDate: z.string().datetime().nullable().optional(),
  notes: z.string().trim().max(2000).optional().default(''),
  isActive: z.boolean().optional().default(true),
})

type PendingEmployeeFileUpload = {
  fileType: CosEmployeeFileType
  file: File
  notes: string | null
}

function nullableText(v: string | null | undefined) {
  const text = (v ?? '').trim()
  return text ? text : null
}

function formString(formData: FormData, key: string) {
  const value = formData.get(key)
  return typeof value === 'string' ? value : undefined
}

function formBoolean(formData: FormData, key: string, fallback: boolean) {
  const value = formString(formData, key)?.trim().toLowerCase()
  if (!value) return fallback
  return !['0', 'false', 'no', 'off'].includes(value)
}

function isUploadedFile(value: FormDataEntryValue | null): value is File {
  if (!value || typeof value !== 'object') return false
  const file = value as File
  return typeof file.name === 'string'
    && typeof file.size === 'number'
    && file.size > 0
    && typeof file.arrayBuffer === 'function'
}

function parseCreateFormData(formData: FormData) {
  const pendingFiles = FILE_TYPES.flatMap((fileType): PendingEmployeeFileUpload[] => {
    const file = formData.get(`file_${fileType}`)
    if (!isUploadedFile(file)) return []
    return [{
      fileType,
      file,
      notes: formString(formData, `notes_${fileType}`)?.trim() || null,
    }]
  })

  return {
    body: {
      code: formString(formData, 'code') || undefined,
      name: formString(formData, 'name') ?? '',
      employeeType: formString(formData, 'employeeType') ?? '',
      phone: formString(formData, 'phone') ?? null,
      email: formString(formData, 'email') ?? null,
      position: formString(formData, 'position') ?? null,
      department: formString(formData, 'department') ?? null,
      idCardNumber: formString(formData, 'idCardNumber') ?? null,
      birthDate: formString(formData, 'birthDate') || null,
      hireDate: formString(formData, 'hireDate') || null,
      notes: formString(formData, 'notes') ?? '',
      isActive: formBoolean(formData, 'isActive', true),
    },
    pendingFiles,
  }
}

function isMissingTable(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2021'
}

function isDuplicateCode(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002'
}

function uploadErrorStatus(message: string) {
  if (message.includes('OSS') || message.includes('storage')) return 503
  if (message.includes('不支持') || message.includes('过大')) return 400
  return 500
}

export async function GET(req: NextRequest) {
  const { error } = await requireRole('STAFF', { adminMenu: 'cosmocoatEmployees' })
  if (error) return error

  const q = req.nextUrl.searchParams.get('q')?.trim() ?? ''
  const employeeType = req.nextUrl.searchParams.get('employeeType')?.trim() ?? ''
  const fiveElement = req.nextUrl.searchParams.get('fiveElement')?.trim() ?? ''
  const status = req.nextUrl.searchParams.get('status')?.trim() ?? ''
  const activeOnly = req.nextUrl.searchParams.get('activeOnly') === 'true'
  const page = Math.max(1, Number(req.nextUrl.searchParams.get('page') ?? '1') || 1)
  const limit = Math.min(200, Math.max(1, Number(req.nextUrl.searchParams.get('limit') ?? String(PAGE_SIZE)) || PAGE_SIZE))
  const skip = (page - 1) * limit

  const where: Prisma.CosEmployeeWhereInput = {}
  if (q) {
    where.OR = [
      { code: { contains: q, mode: 'insensitive' } },
      { name: { contains: q, mode: 'insensitive' } },
      { phone: { contains: q, mode: 'insensitive' } },
      { email: { contains: q, mode: 'insensitive' } },
      { position: { contains: q, mode: 'insensitive' } },
      { department: { contains: q, mode: 'insensitive' } },
    ]
  }
  if (employeeType && ['INTERNAL', 'SALES', 'PRODUCTION', 'TECHNICAL'].includes(employeeType)) {
    where.employeeType = employeeType as CosEmployeeType
  }
  if (status === 'active') {
    where.isActive = true
  } else if (status === 'inactive') {
    where.isActive = false
  } else if (activeOnly) {
    where.isActive = true
  }

  const normalizedFiveElement = COS_EMPLOYEE_FIVE_ELEMENTS.includes(fiveElement as typeof COS_EMPLOYEE_FIVE_ELEMENTS[number])
    ? fiveElement
    : ''

  try {
    const rows = await prisma.cosEmployee.findMany({
      where,
      orderBy: [{ updatedAt: 'desc' }],
    })

    const filtered = rows
      .map(item => serializeEmployee(item))
      .filter(item => employeeMatchesFiveElement(item, normalizedFiveElement))
    const total = filtered.length
    const items = filtered.slice(skip, skip + limit)

    return NextResponse.json({
      employees: items,
      total,
      page,
      pageSize: limit,
      totalPages: Math.ceil(total / limit),
    })
  } catch (err) {
    if (isMissingTable(err)) {
      return NextResponse.json({ error: '员工表不存在，请先运行数据库迁移' }, { status: 503 })
    }
    throw err
  }
}

export async function POST(req: NextRequest) {
  const { session, error } = await requireRole('STAFF', { adminMenu: 'cosmocoatEmployees' })
  if (error) return error

  const isMultipart = (req.headers.get('content-type') ?? '').toLowerCase().includes('multipart/form-data')
  const pendingFiles: PendingEmployeeFileUpload[] = []
  let body: unknown

  if (isMultipart) {
    const formData = await req.formData().catch(() => null)
    if (!formData) return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
    const parsedForm = parseCreateFormData(formData)
    body = parsedForm.body
    pendingFiles.push(...parsedForm.pendingFiles)
  } else {
    body = await req.json().catch(() => null)
  }

  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  const idCardError = validateCosEmployeeIdCardNumber(parsed.data.idCardNumber)
  if (idCardError) return NextResponse.json({ error: idCardError }, { status: 400 })

  for (const pending of pendingFiles) {
    const validationError = validateCosEmployeeFile(pending.file)
    if (validationError) {
      return NextResponse.json(
        { error: `${FILE_TYPE_LABELS[pending.fileType]}：${validationError}` },
        { status: 400 },
      )
    }
  }

  if (pendingFiles.length > 0) {
    const ossError = getOssConfigError()
    if (ossError) return NextResponse.json({ error: ossError }, { status: 503 })
  }

  let employeeIdForCleanup: string | null = null
  let shouldCleanupEmployee = false
  const uploadedKeys: string[] = []

  try {
    const code = parsed.data.code?.trim() || await generateEmployeeCode()
    const existing = await prisma.cosEmployee.findUnique({ where: { code } })
    if (existing) return NextResponse.json({ error: '员工编码已存在' }, { status: 409 })

    const normalizedIdCardNumber = normalizeCosEmployeeIdCardNumber(parsed.data.idCardNumber)
    const birthDateFromIdCard = extractBirthDateFromCosEmployeeIdCard(normalizedIdCardNumber)
    const resolvedBirthDate = parsed.data.birthDate
      ? new Date(parsed.data.birthDate)
      : (birthDateFromIdCard ? new Date(birthDateFromIdCard) : null)

    const employee = await prisma.cosEmployee.create({
      data: {
        code,
        name: parsed.data.name,
        employeeType: parsed.data.employeeType,
        phone: nullableText(parsed.data.phone),
        email: nullableText(parsed.data.email),
        position: nullableText(parsed.data.position),
        department: nullableText(parsed.data.department),
        idCardNumber: normalizedIdCardNumber,
        birthDate: resolvedBirthDate,
        hireDate: parsed.data.hireDate ? new Date(parsed.data.hireDate) : null,
        notes: parsed.data.notes ?? '',
        isActive: parsed.data.isActive ?? true,
        createdById: session!.user.id,
      },
    })

    employeeIdForCleanup = employee.id
    shouldCleanupEmployee = pendingFiles.length > 0
    const fileRecords = []

    for (const pending of pendingFiles) {
      const { key, contentType } = await uploadCosEmployeeFile(employee.id, pending.fileType, pending.file)
      uploadedKeys.push(key)
      const record = await prisma.cosEmployeeFile.create({
        data: {
          employeeId: employee.id,
          fileType: pending.fileType,
          fileName: pending.file.name,
          storageKey: key,
          mimeType: contentType,
          fileSize: pending.file.size,
          notes: pending.notes,
          uploadedById: session!.user.id,
        },
      })
      fileRecords.push(record)
    }

    shouldCleanupEmployee = false
    await logAudit(session!.user.id, 'CREATE', 'CosEmployee', employee.id, null, employee)
    for (const record of fileRecords) {
      await logAudit(session!.user.id, 'CREATE', 'CosEmployeeFile', record.id, null, record)
    }

    const created = pendingFiles.length > 0 ? await getEmployeeById(employee.id) : null
    return NextResponse.json({ employee: created ?? serializeEmployee(employee) }, { status: 201 })
  } catch (err) {
    if (shouldCleanupEmployee && employeeIdForCleanup) {
      await Promise.all(uploadedKeys.map(key => deleteCosEmployeeFile(key)))
      await prisma.cosEmployee.delete({ where: { id: employeeIdForCleanup } }).catch(cleanupErr => {
        console.warn(`Failed to clean up employee ${employeeIdForCleanup} after file upload failure:`, cleanupErr)
      })
    }

    if (isMissingTable(err)) {
      return NextResponse.json({ error: '员工表不存在，请先运行数据库迁移' }, { status: 503 })
    }
    if (isDuplicateCode(err)) {
      return NextResponse.json({ error: '员工编码已存在' }, { status: 409 })
    }
    if (shouldCleanupEmployee) {
      const message = err instanceof Error ? err.message : '文件上传失败'
      return NextResponse.json({ error: message }, { status: uploadErrorStatus(message) })
    }
    throw err
  }
}
