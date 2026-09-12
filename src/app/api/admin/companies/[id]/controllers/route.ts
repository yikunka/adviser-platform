import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'
import { logAudit } from '@/lib/audit/logger'
import { z } from 'zod'

const createSchema = z.object({
  nameEn: z.string().min(1).max(200),
  nameZh: z.string().max(200).optional(),
  entryDate: z.string().datetime(),
  becomingDate: z.string().datetime(),
  correspondenceAddress: z.string().max(500).optional(),
  idType: z.enum(['HKID', 'PASSPORT', 'OTHER']).optional(),
  idPassportNo: z.string().max(50).optional(),
  issuingCountry: z.string().max(100).optional(),
  natureOfControl: z.string().max(500).optional(),
  cessationDate: z.string().datetime().optional(),
  isLegalEntity: z.boolean().optional(),
  legalEntityRegNo: z.string().max(100).optional(),
  legalEntityGovLaw: z.string().max(200).optional(),
  remarks: z.string().max(1000).optional(),
  keyPersonId: z.string().cuid().nullable().optional(),
  linkedCompanyId: z.string().cuid().nullable().optional(),
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

  const { entryDate, becomingDate, cessationDate, keyPersonId, linkedCompanyId, ...rest } = parsed.data

  if (linkedCompanyId) {
    if (linkedCompanyId === companyId) {
      return NextResponse.json({ error: 'Cannot link controller to the same company' }, { status: 400 })
    }
    const linked = await prisma.company.findFirst({
      where: { id: linkedCompanyId, deletedAt: null },
      select: { id: true },
    })
    if (!linked) return NextResponse.json({ error: 'Linked company not found' }, { status: 400 })
  }

  if (keyPersonId) {
    const person = await prisma.keyPerson.findUnique({ where: { id: keyPersonId }, select: { id: true } })
    if (!person) return NextResponse.json({ error: 'Linked KYC person not found' }, { status: 400 })
  }

  const finalLinkedCompanyId = linkedCompanyId ?? null
  const finalKeyPersonId = finalLinkedCompanyId ? null : (keyPersonId ?? null)
  const isLegalEntity = finalLinkedCompanyId ? true : (rest.isLegalEntity ?? false)

  const controller = await prisma.significantController.create({
    data: {
      ...rest,
      companyId,
      keyPersonId: finalKeyPersonId,
      linkedCompanyId: finalLinkedCompanyId,
      isLegalEntity,
      entryDate: new Date(entryDate),
      becomingDate: new Date(becomingDate),
      ...(cessationDate && { cessationDate: new Date(cessationDate) }),
    },
  })

  await logAudit(session!.user.id, 'CREATE', 'SignificantController', controller.id, null, controller)
  return NextResponse.json(controller, { status: 201 })
}
