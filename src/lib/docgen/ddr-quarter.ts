import { prisma } from '@/lib/db/prisma'

export type DdrComplianceStatus = 'ok' | 'due' | 'overdue'

export type DdrTodoKind = 'ddr_due' | 'ddr_overdue'

export type DdrTodoItem = {
  id: string
  kind: DdrTodoKind
  subjectType: 'COMPANY' | 'PERSON'
  href: string
  title: string
  detail: string
  /** Period label, e.g. H1 2026 / H2 2026 */
  quarterLabel: string
  at: Date
}

export type HalfYearRange = {
  year: number
  half: 1 | 2
  start: Date
  /** Exclusive end */
  end: Date
  dueDate: Date
  /** List/notify from this instant (1 month before dueDate) */
  notifyFrom: Date
  label: string
}

/** Semi-annual bounds: H1 = Jan–Jun (due Jun 30), H2 = Jul–Dec (due Dec 31). */
export function calendarHalfYearRange(date = new Date()): HalfYearRange {
  const year = date.getFullYear()
  const month = date.getMonth() // 0–11
  if (month <= 5) {
    const dueDate = new Date(year, 5, 30, 23, 59, 59, 999)
    return {
      year,
      half: 1,
      start: new Date(year, 0, 1, 0, 0, 0, 0),
      end: new Date(year, 6, 1, 0, 0, 0, 0),
      dueDate,
      notifyFrom: dueDateNotifyFrom(dueDate),
      label: `H1 ${year}`,
    }
  }
  const dueDate = new Date(year, 11, 31, 23, 59, 59, 999)
  return {
    year,
    half: 2,
    start: new Date(year, 6, 1, 0, 0, 0, 0),
    end: new Date(year + 1, 0, 1, 0, 0, 0, 0),
    dueDate,
    notifyFrom: dueDateNotifyFrom(dueDate),
    label: `H2 ${year}`,
  }
}

/** @deprecated Use calendarHalfYearRange — kept for callers still naming "quarter". */
export function calendarQuarterRange(date = new Date()) {
  const h = calendarHalfYearRange(date)
  return {
    year: h.year,
    quarter: h.half,
    start: h.start,
    end: h.end,
    label: h.label,
  }
}

export function previousHalfYearRange(date = new Date()): HalfYearRange {
  const { start } = calendarHalfYearRange(date)
  const prev = new Date(start)
  prev.setDate(prev.getDate() - 1)
  return calendarHalfYearRange(prev)
}

/** @deprecated Use previousHalfYearRange */
export function previousCalendarQuarterRange(date = new Date()) {
  return calendarQuarterRange(previousHalfYearRange(date).start)
}

/** One calendar month before the due date (Jun 30 → May 30, Dec 31 → Nov 30). */
export function dueDateNotifyFrom(dueDate: Date): Date {
  const y = dueDate.getFullYear()
  const m = dueDate.getMonth()
  const day = dueDate.getDate()
  // Clamp day so Dec 31 − 1 month stays Nov 30 (not Dec 1 via overflow).
  const lastDayPrevMonth = new Date(y, m, 0).getDate()
  return new Date(y, m - 1, Math.min(day, lastDayPrevMonth), 0, 0, 0, 0)
}

/**
 * First DDR due after subject start (`createdAt` for companies).
 * Open Jan–Jun → Dec 31 same year; open Jul–Dec → Jun 30 next year.
 */
export function firstDdrDueDate(subjectSince: Date): Date {
  const y = subjectSince.getFullYear()
  const m = subjectSince.getMonth()
  if (m <= 5) return new Date(y, 11, 31, 23, 59, 59, 999)
  return new Date(y + 1, 5, 30, 23, 59, 59, 999)
}

