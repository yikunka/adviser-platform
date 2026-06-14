import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { requireRole } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'
import { rejectPendingProcessKitChangeRequests } from '@/lib/cosmocoat/process-kit-change-requests'
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
  testerName: z.string().trim().max(120).optional().default(''),
  testerId: z.string().trim().min(1),
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
  const { session, error } = await requireRole('STAFF', { adminMenu: 'cosmocoatProcessKits' })
  if (error) return error
  if (session!.user.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: '非超级管理员请在详情页提交审批，不能直接新增测试记录' }, { status: 403 })
  }

  const { id: kitId } = await params
  try {
    const kit = await prisma.cosProcessKit.findUnique({ where: { id: kitId } })
    if (!kit) return NextResponse.json({ error: '工艺书不存在' }, { status: 404 })

    const tests = await prisma.cosProcessTest.findMany({
      where: { kitId },
      orderBy: [{ testDate: 'desc' }, { id: 'desc' }],
      include: {
        tester: {
          select: { id: true, code: true, name: true },
        },
      },
    })

    return NextResponse.json({
      tests: tests.map(t => ({
        id: t.id,
        kitId: t.kitId,
        testType: t.testType,
        testResult: t.testResult,
        testDate: t.testDate.toISOString(),
        testerName: t.tester?.name ?? t.testerName,
        testerId: t.testerId,
        tester: t.tester ? { id: t.tester.id, code: t.tester.code, name: t.tester.name } : null,
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
  if (session!.user.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: '非超级管理员请在详情页提交审批，不能直接新增测试记录' }, { status: 403 })
  }

  const { id: kitId } = await params
  const kit = await prisma.cosProcessKit.findUnique({ where: { id: kitId } })
  if (!kit) return NextResponse.json({ error: '工艺书不存在' }, { status: 404 })

  const body = await req.json().catch(() => null)
  const parsed = testSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  try {
    await rejectPendingProcessKitChangeRequests(kitId, session!.user.id, '超级管理员已直接执行变更')
    const tester = await prisma.cosEmployee.findFirst({
      where: {
        id: parsed.data.testerId,
        employeeType: 'TECHNICAL',
        isActive: true,
      },
      select: { id: true, name: true },
    })
    if (!tester) {
      return NextResponse.json({ error: '请选择有效的技术人员' }, { status: 400 })
    }

    const passedAt = parsed.data.passedAt !== undefined
      ? (parsed.data.passedAt ? new Date(parsed.data.passedAt) : null)
      : (parsed.data.testResult === 'PASSED' ? new Date(parsed.data.testDate) : null)

    await prisma.cosProcessTest.create({
      data: {
        kitId,
        testType: parsed.data.testType,
        testResult: parsed.data.testResult,
        testDate: new Date(parsed.data.testDate),
        testerName: tester.name,
        testerId: tester.id,
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
