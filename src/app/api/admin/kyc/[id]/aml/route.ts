import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'
import { screenKeyPerson } from '@/lib/aml/screener'

const amlRecordSelect = {
  select: {
    primaryName: true,
    aliases: true,
    nationality: true,
    dateOfBirth: true,
    listingReason: true,
    source: { select: { nameEn: true } },
  },
}

async function getAMLData(keyPersonId: string) {
  const [lastCheck, alerts] = await Promise.all([
    prisma.aMLCheck.findFirst({
      where: { keyPersonId, subjectType: 'KEY_PERSON' },
      orderBy: { checkedAt: 'desc' },
    }),
    prisma.aMLAlert.findMany({
      where: { keyPersonId, subjectType: 'KEY_PERSON', isActive: true },
      orderBy: { result: 'desc' },
      include: { amlRecord: amlRecordSelect },
    }),
  ])
  return { lastCheck, alerts }
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireRole('STAFF')
  if (error) return error

  const { id } = await params
  const data = await getAMLData(id)
  return NextResponse.json(data)
}

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireRole('STAFF')
  if (error) return error

  const { id } = await params

  const person = await prisma.keyPerson.findUnique({ where: { id } })
  if (!person) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const result = await screenKeyPerson(id, 'MANUAL', session.user.id)
  const data = await getAMLData(id)
  return NextResponse.json({ result, ...data })
}