export function classifyDdrCompliance(opts: {
  now?: Date
  /** Company createdAt / person kycApprovedAt ?? createdAt */
  subjectSince: Date
  lastDdrAt: Date | null
  /** True if a DDR exists inside the current half-year. */
  hasCurrentQuarterDdr: boolean
}): DdrComplianceStatus {
  if (opts.hasCurrentQuarterDdr) return 'ok'

  const now = opts.now ?? new Date()
  const current = calendarHalfYearRange(now)
  const previous = previousHalfYearRange(now)
  const firstDue = firstDdrDueDate(opts.subjectSince)
  const firstNotify = dueDateNotifyFrom(firstDue)

  // Before the 1-month window of the first due date — not on the list yet
  if (now.getTime() < firstNotify.getTime()) return 'ok'

  const lastCoversHalf = (half: HalfYearRange) =>
    !!opts.lastDdrAt
    && opts.lastDdrAt.getTime() >= half.start.getTime()
    && opts.lastDdrAt.getTime() < half.end.getTime()

  // Missed a prior half that was already an obligation
  if (
    previous.dueDate.getTime() >= firstDue.getTime()
    && now.getTime() > previous.dueDate.getTime()
    && !lastCoversHalf(previous)
  ) {
    // If last DDR is after previous start it might be late filing in current half —
    // only overdue when previous half itself has no covering DDR.
    return 'overdue'
  }

  // Current half is not yet an obligation (first due is a later half)
  if (current.dueDate.getTime() < firstDue.getTime()) return 'ok'

  // Wait until 1 month before current half's due date
  if (now.getTime() < current.notifyFrom.getTime()) return 'ok'

  // Past current due date without a current-half DDR
  if (now.getTime() > current.dueDate.getTime()) return 'overdue'

  return 'due'
}

export async function latestCompanyDdrAt(companyId: string): Promise<Date | null> {
  const doc = await prisma.document.findFirst({
    where: { companyId, documentType: 'DDR', deletedAt: null },
    orderBy: [{ effectiveDate: 'desc' }, { createdAt: 'desc' }],
    select: { effectiveDate: true, createdAt: true },
  })
  if (!doc) return null
  return doc.effectiveDate ?? doc.createdAt
}

export async function companyHasDdrInRange(companyId: string, start: Date, end: Date): Promise<boolean> {
  const count = await prisma.document.count({
    where: {
      companyId,
      documentType: 'DDR',
      deletedAt: null,
      OR: [
        { effectiveDate: { gte: start, lt: end } },
        { AND: [{ effectiveDate: null }, { createdAt: { gte: start, lt: end } }] },
      ],
    },
  })
  return count > 0
}

export async function latestPersonDdrAt(keyPersonId: string): Promise<Date | null> {
  const doc = await prisma.kYCDocument.findFirst({
    where: { keyPersonId, documentType: 'PERSON_DDR' },
    orderBy: { uploadedAt: 'desc' },
    select: { uploadedAt: true },
  })
  return doc?.uploadedAt ?? null
}

export async function personHasDdrInRange(keyPersonId: string, start: Date, end: Date): Promise<boolean> {
  const count = await prisma.kYCDocument.count({
    where: {
      keyPersonId,
      documentType: 'PERSON_DDR',
      uploadedAt: { gte: start, lt: end },
    },
  })
  return count > 0
}

/** Hard gate: KYC may only move to APPROVED when a PERSON_DDR exists in the current half-year. */
export async function assertPersonDdrForApproval(keyPersonId: string, now = new Date()) {
  const { start, end, label } = calendarHalfYearRange(now)
  const ok = await personHasDdrInRange(keyPersonId, start, end)
  if (!ok) {
    throw new Error(
      `Cannot approve KYC without a PERSON_DDR filed for ${label}. Complete four-step screening, generate the person DDR, then approve.`,
    )
  }
}

