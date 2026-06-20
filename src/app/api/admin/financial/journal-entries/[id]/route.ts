import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { logAudit } from '@/lib/audit/logger'
import { prisma } from '@/lib/db/prisma'
import { assertCompanyAccessible, resolveCompanyAccess } from '@/lib/company-access'
import { resolveJournalCompanyScope } from '@/lib/financial/company-scope'
import { assertFinancialManager, requireFinancialReadRole, requireFinancialWriteRole } from '@/lib/financial/api-guard'
import {
  journalEntryInclude,
  loadCompanyAccountMap,
  serializeJournalEntryWithHierarchy,
} from '@/lib/financial/journal-entry-serialization'
import { journalEntryUpdateSchema } from '@/lib/financial/schemas'
import { serializeJournalEntry } from '@/lib/financial/serializers'
import { parseYmdDate, periodFromDate, validateBalance } from '@/lib/financial/utils'

function apiError(error: string, status = 400) {
  return NextResponse.json({ error, toast: error }, { status })
}

function validateJournalLines(lines: { debit: number; credit: number }[]) {
  const invalidLine = lines.find(line => (line.debit > 0 && line.credit > 0) || (line.debit === 0 && line.credit === 0))
  if (invalidLine) return 'Each line must have either debit or credit, but not both.'

  const balance = validateBalance(lines)
  if (!balance.balanced) return 'Total debit must equal total credit.'
  if (balance.totalDebit <= 0) return 'Journal entry total must be greater than zero.'
  return null
}

