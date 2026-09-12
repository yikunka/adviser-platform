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
  keyPersonId: z.string().cuid().nullable().optional(),
  linkedCompanyId: z.string().cuid().nullable().optional(),
})

type Params = { params: Promise<{ id: string; controllerId: string }> }

export async function PATCH(req: NextRequest, { params }: Params) {
  const { session, error } = await requireRole('STAFF', { adminMenu: 'companies' })
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
    keyPersonId,
    linkedCompanyId,
  } = parsed.data

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

  const data: Prisma.SignificantControllerUpdateInput = {}
  if (nameEn !== undefined) data.nameEn = nameEn
  if (nameZh !== undefined) data.nameZh = nameZh
  if (correspondenceAddress !== undefined) data.correspondenceAddress = correspondenceAddress
  if (idType !== undefined) data.idType = idType
  if (idPassportNo !== undefined) data.idPassportNo = idPassportNo
  if (issuingCountry !== undefined) data.issuingCountry = issuingCountry
  if (natureOfControl !== undefined) data.natureOfControl = natureOfControl
  if (legalEntityRegNo !== undefined) data.legalEntityRegNo = legalEntityRegNo
  if (legalEntityGovLaw !== undefined) data.legalEntityGovLaw = legalEntityGovLaw
  if (remarks !== undefined) data.remarks = remarks
  if (entryDate !== undefined) data.entryDate = new Date(entryDate)
  if (becomingDate !== undefined) data.becomingDate = new Date(becomingDate)
  if (cessationDate !== undefined) data.cessationDate = cessationDate ? new Date(cessationDate) : null

  if (linkedCompanyId !== undefined && linkedCompanyId) {
    data.linkedCompany = { connect: { id: linkedCompanyId } }
    data.keyPerson = { disconnect: true }
    data.isLegalEntity = true
  } else if (keyPersonId !== undefined && keyPersonId) {
    data.keyPerson = { connect: { id: keyPersonId } }
    data.linkedCompany = { disconnect: true }
    if (isLegalEntity !== undefined) data.isLegalEntity = isLegalEntity
    else data.isLegalEntity = false
  } else {
    if (linkedCompanyId !== undefined) {
      data.linkedCompany = linkedCompanyId ? { connect: { id: linkedCompanyId } } : { disconnect: true }
    }
    if (keyPersonId !== undefined) {
      data.keyPerson = keyPersonId ? { connect: { id: keyPersonId } } : { disconnect: true }
    }
    if (isLegalEntity !== undefined) data.isLegalEntity = isLegalEntity
  }

  const controller = await prisma.significantController.update({
    where: { id: controllerId },
    data,
    include: {
      linkedCompany: { select: { id: true, nameEn: true, nameZh: true, companyCode: true, companyNumber: true, registeredAddress: true } },
      keyPerson: { select: { id: true, nameEn: true, nameZh: true, kycStatus: true } },
    },
  })
  await logAudit(session!.user.id, 'UPDATE', 'SignificantController', controllerId, before, controller)
  return NextResponse.json(controller)
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { session, error } = await requireRole('STAFF', { adminMenu: 'companies' })
  if (error) return error

  const { id: companyId, controllerId } = await params
  const controller = await prisma.significantController.findFirst({ where: { id: controllerId, companyId } })
  if (!controller) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.significantController.delete({ where: { id: controllerId } })
  await logAudit(session!.user.id, 'DELETE', 'SignificantController', controllerId, controller, null)
  return NextResponse.json({ message: 'Deleted' })
}