export async function listDdrComplianceTodos(now = new Date(), limit = 40): Promise<DdrTodoItem[]> {
  const current = calendarHalfYearRange(now)
  const items: DdrTodoItem[] = []

  const [companies, persons, companyDdrDocs, personDdrDocs] = await Promise.all([
    prisma.company.findMany({
      where: { status: 'ACTIVE', deletedAt: null },
      select: {
        id: true,
        nameEn: true,
        companyCode: true,
        createdAt: true,
      },
      orderBy: { nameEn: 'asc' },
    }),
    prisma.keyPerson.findMany({
      where: { kycStatus: 'APPROVED' },
      select: {
        id: true,
        nameEn: true,
        kycCode: true,
        kycStatus: true,
        createdAt: true,
        kycApprovedAt: true,
      },
      orderBy: { updatedAt: 'desc' },
    }),
    prisma.document.findMany({
      where: { documentType: 'DDR', deletedAt: null },
      select: { companyId: true, effectiveDate: true, createdAt: true },
    }),
    prisma.kYCDocument.findMany({
      where: { documentType: 'PERSON_DDR' },
      select: { keyPersonId: true, uploadedAt: true },
    }),
  ])

  const companyDdrById = new Map<string, Date[]>()
  for (const doc of companyDdrDocs) {
    if (!doc.companyId) continue
    const at = doc.effectiveDate ?? doc.createdAt
    const list = companyDdrById.get(doc.companyId) ?? []
    list.push(at)
    companyDdrById.set(doc.companyId, list)
  }

  const personDdrById = new Map<string, Date[]>()
  for (const doc of personDdrDocs) {
    const list = personDdrById.get(doc.keyPersonId) ?? []
    list.push(doc.uploadedAt)
    personDdrById.set(doc.keyPersonId, list)
  }

  function latestOf(dates: Date[] | undefined): Date | null {
    if (!dates?.length) return null
    return dates.reduce((a, b) => (a.getTime() >= b.getTime() ? a : b))
  }

  function inCurrentHalf(dates: Date[] | undefined): boolean {
    if (!dates?.length) return false
    return dates.some(d => d.getTime() >= current.start.getTime() && d.getTime() < current.end.getTime())
  }

  for (const company of companies) {
    const dates = companyDdrById.get(company.id)
    const lastDdrAt = latestOf(dates)
    const hasCurrent = inCurrentHalf(dates)
    const status = classifyDdrCompliance({
      now,
      subjectSince: company.createdAt,
      lastDdrAt,
      hasCurrentQuarterDdr: hasCurrent,
    })
    if (status === 'ok') continue
    items.push({
      id: `company-${company.id}`,
      kind: status === 'overdue' ? 'ddr_overdue' : 'ddr_due',
      subjectType: 'COMPANY',
      href: `/admin/companies/${company.id}`,
      title: company.companyCode ? `${company.companyCode} · ${company.nameEn}` : company.nameEn,
      detail:
        status === 'overdue'
          ? `公司 DDR 已逾期 · ${current.label}（到期 ${current.dueDate.toLocaleDateString('en-HK')}）`
          : `公司 DDR 半年到期 · ${current.label}（到期 ${current.dueDate.toLocaleDateString('en-HK')}）`,
      quarterLabel: current.label,
      at: lastDdrAt ?? company.createdAt,
    })
  }

  for (const person of persons) {
    const dates = personDdrById.get(person.id)
    const lastDdrAt = latestOf(dates)
    const hasCurrent = inCurrentHalf(dates)
    const subjectSince = person.kycApprovedAt ?? person.createdAt

    const status = classifyDdrCompliance({
      now,
      subjectSince,
      lastDdrAt,
      hasCurrentQuarterDdr: hasCurrent,
    })
    if (status === 'ok') continue
    items.push({
      id: `person-${person.id}`,
      kind: status === 'overdue' ? 'ddr_overdue' : 'ddr_due',
      subjectType: 'PERSON',
      href: `/admin/kyc/${person.id}`,
      title: person.kycCode ? `${person.kycCode} · ${person.nameEn}` : person.nameEn,
      detail:
        status === 'overdue'
          ? `自然人 DDR 已逾期 · ${current.label}（到期 ${current.dueDate.toLocaleDateString('en-HK')}）`
          : `自然人 DDR 半年到期 · ${current.label}（到期 ${current.dueDate.toLocaleDateString('en-HK')}）`,
      quarterLabel: current.label,
      at: lastDdrAt ?? subjectSince,
    })
  }

  items.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'ddr_overdue' ? -1 : 1
    return a.at.getTime() - b.at.getTime()
  })

  return items.slice(0, limit)
}
