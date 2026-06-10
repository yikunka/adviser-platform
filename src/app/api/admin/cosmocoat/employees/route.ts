import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { requireRole } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'
import { logAudit } from '@/lib/audit/logger'
import {
  generateEmployeeCode,
  serializeEmployee,
} from '@/lib/cosmocoat/employees'

const PAGE_SIZE = 20

const createSchema = z.object({
  code: z.string().trim().min(1).max(32).optional(),
  name: z.string().trim().min(1).max(200),
  employeeType: z.enum(['INTERNAL', 'SALES', 'PRODUCTION', 'TECHNICAL']),
  phone: z.string().trim().max(50).optional().nullable(),
  email: z.string().trim().max(200).optional().nullable(),
  position: z.string().trim().max(100).optional().nullable(),
  department: z.string().trim().max(100).optional().nullable(),
  hireDate: z.string().datetime().nullable().optional(),
  notes: z.string().trim().max(2000).optional().default(''),
  isActive: z.boolean().optional().default(true),
})

function nullableText(v: string | null | undefined) {
  const text = (v ?? '').trim()
  return text ? text : null
}

function isMissingTable(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2021'
}

export async function GET(req: NextRequest) {
  const { error } = await requireRole('STAFF', { adminMenu: 'cosmocoatEmployees' })
  if (error) return error

  const q = req.nextUrl.searchParams.get('q')?.trim() ?? ''
  const employeeType = req.nextUrl.searchParams.get('employeeType')?.trim() ?? ''
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
    where.employeeType = employeeType as Prisma.EnumCosEmployeeTypeFilter['equals']
  }
  if (activeOnly) where.isActive = true

  try {
    const [total, items] = await Promise.all([
      prisma.cosEmployee.count({ where }),
      prisma.cosEmployee.findMany({
        where,
        orderBy: [{ updatedAt: 'desc' }],
        skip,
        take: limit,
      }),
    ])

    return NextResponse.json({
      employees: items.map(item => serializeEmployee(item)),
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

  const body = await req.json().catch(() => null)
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  try {
    const code = parsed.data.code?.trim() || await generateEmployeeCode()
    const existing = await prisma.cosEmployee.findUnique({ where: { code } })
    if (existing) return NextResponse.json({ error: '员工编码已存在' }, { status: 409 })

    const employee = await prisma.cosEmployee.create({
      data: {
        code,
        name: parsed.data.name,
        employeeType: parsed.data.employeeType,
        phone: nullableText(parsed.data.phone),
        email: nullableText(parsed.data.email),
        position: nullableText(parsed.data.position),
        department: nullableText(parsed.data.department),
        hireDate: parsed.data.hireDate ? new Date(parsed.data.hireDate) : null,
        notes: parsed.data.notes ?? '',
        isActive: parsed.data.isActive ?? true,
        createdById: session!.user.id,
      },
    })

    await logAudit(session!.user.id, 'CREATE', 'CosEmployee', employee.id, null, employee)
    return NextResponse.json({ employee: serializeEmployee(employee) }, { status: 201 })
  } catch (err) {
    if (isMissingTable(err)) {
      return NextResponse.json({ error: '员工表不存在，请先运行数据库迁移' }, { status: 503 })
    }
    throw err
  }
}
