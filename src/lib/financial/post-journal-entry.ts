import type { Session } from 'next-auth'
import { logAudit } from '@/lib/audit/logger'
import { prisma } from '@/lib/db/prisma'
import { assertPeriodOpen, PeriodClosedError } from '@/lib/financial/fiscal-periods'
import { writeLedgerRows } from '@/lib/financial/ledger-writer'
import { serializeJournalEntry } from '@/lib/financial/serializers'
import { assertCompanyAccessible, resolveCompanyAccess } from '@/lib/company-access'
import { assertFinancialManager } from '@/lib/financial/api-guard'
import { isDirectlyUnpostableJournalSourceType } from '@/lib/financial/journal-entry-source-types'

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

type UnpostResult = PostResult

export async function postJournalEntryById(id: string, session: Session): Promise<PostResult> {
  const before = await prisma.journalEntry.findUnique({ where: { id }, include: journalInclude })
  if (!before) return { ok: false, error: 'Journal entry not found.', status: 404 }
  if (before.status !== 'DRAFT') return { ok: false, error: 'Only pending (draft) journal entries can be posted.', status: 400 }
  if (!before.companyId) return { ok: false, error: 'Journal entry must be assigned to a company before posting.', status: 400 }

  const access = await resolveCompanyAccess(session.user.id, session.user.role)
  if (!(await assertCompanyAccessible(access, before.companyId))) {
    return { ok: false, error: 'Forbidden', status: 403 }
  }
  const managerError = await assertFinancialManager(session, before.companyId)
  if (managerError) {
    return {
      ok: false,
      error: 'Only the assigned financial manager can perform financial operations for this company.',
      status: 403,
    }
  }
  try {
    await assertPeriodOpen(prisma, before.companyId, periodFromEntryDate(before.entryDate))
  } catch (err) {
    if (err instanceof PeriodClosedError) return { ok: false, error: err.message, status: 400 }
    throw err
  }

  const companyId = before.companyId
  const entry = await prisma.$transaction(async tx => {
    await tx.ledger.deleteMany({ where: { entryId: id } })

    await writeLedgerRows(
      tx,
      {
        id,
        companyId,
        entryDate: before.entryDate,
        voucherNo: before.voucherNo,
        description: before.description,
      },
      before.lines,
    )

    return tx.journalEntry.update({
      where: { id },
      data: { status: 'POSTED', postedAt: new Date() },
      include: journalInclude,
    })
  })

  await logAudit(session.user.id, 'POST', 'JournalEntry', id, serializeJournalEntry(before), serializeJournalEntry(entry))
  return { ok: true, entry: serializeJournalEntry(entry) }
}

export async function unpostJournalEntryById(id: string, session: Session): Promise<UnpostResult> {
  const before = await prisma.journalEntry.findUnique({ where: { id }, include: journalInclude })
  if (!before) return { ok: false, error: 'Journal entry not found.', status: 404 }
  if (before.status !== 'POSTED') return { ok: false, error: '只有已过账的日记账可以撤销过账。', status: 400 }
  if (!before.companyId) return { ok: false, error: 'Journal entry must be assigned to a company before unposting.', status: 400 }
  if (!isDirectlyUnpostableJournalSourceType(before.sourceType)) {
    return { ok: false, error: '子分类账自动生成的凭证不能直接撤销过账，请从源单据作废或红冲。', status: 400 }
  }

  const access = await resolveCompanyAccess(session.user.id, session.user.role)
  if (!(await assertCompanyAccessible(access, before.companyId))) {
    return { ok: false, error: 'Forbidden', status: 403 }
  }
  const managerError = await assertFinancialManager(session, before.companyId)
  if (managerError) {
    return {
      ok: false,
      error: 'Only the assigned financial manager can perform financial operations for this company.',
      status: 403,
    }
  }
  try {
    await assertPeriodOpen(prisma, before.companyId, periodFromEntryDate(before.entryDate))
  } catch (err) {
    if (err instanceof PeriodClosedError) return { ok: false, error: err.message, status: 400 }
    throw err
  }

  const entry = await prisma.$transaction(async tx => {
    await tx.ledger.deleteMany({ where: { entryId: id } })
    return tx.journalEntry.update({
      where: { id },
      data: { status: 'DRAFT', postedAt: null, reversedAt: null },
      include: journalInclude,
    })
  })

  await logAudit(session.user.id, 'UNPOST', 'JournalEntry', id, serializeJournalEntry(before), serializeJournalEntry(entry))
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
