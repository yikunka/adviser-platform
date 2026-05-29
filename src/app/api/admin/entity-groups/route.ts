import { NextRequest, NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { requireRole } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'
import { logAudit } from '@/lib/audit/logger'
import {
  buildGroupWhere,
  resolveEntityGroupAccess,
} from '@/lib/entity-groups/access'
import { entityGroupCreateSchema, entityGroupFilterSchema } from '@/lib/entity-groups/schemas'

export async function GET(req: NextRequest) {
  const { session, error } = await requireRole('STAFF', { adminMenu: 'entities' })
  if (error) return error

  const parsed = entityGroupFilterSchema.safeParse({
    q: req.nextUrl.searchParams.get('q') ?? undefined,
    page: req.nextUrl.searchParams.get('page') ?? undefined,
    limit: req.nextUrl.searchParams.get('limit') ?? undefined,
  })
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid filters' }, { status: 400 })
  }

  const access = await resolveEntityGroupAccess(session!.user.id, session!.user.role)
  const { q, page, limit } = parsed.data
  const skip = (page - 1) * limit

  const where: Prisma.ClientEntityGroupWhereInput = {
    ...buildGroupWhere(access),
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { contactPerson: { contains: q, mode: 'insensitive' } },
            { email: { contains: q, mode: 'insensitive' } },
          ],
        }
      : {}),
  }

  const [groups, total] = await Promise.all([
    prisma.clientEntityGroup.findMany({
      where,
      skip,
      take: limit,
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { companies: true, members: true } },
        members: {
          include: { user: { select: { id: true, nameEn: true, email: true } } },
        },
      },
    }),
    prisma.clientEntityGroup.count({ where }),
  ])

  return NextResponse.json({ groups, total, page, limit })
}

export async function POST(req: NextRequest) {
  const { session, error } = await requireRole('STAFF', { adminMenu: 'entities' })
  if (error) return error

  const body = await req.json().catch(() => null)
  const parsed = entityGroupCreateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  const { memberUserIds, email, ...rest } = parsed.data
  const normalizedEmail = email && email.length > 0 ? email : null

  const group = await prisma.$transaction(async tx => {
    const created = await tx.clientEntityGroup.create({
      data: {
        ...rest,
        email: normalizedEmail,
        contactPerson: rest.contactPerson ?? null,
        phone: rest.phone ?? null,
        address: rest.address ?? null,
        notes: rest.notes ?? null,
      },
    })

    if (memberUserIds.length > 0) {
      await tx.clientEntityGroupMember.createMany({
        data: memberUserIds.map(userId => ({ groupId: created.id, userId })),
        skipDuplicates: true,
      })
    }

    return tx.clientEntityGroup.findUniqueOrThrow({
      where: { id: created.id },
      include: {
        _count: { select: { companies: true, members: true } },
        members: { include: { user: { select: { id: true, nameEn: true, email: true } } } },
      },
    })
  })

  await logAudit(session!.user.id, 'CREATE', 'ClientEntityGroup', group.id, null, group)
  return NextResponse.json(group, { status: 201 })
}
