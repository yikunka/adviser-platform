import { NextRequest, NextResponse } from 'next/server'
import type { KYCStatus } from '@prisma/client'
import { auth } from '@/lib/auth/auth'
import { prisma } from '@/lib/db/prisma'
import { nextKycCode } from '@/lib/kyc/kyc-code'
import { kycBatchZod, inputToKeyPersonData } from '@/lib/kyc/personZod'
import { screenKeyPerson } from '@/lib/aml/screener'

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json().catch(() => null)
    const parsed = kycBatchZod.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { action, persons } = parsed.data
    const userId = session.user.id
    const results: { id: string; kycStatus: string; kycCode: string | null }[] = []

    const terminal: KYCStatus[] = ['SUBMITTED', 'APPROVED', 'PENDING_INFO', 'REJECTED']

    for (const p of persons) {
      let data = inputToKeyPersonData(p, action) as Record<string, unknown>
      if (p.id) {
        const own = await prisma.keyPerson.findFirst({
          where: { id: p.id, submittedByUserId: userId },
        })
        if (!own) {
          return NextResponse.json({ error: 'Invalid person id' }, { status: 403 })
        }
        if (own.kycStatus === 'APPROVED' || (action === 'SAVE_DRAFT' && terminal.includes(own.kycStatus))) {
          const rest = { ...data }
          delete rest.kycStatus
          data = rest
        }
        if (action === 'SUBMIT' && !own.kycCode) {
          data.kycCode = await nextKycCode()
        }
        const updated = await prisma.keyPerson.update({
          where: { id: p.id },
          data: data as never,
        })
        results.push({ id: updated.id, kycStatus: updated.kycStatus, kycCode: updated.kycCode })
      } else {
        if (action === 'SUBMIT') {
          data.kycCode = await nextKycCode()
        }
        const created = await prisma.keyPerson.create({
          data: {
            ...(data as object),
            submittedByUserId: userId,
          } as never,
        })
        results.push({ id: created.id, kycStatus: created.kycStatus, kycCode: created.kycCode })
      }
    }

    if (action === 'SUBMIT') {
      for (const r of results) {
        try {
          await screenKeyPerson(r.id, 'KYC_SUBMIT', userId)
        } catch (e) {
          console.error('[KYC] AML screen failed for', r.id, e)
        }
      }
    }

    return NextResponse.json({ persons: results })
  } catch (error) {
    console.error('[KYC] save failed', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Save failed' },
      { status: 500 },
    )
  }
}

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = session.user.id

  let list = await prisma.keyPerson.findMany({
    where: {
      OR: [
        { submittedByUserId: userId },
        {
          AND: [
            { submittedByUserId: null },
            { companyLinks: { some: { company: { clientUserId: userId } } } },
          ],
        },
      ],
    },
    orderBy: { createdAt: 'asc' },
    include: { kycDocuments: true },
  })

  // Rows created only via company links may still have submittedByUserId = null, which
  // would block POST /api/kyc updates. Claim them for this portal user once.
  const orphanIds = list.filter((p) => !p.submittedByUserId).map((p) => p.id)
  if (orphanIds.length > 0) {
    await prisma.keyPerson.updateMany({
      where: { id: { in: orphanIds } },
      data: { submittedByUserId: userId },
    })
    list = await prisma.keyPerson.findMany({
      where: {
        OR: [
          { submittedByUserId: userId },
          {
            AND: [
              { submittedByUserId: null },
              { companyLinks: { some: { company: { clientUserId: userId } } } },
            ],
          },
        ],
      },
      orderBy: { createdAt: 'asc' },
      include: { kycDocuments: true },
    })
  }

  return NextResponse.json({ persons: list })
}
