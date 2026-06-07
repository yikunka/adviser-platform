import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { requireRole } from '@/lib/auth/rbac'
import { getProcessKitById } from '@/lib/cosmocoat/process-kits'

function isMissingTable(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2021'
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await requireRole('STAFF', { adminMenu: 'cosmocoatSampleOrders' })
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
