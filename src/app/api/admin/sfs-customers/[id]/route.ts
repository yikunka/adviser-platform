import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireRole } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'
import { logAudit } from '@/lib/audit/logger'
import { deleteSfsCustomerContractFile } from '@/lib/sfs/customer-contracts'

const updateSchema = z.object({
  name: z.string().optional().nullable(),
  email: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  mailingAddress: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
})

type CustomerUpdateData = {
  name?: string
  email?: string | null
  phone?: string | null
  mailingAddress?: string | null
  notes?: string | null
}

function norm(v: string | null | undefined) {
  return (v ?? '').trim().toLowerCase()
}

function nullableText(v: string | null | undefined) {
  const text = (v ?? '').trim()
  return text ? text : null
}

function buildUpdateData(input: z.infer<typeof updateSchema>): CustomerUpdateData {
  return {
    ...(input.name !== undefined ? { name: input.name?.trim() ?? '' } : {}),
    ...(input.email !== undefined ? { email: nullableText(input.email) } : {}),
    ...(input.phone !== undefined ? { phone: nullableText(input.phone) } : {}),
    ...(input.mailingAddress !== undefined ? { mailingAddress: nullableText(input.mailingAddress) } : {}),
    ...(input.notes !== undefined ? { notes: nullableText(input.notes) } : {}),
  }
}

function buildCreateData(input: z.infer<typeof updateSchema>, createdById: string) {
  return {
    name: input.name?.trim() ?? '',
    email: nullableText(input.email),
    phone: nullableText(input.phone),
    mailingAddress: nullableText(input.mailingAddress),
    notes: nullableText(input.notes),
    createdById,
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, error } = await requireRole('STAFF', { adminMenu: 'sfsCustomers' })
  if (error) return error

  const { id } = await params
  const rowId = decodeURIComponent(id)
  const body = await req.json().catch(() => null)
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  const updateData = buildUpdateData(parsed.data)
  const createData = buildCreateData(parsed.data, session!.user.id)

  if (rowId.startsWith('customer:')) {
    const customerId = rowId.slice('customer:'.length)
    const before = await prisma.sfsCustomer.findUnique({ where: { id: customerId } })
    if (!before) return NextResponse.json({ error: 'Customer not found' }, { status: 404 })

    const customer = await prisma.sfsCustomer.update({
      where: { id: customerId },
      data: updateData,
    })
    await logAudit(session!.user.id, 'UPDATE', 'SfsCustomer', customer.id, before, customer)
    return NextResponse.json({ customer })
  }

  if (rowId.startsWith('user:')) {
    const userId = rowId.slice('user:'.length)
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } })
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    const before = await prisma.sfsCustomer.findUnique({ where: { userId } })
    const customer = before
      ? await prisma.sfsCustomer.update({ where: { id: before.id }, data: updateData })
      : await prisma.sfsCustomer.create({ data: { ...createData, userId } })

    await prisma.sfsOrder.updateMany({
      where: { userId, customerId: null },
      data: { customerId: customer.id },
    })
    await logAudit(session!.user.id, before ? 'UPDATE' : 'CREATE', 'SfsCustomer', customer.id, before, customer)
    return NextResponse.json({ customer })
  }

  if (rowId.startsWith('missing-user:')) {
    const userId = rowId.slice('missing-user:'.length)
    const [user, before] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId }, select: { id: true } }),
      prisma.sfsCustomer.findUnique({ where: { userId } }).catch(() => null),
    ])

    const customer = before
      ? await prisma.sfsCustomer.update({ where: { id: before.id }, data: updateData })
      : await prisma.sfsCustomer.create({ data: { ...createData, ...(user ? { userId } : {}) } })

    await prisma.sfsOrder.updateMany({
      where: { userId, customerId: null },
      data: { customerId: customer.id },
    })
    await logAudit(session!.user.id, before ? 'UPDATE' : 'CREATE', 'SfsCustomer', customer.id, before, customer)
    return NextResponse.json({ customer })
  }

  if (rowId.startsWith('order-email:')) {
    const key = rowId.slice('order-email:'.length)
    const unboundOrders = await prisma.sfsOrder.findMany({
      where: { userId: null, customerId: null },
      select: { id: true, email: true },
    })
    const matchedOrderIds = unboundOrders
      .filter(order => order.id === key || norm(order.email) === key)
      .map(order => order.id)

    if (matchedOrderIds.length === 0) {
      return NextResponse.json({ error: 'Order contact not found' }, { status: 404 })
    }

    const customer = await prisma.sfsCustomer.create({ data: createData })
    await prisma.sfsOrder.updateMany({
      where: { id: { in: matchedOrderIds }, customerId: null },
      data: { customerId: customer.id },
    })
    await logAudit(session!.user.id, 'CREATE', 'SfsCustomer', customer.id, null, {
      ...customer,
      boundOrderIds: matchedOrderIds,
    })
    return NextResponse.json({ customer })
  }

  return NextResponse.json({ error: 'Unsupported customer row' }, { status: 400 })
}

async function resolveDeletableCustomerId(rowId: string): Promise<string | null> {
  if (rowId.startsWith('customer:')) return rowId.slice('customer:'.length)

  if (rowId.startsWith('user:')) {
    const userId = rowId.slice('user:'.length)
    const profile = await prisma.sfsCustomer.findUnique({ where: { userId }, select: { id: true } })
    return profile?.id ?? null
  }

  return null
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, error } = await requireRole('STAFF', { adminMenu: 'sfsCustomers' })
  if (error) return error

  const { id } = await params
  const rowId = decodeURIComponent(id)
  const customerId = await resolveDeletableCustomerId(rowId)

  if (!customerId) {
    if (rowId.startsWith('user:')) {
      return NextResponse.json({ error: 'No customer profile to delete' }, { status: 404 })
    }
    return NextResponse.json({ error: 'This customer record cannot be deleted' }, { status: 400 })
  }

  const customer = await prisma.sfsCustomer.findUnique({
    where: { id: customerId },
    include: { contracts: { select: { id: true, storageKey: true } } },
  })
  if (!customer) return NextResponse.json({ error: 'Customer not found' }, { status: 404 })

  const orderCount = await prisma.sfsOrder.count({
    where: {
      OR: [
        { customerId: customer.id },
        ...(customer.userId ? [{ userId: customer.userId }] : []),
      ],
    },
  })

  if (orderCount > 0) {
    return NextResponse.json(
      { error: 'Cannot delete a customer with existing orders.' },
      { status: 409 },
    )
  }

  for (const contract of customer.contracts) {
    await deleteSfsCustomerContractFile(contract.storageKey)
  }

  await prisma.sfsCustomer.delete({ where: { id: customer.id } })
  await logAudit(session!.user.id, 'DELETE', 'SfsCustomer', customer.id, customer, null)

  return NextResponse.json({ success: true })
}
