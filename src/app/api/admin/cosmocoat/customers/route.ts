import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { requireRole } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'
import { logAudit } from '@/lib/audit/logger'
import {
  customerInclude,
  generateCustomerCode,
  serializeCustomer,
} from '@/lib/cosmocoat/customers'

const PAGE_SIZE = 20

const createSchema = z.object({
  code: z.string().trim().min(1).max(32).optional(),
  name: z.string().trim().min(1).max(200),
  userId: z.union([z.string().trim().min(1), z.literal(''), z.null()]).optional(),
  salesEmployeeId: z.union([z.string().trim().min(1), z.literal(''), z.null()]).optional(),
  technicalEmployeeId: z.union([z.string().trim().min(1), z.literal(''), z.null()]).optional(),
  phone: z.string().trim().max(50).optional().nullable(),
  contactPerson: z.string().trim().max(200).optional().nullable(),
  contactPhone: z.string().trim().max(50).optional().nullable(),
  address: z.string().trim().max(500).optional().nullable(),
  productionEquipmentParams: z.string().trim().max(5000).optional().nullable(),
})

function nullableText(v: string | null | undefined) {
  const text = (v ?? '').trim()
  return text ? text : null
}

function isMissingTable(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2021'
}

async function validateUserId(userId: string | null | undefined) {
  const id = nullableText(userId ?? null)
  if (!id) return null

  const user = await prisma.user.findFirst({
    where: { id, role: 'CLIENT', platform: 'COSMICOAT' },
    select: { id: true },
  })
  if (!user) throw new Error('COSMICOAT_USER_NOT_FOUND')

  const bound = await prisma.cosCustomer.findUnique({ where: { userId: id }, select: { id: true } })
  if (bound) throw new Error('USER_ALREADY_BOUND')

  return id
}

async function validateEmployeeId(employeeId: string | null | undefined, employeeType: 'SALES' | 'TECHNICAL') {
  const id = nullableText(employeeId ?? null)
  if (!id) return null

  const employee = await prisma.cosEmployee.findFirst({
    where: { id, employeeType },
    select: { id: true },
  })
  if (!employee) throw new Error(employeeType === 'SALES' ? 'SALES_EMPLOYEE_NOT_FOUND' : 'TECHNICAL_EMPLOYEE_NOT_FOUND')

  return id
}

export async function GET(req: NextRequest) {
  const { error } = await requireRole('STAFF', { adminMenu: 'cosmocoatCustomers' })
  if (error) return error

  const q = req.nextUrl.searchParams.get('q')?.trim() ?? ''
  const all = req.nextUrl.searchParams.get('all') === '1'
  const page = Math.max(1, Number(req.nextUrl.searchParams.get('page') ?? '1') || 1)
  const skip = (page - 1) * PAGE_SIZE

  const where: Prisma.CosCustomerWhereInput = q
    ? {
        OR: [
          { code: { contains: q, mode: 'insensitive' } },
          { name: { contains: q, mode: 'insensitive' } },
          { phone: { contains: q, mode: 'insensitive' } },
          { contactPerson: { contains: q, mode: 'insensitive' } },
          { contactPhone: { contains: q, mode: 'insensitive' } },
          { address: { contains: q, mode: 'insensitive' } },
          { salesEmployee: { name: { contains: q, mode: 'insensitive' } } },
          { salesEmployee: { code: { contains: q, mode: 'insensitive' } } },
          { technicalEmployee: { name: { contains: q, mode: 'insensitive' } } },
          { technicalEmployee: { code: { contains: q, mode: 'insensitive' } } },
          { user: { email: { contains: q, mode: 'insensitive' } } },
          { user: { nameEn: { contains: q, mode: 'insensitive' } } },
        ],
      }
    : {}

  try {
    const [total, items] = await Promise.all([
      prisma.cosCustomer.count({ where }),
      prisma.cosCustomer.findMany({
        where,
        include: customerInclude,
        orderBy: [{ updatedAt: 'desc' }],
        ...(all ? {} : { skip, take: PAGE_SIZE }),
      }),
    ])

    return NextResponse.json({
      customers: items.map(serializeCustomer),
      total,
      page,
      pageSize: all ? total : PAGE_SIZE,
      totalPages: all ? 1 : Math.ceil(total / PAGE_SIZE),
    })
  } catch (err) {
    if (isMissingTable(err)) {
      return NextResponse.json({ error: '客户表不存在，请先运行数据库迁移' }, { status: 503 })
    }
    throw err
  }
}

export async function POST(req: NextRequest) {
  const { session, error } = await requireRole('STAFF', { adminMenu: 'cosmocoatCustomers' })
  if (error) return error

  const body = await req.json().catch(() => null)
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  try {
    const code = parsed.data.code?.trim() || await generateCustomerCode()
    const existing = await prisma.cosCustomer.findUnique({ where: { code } })
    if (existing) return NextResponse.json({ error: '客户编码已存在' }, { status: 409 })

    const userId = await validateUserId(parsed.data.userId)
    const salesEmployeeId = await validateEmployeeId(parsed.data.salesEmployeeId, 'SALES')
    const technicalEmployeeId = await validateEmployeeId(parsed.data.technicalEmployeeId, 'TECHNICAL')

    const customer = await prisma.cosCustomer.create({
      data: {
        code,
        name: parsed.data.name,
        userId,
        salesEmployeeId,
        technicalEmployeeId,
        phone: nullableText(parsed.data.phone),
        contactPerson: nullableText(parsed.data.contactPerson),
        contactPhone: nullableText(parsed.data.contactPhone),
        address: nullableText(parsed.data.address),
        productionEquipmentParams: nullableText(parsed.data.productionEquipmentParams),
        createdById: session!.user.id,
      },
      include: customerInclude,
    })

    await logAudit(session!.user.id, 'CREATE', 'CosCustomer', customer.id, null, customer)
    return NextResponse.json({ customer: serializeCustomer(customer) }, { status: 201 })
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === 'COSMICOAT_USER_NOT_FOUND') {
        return NextResponse.json({ error: '所选 CosmoCoat 平台账号不存在' }, { status: 400 })
      }
      if (err.message === 'USER_ALREADY_BOUND') {
        return NextResponse.json({ error: '该账号已关联其他客户档案' }, { status: 409 })
      }
      if (err.message === 'SALES_EMPLOYEE_NOT_FOUND') {
        return NextResponse.json({ error: '所选销售人员不存在或类型不正确' }, { status: 400 })
      }
      if (err.message === 'TECHNICAL_EMPLOYEE_NOT_FOUND') {
        return NextResponse.json({ error: '所选技术负责人不存在或类型不正确' }, { status: 400 })
      }
    }
    if (isMissingTable(err)) {
      return NextResponse.json({ error: '客户表不存在，请先运行数据库迁移' }, { status: 503 })
    }
    throw err
  }
}
