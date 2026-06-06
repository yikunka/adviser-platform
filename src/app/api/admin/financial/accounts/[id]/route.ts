import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { logAudit } from '@/lib/audit/logger'
import { requireRole } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'
import { isDescendantAccount } from '@/lib/financial/account-tree'
import { accountUpdateSchema } from '@/lib/financial/schemas'
import { serializeAccount } from '@/lib/financial/serializers'
import { assertCompanyAccessible, resolveCompanyAccess } from '@/lib/company-access'
import { canEditOpeningBalance } from '@/lib/financial/opening-balance'
import { signedLineAmount } from '@/lib/financial/utils'
import { calculateYearToDateAmount } from '@/lib/financial/year-to-date'

function apiError(error: string, status = 400) {
  return NextResponse.json({ error, toast: error }, { status })
}

function defaultOpeningPeriod() {
  return `${new Date().getUTCFullYear()}-01`
}

function hasPayloadField(body: unknown, field: string) {
  return Boolean(
    body
    && typeof body === 'object'
    && !Array.isArray(body)
    && Object.prototype.hasOwnProperty.call(body, field),
  )
}

function splitLegacyYearToDateAmount(amount: number, type: string, code: string) {
  const creditNormal = ['LIABILITY', 'EQUITY', 'REVENUE'].includes(type) || (type === 'CURRENT_ACCOUNT' && /^2/.test(code))
  return {
    debit: creditNormal ? 0 : amount,
    credit: creditNormal ? amount : 0,
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, error } = await requireRole('STAFF', { adminMenu: 'financial' })
  if (error) return error

  const { id } = await params
  const body = await req.json().catch(() => null)
  const openingBalanceRequested = ['openingDebit', 'openingCredit', 'openingBalancePeriod']
    .some(field => hasPayloadField(body, field))
  const yearToDateRequested = ['yearToDateDebit', 'yearToDateCredit', 'yearToDateAmount']
    .some(field => hasPayloadField(body, field))
  const parsed = accountUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid account input', toast: 'Please check the account form.', details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const before = await prisma.finAccount.findUnique({ where: { id } })
  if (!before) return apiError('Account not found.', 404)
  if (!before.companyId) return apiError('Legacy shared accounts cannot be edited from a company ledger.', 400)

  const access = await resolveCompanyAccess(session.user.id, session.user.role)
  if (!(await assertCompanyAccessible(access, before.companyId))) return apiError('Forbidden', 403)

  if (parsed.data.code && parsed.data.code !== before.code) {
    const conflict = await prisma.finAccount.findFirst({
      where: { companyId: before.companyId, code: parsed.data.code, NOT: { id } },
    })
    if (conflict) return apiError('Account code already exists.', 409)
  }

  const parentId = hasPayloadField(body, 'parentId') ? parsed.data.parentId : before.parentId
  let parent: { id: string; level: number } | null = null
  if (parentId) {
    if (parentId === id) return apiError('An account cannot be its own parent.')
    const accounts = await prisma.finAccount.findMany({
      where: { companyId: before.companyId },
      select: { id: true, code: true, name: true, parentId: true, level: true, sortOrder: true },
    })
    if (isDescendantAccount(accounts, id, parentId)) {
      return apiError('An account cannot be moved under one of its children.')
    }
    parent = await prisma.finAccount.findFirst({
      where: { id: parentId, companyId: before.companyId },
      select: { id: true, level: true },
    })
    if (!parent) return apiError('Parent account does not exist.', 404)
    if (parent.level >= 4) return apiError('Parent account level is too deep for a child account.')
  }

  try {
    const account = await prisma.$transaction(async tx => {
      const nextType = parsed.data.type ?? before.type
      const nextCode = parsed.data.code ?? before.code
      const nextName = parsed.data.name ?? before.name
      const nextLevel = parent ? parent.level + 1 : (hasPayloadField(body, 'parentId') ? 1 : before.level)
      const childCount = await tx.finAccount.count({ where: { parentId: id } })
      const openingDebit = parsed.data.openingDebit ?? 0
      const openingCredit = parsed.data.openingCredit ?? 0
      if (openingBalanceRequested && (openingDebit > 0 || openingCredit > 0) && !canEditOpeningBalance(nextLevel, childCount > 0)) {
        throw new Error('OPENING_BALANCE_NOT_EDITABLE')
      }

      const legacyYearToDate = hasPayloadField(body, 'yearToDateAmount')
        ? splitLegacyYearToDateAmount(parsed.data.yearToDateAmount ?? 0, nextType, nextCode)
        : null
      const yearToDateDebit = hasPayloadField(body, 'yearToDateDebit')
        ? parsed.data.yearToDateDebit ?? 0
        : legacyYearToDate?.debit ?? Number(before.yearToDateDebit)
      const yearToDateCredit = hasPayloadField(body, 'yearToDateCredit')
        ? parsed.data.yearToDateCredit ?? 0
        : legacyYearToDate?.credit ?? Number(before.yearToDateCredit)
      const yearToDateAmount = yearToDateRequested
        ? calculateYearToDateAmount({
            name: nextName,
            type: nextType,
            code: nextCode,
            debit: yearToDateDebit,
            credit: yearToDateCredit,
          })
        : undefined

      const updated = await tx.finAccount.update({
        where: { id },
        data: {
          ...(hasPayloadField(body, 'code') && parsed.data.code !== undefined ? { code: parsed.data.code } : {}),
          ...(hasPayloadField(body, 'name') && parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
          ...(hasPayloadField(body, 'type') && parsed.data.type !== undefined ? { type: parsed.data.type } : {}),
          ...(hasPayloadField(body, 'sortOrder') && parsed.data.sortOrder !== undefined ? { sortOrder: parsed.data.sortOrder } : {}),
          ...(hasPayloadField(body, 'isSystem') && parsed.data.isSystem !== undefined ? { isSystem: parsed.data.isSystem } : {}),
          ...(hasPayloadField(body, 'notes') && parsed.data.notes !== undefined ? { notes: parsed.data.notes } : {}),
          ...(yearToDateRequested
            ? {
                yearToDateAmount: new Prisma.Decimal(yearToDateAmount ?? 0),
                yearToDateDebit: new Prisma.Decimal(yearToDateDebit),
                yearToDateCredit: new Prisma.Decimal(yearToDateCredit),
              }
            : {}),
          ...(hasPayloadField(body, 'parentId')
            ? { parentId: parent?.id ?? null, level: parent ? parent.level + 1 : 1 }
            : {}),
        },
        include: { parent: { select: { id: true, code: true, name: true } } },
      })

      if (openingBalanceRequested) {
        const latestOpeningBalance = await tx.accountBalance.findFirst({
          where: { accountId: id },
          orderBy: [{ period: 'desc' }],
          select: { period: true },
        })
        const openingDebit = parsed.data.openingDebit ?? 0
        const openingCredit = parsed.data.openingCredit ?? 0
        const period = parsed.data.openingBalancePeriod ?? latestOpeningBalance?.period ?? defaultOpeningPeriod()
        const endingBalance = signedLineAmount({
          accountId: updated.id,
          accountType: updated.type,
          accountCode: updated.code,
          debit: openingDebit,
          credit: openingCredit,
        })

        await tx.accountBalance.upsert({
          where: { accountId_period: { accountId: id, period } },
          create: {
            accountId: id,
            period,
            openingDebit: new Prisma.Decimal(openingDebit),
            openingCredit: new Prisma.Decimal(openingCredit),
            closingDebit: new Prisma.Decimal(openingDebit),
            closingCredit: new Prisma.Decimal(openingCredit),
            endingBalance: new Prisma.Decimal(endingBalance),
          },
          update: {
            openingDebit: new Prisma.Decimal(openingDebit),
            openingCredit: new Prisma.Decimal(openingCredit),
            closingDebit: new Prisma.Decimal(openingDebit),
            closingCredit: new Prisma.Decimal(openingCredit),
            endingBalance: new Prisma.Decimal(endingBalance),
          },
        })
      }

      return updated
    })

    await logAudit(session.user.id, 'UPDATE', 'FinAccount', id, before, account)
    return NextResponse.json({ account: serializeAccount(account), message: 'Account updated.', toast: 'Account updated.' })
  } catch (err) {
    if (err instanceof Error && err.message === 'OPENING_BALANCE_NOT_EDITABLE') {
      return apiError('此科目不支持单独录入期初余额，请在下级科目中录入。', 400)
    }
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
    include: { _count: { select: { journalLines: true } } },
  })
  if (!before) return apiError('Account not found.', 404)
  if (!before.companyId) return apiError('Legacy shared accounts cannot be deleted from a company ledger.', 400)
  const access = await resolveCompanyAccess(session.user.id, session.user.role)
  if (!(await assertCompanyAccessible(access, before.companyId))) return apiError('Forbidden', 403)
  if (before.isSystem) return apiError('System accounts cannot be deleted.', 400)
  if (before._count.journalLines > 0) {
    return apiError('Account has journal entries and cannot be deleted.', 409)
  }
  const nonOpeningLedgerEntries = await prisma.ledger.count({
    where: { accountId: id, entryId: { not: null } },
  })
  if (nonOpeningLedgerEntries > 0) {
    return apiError('Account has posted journal activity and cannot be deleted.', 409)
  }

  await prisma.$transaction(async tx => {
    await tx.accountBalance.deleteMany({ where: { accountId: id } })
    await tx.ledger.deleteMany({ where: { accountId: id, entryId: null } })
    await tx.finAccount.delete({ where: { id } })
  })
  await logAudit(session.user.id, 'DELETE', 'FinAccount', id, before, null)
  return NextResponse.json({ success: true, message: 'Account deleted.', toast: 'Account deleted.' })
}
