import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { logAudit } from '@/lib/audit/logger'
import { requireRole } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'
import { isDescendantAccount } from '@/lib/financial/account-tree'
import { accountUpdateSchema } from '@/lib/financial/schemas'
import { serializeAccount } from '@/lib/financial/serializers'

function apiError(error: string, status = 400) {
  return NextResponse.json({ error, toast: error }, { status })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, error } = await requireRole('STAFF', { adminMenu: 'financial' })
  if (error) return error

  const { id } = await params
  const body = await req.json().catch(() => null)
  const parsed = accountUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid account input', toast: 'Please check the account form.', details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const before = await prisma.finAccount.findUnique({ where: { id } })
  if (!before) return apiError('Account not found.', 404)

  if (parsed.data.code && parsed.data.code !== before.code) {
    const conflict = await prisma.finAccount.findUnique({ where: { code: parsed.data.code } })
    if (conflict) return apiError('Account code already exists.', 409)
  }

  const parentId = parsed.data.parentId === undefined ? before.parentId : parsed.data.parentId
  let parent: { id: string; level: number } | null = null
  if (parentId) {
    if (parentId === id) return apiError('An account cannot be its own parent.')
    const accounts = await prisma.finAccount.findMany({
      select: { id: true, code: true, name: true, parentId: true, level: true, sortOrder: true },
    })
    if (isDescendantAccount(accounts, id, parentId)) {
      return apiError('An account cannot be moved under one of its children.')
    }
    parent = await prisma.finAccount.findUnique({ where: { id: parentId }, select: { id: true, level: true } })
    if (!parent) return apiError('Parent account does not exist.', 404)
    if (parent.level >= 4) return apiError('Parent account level is too deep for a child account.')
  }

  try {
    const account = await prisma.finAccount.update({
      where: { id },
      data: {
        ...('code' in parsed.data ? { code: parsed.data.code } : {}),
        ...('name' in parsed.data ? { name: parsed.data.name } : {}),
        ...('type' in parsed.data ? { type: parsed.data.type } : {}),
        ...('sortOrder' in parsed.data ? { sortOrder: parsed.data.sortOrder } : {}),
        ...('isSystem' in parsed.data ? { isSystem: parsed.data.isSystem } : {}),
        ...('notes' in parsed.data ? { notes: parsed.data.notes } : {}),
        ...(parsed.data.parentId !== undefined
          ? { parentId: parent?.id ?? null, level: parent ? parent.level + 1 : 1 }
          : {}),
      },
      include: { parent: { select: { id: true, code: true, name: true } } },
    })

    await logAudit(session.user.id, 'UPDATE', 'FinAccount', id, before, account)
    return NextResponse.json({ account: serializeAccount(account), message: 'Account updated.', toast: 'Account updated.' })
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return apiError('Account code already exists.', 409)
    }
    throw err
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, error } = await requireRole('STAFF', { adminMenu: 'financial' })
  if (error) return error

  const { id } = await params
  const before = await prisma.finAccount.findUnique({
    where: { id },
    include: { _count: { select: { journalLines: true, ledgerEntries: true } } },
  })
  if (!before) return apiError('Account not found.', 404)
  if (before.isSystem) return apiError('System accounts cannot be deleted.', 400)
  if (before._count.journalLines > 0 || before._count.ledgerEntries > 0) {
    return apiError('Account has journal or ledger activity and cannot be deleted.', 409)
  }

  await prisma.finAccount.delete({ where: { id } })
  await logAudit(session.user.id, 'DELETE', 'FinAccount', id, before, null)
  return NextResponse.json({ success: true, message: 'Account deleted.', toast: 'Account deleted.' })
}
