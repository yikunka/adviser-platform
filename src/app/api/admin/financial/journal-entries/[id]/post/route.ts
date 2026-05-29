import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import type { Session } from 'next-auth'
import { logAudit } from '@/lib/audit/logger'
import { requireRole } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'
import { serializeJournalEntry } from '@/lib/financial/serializers'
import { roundMoney, signedLineAmount } from '@/lib/financial/utils'

const journalInclude = {
  createdBy: { select: { id: true, nameEn: true, email: true } },
  lines: {
    include: { account: { select: { id: true, code: true, name: true, type: true } } },
    orderBy: { lineNum: 'asc' as const },
  },
}

function apiError(error: string, status = 400) {
  return NextResponse.json({ error, toast: error }, { status })
}

async function postJournalEntry(id: string, session: Session) {
  const before = await prisma.journalEntry.findUnique({ where: { id }, include: journalInclude })
  if (!before) return apiError('Journal entry not found.', 404)
  if (before.status !== 'DRAFT') return apiError('Only pending (draft) journal entries can be posted.')

  const sortedLines = before.lines.slice().sort((a, b) => a.lineNum - b.lineNum)

  const entry = await prisma.$transaction(async tx => {
    await tx.ledger.deleteMany({ where: { entryId: id } })

    const balances = new Map<string, number>()
    for (const line of sortedLines) {
      if (!balances.has(line.accountId)) {
        const previous = await tx.ledger.findFirst({
          where: {
            accountId: line.accountId,
            OR: [
              { date: { lt: before.entryDate } },
              { date: before.entryDate, lineNum: { lt: line.lineNum } },
            ],
          },
          orderBy: [{ date: 'desc' }, { lineNum: 'desc' }],
          select: { balance: true },
        })
        balances.set(line.accountId, Number(previous?.balance ?? 0))
      }

      const nextBalance = roundMoney((balances.get(line.accountId) ?? 0) + signedLineAmount({
        accountId: line.accountId,
        accountType: line.account.type,
        debit: line.debit,
        credit: line.credit,
      }))
      balances.set(line.accountId, nextBalance)

      await tx.ledger.create({
        data: {
          accountId: line.accountId,
          entryId: id,
          lineNum: line.lineNum,
          date: before.entryDate,
          voucherNo: before.voucherNo,
          description: line.description || before.description,
          debit: new Prisma.Decimal(line.debit),
          credit: new Prisma.Decimal(line.credit),
          balance: new Prisma.Decimal(nextBalance),
        },
      })
    }

    return tx.journalEntry.update({
      where: { id },
      data: { status: 'POSTED', postedAt: new Date() },
      include: journalInclude,
    })
  })

  await logAudit(session.user.id, 'POST', 'JournalEntry', id, serializeJournalEntry(before), serializeJournalEntry(entry))
  return NextResponse.json({ entry: serializeJournalEntry(entry), message: 'Journal entry posted.', toast: 'Journal entry posted.' })
}

export async function PUT(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, error } = await requireRole('STAFF', { adminMenu: 'financial' })
  if (error) return error

  const { id } = await params
  return postJournalEntry(id, session)
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, error } = await requireRole('STAFF', { adminMenu: 'financial' })
  if (error) return error

  const { id } = await params
  return postJournalEntry(id, session)
}
