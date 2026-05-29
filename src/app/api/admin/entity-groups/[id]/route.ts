import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'
import { logAudit } from '@/lib/audit/logger'
import {
  assertGroupAccessible,
  resolveEntityGroupAccess,
} from '@/lib/entity-groups/access'
import { entityGroupUpdateSchema } from '@/lib/entity-groups/schemas'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, error } = await requireRole('STAFF', { adminMenu: 'entities' })
  if (error) return error

  const { id } = await params
  const access = await resolveEntityGroupAccess(session!.user.id, session!.user.role)
  if (!(await assertGroupAccessible(access, id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const group = await prisma.clientEntityGroup.findUnique({
    where: { id },
    include: {
      companies: {
        where: { deletedAt: null },
        orderBy: { nameEn: 'asc' },
        select: {
          id: true,
          companyCode: true,
          nameEn: true,
          nameZh: true,
          companyNumber: true,
          status: true,
        },
      },
      members: {
        include: { user: { select: { id: true, nameEn: true, email: true, role: true } } },
      },
    },
  })

  if (!group) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(group)
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, error } = await requireRole('STAFF', { adminMenu: 'entities' })
  if (error) return error

  const { id } = await params
  const access = await resolveEntityGroupAccess(session!.user.id, session!.user.role)
  if (!(await assertGroupAccessible(access, id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json().catch(() => null)
  const parsed = entityGroupUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  const before = await prisma.clientEntityGroup.findUnique({ where: { id } })
  if (!before) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { memberUserIds, email, ...rest } = parsed.data
  const data = {
    ...rest,
    ...(email !== undefined ? { email: email && email.length > 0 ? email : null } : {}),
  }

  const group = await prisma.$transaction(async tx => {
    await tx.clientEntityGroup.update({ where: { id }, data })

    if (memberUserIds !== undefined) {
      await tx.clientEntityGroupMember.deleteMany({ where: { groupId: id } })
      if (memberUserIds.length > 0) {
        await tx.clientEntityGroupMember.createMany({
          data: memberUserIds.map(userId => ({ groupId: id, userId })),
          skipDuplicates: true,
        })
      }
    }

    return tx.clientEntityGroup.findUniqueOrThrow({
      where: { id },
      include: {
        _count: { select: { companies: true, members: true } },
        members: { include: { user: { select: { id: true, nameEn: true, email: true } } } },
        companies: {
          where: { deletedAt: null },
          select: { id: true, companyCode: true, nameEn: true, status: true },
        },
      },
    })
  })

  await logAudit(session!.user.id, 'UPDATE', 'ClientEntityGroup', id, before, group)
  return NextResponse.json(group)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, error } = await requireRole('SUPER_ADMIN')
  if (error) return error

  const { id } = await params
  const before = await prisma.clientEntityGroup.findUnique({
    where: { id },
    include: { _count: { select: { companies: true } } },
  })
  if (!before) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (before._count.companies > 0) {
    return NextResponse.json(
      { error: 'Cannot delete a group that still has companies. Reassign companies first.' },
      { status: 409 },
    )
  }

  await prisma.clientEntityGroup.delete({ where: { id } })
  await logAudit(session!.user.id, 'DELETE', 'ClientEntityGroup', id, before, null)
  return NextResponse.json({ ok: true })
}
