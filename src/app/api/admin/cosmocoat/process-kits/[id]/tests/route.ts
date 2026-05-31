import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { requireRole } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'
import { getProcessKitById } from '@/lib/cosmocoat/process-kits'

const testSchema = z.object({
  testType: z.enum([
    'PERFORMANCE',
    'DURABILITY',
    'ADHESION',
    'COLOR_STABILITY',
    'BOND_STRENGTH',
    'OTHER',
  ]),
  testResult: z.enum(['PASSED', 'FAILED', 'PENDING']).optional().default('PENDING'),
  testDate: z.string().datetime(),
  testerName: z.string().trim().min(1).max(120),
  testerId: z.string().trim().min(1).optional(),
  reportLink: z.string().trim().max(500).optional().default(''),
  testNotes: z.string().trim().max(2000).optional().default(''),
  passedAt: z.string().datetime().nullable().optional(),
})

function isMissingTable(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2021'
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await requireRole('STAFF', { adminMenu: 'cosmocoatProcessKits' })
  if (error) return error

  const { id: kitId } = await params
  try {
    const kit = await prisma.cosProcessKit.findUnique({ where: { id: kitId } })
    if (!kit) return NextResponse.json({ error: '工艺书不存在' }, { status: 404 })

    const tests = await prisma.cosProcessTest.findMany({
      where: { kitId },
      orderBy: [{ testDate: 'desc' }, { id: 'desc' }],
    })

    return NextResponse.json({
      tests: tests.map(t => ({
        id: t.id,
        kitId: t.kitId,
        testType: t.testType,
        testResult: t.testResult,
        testDate: t.testDate.toISOString(),
        testerName: t.testerName,
        testerId: t.testerId,
        reportLink: t.reportLink,
        testNotes: t.testNotes,
        passedAt: t.passedAt?.toISOString() ?? null,
      })),
    })
  } catch (err) {
    if (isMissingTable(err)) {
      return NextResponse.json({ error: '工艺书表不存在，请先运行数据库迁移' }, { status: 503 })
    }
    throw err
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, error } = await requireRole('STAFF', { adminMenu: 'cosmocoatProcessKits' })
  if (error) return error

  const { id: kitId } = await params
  const kit = await prisma.cosProcessKit.findUnique({ where: { id: kitId } })
  if (!kit) return NextResponse.json({ error: '工艺书不存在' }, { status: 404 })

  const body = await req.json().catch(() => null)
  const parsed = testSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  try {
    const passedAt = parsed.data.passedAt !== undefined
      ? (parsed.data.passedAt ? new Date(parsed.data.passedAt) : null)
      : (parsed.data.testResult === 'PASSED' ? new Date(parsed.data.testDate) : null)

    await prisma.cosProcessTest.create({
      data: {
        kitId,
        testType: parsed.data.testType,
        testResult: parsed.data.testResult,
        testDate: new Date(parsed.data.testDate),
        testerName: parsed.data.testerName,
        testerId: parsed.data.testerId ?? session!.user.id,
        reportLink: parsed.data.reportLink || null,
        testNotes: parsed.data.testNotes || null,
        passedAt,
      },
    })

    const full = await getProcessKitById(kitId)
    return NextResponse.json({ kit: full }, { status: 201 })
  } catch (err) {
    if (isMissingTable(err)) {
      return NextResponse.json({ error: '工艺书表不存在，请先运行数据库迁移' }, { status: 503 })
    }
    throw err
  }
}
