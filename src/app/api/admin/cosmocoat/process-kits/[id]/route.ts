import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { requireRole } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'
import { getProcessKitById } from '@/lib/cosmocoat/process-kits'

const patchSchema = z.object({
  name: z.string().trim().min(1).max(160).optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  status: z.enum(['DRAFT', 'ACTIVE', 'ARCHIVED']).optional(),
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

  const { id } = await params
  try {
    const kit = await getProcessKitById(id)
    if (!kit) return NextResponse.json({ error: '工艺书不存在' }, { status: 404 })
    return NextResponse.json({ kit })
  } catch (err) {
    if (isMissingTable(err)) {
      return NextResponse.json({ error: '工艺书表不存在，请先运行数据库迁移' }, { status: 503 })
    }
    throw err
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await requireRole('STAFF', { adminMenu: 'cosmocoatProcessKits' })
  if (error) return error

  const { id } = await params
  const body = await req.json().catch(() => null)
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  const current = await prisma.cosProcessKit.findUnique({ where: { id } })
  if (!current) return NextResponse.json({ error: '工艺书不存在' }, { status: 404 })

  try {
    await prisma.cosProcessKit.update({
      where: { id },
      data: {
        name: parsed.data.name,
        description: parsed.data.description !== undefined
          ? (parsed.data.description || null)
          : undefined,
        status: parsed.data.status,
      },
    })

    const kit = await getProcessKitById(id)
    return NextResponse.json({ kit })
  } catch (err) {
    if (isMissingTable(err)) {
      return NextResponse.json({ error: '工艺书表不存在，请先运行数据库迁移' }, { status: 503 })
    }
    throw err
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await requireRole('STAFF', { adminMenu: 'cosmocoatProcessKits' })
  if (error) return error

  const { id } = await params
  const current = await prisma.cosProcessKit.findUnique({ where: { id } })
  if (!current) return NextResponse.json({ error: '工艺书不存在' }, { status: 404 })

  await prisma.cosProcessKit.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
