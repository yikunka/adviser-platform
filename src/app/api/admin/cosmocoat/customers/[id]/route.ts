import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { requireRole } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'
import { logAudit } from '@/lib/audit/logger'
import {
  customerInclude,
  getCustomerById,
  serializeCustomer,
} from '@/lib/cosmocoat/customers'

const updateSchema = z.object({
  code: z.string().trim().min(1).max(32).optional(),
  name: z.string().trim().min(1).max(200).optional(),
  userId: z.union([z.string().trim().min(1), z.literal(''), z.null()]).optional(),
  phone: z.string().trim().max(50).optional().nullable(),
  address: z.string().trim().max(500).optional().nullable(),
})

function nullableText(v: string | null | undefined) {
  const text = (v ?? '').trim()
  return text ? text : null
}

function isMissingTable(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2021'
}

async function validateUserId(userId: string | null | undefined, customerId: string) {
  if (userId === undefined) return undefined

  const id = nullableText(userId ?? null)
  if (!id) return null

  const user = await prisma.user.findFirst({
    where: { id, role: 'CLIENT', platform: 'COSMICOAT' },
    select: { id: true },
  })
  if (!user) throw new Error('COSMICOAT_USER_NOT_FOUND')

  const bound = await prisma.cosCustomer.findFirst({
    where: { userId: id, NOT: { id: customerId } },
    select: { id: true },
  })
  if (bound) throw new Error('USER_ALREADY_BOUND')

  return id
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await requireRole('STAFF', { adminMenu: 'cosmocoatCustomers' })
  if (error) return error

  const { id } = await params

  try {
    const customer = await getCustomerById(id)
    if (!customer) return NextResponse.json({ error: '客户不存在' }, { status: 404 })
    return NextResponse.json({ customer })
  } catch (err) {
    if (isMissingTable(err)) {
      return NextResponse.json({ error: '客户表不存在，请先运行数据库迁移' }, { status: 503 })
    }
    throw err
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, error } = await requireRole('STAFF', { adminMenu: 'cosmocoatCustomers' })
  if (error) return error

  const { id } = await params
  const body = await req.json().catch(() => null)
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  try {
    const before = await prisma.cosCustomer.findUnique({ where: { id } })
    if (!before) return NextResponse.json({ error: '客户不存在' }, { status: 404 })

    if (parsed.data.code && parsed.data.code !== before.code) {
      const codeTaken = await prisma.cosCustomer.findUnique({ where: { code: parsed.data.code } })
      if (codeTaken) return NextResponse.json({ error: '客户编码已存在' }, { status: 409 })
    }

    const userId = await validateUserId(parsed.data.userId, id)

    const customer = await prisma.cosCustomer.update({
      where: { id },
      data: {
        ...(parsed.data.code !== undefined ? { code: parsed.data.code } : {}),
        ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
        ...(userId !== undefined ? { userId } : {}),
        ...(parsed.data.phone !== undefined ? { phone: nullableText(parsed.data.phone) } : {}),
        ...(parsed.data.address !== undefined ? { address: nullableText(parsed.data.address) } : {}),
      },
      include: customerInclude,
    })

    await logAudit(session!.user.id, 'UPDATE', 'CosCustomer', customer.id, before, customer)
    return NextResponse.json({ customer: serializeCustomer(customer) })
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === 'COSMICOAT_USER_NOT_FOUND') {
        return NextResponse.json({ error: '所选 CosmoCoat 平台账号不存在' }, { status: 400 })
      }
      if (err.message === 'USER_ALREADY_BOUND') {
        return NextResponse.json({ error: '该账号已关联其他客户档案' }, { status: 409 })
      }
    }
    if (isMissingTable(err)) {
      return NextResponse.json({ error: '客户表不存在，请先运行数据库迁移' }, { status: 503 })
    }
    throw err
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, error } = await requireRole('STAFF', { adminMenu: 'cosmocoatCustomers' })
  if (error) return error

  const { id } = await params

  try {
    const before = await prisma.cosCustomer.findUnique({ where: { id } })
    if (!before) return NextResponse.json({ error: '客户不存在' }, { status: 404 })

    await prisma.cosCustomer.delete({ where: { id } })
    await logAudit(session!.user.id, 'DELETE', 'CosCustomer', id, before, null)
    return NextResponse.json({ success: true })
  } catch (err) {
    if (isMissingTable(err)) {
      return NextResponse.json({ error: '客户表不存在，请先运行数据库迁移' }, { status: 503 })
    }
    throw err
  }
}
