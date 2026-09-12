import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'
import { logAudit } from '@/lib/audit/logger'
import { normalizeSignupEmail } from '@/lib/company/claim-pending-client'
import {
  buildCompanyAccessWhere,
  resolveCompanyAccess,
} from '@/lib/company-access'
import {
  COMPANY_SERVICE_OPTIONS,
  normalizeCompanyServiceTiers,
} from '@/lib/company/service-tiers'
import {
  COMPANY_JURISDICTION_CODE_PREFIX,
  COMPANY_JURISDICTIONS,
} from '@/lib/company/jurisdiction'
import { COMPANY_STATUSES } from '@/lib/company/company-status'
import {
  buildCompanyOwnershipNode,
  computeEffectiveNaturalOwners,
  indexCompaniesById,
  indexCompaniesByName,
  loadAllCompaniesWithMembers,
} from '@/lib/aml/ownershipLookThrough'
import { z } from 'zod'

async function nextCompanyCode(companyType: string): Promise<string> {
  const prefix =
    COMPANY_JURISDICTION_CODE_PREFIX[companyType as keyof typeof COMPANY_JURISDICTION_CODE_PREFIX] ?? 'AA'
  const rows = await prisma.$queryRaw<Array<{ max_no: number | null }>>`
    SELECT MAX(CAST(SUBSTRING("companyCode" FROM 3) AS INTEGER)) AS max_no
    FROM companies
    WHERE "companyCode" ~ ${`^${prefix}[0-9]{5}$`}
  `
  const next = (rows[0]?.max_no ?? 0) + 1
  return `${prefix}${String(next).padStart(5, '0')}`
}

const createSchema = z
  .object({
    nameEn: z.string().min(1).max(200),
    nameZh: z.string().max(200).optional(),
    companyNumber: z.string().max(20).optional(),
    companyType: z.enum(COMPANY_JURISDICTIONS).optional(),
    dateOfIncorporation: z.string().optional(),
    registeredAddress: z.string().max(500).optional(),
    businessNature: z.string().max(500).optional(),
    /** Calendar month of financial year end: 3 = 31 Mar, 12 = 31 Dec */
    financialYearEndMonth: z.union([z.literal(3), z.literal(12)]).optional().nullable(),
    serviceTiers: z.array(z.enum(COMPANY_SERVICE_OPTIONS)).optional(),
    /** Pick from verified CLIENT users (admin UI). */
    clientUserId: z.string().cuid().optional(),
    /** CLIENT signup email when not choosing from list (e.g. not yet verified). */
    clientUserEmail: z.string().max(320).optional(),
    assignedStaffId: z.string().cuid().optional(),
  })
  // clientUserId / clientUserEmail optional — UI may choose "provide later"

