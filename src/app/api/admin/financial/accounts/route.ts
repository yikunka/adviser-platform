import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { logAudit } from '@/lib/audit/logger'
import { requireRole } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'
import { accountCreateSchema } from '@/lib/financial/schemas'
import { serializeAccount } from '@/lib/financial/serializers'
import { resolveJournalCompanyScope } from '@/lib/financial/company-scope'
import { assertCompanyAccessible, resolveCompanyAccess } from '@/lib/company-access'

function apiError(error: string, status = 400) {
  return NextResponse.json({ error, toast: error }, { status })
}

async function resolveParent(parentId: string | null | undefined, companyId: string) {
  if (!parentId) return null
  return prisma.finAccount.findFirst({ where: { id: parentId, companyId } })
}

export async function GET(req: NextRequest) {
  const { session, error } = await requireRole('STAFF', { adminMenu: 'financial' })
  if (error) return error
  const companyId = req.nextUrl.searchParams.get('companyId')
  if (!companyId) return apiError('Company is required.')

  const access = await resolveCompanyAccess(session!.user.id, session!.user.role)
  if (!(await assertCompanyAccessible(access, companyId))) return apiError('Forbidden', 403)

  const accounts = await prisma.finAccount.findMany({
    where: { companyId },
    include: { parent: { select: { id: true, code: true, name: true } } },
    orderBy: [{ type: 'asc' }, { sortOrder: 'asc' }, { code: 'asc' }],
  })

  return NextResponse.json({ accounts: accounts.map(serializeAccount) })
}

export async function POST(req: NextRequest) {
  const { session, error } = await requireRole('STAFF', { adminMenu: 'financial' })
  if (error) return error

  const body = await req.json().catch(() => null)
  const parsed = accountCreateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid account input', toast: 'Please check the account form.', details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const access = await resolveCompanyAccess(session!.user.id, session!.user.role)
  if (!(await assertCompanyAccessible(access, parsed.data.companyId))) return apiError('Forbidden', 403)
  const companyScope = await resolveJournalCompanyScope(parsed.data.companyId)
  if (!companyScope.companyId) return apiError('Selected company does not exist.', 400)

  const existing = await prisma.finAccount.findFirst({
    where: { companyId: companyScope.companyId, code: parsed.data.code },
  })
  if (existing) return apiError('Account code already exists.', 409)

  const parent = await resolveParent(parsed.data.parentId, companyScope.companyId)
  if (parsed.data.parentId && !parent) return apiError('Parent account does not exist.', 404)
  if (parent && parent.level >= 4) return apiError('Parent account level is too deep for a child account.')

  try {
    const account = await prisma.finAccount.create({
      data: {
        code: parsed.data.code,
        name: parsed.data.name,
        type: parsed.data.type,
        companyId: companyScope.companyId,
        parentId: parent?.id ?? null,
        level: parent ? parent.level + 1 : 1,
        sortOrder: parsed.data.sortOrder,
        isSystem: parsed.data.isSystem,
        notes: parsed.data.notes,
      },
      include: { parent: { select: { id: true, code: true, name: true } } },
    })

    await logAudit(session.user.id, 'CREATE', 'FinAccount', account.id, null, account)
    return NextResponse.json(
      { account: serializeAccount(account), message: 'Account created.', toast: 'Account created.' },
      { status: 201 },
    )
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return apiError('Account code already exists.', 409)
    }
    throw err
  }
}
