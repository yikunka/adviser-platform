import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { logAudit } from '@/lib/audit/logger'
import { requireRole } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'
import { journalEntryUpdateSchema } from '@/lib/financial/schemas'
import { serializeJournalEntry } from '@/lib/financial/serializers'
import { parseYmdDate, periodFromDate, validateBalance } from '@/lib/financial/utils'
import { assertCompanyAccessible, resolveCompanyAccess } from '@/lib/company-access'
import { resolveJournalCompanyScope } from '@/lib/financial/company-scope'

const journalInclude = {
  company: { select: { id: true, nameEn: true, companyCode: true } },
  createdBy: { select: { id: true, nameEn: true, email: true } },
  lines: {
    include: { account: { select: { id: true, code: true, name: true, type: true } } },
    orderBy: { lineNum: 'asc' as const },
  },
}

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

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, error } = await requireRole('STAFF', { adminMenu: 'financial' })
  if (error) return error

  const { id } = await params
  const entry = await prisma.journalEntry.findUnique({ where: { id }, include: journalInclude })
  if (!entry) return apiError('Journal entry not found.', 404)
  const access = await resolveCompanyAccess(session!.user.id, session!.user.role)
  if (!entry.companyId || !(await assertCompanyAccessible(access, entry.companyId))) return apiError('Forbidden', 403)

  return NextResponse.json({ entry: serializeJournalEntry(entry) })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, error } = await requireRole('STAFF', { adminMenu: 'financial' })
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

  const before = await prisma.journalEntry.findUnique({ where: { id }, include: journalInclude })
  if (!before) return apiError('Journal entry not found.', 404)
  if (before.status !== 'DRAFT') return apiError('Only draft journal entries can be edited.')
  const access = await resolveCompanyAccess(session.user.id, session.user.role)
  if (!before.companyId || !(await assertCompanyAccessible(access, before.companyId))) return apiError('Forbidden', 403)

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

  if (parsed.data.lines) {
    const accountCount = await prisma.finAccount.count({
      where: { companyId: companyScope.companyId, id: { in: parsed.data.lines.map(line => line.accountId) } },
    })
    if (accountCount !== new Set(parsed.data.lines.map(line => line.accountId)).size) {
      return apiError('One or more selected accounts do not belong to this company.', 400)
    }
  }

  const entry = await prisma.$transaction(async tx => {
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
      include: journalInclude,
    })
  })

  await logAudit(session.user.id, 'UPDATE', 'JournalEntry', id, serializeJournalEntry(before), serializeJournalEntry(entry))
  return NextResponse.json({ entry: serializeJournalEntry(entry), message: 'Journal entry updated.', toast: 'Journal entry updated.' })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, error } = await requireRole('STAFF', { adminMenu: 'financial' })
  if (error) return error

  const { id } = await params
  const before = await prisma.journalEntry.findUnique({ where: { id }, include: journalInclude })
  if (!before) return apiError('Journal entry not found.', 404)
  if (before.status === 'CANCELLED') return apiError('Journal entry is already cancelled.')
  const access = await resolveCompanyAccess(session.user.id, session.user.role)
  if (!before.companyId || !(await assertCompanyAccessible(access, before.companyId))) return apiError('Forbidden', 403)

  const entry = await prisma.$transaction(async tx => {
    await tx.ledger.deleteMany({ where: { entryId: id } })
    return tx.journalEntry.update({
      where: { id },
      data: { status: 'CANCELLED', reversedAt: new Date() },
      include: journalInclude,
    })
  })

  await logAudit(session.user.id, 'CANCEL', 'JournalEntry', id, serializeJournalEntry(before), serializeJournalEntry(entry))
  return NextResponse.json({ entry: serializeJournalEntry(entry), message: 'Journal entry cancelled.', toast: 'Journal entry cancelled.' })
}
