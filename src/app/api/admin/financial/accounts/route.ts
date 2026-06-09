import { NextRequest, NextResponse } from 'next/server'
import { Prisma, type AccountType } from '@prisma/client'
import { logAudit } from '@/lib/audit/logger'
import { requireRole } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'
import { accountCreateSchema } from '@/lib/financial/schemas'
import { resolveJournalCompanyScope } from '@/lib/financial/company-scope'
import { serializeAccountsWithRollups } from '@/lib/financial/account-rollup'
import { serializeAccount } from '@/lib/financial/serializers'
import { canEditEnteredBalances } from '@/lib/financial/opening-balance'
import { assertCompanyAccessible, resolveCompanyAccess } from '@/lib/company-access'
import { roundMoney, signedLineAmount } from '@/lib/financial/utils'
import { calculateYearToDateAmount } from '@/lib/financial/year-to-date'
import { ensureDefaultChartOfAccounts } from '@/lib/financial/default-chart-of-accounts'
import { isCreditNormalAccountType } from '@/lib/financial/account-types'

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
  const creditNormal = isCreditNormalAccountType(type, code)
  return {
    debit: creditNormal ? 0 : amount,
    credit: creditNormal ? amount : 0,
    amount,
  }
}

function hasPayloadField(body: unknown, field: string) {
  return Boolean(
    body
    && typeof body === 'object'
    && !Array.isArray(body)
    && Object.prototype.hasOwnProperty.call(body, field),
  )
}

async function clearEnteredBalances(
  tx: Prisma.TransactionClient,
  accountId: string,
) {
  await tx.finAccount.update({
    where: { id: accountId },
    data: {
      yearToDateAmount: new Prisma.Decimal(0),
      yearToDateDebit: new Prisma.Decimal(0),
      yearToDateCredit: new Prisma.Decimal(0),
    },
  })
  await tx.accountBalance.deleteMany({ where: { accountId } })
  await tx.ledger.deleteMany({ where: { accountId, entryId: null } })
}

export async function GET(req: NextRequest) {
  const { session, error } = await requireRole('STAFF', { adminMenu: 'financial' })
  if (error) return error
  const companyId = req.nextUrl.searchParams.get('companyId')
  if (!companyId) return apiError('Company is required.')

  const access = await resolveCompanyAccess(session!.user.id, session!.user.role)
  if (!(await assertCompanyAccessible(access, companyId))) return apiError('Forbidden', 403)

  await ensureDefaultChartOfAccounts(companyId, prisma)

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

  return NextResponse.json({ accounts: serializeAccountsWithRollups(accounts) })
}

export async function POST(req: NextRequest) {
  const { session, error } = await requireRole('STAFF', { adminMenu: 'financial' })
  if (error) return error

  const body = await req.json().catch(() => null)
  const openingBalanceRequested = ['openingDebit', 'openingCredit', 'openingBalancePeriod']
    .some(field => hasPayloadField(body, field))
  const yearToDateRequested = ['yearToDateDebit', 'yearToDateCredit', 'yearToDateAmount']
    .some(field => hasPayloadField(body, field))
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
  const enteredBalancesEditable = canEditEnteredBalances(nextLevel, false)
  const openingDebit = parsed.data.openingDebit ?? 0
  const openingCredit = parsed.data.openingCredit ?? 0
  if ((openingBalanceRequested || yearToDateRequested) && !enteredBalancesEditable) {
    return apiError('此科目不支持单独录入期初余额或本年累计发生数，请在下级科目中录入。', 400)
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
            yearToDateAmount: new Prisma.Decimal(enteredBalancesEditable ? ytd.amount : 0),
            yearToDateDebit: new Prisma.Decimal(enteredBalancesEditable ? ytd.debit : 0),
            yearToDateCredit: new Prisma.Decimal(enteredBalancesEditable ? ytd.credit : 0),
          }
        })(),
        include: { parent: { select: { id: true, code: true, name: true } } },
      })

      if (parent) {
        await clearEnteredBalances(tx, parent.id)
      }

      if (enteredBalancesEditable && (openingDebit > 0 || openingCredit > 0)) {
        const endingBalance = signedLineAmount({
          accountId: created.id,
          accountType: created.type,
          accountCode: created.code,
          debit: openingDebit,
          credit: openingCredit,
        })
        await tx.accountBalance.create({
          data: {
            accountId: created.id,
            period: parsed.data.openingBalancePeriod || defaultOpeningPeriod(),
            openingDebit: new Prisma.Decimal(openingDebit),
            openingCredit: new Prisma.Decimal(openingCredit),
            closingDebit: new Prisma.Decimal(openingDebit),
            closingCredit: new Prisma.Decimal(openingCredit),
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
