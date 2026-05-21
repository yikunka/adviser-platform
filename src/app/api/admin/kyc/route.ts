import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'
import { logAudit } from '@/lib/audit/logger'
import { screenKeyPerson } from '@/lib/aml/screener'
import { kycPersonDraftZod, kycPersonZod, inputToKeyPersonAdminUpdate } from '@/lib/kyc/personZod'
import { z } from 'zod'

const createSchema = z.object({
  clientUserId: z.string().optional().nullable(),
  action: z.enum(['SAVE_DRAFT', 'SUBMIT']).default('SAVE_DRAFT'),
  person: kycPersonDraftZod,
})

async function nextKycCode() {
  const rows = await prisma.$queryRaw<Array<{ max_no: number | null }>>`
    SELECT MAX(CAST(SUBSTRING(kyc_code FROM 3) AS INTEGER)) AS max_no
    FROM key_persons
    WHERE kyc_code ~ '^CL[0-9]{5}$'
  `
  const next = (rows[0]?.max_no ?? 0) + 1
  return `CL${String(next).padStart(5, '0')}`
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
  submittedByUser: { select: { email: true, nameEn: true } },
  companyLinks: {
    include: {
      company: {
        select: {
          nameEn: true,
          clientUser: { select: { email: true, nameEn: true } },
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
  const page = parseInt(searchParams.get('page') ?? '1')
  const limit = 20

  const where = status ? { kycStatus: status as never } : {}

  const [records, total] = await Promise.all([
    prisma.keyPerson.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { updatedAt: 'desc' },
      include: kycRecordInclude,
    }),
    prisma.keyPerson.count({ where }),
  ])

  return NextResponse.json({ records, total, page, limit })
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
      where: { id: clientUserId, role: 'CLIENT' },
      select: { id: true },
    })
    if (!client) return NextResponse.json({ error: 'Invalid client account' }, { status: 400 })
  }

  const data = inputToKeyPersonAdminUpdate(person) as Record<string, unknown>
  data.kycStatus = action === 'SUBMIT' ? 'SUBMITTED' : 'DRAFT'
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

  return NextResponse.json(created, { status: 201 })
}
