import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { requireRole } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'
import { logAudit } from '@/lib/audit/logger'
import { deleteCosEmployeeFile } from '@/lib/cosmocoat/employee-files'
import { getEmployeeById } from '@/lib/cosmocoat/employees'
import {
  extractBirthDateFromCosEmployeeIdCard,
  normalizeCosEmployeeIdCardNumber,
  validateCosEmployeeIdCardNumber,
} from '@/lib/cosmocoat/employee-id-card'

const patchSchema = z.object({
  code: z.string().trim().min(1).max(32).optional(),
  name: z.string().trim().min(1).max(200).optional(),
  employeeType: z.enum(['INTERNAL', 'SALES', 'PRODUCTION', 'TECHNICAL']).optional(),
  phone: z.string().trim().max(50).optional().nullable(),
  email: z.string().trim().max(200).optional().nullable(),
  position: z.string().trim().max(100).optional().nullable(),
  department: z.string().trim().max(100).optional().nullable(),
  idCardNumber: z.string().trim().max(18).optional().nullable(),
  birthDate: z.string().datetime().nullable().optional(),
  hireDate: z.string().datetime().nullable().optional(),
  notes: z.string().trim().max(2000).optional(),
  isActive: z.boolean().optional(),
})

function nullableText(v: string | null | undefined) {
  const text = (v ?? '').trim()
  return text ? text : null
}

function isMissingTable(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2021'
}

function dateOnly(value: Date | null) {
  return value?.toISOString().slice(0, 10) ?? null
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await requireRole('STAFF', { adminMenu: 'cosmocoatEmployees' })
  if (error) return error

  const { id } = await params
  try {
    const employee = await getEmployeeById(id)
    if (!employee) return NextResponse.json({ error: '员工不存在' }, { status: 404 })
    return NextResponse.json({ employee })
  } catch (err) {
    if (isMissingTable(err)) {
      return NextResponse.json({ error: '员工表不存在，请先运行数据库迁移' }, { status: 503 })
    }
    throw err
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, error } = await requireRole('STAFF', { adminMenu: 'cosmocoatEmployees' })
  if (error) return error

  const { id } = await params
  const body = await req.json().catch(() => null)
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  const current = await prisma.cosEmployee.findUnique({ where: { id } })
  if (!current) return NextResponse.json({ error: '员工不存在' }, { status: 404 })

  if (parsed.data.code && parsed.data.code !== current.code) {
    const dup = await prisma.cosEmployee.findUnique({ where: { code: parsed.data.code } })
    if (dup) return NextResponse.json({ error: '员工编码已存在' }, { status: 409 })
  }

  if (parsed.data.idCardNumber !== undefined) {
    const idCardError = validateCosEmployeeIdCardNumber(parsed.data.idCardNumber)
    if (idCardError) return NextResponse.json({ error: idCardError }, { status: 400 })
  }

  const normalizedIdCardNumber = parsed.data.idCardNumber !== undefined
    ? normalizeCosEmployeeIdCardNumber(parsed.data.idCardNumber)
    : undefined
  const birthDateFromUpdatedIdCard = normalizedIdCardNumber !== undefined
    ? extractBirthDateFromCosEmployeeIdCard(normalizedIdCardNumber)
    : null
  const currentBirthDate = dateOnly(current.birthDate)
  const currentBirthDateFromIdCard = extractBirthDateFromCosEmployeeIdCard(current.idCardNumber)
  const shouldAutoUpdateBirthDate = parsed.data.birthDate === undefined
    && birthDateFromUpdatedIdCard
    && (!currentBirthDate || currentBirthDate === currentBirthDateFromIdCard)
  const birthDateUpdate = parsed.data.birthDate !== undefined
    ? (parsed.data.birthDate ? new Date(parsed.data.birthDate) : null)
    : (shouldAutoUpdateBirthDate ? new Date(birthDateFromUpdatedIdCard) : undefined)

  try {
    const updated = await prisma.cosEmployee.update({
      where: { id },
      data: {
        code: parsed.data.code,
        name: parsed.data.name,
        employeeType: parsed.data.employeeType,
        phone: parsed.data.phone !== undefined ? nullableText(parsed.data.phone) : undefined,
        email: parsed.data.email !== undefined ? nullableText(parsed.data.email) : undefined,
        position: parsed.data.position !== undefined ? nullableText(parsed.data.position) : undefined,
        department: parsed.data.department !== undefined ? nullableText(parsed.data.department) : undefined,
        idCardNumber: normalizedIdCardNumber,
        birthDate: birthDateUpdate,
        hireDate: parsed.data.hireDate !== undefined
          ? (parsed.data.hireDate ? new Date(parsed.data.hireDate) : null)
          : undefined,
        notes: parsed.data.notes,
        isActive: parsed.data.isActive,
      },
    })

    await logAudit(session!.user.id, 'UPDATE', 'CosEmployee', id, current, updated)
    const employee = await getEmployeeById(id)
    return NextResponse.json({ employee })
  } catch (err) {
    if (isMissingTable(err)) {
      return NextResponse.json({ error: '员工表不存在，请先运行数据库迁移' }, { status: 503 })
    }
    throw err
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, error } = await requireRole('STAFF', { adminMenu: 'cosmocoatEmployees' })
  if (error) return error

  const { id } = await params
  const current = await prisma.cosEmployee.findUnique({
    where: { id },
    include: { files: { select: { storageKey: true } } },
  })
  if (!current) return NextResponse.json({ error: '员工不存在' }, { status: 404 })

  const linkedOrders = await prisma.cosTableProductionOrder.count({
    where: { productionEmployeeId: id },
  })
  if (linkedOrders > 0) {
    return NextResponse.json({ error: '该员工已关联生产单，无法删除' }, { status: 409 })
  }

  for (const file of current.files) {
    await deleteCosEmployeeFile(file.storageKey)
  }

  await prisma.cosEmployee.delete({ where: { id } })
  await logAudit(session!.user.id, 'DELETE', 'CosEmployee', id, current, null)
  return NextResponse.json({ success: true })
}
