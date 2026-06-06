import { NextRequest, NextResponse } from 'next/server'
import { Prisma, type AccountType } from '@prisma/client'
import { logAudit } from '@/lib/audit/logger'
import { requireRole } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'
import { accountCreateSchema } from '@/lib/financial/schemas'
import { serializeAccount } from '@/lib/financial/serializers'
import { resolveJournalCompanyScope } from '@/lib/financial/company-scope'
import { canEditOpeningBalance } from '@/lib/financial/opening-balance'
import { assertCompanyAccessible, resolveCompanyAccess } from '@/lib/company-access'
import { roundMoney, signedLineAmount } from '@/lib/financial/utils'
import { calculateYearToDateAmount, calculateYearToDateBalance } from '@/lib/financial/year-to-date'

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
  yearToDateAmount: Prisma.Decimal
  yearToDateDebit: Prisma.Decimal
  yearToDateCredit: Prisma.Decimal
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
  const ownYearToDateById = new Map<string, number>()
  const ownYearToDateDebitById = new Map<string, number>()
  const ownYearToDateCreditById = new Map<string, number>()
  const ownYearToDateBalanceById = new Map<string, number>()

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
    const yearToDateDebit = roundMoney(Number(account.yearToDateDebit))
    const yearToDateCredit = roundMoney(Number(account.yearToDateCredit))
    const yearToDateAmount = calculateYearToDateAmount({
      name: account.name,
      type: account.type,
      code: account.code,
      debit: yearToDateDebit,
      credit: yearToDateCredit,
    })
    const yearToDateBalance = calculateYearToDateBalance({
      name: account.name,
      type: account.type,
      code: account.code,
      debit: yearToDateDebit,
      credit: yearToDateCredit,
    })
    ownYearToDateById.set(account.id, yearToDateAmount)
    ownYearToDateDebitById.set(account.id, yearToDateDebit)
    ownYearToDateCreditById.set(account.id, yearToDateCredit)
    ownYearToDateBalanceById.set(account.id, yearToDateBalance)

    return {
      ...serializeAccount(account),
      openingBalancePeriod: openingBalance?.period ?? null,
      openingDebit,
      openingCredit,
      openingBalance: ownBalance,
      openingBalanceTotal: ownBalance,
      yearToDateAmount,
      yearToDateDebit,
      yearToDateCredit,
      yearToDateAmountTotal: yearToDateAmount,
      yearToDateDebitTotal: yearToDateDebit,
      yearToDateCreditTotal: yearToDateCredit,
      yearToDateBalance,
      yearToDateBalanceTotal: yearToDateBalance,
    }
  })

  const totalById = new Map<string, number>()
  const calculateTotal = (accountId: string): number => {
    const cached = totalById.get(accountId)
    if (cached !== undefined) return cached
    const children = childrenByParent.get(accountId) ?? []
    const total = children.length > 0
      ? children.reduce((sum, childId) => roundMoney(sum + calculateTotal(childId)), 0)
      : roundMoney(ownBalanceById.get(accountId) ?? 0)
    totalById.set(accountId, total)
    return total
  }
  const yearToDateTotalById = new Map<string, number>()
  const yearToDateDebitTotalById = new Map<string, number>()
  const yearToDateCreditTotalById = new Map<string, number>()
  const yearToDateBalanceTotalById = new Map<string, number>()
  const calculateNumericTotal = (
    accountId: string,
    ownById: Map<string, number>,
    totalById: Map<string, number>,
  ): number => {
    const cached = totalById.get(accountId)
    if (cached !== undefined) return cached
    const childrenTotal = (childrenByParent.get(accountId) ?? [])
      .reduce((sum, childId) => roundMoney(sum + calculateNumericTotal(childId, ownById, totalById)), 0)
    const total = roundMoney((ownById.get(accountId) ?? 0) + childrenTotal)
    totalById.set(accountId, total)
    return total
  }

  return serialized.map(account => ({
    ...account,
    openingBalanceTotal: calculateTotal(account.id),
    yearToDateAmountTotal: calculateNumericTotal(account.id, ownYearToDateById, yearToDateTotalById),
    yearToDateDebitTotal: calculateNumericTotal(account.id, ownYearToDateDebitById, yearToDateDebitTotalById),
    yearToDateCreditTotal: calculateNumericTotal(account.id, ownYearToDateCreditById, yearToDateCreditTotalById),
    yearToDateBalanceTotal: calculateNumericTotal(account.id, ownYearToDateBalanceById, yearToDateBalanceTotalById),
  }))
}

function yearToDateValues(input: {
  yearToDateAmount?: number
  yearToDateDebit?: number
  yearToDateCredit?: number
}, type: AccountType, code: string, name: string) {
  const explicitDebit = input.yearToDateDebit !== undefined
  const explicitCredit = input.yearToDateCredit !== undefined
  if (explicitDebit || explicitCredit) {
    const debit = roundMoney(input.yearToDateDebit ?? 0)
    const credit = roundMoney(input.yearToDateCredit ?? 0)
    return {
      debit,
      credit,
      amount: calculateYearToDateAmount({ name, type, code, debit, credit }),
    }
  }

  const amount = roundMoney(input.yearToDateAmount ?? 0)
  const creditNormal = ['LIABILITY', 'EQUITY', 'REVENUE'].includes(type) || (type === 'CURRENT_ACCOUNT' && /^2/.test(code))
  return {
    debit: creditNormal ? 0 : amount,
    credit: creditNormal ? amount : 0,
    amount,
  }
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

  const nextLevel = parent ? parent.level + 1 : 1
  const openingDebit = parsed.data.openingDebit ?? 0
  const openingCredit = parsed.data.openingCredit ?? 0
  if ((openingDebit > 0 || openingCredit > 0) && !canEditOpeningBalance(nextLevel, false)) {
    return apiError('一级科目不支持单独录入期初余额，请在其下级二级科目中录入。', 400)
  }

  try {
    const account = await prisma.$transaction(async tx => {
      const created = await tx.finAccount.create({
        data: (() => {
          const ytd = yearToDateValues(parsed.data, parsed.data.type, parsed.data.code, parsed.data.name)
          return {
            code: parsed.data.code,
            name: parsed.data.name,
            type: parsed.data.type,
            companyId: companyScope.companyId,
            parentId: parent?.id ?? null,
            level: parent ? parent.level + 1 : 1,
            sortOrder: parsed.data.sortOrder,
            isSystem: parsed.data.isSystem,
            notes: parsed.data.notes,
            yearToDateAmount: new Prisma.Decimal(ytd.amount),
            yearToDateDebit: new Prisma.Decimal(ytd.debit),
            yearToDateCredit: new Prisma.Decimal(ytd.credit),
          }
        })(),
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
