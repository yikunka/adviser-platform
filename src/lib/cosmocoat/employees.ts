import type { CosEmployeeFileType, CosEmployeeType } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'
export { COS_EMPLOYEE_FILE_TYPE_LABELS, COS_EMPLOYEE_TYPE_LABELS } from '@/lib/cosmocoat/employee-labels'

export type CosEmployeeFileRow = {
  id: string
  fileType: CosEmployeeFileType
  fileName: string
  storageKey: string
  mimeType: string
  fileSize: number
  notes: string | null
  createdAt: string
  uploadedBy: { nameEn: string | null; email: string }
}

export type CosEmployeeRow = {
  id: string
  code: string
  name: string
  employeeType: CosEmployeeType
  phone: string | null
  email: string | null
  position: string | null
  department: string | null
  hireDate: string | null
  notes: string
  isActive: boolean
  createdById: string | null
  createdAt: string
  updatedAt: string
  laborContracts?: CosEmployeeFileRow[]
  resumes?: CosEmployeeFileRow[]
  idCards?: CosEmployeeFileRow[]
}

const fileSelect = {
  id: true,
  fileType: true,
  fileName: true,
  storageKey: true,
  mimeType: true,
  fileSize: true,
  notes: true,
  createdAt: true,
  uploadedBy: { select: { nameEn: true, email: true } },
} as const

const employeeInclude = {
  files: {
    orderBy: { createdAt: 'desc' as const },
    select: fileSelect,
  },
} as const

function serializeFile(file: {
  id: string
  fileType: CosEmployeeFileType
  fileName: string
  storageKey: string
  mimeType: string
  fileSize: number
  notes: string | null
  createdAt: Date
  uploadedBy: { nameEn: string | null; email: string }
}): CosEmployeeFileRow {
  return {
    ...file,
    createdAt: file.createdAt.toISOString(),
  }
}

export function serializeEmployee(
  employee: {
    id: string
    code: string
    name: string
    employeeType: CosEmployeeType
    phone: string | null
    email: string | null
    position: string | null
    department: string | null
    hireDate: Date | null
    notes: string
    isActive: boolean
    createdById: string | null
    createdAt: Date
    updatedAt: Date
    files?: Array<{
      id: string
      fileType: CosEmployeeFileType
      fileName: string
      storageKey: string
      mimeType: string
      fileSize: number
      notes: string | null
      createdAt: Date
      uploadedBy: { nameEn: string | null; email: string }
    }>
  },
  options?: { includeFiles?: boolean },
): CosEmployeeRow {
  const row: CosEmployeeRow = {
    id: employee.id,
    code: employee.code,
    name: employee.name,
    employeeType: employee.employeeType,
    phone: employee.phone,
    email: employee.email,
    position: employee.position,
    department: employee.department,
    hireDate: employee.hireDate?.toISOString() ?? null,
    notes: employee.notes,
    isActive: employee.isActive,
    createdById: employee.createdById,
    createdAt: employee.createdAt.toISOString(),
    updatedAt: employee.updatedAt.toISOString(),
  }
  if (options?.includeFiles) {
    const files = employee.files ?? []
    row.laborContracts = files
      .filter(f => f.fileType === 'LABOR_CONTRACT')
      .map(serializeFile)
    row.resumes = files
      .filter(f => f.fileType === 'RESUME')
      .map(serializeFile)
    row.idCards = files
      .filter(f => f.fileType === 'ID_CARD')
      .map(serializeFile)
  }
  return row
}

export async function getEmployeeById(id: string) {
  const employee = await prisma.cosEmployee.findUnique({
    where: { id },
    include: employeeInclude,
  })
  if (!employee) return null
  return serializeEmployee(employee, { includeFiles: true })
}

export async function generateEmployeeCode(): Promise<string> {
  const latest = await prisma.cosEmployee.findFirst({
    where: { code: { startsWith: 'YG' } },
    orderBy: { code: 'desc' },
    select: { code: true },
  })

  if (!latest?.code) return 'YG0001'

  const match = latest.code.match(/^YG(\d+)$/)
  if (match) {
    const lastNumber = parseInt(match[1], 10)
    return `YG${String(lastNumber + 1).padStart(4, '0')}`
  }

  return 'YG0001'
}

export { employeeInclude }
