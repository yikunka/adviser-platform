import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { logAudit } from '@/lib/audit/logger'
import { prisma } from '@/lib/db/prisma'
import { journalEntryCreateSchema, journalEntryFilterSchema } from '@/lib/financial/schemas'
import { serializeJournalEntriesWithHierarchy, serializeJournalEntryWithHierarchy, loadCompanyAccountMap } from '@/lib/financial/journal-entry-serialization'
import { resolveJournalCompanyScope } from '@/lib/financial/company-scope'
import {
  assertCompanyAccessible,
  resolveCompanyAccess,
} from '@/lib/company-access'
import { assertFinancialManager, requireFinancialReadRole, requireFinancialWriteRole } from '@/lib/financial/api-guard'
import { generateVoucherNo, parseYmdDate, periodFromDate, validateBalance } from '@/lib/financial/utils'

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

export async function GET(req: NextRequest) {
  const { session, error } = await requireFinancialReadRole()
  if (error) return error

  const parsed = journalEntryFilterSchema.safeParse({
    period: req.nextUrl.searchParams.get('period') || undefined,
    status: req.nextUrl.searchParams.get('status') || undefined,
    search: req.nextUrl.searchParams.get('search') || undefined,
    companyId: req.nextUrl.searchParams.get('companyId') || undefined,
  })
  if (!parsed.success) return apiError('Invalid journal filters.')

  const access = await resolveCompanyAccess(session!.user.id, session!.user.role)
  if (parsed.data.companyId && !(await assertCompanyAccessible(access, parsed.data.companyId))) {
    return apiError('Forbidden', 403)
  }

  const where: Prisma.JournalEntryWhereInput = {
    ...(!parsed.data.companyId && access.kind === 'restricted' ? { companyId: { in: access.companyIds } } : {}),
    ...(parsed.data.period ? { period: parsed.data.period } : {}),
    ...(parsed.data.status ? { status: parsed.data.status } : {}),
    ...(parsed.data.companyId ? { companyId: parsed.data.companyId } : {}),
    ...(parsed.data.search
      ? {
          OR: [
            { voucherNo: { contains: parsed.data.search, mode: 'insensitive' } },
            { description: { contains: parsed.data.search, mode: 'insensitive' } },
          ],
        }
      : {}),
  }

  const entries = await prisma.journalEntry.findMany({
    where,
    include: {
      company: { select: { id: true, nameEn: true, companyCode: true } },
      createdBy: { select: { id: true, nameEn: true, email: true } },
      lines: {
        include: {
          account: { select: { id: true, code: true, name: true, type: true, level: true, parentId: true } },
        },
        orderBy: { lineNum: 'asc' },
      },
    },
    orderBy: [{ entryDate: 'desc' }, { voucherNo: 'desc' }],
  })

  return NextResponse.json({ entries: await serializeJournalEntriesWithHierarchy(entries) })
}

export async function POST(req: NextRequest) {
  const { session, error } = await requireFinancialWriteRole()
  if (error) return error

  const body = await req.json().catch(() => null)
  const parsed = journalEntryCreateSchema.safeParse(body)
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message || 'Please check the journal entry form.'
    return NextResponse.json(
      { error: 'Invalid journal entry input', toast: message, details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const lineError = validateJournalLines(parsed.data.lines)
  if (lineError) return apiError(lineError)

  const access = await resolveCompanyAccess(session!.user.id, session!.user.role)
  if (!(await assertCompanyAccessible(access, parsed.data.companyId))) {
    return apiError('Forbidden', 403)
  }
  const companyScope = await resolveJournalCompanyScope(parsed.data.companyId)
  if (!companyScope.companyId) return apiError('Selected company does not exist.', 400)
  const managerError = await assertFinancialManager(session!, companyScope.companyId)
  if (managerError) return managerError

  const accountCount = await prisma.finAccount.count({
    where: { companyId: companyScope.companyId, id: { in: parsed.data.lines.map(line => line.accountId) } },
  })
  if (accountCount !== new Set(parsed.data.lines.map(line => line.accountId)).size) {
    return apiError('One or more selected accounts do not belong to this company.', 400)
  }

  try {
    const entry = await prisma.$transaction(async tx => {
      const entryDate = parseYmdDate(parsed.data.entryDate)
      const voucherNo = await generateVoucherNo(entryDate, tx)
      return tx.journalEntry.create({
        data: {
          voucherNo,
          entryDate,
          description: parsed.data.description,
          period: periodFromDate(entryDate),
          attachments: parsed.data.attachments,
          companyId: companyScope.companyId,
          createdById: session.user.id,
          lines: {
            create: parsed.data.lines.map((line, index) => ({
              accountId: line.accountId,
              lineNum: index + 1,
              description: line.description || parsed.data.description,
              debit: new Prisma.Decimal(line.debit),
              credit: new Prisma.Decimal(line.credit),
              notes: line.notes,
            })),
          },
        },
        include: {
          company: { select: { id: true, nameEn: true, companyCode: true } },
          createdBy: { select: { id: true, nameEn: true, email: true } },
          lines: {
            include: {
              account: { select: { id: true, code: true, name: true, type: true, level: true, parentId: true } },
            },
            orderBy: { lineNum: 'asc' },
          },
        },
      })
    })

    await logAudit(session.user.id, 'CREATE', 'JournalEntry', entry.id, null, entry)
    const accountById = await loadCompanyAccountMap(companyScope.companyId)
    return NextResponse.json(
      {
        entry: serializeJournalEntryWithHierarchy(entry, accountById),
        message: 'Journal entry created.',
        toast: 'Journal entry created.',
      },
      { status: 201 },
    )
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return apiError('Voucher number conflict. Please try again.', 409)
    }
    throw err
  }
}
