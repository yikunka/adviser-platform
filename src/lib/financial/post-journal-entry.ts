import { Prisma } from '@prisma/client'
import type { Session } from 'next-auth'
import { logAudit } from '@/lib/audit/logger'
import { prisma } from '@/lib/db/prisma'
import { serializeJournalEntry } from '@/lib/financial/serializers'
import { roundMoney, signedLineAmount } from '@/lib/financial/utils'
import { assertCompanyAccessible, resolveCompanyAccess } from '@/lib/company-access'

const journalInclude = {
  company: { select: { id: true, nameEn: true, companyCode: true } },
  createdBy: { select: { id: true, nameEn: true, email: true } },
  lines: {
    include: { account: { select: { id: true, code: true, name: true, type: true } } },
    orderBy: { lineNum: 'asc' as const },
  },
}

function periodFromEntryDate(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
}

type PostResult =
  | { ok: true; entry: ReturnType<typeof serializeJournalEntry> }
  | { ok: false; error: string; status: number }

export async function postJournalEntryById(id: string, session: Session): Promise<PostResult> {
  const before = await prisma.journalEntry.findUnique({ where: { id }, include: journalInclude })
  if (!before) return { ok: false, error: 'Journal entry not found.', status: 404 }
  if (before.status !== 'DRAFT') return { ok: false, error: 'Only pending (draft) journal entries can be posted.', status: 400 }
  if (!before.companyId) return { ok: false, error: 'Journal entry must be assigned to a company before posting.', status: 400 }

  const access = await resolveCompanyAccess(session.user.id, session.user.role)
  if (!(await assertCompanyAccessible(access, before.companyId))) {
    return { ok: false, error: 'Forbidden', status: 403 }
  }

  const sortedLines = before.lines.slice().sort((a, b) => a.lineNum - b.lineNum)

  const entry = await prisma.$transaction(async tx => {
    await tx.ledger.deleteMany({ where: { entryId: id } })

    const balances = new Map<string, number>()
    for (const line of sortedLines) {
      if (!balances.has(line.accountId)) {
        const previous = await tx.ledger.findFirst({
          where: {
            accountId: line.accountId,
            companyId: before.companyId,
            OR: [
              { date: { lt: before.entryDate } },
              { date: before.entryDate, lineNum: { lt: line.lineNum } },
            ],
          },
          orderBy: [{ date: 'desc' }, { lineNum: 'desc' }],
          select: { balance: true },
        })
        if (previous) {
          balances.set(line.accountId, Number(previous.balance))
        } else {
          const opening = await tx.accountBalance.findFirst({
            where: {
              accountId: line.accountId,
              period: { lte: periodFromEntryDate(before.entryDate) },
            },
            orderBy: { period: 'desc' },
            select: { openingDebit: true, openingCredit: true },
          })
          balances.set(
            line.accountId,
            opening
              ? signedLineAmount({
                  accountId: line.accountId,
                  accountType: line.account.type,
                  accountCode: line.account.code,
                  debit: opening.openingDebit,
                  credit: opening.openingCredit,
                })
              : 0,
          )
        }
      }

      const nextBalance = roundMoney(
        (balances.get(line.accountId) ?? 0) +
          signedLineAmount({
            accountId: line.accountId,
            accountType: line.account.type,
            accountCode: line.account.code,
            debit: line.debit,
            credit: line.credit,
          }),
      )
      balances.set(line.accountId, nextBalance)

      await tx.ledger.create({
        data: {
          accountId: line.accountId,
          entryId: id,
          companyId: before.companyId,
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
  return { ok: true, entry: serializeJournalEntry(entry) }
}

export async function postJournalEntriesBatch(
  ids: string[],
  session: Session,
): Promise<{ posted: ReturnType<typeof serializeJournalEntry>[]; errors: { id: string; error: string }[] }> {
  const uniqueIds = [...new Set(ids)]
  const entries = await prisma.journalEntry.findMany({
    where: { id: { in: uniqueIds } },
    select: { id: true, entryDate: true, voucherNo: true, status: true },
  })

  const entryById = new Map(entries.map(entry => [entry.id, entry]))
  const missing = uniqueIds.filter(id => !entryById.has(id))
  const errors: { id: string; error: string }[] = missing.map(id => ({ id, error: 'Journal entry not found.' }))

  const draftIds = uniqueIds
    .filter(id => entryById.has(id))
    .filter(id => {
      const entry = entryById.get(id)!
      if (entry.status !== 'DRAFT') {
        errors.push({ id, error: `凭证 ${entry.voucherNo} 不是待过账状态。` })
        return false
      }
      return true
    })
    .sort((a, b) => {
      const left = entryById.get(a)!
      const right = entryById.get(b)!
      const dateCompare = left.entryDate.getTime() - right.entryDate.getTime()
      if (dateCompare !== 0) return dateCompare
      return left.voucherNo.localeCompare(right.voucherNo)
    })

  const posted: ReturnType<typeof serializeJournalEntry>[] = []
  for (const id of draftIds) {
    const result = await postJournalEntryById(id, session)
    if (result.ok) {
      posted.push(result.entry)
    } else {
      errors.push({ id, error: result.error })
    }
  }

  return { posted, errors }
}