async function serializeEntryWithCompanyHierarchy(
  entry: Parameters<typeof serializeJournalEntry>[0],
) {
  if (!entry.companyId) return serializeJournalEntry(entry)
  const accountById = await loadCompanyAccountMap(entry.companyId)
  return serializeJournalEntryWithHierarchy(entry, accountById)
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, error } = await requireFinancialReadRole()
  if (error) return error

  const { id } = await params
  const entry = await prisma.journalEntry.findUnique({ where: { id }, include: journalEntryInclude })
  if (!entry) return apiError('Journal entry not found.', 404)
  const access = await resolveCompanyAccess(session!.user.id, session!.user.role)
  if (!entry.companyId || !(await assertCompanyAccessible(access, entry.companyId))) return apiError('Forbidden', 403)

  return NextResponse.json({ entry: await serializeEntryWithCompanyHierarchy(entry) })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, error } = await requireFinancialWriteRole()
  if (error) return error

  const { id } = await params
  const body = await req.json().catch(() => null)
  const parsed = journalEntryUpdateSchema.safeParse(body)
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message || 'Please check the journal entry form.'
    return NextResponse.json(
      { error: 'Invalid journal entry input', toast: message, details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const before = await prisma.journalEntry.findUnique({ where: { id }, include: journalEntryInclude })
  if (!before) return apiError('Journal entry not found.', 404)
  if (before.status !== 'DRAFT' && before.status !== 'CANCELLED') {
    return apiError('只有待过账或已取消的日记账可以编辑。')
  }
  const isReopeningCancelled = before.status === 'CANCELLED'
  const access = await resolveCompanyAccess(session.user.id, session.user.role)
  if (!before.companyId || !(await assertCompanyAccessible(access, before.companyId))) return apiError('Forbidden', 403)
  const currentManagerError = await assertFinancialManager(session, before.companyId)
  if (currentManagerError) return currentManagerError

  if (parsed.data.lines) {
    const lineError = validateJournalLines(parsed.data.lines)
    if (lineError) return apiError(lineError)
  }

  const entryDate = parsed.data.entryDate ? parseYmdDate(parsed.data.entryDate) : before.entryDate
  const description = parsed.data.description ?? before.description
  const companyScope = parsed.data.companyId
    ? await resolveJournalCompanyScope(parsed.data.companyId)
    : { companyId: before.companyId }
  if (parsed.data.companyId) {
    if (!(await assertCompanyAccessible(access, parsed.data.companyId))) return apiError('Forbidden', 403)
    if (!companyScope.companyId) return apiError('Selected company does not exist.', 400)
  }
  if (!companyScope.companyId) return apiError('Journal entry must be assigned to a company before editing lines.')
  if (companyScope.companyId !== before.companyId) {
    const targetManagerError = await assertFinancialManager(session, companyScope.companyId)
    if (targetManagerError) return targetManagerError
  }

  if (parsed.data.lines) {
    const accountCount = await prisma.finAccount.count({
      where: { companyId: companyScope.companyId, id: { in: parsed.data.lines.map(line => line.accountId) } },
    })
    if (accountCount !== new Set(parsed.data.lines.map(line => line.accountId)).size) {
      return apiError('One or more selected accounts do not belong to this company.', 400)
    }
  }

  const entry = await prisma.$transaction(async tx => {
    if (isReopeningCancelled) {
      await tx.ledger.deleteMany({ where: { entryId: id } })
    }

    if (parsed.data.lines) {
      await tx.journalLine.deleteMany({ where: { entryId: id } })
    }

    return tx.journalEntry.update({
      where: { id },
      data: {
        ...(parsed.data.entryDate ? { entryDate, period: periodFromDate(entryDate) } : {}),
        ...(parsed.data.description !== undefined ? { description } : {}),
        ...(parsed.data.companyId !== undefined
          ? { companyId: companyScope.companyId }
          : {}),
        ...(parsed.data.attachments !== undefined ? { attachments: parsed.data.attachments } : {}),
        ...(parsed.data.sourceType !== undefined ? { sourceType: parsed.data.sourceType } : {}),
        ...(isReopeningCancelled ? { status: 'DRAFT', postedAt: null, reversedAt: null } : {}),
        ...(parsed.data.lines
          ? {
              lines: {
                create: parsed.data.lines.map((line, index) => ({
                  accountId: line.accountId,
                  lineNum: index + 1,
                  description: line.description || description,
                  debit: new Prisma.Decimal(line.debit),
                  credit: new Prisma.Decimal(line.credit),
                  notes: line.notes,
                })),
              },
            }
          : {}),
      },
      include: journalEntryInclude,
    })
  })

  await logAudit(session.user.id, 'UPDATE', 'JournalEntry', id, serializeJournalEntry(before), serializeJournalEntry(entry))
  return NextResponse.json({
    entry: await serializeEntryWithCompanyHierarchy(entry),
    message: isReopeningCancelled ? 'Journal entry reopened as draft.' : 'Journal entry updated.',
    toast: isReopeningCancelled ? '日记账已恢复为待过账。' : '日记账已更新。',
  })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, error } = await requireFinancialWriteRole()
  if (error) return error

  const { id } = await params
  const before = await prisma.journalEntry.findUnique({ where: { id }, include: journalEntryInclude })
  if (!before) return apiError('Journal entry not found.', 404)
  if (before.status === 'CANCELLED') return apiError('Journal entry is already cancelled.')
  const access = await resolveCompanyAccess(session.user.id, session.user.role)
  if (!before.companyId || !(await assertCompanyAccessible(access, before.companyId))) return apiError('Forbidden', 403)
  const managerError = await assertFinancialManager(session, before.companyId)
  if (managerError) return managerError

  const entry = await prisma.$transaction(async tx => {
    await tx.ledger.deleteMany({ where: { entryId: id } })
    return tx.journalEntry.update({
      where: { id },
      data: { status: 'CANCELLED', reversedAt: new Date() },
      include: journalEntryInclude,
    })
  })

  await logAudit(session.user.id, 'CANCEL', 'JournalEntry', id, serializeJournalEntry(before), serializeJournalEntry(entry))
  return NextResponse.json({
    entry: await serializeEntryWithCompanyHierarchy(entry),
    message: 'Journal entry cancelled.',
    toast: 'Journal entry cancelled.',
  })
}
