import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'

export async function GET(req: NextRequest) {
  const { error } = await requireRole('STAFF', { adminMenu: 'aml' })
  if (error) return error

  const { searchParams } = req.nextUrl
  const resolution = searchParams.get('resolution') ?? undefined
  const result = searchParams.get('result') ?? undefined
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
  const limit = 50

  const where = {
    ...(resolution && { resolution: resolution as never }),
    ...(result && { result: result as never }),
  }

  const [alertsRaw, total] = await Promise.all([
    prisma.aMLAlert.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        amlRecord: { select: { primaryName: true, source: { select: { nameEn: true } } } },
      },
    }),
    prisma.aMLAlert.count({ where }),
  ])

  // Resolve subject names (KeyPerson / Company) without schema relations
  const keyPersonIds = [...new Set(alertsRaw.map(a => a.keyPersonId).filter(Boolean))] as string[]
  const companyIds   = [...new Set(alertsRaw.map(a => a.companyId).filter(Boolean))] as string[]
  const [persons, companies] = await Promise.all([
    keyPersonIds.length ? prisma.keyPerson.findMany({ where: { id: { in: keyPersonIds } }, select: { id: true, nameEn: true } }) : [],
    companyIds.length   ? prisma.company.findMany({ where: { id: { in: companyIds } }, select: { id: true, nameEn: true } }) : [],
  ])
  const personMap  = new Map(persons.map(p => [p.id, p.nameEn]))
  const companyMap = new Map(companies.map(c => [c.id, c.nameEn]))

  const alerts = alertsRaw.map(a => ({
    ...a,
    subjectName: a.keyPersonId
      ? (personMap.get(a.keyPersonId) ?? null)
      : a.companyId
        ? (companyMap.get(a.companyId) ?? null)
        : null,
  }))

  return NextResponse.json({ alerts, total, page, pages: Math.ceil(total / limit) })
}
