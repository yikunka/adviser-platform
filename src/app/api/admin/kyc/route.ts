import { NextRequest, NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { requireRole } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'
import { logAudit } from '@/lib/audit/logger'
import { screenKeyPerson } from '@/lib/aml/screener'
import { nextKycCode } from '@/lib/kyc/kyc-code'
import { kycPersonDraftZod, kycPersonZod, inputToKeyPersonAdminUpdate } from '@/lib/kyc/personZod'
import { getRelatedCompaniesForKeyPersons, getRelatedCompaniesForKeyPerson } from '@/lib/kyc/relatedCompanies'
import { z } from 'zod'

const createSchema = z.object({
  clientUserId: z.string().optional().nullable(),
  action: z.enum(['SAVE_DRAFT', 'SUBMIT']).default('SAVE_DRAFT'),
  person: kycPersonDraftZod,
})

const ID_EXPIRY_CATEGORY = 'ID_EXPIRY'
const KYC_STATUS_VALUES = new Set(['DRAFT', 'APPROVED', 'REJECTED', 'INACTIVE'])

function oneMonthFrom(date: Date) {
  const next = new Date(date)
  next.setMonth(next.getMonth() + 1)
  return next
}

function idExpiryWhere(now = new Date()): Prisma.KeyPersonWhereInput {
  return {
    idExpiryDate: {
      not: null,
      lt: oneMonthFrom(now),
    },
  }
}

function withComposedName(person: z.infer<typeof kycPersonDraftZod>) {
  const structured = [person.firstName, person.otherName, person.lastName]
    .map(part => part?.trim())
    .filter(Boolean)
    .join(' ')
  return {
    ...person,
    nameEn: structured || person.nameEn || person.nameZh || '',
  }
}

const kycRecordInclude = {
  kycDocuments: {
    orderBy: { uploadedAt: 'desc' as const },
    select: {
      id: true,
      fileName: true,
      documentType: true,
      storageKey: true,
      mimeType: true,
      fileSize: true,
      status: true,
      uploadedAt: true,
    },
  },
  submittedByUser: { select: { id: true, email: true, nameEn: true } },
  companyLinks: {
    include: {
      company: {
        select: {
          nameEn: true,
          clientUser: { select: { id: true, email: true, nameEn: true } },
        },
      },
    },
  },
} as const

export async function GET(req: NextRequest) {
  const { error } = await requireRole('STAFF', { adminMenu: 'kyc' })
  if (error) return error

  const { searchParams } = req.nextUrl
  const status = searchParams.get('status')
  const category = searchParams.get('category')
  const search = searchParams.get('q')?.trim() ?? ''
  const requestedPage = parseInt(searchParams.get('page') ?? '1')
  const page = Number.isFinite(requestedPage) ? Math.max(1, requestedPage) : 1
  const limit = 20

  const filters: Prisma.KeyPersonWhereInput[] = []
  if (category === ID_EXPIRY_CATEGORY) {
    filters.push(idExpiryWhere())
  } else if (status && KYC_STATUS_VALUES.has(status)) {
    filters.push({ kycStatus: status as never })
  }
  if (search) {
    filters.push({
      OR: [
        { kycCode: { contains: search, mode: 'insensitive' } },
        { nameEn: { contains: search, mode: 'insensitive' } },
        { nameZh: { contains: search, mode: 'insensitive' } },
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { idNumber: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { mobile: { contains: search, mode: 'insensitive' } },
        { submittedByUser: { is: { email: { contains: search, mode: 'insensitive' } } } },
        { companyLinks: { some: { company: { nameEn: { contains: search, mode: 'insensitive' } } } } },
        { companyLinks: { some: { company: { nameZh: { contains: search, mode: 'insensitive' } } } } },
      ],
    })
  }

  const where: Prisma.KeyPersonWhereInput = filters.length > 0 ? { AND: filters } : {}

  const [records, total, idExpiryCount] = await Promise.all([
    prisma.keyPerson.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { kycCode: { sort: 'desc', nulls: 'last' } },
      include: kycRecordInclude,
    }),
    prisma.keyPerson.count({ where }),
    prisma.keyPerson.count({ where: idExpiryWhere() }),
  ])

  const relatedByPerson = await getRelatedCompaniesForKeyPersons(
    records.map(r => ({
      id: r.id,
      submittedByUserId: r.submittedByUserId,
      submittedByEmail: r.submittedByUser?.email ?? null,
    })),
  )

  const enriched = records.map(r => ({
    ...r,
    relatedCompanies: relatedByPerson[r.id] ?? [],
  }))

  return NextResponse.json({ records: enriched, total, page, limit, counts: { idExpiry: idExpiryCount } })
}

export async function POST(req: NextRequest) {
  const { session, error } = await requireRole('STAFF', { adminMenu: 'kyc' })
  if (error) return error

  const body = await req.json().catch(() => null)
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const { action } = parsed.data
  const person = withComposedName(parsed.data.person)
  const clientUserId = parsed.data.clientUserId?.trim() || null

  if (action === 'SUBMIT') {
    const submitParsed = kycPersonZod.safeParse(person)
    if (!submitParsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: submitParsed.error.flatten() },
        { status: 400 },
      )
    }
  }

  if (clientUserId) {
    const client = await prisma.user.findFirst({
      where: { id: clientUserId, role: 'CLIENT', platform: 'ADVISER' },
      select: { id: true },
    })
    if (!client) {
      return NextResponse.json(
        { error: 'Invalid client account — choose an Advise customer account or leave blank' },
        { status: 400 },
      )
    }
  }

  const data = inputToKeyPersonAdminUpdate(person) as Record<string, unknown>
  data.kycStatus = 'DRAFT'
  if (action === 'SUBMIT' && !data.kycCode) {
    data.kycCode = await nextKycCode()
  }

  const created = await prisma.keyPerson.create({
    data: {
      ...data,
      submittedByUserId: clientUserId ?? undefined,
    } as never,
    include: kycRecordInclude,
  })

  await logAudit(session!.user.id, 'KYC_ADMIN_CREATE', 'KeyPerson', created.id, null, created)

  if (action === 'SUBMIT') {
    try {
      await screenKeyPerson(created.id, 'KYC_SUBMIT', session!.user.id)
    } catch (e) {
      console.error('[admin/kyc] AML screen failed for created KYC', created.id, e)
    }
  }

  const relatedCompanies = await getRelatedCompaniesForKeyPerson({
    id: created.id,
    submittedByUserId: created.submittedByUserId,
    submittedByEmail: created.submittedByUser?.email ?? null,
  })

  return NextResponse.json({ ...created, relatedCompanies }, { status: 201 })
}
