import { NextRequest, NextResponse } from 'next/server'
import { requirePermission, requireRole } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'
import { deleteFromR2, getSignedDownloadUrl } from '@/lib/storage/r2'

type Ctx = { params: Promise<{ fileId: string }> }

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { error } = await requireRole('STAFF', { adminMenu: 'jmmOrders' })
  if (error) return error
  const { fileId } = await ctx.params
  const file = await prisma.jmmShipmentFile.findUnique({
    where: { id: fileId },
    select: { storageKey: true, fileName: true },
  })
  if (!file) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const url = await getSignedDownloadUrl(file.storageKey, 900, {
    responseContentDisposition: `attachment; filename="${file.fileName}"`,
  })
  return NextResponse.json({ url })
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const { error } = await requirePermission('jmmOrders.edit')
  if (error) return error
  const { fileId } = await ctx.params
  const file = await prisma.jmmShipmentFile.findUnique({ where: { id: fileId } })
  if (!file) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  await prisma.jmmShipmentFile.delete({ where: { id: fileId } })
  await deleteFromR2(file.storageKey).catch(() => undefined)
  return NextResponse.json({ ok: true })
}
