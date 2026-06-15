import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'
import { logAudit } from '@/lib/audit/logger'
import { normalizeSignupEmail } from '@/lib/company/claim-pending-client'
import {
  buildCompanyAccessWhere,
  resolveCompanyAccess,
} from '@/lib/company-access'
import { z } from 'zod'

const COMPANY_TYPE_PREFIX: Record<string, string> = {
  HONG_KONG: 'AA',
  BVI:       'BV',
  CAYMAN:    'CA',
  MARSHALL:  'MS',
}

async function nextCompanyCode(companyType: string): Promise<string> {
  const prefix = COMPANY_TYPE_PREFIX[companyType] ?? 'AA'
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
    companyType: z.enum(['HONG_KONG', 'BVI', 'CAYMAN', 'MARSHALL']).optional(),
    dateOfIncorporation: z.string().optional(),
    registeredAddress: z.string().max(500).optional(),
    businessNature: z.string().max(500).optional(),
    serviceTier: z.enum(['BASIC', 'PROFESSIONAL', 'PREMIUM']).optional(),
    /** Pick from verified CLIENT users (admin UI). */
    clientUserId: z.string().cuid().optional(),
    /** CLIENT signup email when not choosing from list (e.g. not yet verified). */
    clientUserEmail: z.string().max(320).optional(),
    assignedStaffId: z.string().cuid().optional(),
  })
  .superRefine((data, ctx) => {
    const id = data.clientUserId?.trim()
    const em = data.clientUserEmail?.trim()
    if (!id && !em) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'clientRequired',
        path: ['clientUserId'],
      })
    }
  })

export async function GET(req: NextRequest) {
  const { session, error } = await requireRole('STAFF', { adminMenu: 'companies' })
  if (error) return error

  const { searchParams } = req.nextUrl
  const search = searchParams.get('q') ?? ''
  const page = parseInt(searchParams.get('page') ?? '1')
  const limit = 20
  const skip = (page - 1) * limit

  const access = await resolveCompanyAccess(session!.user.id, session!.user.role)

  const accessFilter = buildCompanyAccessWhere(access)
  const where = {
    ...(accessFilter ?? {}),
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

  const useLegacySort = !search && access.kind === 'all'

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
    const companies = companiesRaw.sort((a, b) => (idIndex.get(a.id) ?? 0) - (idIndex.get(b.id) ?? 0))
    return NextResponse.json({ companies, total, page, limit })
  }

  const [companies, total] = await Promise.all([
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
  const annualReturnDate = doi ? new Date(doi.getTime() + 42 * 24 * 60 * 60 * 1000) : null

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
  } else {
    return NextResponse.json({ error: 'clientRequired' }, { status: 400 })
  }

  const { companyNumber, registeredAddress, companyType, ...companyFields } = rest

  const companyCode = companyType ? await nextCompanyCode(companyType) : null

  const company = await prisma.company.create({
    data: {
      ...companyFields,
      companyNumber: companyNumber ?? null,
      companyType: companyType ?? null,
      companyCode,
      registeredAddress: registeredAddress ?? null,
      clientUserId: resolvedClientId ?? null,
      pendingClientEmail,
      dateOfIncorporation: doi,
      annualReturnDate,
    },
  })

  await logAudit(session!.user.id, 'CREATE', 'Company', company.id, null, company)
  return NextResponse.json(company, { status: 201 })
}
