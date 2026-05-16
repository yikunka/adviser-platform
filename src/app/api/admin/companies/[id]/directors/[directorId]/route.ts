import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'
import { logAudit } from '@/lib/audit/logger'
import { z } from 'zod'

const updateSchema = z.object({
  nameEn: z.string().min(1).max(200).optional(),
  nameZh: z.string().max(200).optional(),
  dateOfAppointment: z.string().datetime().optional(),
  dateAsReserve: z.string().datetime().nullable().optional(),
  dateOfCessation: z.string().datetime().nullable().optional(),
  addressForService: z.string().min(1).max(500).optional(),
  dateOfBirth: z.string().datetime().nullable().optional(),
  placeOfBirth: z.string().max(200).optional(),
  nationality: z.string().max(100).optional(),
  idType: z.enum(['HKID', 'PASSPORT', 'OTHER']).nullable().optional(),
  idNumber: z.string().max(50).optional(),
  countryOfIssuance: z.string().max(100).optional(),
  isCorporation: z.boolean().optional(),
  corpRegNumber: z.string().max(100).optional(),
  corpRegPlace: z.string().max(200).optional(),
  status: z.enum(['ACTIVE', 'CEASED']).optional(),
})

type Params = { params: Promise<{ id: string; directorId: string }> }

export async function PATCH(req: NextRequest, { params }: Params) {
  const { session, error } = await requireRole('STAFF', { adminMenu: 'companies' })
  if (error) return error

  const { id: companyId, directorId } = await params
  const before = await prisma.director.findFirst({ where: { id: directorId, companyId } })
  if (!before) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json().catch(() => null)
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })

  const { dateOfAppointment, dateAsReserve, dateOfCessation, dateOfBirth, ...rest } = parsed.data

  const data: Record<string, unknown> = { ...rest }
  if (dateOfAppointment !== undefined) data.dateOfAppointment = new Date(dateOfAppointment)
  if (dateAsReserve !== undefined) data.dateAsReserve = dateAsReserve ? new Date(dateAsReserve) : null
  if (dateOfCessation !== undefined) data.dateOfCessation = dateOfCessation ? new Date(dateOfCessation) : null
  if (dateOfBirth !== undefined) data.dateOfBirth = dateOfBirth ? new Date(dateOfBirth) : null

  const director = await prisma.director.update({ where: { id: directorId }, data })
  await logAudit(session!.user.id, 'UPDATE', 'Director', directorId, before, director)
  return NextResponse.json(director)
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { session, error } = await requireRole('STAFF', { adminMenu: 'companies' })
  if (error) return error

  const { id: companyId, directorId } = await params
  const director = await prisma.director.findFirst({ where: { id: directorId, companyId } })
  if (!director) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.director.delete({ where: { id: directorId } })
  await logAudit(session!.user.id, 'DELETE', 'Director', directorId, director, null)
  return NextResponse.json({ message: 'Deleted' })
}
