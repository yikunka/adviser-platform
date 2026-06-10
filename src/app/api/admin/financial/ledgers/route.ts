import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { requireRole } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'
import { ledgerFilterSchema } from '@/lib/financial/schemas'
import { serializeLedgerEntry } from '@/lib/financial/serializers'
import {
  assertCompanyAccessible,
  resolveCompanyAccess,
} from '@/lib/company-access'

function apiError(error: string, status = 400) {
  return NextResponse.json({ error, toast: error }, { status })
}

function periodRange(period: string) {
  const [year, month] = period.split('-').map(Number)
  const start = new Date(Date.UTC(year, month - 1, 1))
  const end = new Date(Date.UTC(year, month, 1))
  return { start, end }
}

function parseYmdDate(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day))
}

function nextUtcDay(value: string) {
  const date = parseYmdDate(value)
  date.setUTCDate(date.getUTCDate() + 1)
  return date
}

function ledgerDateFilter(input: { period?: string; startDate?: string; endDate?: string }) {
  const period = input.period ? periodRange(input.period) : null
  let gte = period?.start
  let lt = period?.end

  if (input.startDate) {
    const start = parseYmdDate(input.startDate)
    gte = gte && gte > start ? gte : start
  }

  if (input.endDate) {
    const end = nextUtcDay(input.endDate)
    lt = lt && lt < end ? lt : end
  }

  if (!gte && !lt) return undefined
  return {
    ...(gte ? { gte } : {}),
    ...(lt ? { lt } : {}),
  }
}

export async function GET(req: NextRequest) {
  const { session, error } = await requireRole('STAFF', { adminMenu: 'financial' })
  if (error) return error

  const rawAccountId = req.nextUrl.searchParams.get('accountId') || undefined
  const rawAccountIds = req.nextUrl.searchParams.get('accountIds') || ''
  const accountIds = rawAccountIds
    .split(',')
    .map(id => id.trim())
    .filter(id => id && id !== 'ALL')
  const parsed = ledgerFilterSchema.safeParse({
    accountId: rawAccountId === 'ALL' ? undefined : rawAccountId,
    accountIds: accountIds.length > 0 ? accountIds : undefined,
    accountType: req.nextUrl.searchParams.get('accountType') || undefined,
    period: req.nextUrl.searchParams.get('period') || undefined,
    startDate: req.nextUrl.searchParams.get('startDate') || undefined,
    endDate: req.nextUrl.searchParams.get('endDate') || undefined,
    voucherNo: req.nextUrl.searchParams.get('voucherNo') || undefined,
    companyId: req.nextUrl.searchParams.get('companyId') || undefined,
  })
  if (!parsed.success) return apiError('Invalid ledger filters.')

  const access = await resolveCompanyAccess(session!.user.id, session!.user.role)
  if (parsed.data.companyId && !(await assertCompanyAccessible(access, parsed.data.companyId))) {
    return apiError('Forbidden', 403)
  }
  const dateFilter = ledgerDateFilter(parsed.data)
  const selectedAccountIds = parsed.data.accountIds?.length
    ? parsed.data.accountIds
    : parsed.data.accountId
      ? [parsed.data.accountId]
      : null
  const where: Prisma.LedgerWhereInput = {
    ...(selectedAccountIds ? { accountId: { in: selectedAccountIds } } : {}),
    ...(parsed.data.accountType ? { account: { type: parsed.data.accountType } } : {}),
    ...(parsed.data.voucherNo ? { voucherNo: { contains: parsed.data.voucherNo, mode: 'insensitive' } } : {}),
    ...(parsed.data.companyId ? { companyId: parsed.data.companyId } : {}),
    ...(!parsed.data.companyId && access.kind === 'restricted' ? { companyId: { in: access.companyIds } } : {}),
    ...(dateFilter ? { date: dateFilter } : {}),
    entry: { status: 'POSTED' },
  }

  const ledgers = await prisma.ledger.findMany({
    where,
    include: {
      account: { select: { id: true, code: true, name: true, type: true } },
      company: { select: { id: true, nameEn: true, companyCode: true } },
    },
    orderBy: [{ date: 'asc' }, { lineNum: 'asc' }, { voucherNo: 'asc' }],
  })

  return NextResponse.json({
    ledgers: ledgers.map(entry => serializeLedgerEntry(entry)),
  })
}
