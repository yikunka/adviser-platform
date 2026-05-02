import { NextRequest, NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { requireRole } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'
import { logAudit } from '@/lib/audit/logger'
import { z } from 'zod'

const updateSchema = z.object({
  nameEn: z.string().min(1).max(200).optional(),
  nameZh: z.string().max(200).optional(),
  entryDate: z.string().datetime().optional(),
  becomingDate: z.string().datetime().optional(),
  correspondenceAddress: z.string().max(500).optional(),
  idType: z.enum(['HKID', 'PASSPORT', 'OTHER']).nullable().optional(),
  idPassportNo: z.string().max(50).optional(),
  issuingCountry: z.string().max(100).optional(),
  natureOfControl: z.string().max(500).optional(),
  cessationDate: z.string().datetime().nullable().optional(),
  isLegalEntity: z.boolean().optional(),
  legalEntityRegNo: z.string().max(100).optional(),
  legalEntityGovLaw: z.string().max(200).optional(),
  remarks: z.string().max(1000).optional(),
})

type Params = { params: Promise<{ id: string; controllerId: string }> }

export async function PATCH(req: NextRequest, { params }: Params) {
  const { session, error } = await requireRole('STAFF')
  if (error) return error

  const { id: companyId, controllerId } = await params
  const before = await prisma.significantController.findFirst({ where: { id: controllerId, companyId } })
  if (!before) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json().catch(() => null)
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })

  const {
    entryDate,
    becomingDate,
    cessationDate,
    nameEn,
    nameZh,
    correspondenceAddress,
    idType,
    idPassportNo,
    issuingCountry,
    natureOfControl,
    isLegalEntity,
    legalEntityRegNo,
    legalEntityGovLaw,
    remarks,
  } = parsed.data

  const data: Prisma.SignificantControllerUpdateInput = {}
  if (nameEn !== undefined) data.nameEn = nameEn
  if (nameZh !== undefined) data.nameZh = nameZh
  if (correspondenceAddress !== undefined) data.correspondenceAddress = correspondenceAddress
  if (idType !== undefined) data.idType = idType
  if (idPassportNo !== undefined) data.idPassportNo = idPassportNo
  if (issuingCountry !== undefined) data.issuingCountry = issuingCountry
  if (natureOfControl !== undefined) data.natureOfControl = natureOfControl
  if (isLegalEntity !== undefined) data.isLegalEntity = isLegalEntity
  if (legalEntityRegNo !== undefined) data.legalEntityRegNo = legalEntityRegNo
  if (legalEntityGovLaw !== undefined) data.legalEntityGovLaw = legalEntityGovLaw
  if (remarks !== undefined) data.remarks = remarks
  if (entryDate !== undefined) data.entryDate = new Date(entryDate)
  if (becomingDate !== undefined) data.becomingDate = new Date(becomingDate)
  if (cessationDate !== undefined) data.cessationDate = cessationDate ? new Date(cessationDate) : null

  const controller = await prisma.significantController.update({ where: { id: controllerId }, data })
  await logAudit(session!.user.id, 'UPDATE', 'SignificantController', controllerId, before, controller)
  return NextResponse.json(controller)
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { session, error } = await requireRole('STAFF')
  if (error) return error

  const { id: companyId, controllerId } = await params
  const controller = await prisma.significantController.findFirst({ where: { id: controllerId, companyId } })
  if (!controller) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.significantController.delete({ where: { id: controllerId } })
  await logAudit(session!.user.id, 'DELETE', 'SignificantController', controllerId, controller, null)
  return NextResponse.json({ message: 'Deleted' })
}
