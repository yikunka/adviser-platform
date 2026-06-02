import { NextRequest, NextResponse } from 'next/server'
import { Prisma, type AccountType } from '@prisma/client'
import { logAudit } from '@/lib/audit/logger'
import { requireRole } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'
import { accountCreateSchema } from '@/lib/financial/schemas'
import { serializeAccount } from '@/lib/financial/serializers'
import { resolveJournalCompanyScope } from '@/lib/financial/company-scope'
import { assertCompanyAccessible, resolveCompanyAccess } from '@/lib/company-access'
import { roundMoney, signedLineAmount } from '@/lib/financial/utils'

function apiError(error: string, status = 400) {
  return NextResponse.json({ error, toast: error }, { status })
}

function defaultOpeningPeriod() {
  return `${new Date().getUTCFullYear()}-01`
}

async function resolveParent(parentId: string | null | undefined, companyId: string) {
  if (!parentId) return null
  return prisma.finAccount.findFirst({ where: { id: parentId, companyId } })
}

type AccountWithOpeningBalance = {
  id: string
  code: string
  name: string
  type: AccountType
  companyId?: string | null
  level: number
  sortOrder: number
  parentId: string | null
  parent?: { id: string; code: string; name: string } | null
  isSystem: boolean
  notes: string
  createdAt?: Date
  updatedAt?: Date
  accountBalances: {
    period: string
    openingDebit: Prisma.Decimal
    openingCredit: Prisma.Decimal
  }[]
}

function serializeAccountOpeningBalances(accounts: AccountWithOpeningBalance[]) {
  const childrenByParent = new Map<string | null, string[]>()
  const ownBalanceById = new Map<string, number>()

  const serialized = accounts.map(account => {
    const openingBalance = account.accountBalances[0] ?? null
    const openingDebit = Number(openingBalance?.openingDebit ?? 0)
    const openingCredit = Number(openingBalance?.openingCredit ?? 0)
    const ownBalance = roundMoney(signedLineAmount({
      accountId: account.id,
      accountType: account.type,
      accountCode: account.code,
      debit: openingDebit,
      credit: openingCredit,
    }))

    const parentChildren = childrenByParent.get(account.parentId) ?? []
    parentChildren.push(account.id)
    childrenByParent.set(account.parentId, parentChildren)
    ownBalanceById.set(account.id, ownBalance)

    return {
      ...serializeAccount(account),
      openingBalancePeriod: openingBalance?.period ?? null,
      openingDebit,
      openingCredit,
      openingBalance: ownBalance,
      openingBalanceTotal: ownBalance,
    }
  })

  const totalById = new Map<string, number>()
  const calculateTotal = (accountId: string): number => {
    const cached = totalById.get(accountId)
    if (cached !== undefined) return cached
    const childrenTotal = (childrenByParent.get(accountId) ?? [])
      .reduce((sum, childId) => roundMoney(sum + calculateTotal(childId)), 0)
    const total = roundMoney((ownBalanceById.get(accountId) ?? 0) + childrenTotal)
    totalById.set(accountId, total)
    return total
  }

  return serialized.map(account => ({
    ...account,
    openingBalanceTotal: calculateTotal(account.id),
  }))
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
    include: {
      parent: { select: { id: true, code: true, name: true } },
      accountBalances: {
        orderBy: [{ period: 'desc' }],
        take: 1,
      },
    },
    orderBy: [{ type: 'asc' }, { sortOrder: 'asc' }, { code: 'asc' }],
  })

  return NextResponse.json({ accounts: serializeAccountOpeningBalances(accounts) })
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
    const account = await prisma.$transaction(async tx => {
      const created = await tx.finAccount.create({
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

      if (parsed.data.openingDebit > 0 || parsed.data.openingCredit > 0) {
        const endingBalance = signedLineAmount({
          accountId: created.id,
          accountType: created.type,
          accountCode: created.code,
          debit: parsed.data.openingDebit,
          credit: parsed.data.openingCredit,
        })
        await tx.accountBalance.create({
          data: {
            accountId: created.id,
            period: parsed.data.openingBalancePeriod || defaultOpeningPeriod(),
            openingDebit: new Prisma.Decimal(parsed.data.openingDebit),
            openingCredit: new Prisma.Decimal(parsed.data.openingCredit),
            closingDebit: new Prisma.Decimal(parsed.data.openingDebit),
            closingCredit: new Prisma.Decimal(parsed.data.openingCredit),
            endingBalance: new Prisma.Decimal(endingBalance),
          },
        })
      }

      return created
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
