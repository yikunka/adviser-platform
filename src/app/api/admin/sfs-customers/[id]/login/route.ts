import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { requireRole } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'
import { logAudit } from '@/lib/audit/logger'

function norm(v: string | null | undefined) {
  return (v ?? '').trim().toLowerCase()
}

function resolveUserIdFromRow(rowId: string): string | null {
  if (rowId.startsWith('user:')) return rowId.slice('user:'.length) || null
  return null
}

async function resolveCustomerForLogin(
  rowId: string,
  createdById: string,
  overrides?: { name?: string; email?: string; phone?: string | null; mailingAddress?: string | null },
): Promise<{ customerId: string; userId: string | null; email: string | null; name: string }> {
  if (rowId.startsWith('customer:')) {
    const customerId = rowId.slice('customer:'.length)
    const customer = await prisma.sfsCustomer.findUnique({
      where: { id: customerId },
      select: { id: true, userId: true, email: true, name: true, phone: true, mailingAddress: true },
    })
    if (!customer) throw new Error('Customer profile not found.')
    return {
      customerId: customer.id,
      userId: customer.userId,
      email: overrides?.email ?? customer.email,
      name: overrides?.name ?? customer.name,
    }
  }

  if (rowId.startsWith('user:')) {
    const userId = rowId.slice('user:'.length)
    const existing = await prisma.sfsCustomer.findUnique({
      where: { userId },
      select: { id: true, userId: true, email: true, name: true },
    })
    if (existing) {
      return {
        customerId: existing.id,
        userId: existing.userId,
        email: overrides?.email ?? existing.email,
        name: overrides?.name ?? existing.name,
      }
    }
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, nameEn: true, phone: true, mailingAddress: true },
    })
    if (!user) throw new Error('User account not found.')
    const created = await prisma.sfsCustomer.create({
      data: {
        userId: user.id,
        name: overrides?.name ?? user.nameEn,
        email: overrides?.email ?? user.email,
        phone: overrides?.phone ?? user.phone,
        mailingAddress: overrides?.mailingAddress ?? user.mailingAddress,
        createdById,
      },
      select: { id: true, userId: true, email: true, name: true },
    })
    return {
      customerId: created.id,
      userId: created.userId,
      email: created.email,
      name: created.name,
    }
  }

  if (rowId.startsWith('order-email:')) {
    const key = rowId.slice('order-email:'.length)
    const unboundOrders = await prisma.sfsOrder.findMany({
      where: { userId: null, customerId: null },
      select: { id: true, email: true, clientName: true, contactNumber: true, mailingAddress: true },
    })
    const matched = unboundOrders.filter(order => order.id === key || norm(order.email) === key)
    if (matched.length === 0) throw new Error('Order contact not found.')
    const sample = matched[0]!
    const email = overrides?.email ?? sample.email
    const name = overrides?.name ?? sample.clientName
    const customer = await prisma.sfsCustomer.create({
      data: {
        name,
        email: email || null,
        phone: overrides?.phone ?? sample.contactNumber ?? null,
        mailingAddress: overrides?.mailingAddress ?? sample.mailingAddress ?? null,
        createdById,
      },
      select: { id: true, userId: true, email: true, name: true },
    })
    await prisma.sfsOrder.updateMany({
      where: { id: { in: matched.map(o => o.id) }, customerId: null },
      data: { customerId: customer.id },
    })
    return {
      customerId: customer.id,
      userId: customer.userId,
      email: customer.email,
      name: customer.name,
    }
  }

  throw new Error('Unsupported customer row.')
}

const createLoginSchema = z.object({
  email: z.string().trim().email().max(320).optional(),
  password: z.string().min(8).max(100),
  nameEn: z.string().trim().min(1).max(100).optional(),
})

const patchLoginSchema = z.object({
  isActive: z.boolean(),
})