export async function GET(req: NextRequest) {
  const { session, error } = await requireRole('STAFF', { adminMenu: 'companies' })
  if (error) return error

  const { searchParams } = req.nextUrl
  const search = searchParams.get('q') ?? ''
  const page = parseInt(searchParams.get('page') ?? '1')
  const requestedLimit = parseInt(searchParams.get('limit') ?? '20')
  const jurisdiction = searchParams.get('jurisdiction') ?? ''
  const status = searchParams.get('status') ?? ''
  const limit = Number.isFinite(requestedLimit)
    ? Math.min(Math.max(requestedLimit, 1), searchParams.get('picker') === '1' ? 500 : 100)
    : 20
  const skip = (page - 1) * limit

  const access = await resolveCompanyAccess(session!.user.id, session!.user.role)

  const accessFilter = buildCompanyAccessWhere(access)
  const jurisdictionFilter =
    jurisdiction && (COMPANY_JURISDICTIONS as readonly string[]).includes(jurisdiction)
      ? { companyType: jurisdiction }
      : {}
  const statusFilter =
    status && (COMPANY_STATUSES as readonly string[]).includes(status)
      ? { status: status as (typeof COMPANY_STATUSES)[number] }
      : {}
  const where = {
    deletedAt: null as null,
    ...(accessFilter ?? {}),
    ...jurisdictionFilter,
    ...statusFilter,
    ...(search
      ? {
          OR: [
            { companyCode: { contains: search, mode: 'insensitive' as const } },
            { nameEn: { contains: search, mode: 'insensitive' as const } },
            { nameZh: { contains: search, mode: 'insensitive' as const } },
            { companyNumber: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  }

  // Lightweight list for member / link pickers (no UBO computation)
  if (searchParams.get('picker') === '1') {
    const [companies, total] = await Promise.all([
      prisma.company.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ companyCode: 'asc' }, { nameEn: 'asc' }],
        select: {
          id: true,
          nameEn: true,
          nameZh: true,
          companyCode: true,
          companyNumber: true,
          companyType: true,
          registeredAddress: true,
          status: true,
        },
      }),
      prisma.company.count({ where }),
    ])
    return NextResponse.json({ companies, total, page, limit })
  }

  const useLegacySort = !search && !jurisdictionFilter.companyType && !statusFilter.status && access.kind === 'all'

  async function withUbos<T extends { id: string }>(companies: T[]) {
    if (companies.length === 0) return companies.map(c => ({ ...c, ubos: [] as Array<{ nameEn: string; nameZh: string | null; effectivePercent: number }> }))
    const allWithMembers = await loadAllCompaniesWithMembers()
    const byName = indexCompaniesByName(allWithMembers)
    const byId = indexCompaniesById(allWithMembers)
    return companies.map(company => {
      const root = byId.get(company.id)
      if (!root) return { ...company, ubos: [] }
      const structure = buildCompanyOwnershipNode(root, byName, new Set(), undefined, byId)
      const ubos = computeEffectiveNaturalOwners(structure).map(u => ({
        nameEn: u.nameEn,
        nameZh: u.nameZh,
        effectivePercent: u.effectivePercent,
      }))
      return { ...company, ubos }
    })
  }

  if (useLegacySort) {
    const orderedIds = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM companies
      ORDER BY
        CASE WHEN "companyCode" IS NULL THEN 1 ELSE 0 END,
        SUBSTRING("companyCode" FROM 3) ASC,
        "createdAt" DESC
      LIMIT ${limit} OFFSET ${skip}
    `
    const ids = orderedIds.map(r => r.id)
    const [companiesRaw, total] = await Promise.all([
      prisma.company.findMany({
        where: { id: { in: ids } },
        include: {
          assignedStaff: { select: { nameEn: true } },
          financialManager: { select: { nameEn: true, email: true } },
          clientUser: { select: { nameEn: true, email: true } },
        },
      }),
      prisma.company.count({ where }),
    ])
    const idIndex = new Map(ids.map((id, i) => [id, i]))
    const companiesSorted = companiesRaw.sort((a, b) => (idIndex.get(a.id) ?? 0) - (idIndex.get(b.id) ?? 0))
    const companies = await withUbos(companiesSorted)
    return NextResponse.json({ companies, total, page, limit })
  }

  const [companiesRaw, total] = await Promise.all([
    prisma.company.findMany({
      where,
      skip,
      take: limit,
      orderBy: [{ companyCode: 'asc' }, { createdAt: 'desc' }],
      include: {
        assignedStaff: { select: { nameEn: true } },
        financialManager: { select: { nameEn: true, email: true } },
        clientUser: { select: { nameEn: true, email: true } },
      },
    }),
    prisma.company.count({ where }),
  ])

  const companies = await withUbos(companiesRaw)
  return NextResponse.json({ companies, total, page, limit })
}

export async function POST(req: NextRequest) {
  const { session, error } = await requireRole('STAFF', { adminMenu: 'companies' })
  if (error) return error

  const body = await req.json().catch(() => null)
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  const { dateOfIncorporation, clientUserEmail, ...rest } = parsed.data
  const doi = dateOfIncorporation ? new Date(dateOfIncorporation) : null

  let resolvedClientId: string | undefined = rest.clientUserId?.trim() || undefined
  let pendingClientEmail: string | null = null

  if (resolvedClientId) {
    const u = await prisma.user.findFirst({
      where: { id: resolvedClientId, role: 'CLIENT' },
    })
    if (!u) {
      return NextResponse.json({ error: 'invalidClientUser' }, { status: 400 })
    }
  } else if (clientUserEmail?.trim()) {
    const emailNorm = normalizeSignupEmail(clientUserEmail)
    if (!z.string().email().safeParse(emailNorm).success) {
      return NextResponse.json({ error: 'invalidEmail' }, { status: 400 })
    }
    const u = await prisma.user.findFirst({
      where: { email: { equals: emailNorm, mode: 'insensitive' }, role: 'CLIENT' },
    })
    if (u) {
      resolvedClientId = u.id
    } else {
      pendingClientEmail = emailNorm
    }
  }

  const { companyNumber, registeredAddress, companyType, serviceTiers, ...companyFields } = rest

  const companyCode = companyType ? await nextCompanyCode(companyType) : null

  const company = await prisma.company.create({
    data: {
      ...companyFields,
      companyNumber: companyNumber ?? null,
      companyType: companyType ?? null,
      companyCode,
      registeredAddress: registeredAddress ?? null,
      serviceTiers: normalizeCompanyServiceTiers(serviceTiers),
      clientUserId: resolvedClientId ?? null,
      pendingClientEmail,
      dateOfIncorporation: doi,
    },
  })

  await logAudit(session!.user.id, 'CREATE', 'Company', company.id, null, company)
  return NextResponse.json(company, { status: 201 })
}
