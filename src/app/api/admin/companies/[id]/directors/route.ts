import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'
import { logAudit } from '@/lib/audit/logger'
import { z } from 'zod'

const createSchema = z.object({
  nameEn: z.string().min(1).max(200),
  nameZh: z.string().max(200).optional(),
  dateOfAppointment: z.string().datetime(),
  dateAsReserve: z.string().datetime().optional(),
  dateOfCessation: z.string().datetime().optional(),
  addressForService: z.string().min(1).max(500),
  dateOfBirth: z.string().datetime().optional(),
  placeOfBirth: z.string().max(200).optional(),
  nationality: z.string().max(100).optional(),
  idType: z.enum(['HKID', 'PASSPORT', 'OTHER']).optional(),
  idNumber: z.string().max(50).optional(),
  countryOfIssuance: z.string().max(100).optional(),
  isCorporation: z.boolean().optional(),
  corpRegNumber: z.string().max(100).optional(),
  corpRegPlace: z.string().max(200).optional(),
  status: z.enum(['ACTIVE', 'CEASED']).optional(),
  keyPersonId: z.string().cuid().nullable().optional(),
})

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, error } = await requireRole('STAFF', { adminMenu: 'companies' })
  if (error) return error

  const { id: companyId } = await params
  const company = await prisma.company.findUnique({ where: { id: companyId } })
  if (!company) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json().catch(() => null)
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })

  const { dateOfAppointment, dateAsReserve, dateOfCessation, dateOfBirth, ...rest } = parsed.data

  const director = await prisma.director.create({
    data: {
      ...rest,
      companyId,
      dateOfAppointment: new Date(dateOfAppointment),
      ...(dateAsReserve && { dateAsReserve: new Date(dateAsReserve) }),
      ...(dateOfCessation && { dateOfCessation: new Date(dateOfCessation) }),
      ...(dateOfBirth && { dateOfBirth: new Date(dateOfBirth) }),
    },
  })

  await logAudit(session!.user.id, 'CREATE', 'Director', director.id, null, director)
  return NextResponse.json(director, { status: 201 })
}
