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
  quarterLabel: string
  at: Date
}

/** Calendar quarter bounds in local wall time (caller should pass HKT-aligned "now"). */
export function calendarQuarterRange(date = new Date()) {
  const year = date.getFullYear()
  const q = Math.floor(date.getMonth() / 3) // 0..3
  const start = new Date(year, q * 3, 1, 0, 0, 0, 0)
  const end = new Date(year, q * 3 + 3, 1, 0, 0, 0, 0)
  return {
    year,
    quarter: q + 1,
    start,
    end,
    label: `Q${q + 1} ${year}`,
  }
}

export function previousCalendarQuarterRange(date = new Date()) {
  const { start } = calendarQuarterRange(date)
  const prev = new Date(start)
  prev.setDate(prev.getDate() - 1)
  return calendarQuarterRange(prev)
}

export function classifyDdrCompliance(opts: {
  now?: Date
  /** When the subject first became subject to DDR (ACTIVE / first relevant date). */
  subjectSince: Date
  /** Latest DDR timestamp (company effectiveDate/createdAt, person uploadedAt). */
  lastDdrAt: Date | null
  /** True if a DDR exists inside the current calendar quarter. */
  hasCurrentQuarterDdr: boolean
}): DdrComplianceStatus {
  if (opts.hasCurrentQuarterDdr) return 'ok'
  const now = opts.now ?? new Date()
  const current = calendarQuarterRange(now)
  const previous = previousCalendarQuarterRange(now)

  // New this quarter: still due for first/current filing, not yet "overdue prior quarter"
  if (opts.subjectSince.getTime() >= current.start.getTime()) return 'due'

  const last = opts.lastDdrAt
  if (!last || last.getTime() < previous.start.getTime()) return 'overdue'
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

/** Hard gate: KYC may only move to APPROVED when a PERSON_DDR exists in the current calendar quarter. */
export async function assertPersonDdrForApproval(keyPersonId: string, now = new Date()) {
  const { start, end, label } = calendarQuarterRange(now)
  const ok = await personHasDdrInRange(keyPersonId, start, end)
  if (!ok) {
    throw new Error(
      `Cannot approve KYC without a PERSON_DDR filed for ${label}. Complete four-step screening, generate the person DDR, then approve.`,
    )
  }
}

export async function listDdrComplianceTodos(now = new Date(), limit = 40): Promise<DdrTodoItem[]> {
  const current = calendarQuarterRange(now)
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
      where: {
        OR: [
          { kycStatus: 'APPROVED' },
          { kycStatus: { in: ['SUBMITTED', 'PENDING_INFO'] } },
        ],
      },
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

  function inCurrentQuarter(dates: Date[] | undefined): boolean {
    if (!dates?.length) return false
    return dates.some(d => d.getTime() >= current.start.getTime() && d.getTime() < current.end.getTime())
  }

  for (const company of companies) {
    const dates = companyDdrById.get(company.id)
    const lastDdrAt = latestOf(dates)
    const hasCurrent = inCurrentQuarter(dates)
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
          ? `公司 DDR 已逾期 · ${current.label}`
          : `公司 DDR 本季到期 · ${current.label}`,
      quarterLabel: current.label,
      at: lastDdrAt ?? company.createdAt,
    })
  }

  for (const person of persons) {
    const dates = personDdrById.get(person.id)
    const lastDdrAt = latestOf(dates)
    const hasCurrent = inCurrentQuarter(dates)
    const subjectSince = person.kycApprovedAt ?? person.createdAt

    if (person.kycStatus !== 'APPROVED') {
      if (hasCurrent) continue
      items.push({
        id: `person-${person.id}`,
        kind: 'ddr_due',
        subjectType: 'PERSON',
        href: `/admin/kyc/${person.id}`,
        title: person.kycCode ? `${person.kycCode} · ${person.nameEn}` : person.nameEn,
        detail: `自然人 DDR 待生成（批准前强制）· ${current.label}`,
        quarterLabel: current.label,
        at: lastDdrAt ?? person.createdAt,
      })
      continue
    }

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
          ? `自然人 DDR 已逾期 · ${current.label}`
          : `自然人 DDR 本季到期 · ${current.label}`,
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
