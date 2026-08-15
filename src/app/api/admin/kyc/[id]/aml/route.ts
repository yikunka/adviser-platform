import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'
import {
  getKeyPersonScreenGate,
  recordManualAdverseMedia,
  screenKeyPerson,
  type ScreenScope,
} from '@/lib/aml/screener'
import { z } from 'zod'

const amlRecordSelect = {
  select: {
    primaryName: true,
    aliases: true,
    entityType: true,
    nationality: true,
    gender: true,
    dateOfBirth: true,
    placeOfBirth: true,
    addresses: true,
    idNumbers: true,
    listingReason: true,
    listingDate: true,
    listVersionDate: true,
    rawData: true,
    source: { select: { nameEn: true, sourceUrl: true, seqNo: true } },
  },
}

const postSchema = z.object({
  step: z.enum(['SANCTIONS', 'FATF', 'PEP', 'ADVERSE_MEDIA']).optional(),
  /** Manual adverse-media outcome (required when step is ADVERSE_MEDIA) */
  outcome: z.enum(['CLEAR', 'HIT']).optional(),
  notes: z.string().max(2000).optional().nullable(),
})

async function getAMLData(keyPersonId: string) {
  const [lastCheck, alerts, adverseMedia, gate] = await Promise.all([
    prisma.aMLCheck.findFirst({
      where: { keyPersonId, subjectType: 'KEY_PERSON' },
      orderBy: { checkedAt: 'desc' },
    }),
    prisma.aMLAlert.findMany({
      where: { keyPersonId, subjectType: 'KEY_PERSON', isActive: true },
      orderBy: { result: 'desc' },
      include: { amlRecord: amlRecordSelect },
    }),
    prisma.adverseMediaFinding.findMany({
      where: { keyPersonId, resolution: { not: 'FALSE_POSITIVE' } },
      orderBy: [{ relevanceScore: 'desc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        title: true,
        snippet: true,
        url: true,
        publisher: true,
        categories: true,
        relevanceScore: true,
        resolution: true,
        source: true,
        createdAt: true,
      },
    }),
    getKeyPersonScreenGate(keyPersonId),
  ])
  return { lastCheck, alerts, adverseMedia, gate }
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireRole('STAFF', { adminMenu: 'kyc' })
  if (error) return error

  const { id } = await params
  const data = await getAMLData(id)
  return NextResponse.json(data)
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireRole('STAFF', { adminMenu: 'kyc' })
  if (error) return error

  const { id } = await params

  const person = await prisma.keyPerson.findUnique({ where: { id } })
  if (!person) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json().catch(() => ({}))
  const parsed = postSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 })

  const step = (parsed.data.step ?? 'FULL') as ScreenScope | 'ADVERSE_MEDIA'
  const gate = await getKeyPersonScreenGate(id)

  if (step === 'FATF' && !gate.canRunFatf) {
    return NextResponse.json(
      { error: 'Run AML (sanctions) first and get CLEAR before FATF screening' },
      { status: 400 },
    )
  }
  if (step === 'PEP' && !gate.canRunPep) {
    return NextResponse.json(
      { error: 'Run AML and FATF first and get CLEAR before PEP screening' },
      { status: 400 },
    )
  }
  if (step === 'ADVERSE_MEDIA') {
    if (!gate.canRunAdverseMedia) {
      return NextResponse.json(
        { error: 'Complete AML → FATF → PEP (all CLEAR) before adverse media review' },
        { status: 400 },
      )
    }
    if (!parsed.data.outcome) {
      return NextResponse.json({ error: 'outcome CLEAR or HIT is required' }, { status: 400 })
    }
    try {
      const result = await recordManualAdverseMedia(
        id,
        parsed.data.outcome,
        session!.user.id,
        parsed.data.notes,
      )
      const data = await getAMLData(id)
      return NextResponse.json({ result, step, ...data })
    } catch (err) {
      console.error('[admin/kyc/aml]', err)
      return NextResponse.json(
        { error: err instanceof Error ? err.message : 'Adverse media review failed' },
        { status: 500 },
      )
    }
  }

  try {
    const result = await screenKeyPerson(
      id,
      'MANUAL',
      session!.user.id,
      step === 'FULL' ? 'FULL' : (step as ScreenScope),
    )
    const data = await getAMLData(id)
    return NextResponse.json({ result, step, ...data })
  } catch (err) {
    console.error('[admin/kyc/aml]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Screening failed' },
      { status: 500 },
    )
  }
}