/**
 * POST — create an SFS_DIAMOND login for a manual / order-only customer and bind it.
 * Staff-created logins are pre-verified and APPROVED.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, error } = await requireRole('STAFF', { adminMenu: 'sfsCustomers' })
  if (error) return error

  const { id } = await params
  const rowId = decodeURIComponent(id)
  const body = await req.json().catch(() => null)
  const parsed = createLoginSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  try {
    if (resolveUserIdFromRow(rowId)) {
      return NextResponse.json({ error: 'This row already has a registered login.' }, { status: 400 })
    }

    const resolved = await resolveCustomerForLogin(rowId, session!.user.id, {
      email: parsed.data.email,
      name: parsed.data.nameEn,
    })
    if (resolved.userId) {
      return NextResponse.json({ error: 'This customer is already bound to a login.' }, { status: 400 })
    }

    const email = norm(parsed.data.email ?? resolved.email)
    if (!email) {
      return NextResponse.json({ error: 'Email is required to create a login.' }, { status: 400 })
    }
    const nameEn = (parsed.data.nameEn ?? resolved.name).trim() || email

    const existing = await prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
      select: { id: true, platform: true, role: true },
    })
    if (existing) {
      if (existing.platform === 'SFS_DIAMOND' && existing.role === 'CLIENT') {
        return NextResponse.json({
          error: 'An SFS login with this email already exists. Merge profiles or use a different email.',
        }, { status: 409 })
      }
      return NextResponse.json({ error: 'Email already registered on another platform.' }, { status: 409 })
    }

    const passwordHash = await bcrypt.hash(parsed.data.password, 12)
    const result = await prisma.$transaction(async tx => {
      const user = await tx.user.create({
        data: {
          email,
          nameEn,
          passwordHash,
          platform: 'SFS_DIAMOND',
          role: 'CLIENT',
          emailVerified: new Date(),
          accountApprovalStatus: 'APPROVED',
          accountApprovedAt: new Date(),
          accountApprovedById: session!.user.id,
        },
        select: { id: true, email: true, nameEn: true, isActive: true, accountApprovalStatus: true },
      })
      const customer = await tx.sfsCustomer.update({
        where: { id: resolved.customerId },
        data: {
          userId: user.id,
          email,
          name: nameEn,
        },
        select: { id: true },
      })
      await tx.sfsOrder.updateMany({
        where: { customerId: customer.id },
        data: { userId: user.id },
      })
      return { user, customerId: customer.id }
    })

    await logAudit(session!.user.id, 'CREATE', 'User', result.user.id, null, {
      action: 'sfs-create-login',
      customerId: result.customerId,
      email: result.user.email,
    })

    return NextResponse.json({
      userId: result.user.id,
      customerId: result.customerId,
      email: result.user.email,
      accountApprovalStatus: result.user.accountApprovalStatus,
      isActive: result.user.isActive,
    }, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create login'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

/**
 * PATCH — enable / disable an SFS partner login bound to this customer row.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, error } = await requireRole('STAFF', { adminMenu: 'sfsCustomers' })
  if (error) return error

  const { id } = await params
  const rowId = decodeURIComponent(id)
  const body = await req.json().catch(() => null)
  const parsed = patchLoginSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  let userId = resolveUserIdFromRow(rowId)
  if (!userId && rowId.startsWith('customer:')) {
    const customerId = rowId.slice('customer:'.length)
    const customer = await prisma.sfsCustomer.findUnique({
      where: { id: customerId },
      select: { userId: true },
    })
    userId = customer?.userId ?? null
  }
  if (!userId) {
    return NextResponse.json({ error: 'No registered login on this customer.' }, { status: 400 })
  }

  const before = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, platform: true, role: true, isActive: true, email: true },
  })
  if (!before || before.platform !== 'SFS_DIAMOND' || before.role !== 'CLIENT') {
    return NextResponse.json({ error: 'SFS login not found.' }, { status: 404 })
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data: { isActive: parsed.data.isActive },
    select: { id: true, email: true, isActive: true },
  })

  await logAudit(session!.user.id, 'UPDATE', 'User', user.id, { isActive: before.isActive }, { isActive: user.isActive })

  return NextResponse.json({ userId: user.id, email: user.email, isActive: user.isActive })
}
