import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { requireRole } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'
import { ledgerFilterSchema } from '@/lib/financial/schemas'
import { serializeLedgerEntry } from '@/lib/financial/serializers'
import { calculateRunningBalance } from '@/lib/financial/utils'

function apiError(error: string, status = 400) {
  return NextResponse.json({ error, toast: error }, { status })
}

function periodRange(period: string) {
  const [year, month] = period.split('-').map(Number)
  const start = new Date(Date.UTC(year, month - 1, 1))
  const end = new Date(Date.UTC(year, month, 1))
  return { start, end }
}

export async function GET(req: NextRequest) {
  const { error } = await requireRole('STAFF', { adminMenu: 'financial' })
  if (error) return error

  const rawAccountId = req.nextUrl.searchParams.get('accountId') || undefined
  const parsed = ledgerFilterSchema.safeParse({
    accountId: rawAccountId === 'ALL' ? undefined : rawAccountId,
    accountType: req.nextUrl.searchParams.get('accountType') || undefined,
    period: req.nextUrl.searchParams.get('period') || undefined,
    voucherNo: req.nextUrl.searchParams.get('voucherNo') || undefined,
  })
  if (!parsed.success) return apiError('Invalid ledger filters.')

  const range = parsed.data.period ? periodRange(parsed.data.period) : null
  const where: Prisma.LedgerWhereInput = {
    ...(parsed.data.accountId ? { accountId: parsed.data.accountId } : {}),
    ...(parsed.data.accountType ? { account: { type: parsed.data.accountType } } : {}),
    ...(parsed.data.voucherNo ? { voucherNo: { contains: parsed.data.voucherNo, mode: 'insensitive' } } : {}),
    ...(range ? { date: { gte: range.start, lt: range.end } } : {}),
    entry: { status: 'POSTED' },
  }

  const ledgers = await prisma.ledger.findMany({
    where,
    include: { account: { select: { id: true, code: true, name: true, type: true } } },
    orderBy: [{ date: 'asc' }, { lineNum: 'asc' }, { voucherNo: 'asc' }],
  })

  const withRunningBalance = calculateRunningBalance(
    ledgers.map(entry => ({
      ...entry,
      accountType: entry.account.type,
      accountCode: entry.account.code,
    })),
  )

  return NextResponse.json({
    ledgers: withRunningBalance.map(entry => serializeLedgerEntry({ ...entry, balance: entry.balance })),
  })
}
