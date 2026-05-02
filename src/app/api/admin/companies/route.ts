import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'
import { logAudit } from '@/lib/audit/logger'
import { normalizeSignupEmail } from '@/lib/company/claim-pending-client'
import { z } from 'zod'

const createSchema = z
  .object({
    nameEn: z.string().min(1).max(200),
    nameZh: z.string().max(200).optional(),
    companyNumber: z.string().max(20).optional(),
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
  const { session, error } = await requireRole('STAFF')
  if (error) return error

  const { searchParams } = req.nextUrl
  const search = searchParams.get('q') ?? ''
  const page = parseInt(searchParams.get('page') ?? '1')
  const limit = 20
  const skip = (page - 1) * limit

  const where = search
    ? {
        OR: [
          { nameEn: { contains: search, mode: 'insensitive' as const } },
          { nameZh: { contains: search, mode: 'insensitive' as const } },
          { companyNumber: { contains: search, mode: 'insensitive' as const } },
        ],
      }
    : {}

  const [companies, total] = await Promise.all([
    prisma.company.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        assignedStaff: { select: { nameEn: true } },
        clientUser: { select: { nameEn: true, email: true } },
      },
    }),
    prisma.company.count({ where }),
  ])

  return NextResponse.json({ companies, total, page, limit })
}

export async function POST(req: NextRequest) {
  const { session, error } = await requireRole('STAFF')
  if (error) return error

  const body = await req.json().catch(() => null)
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  const { dateOfIncorporation, clientUserEmail, ...rest } = parsed.data
  const doi = dateOfIncorporation ? new Date(dateOfIncorporation) : null
  const annualReturnDate = doi ? new Date(new Date(doi).setFullYear(doi.getFullYear() + 1)) : null

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

  const { clientUserId: _drop, companyNumber, registeredAddress, ...companyFields } = rest

  const company = await prisma.company.create({
    data: {
      ...companyFields,
      companyNumber: companyNumber ?? null,
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
