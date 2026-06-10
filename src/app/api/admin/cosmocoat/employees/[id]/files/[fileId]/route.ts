import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'
import { logAudit } from '@/lib/audit/logger'
import { deleteCosEmployeeFile } from '@/lib/cosmocoat/employee-files'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; fileId: string }> },
) {
  const { session, error } = await requireRole('STAFF', { adminMenu: 'cosmocoatEmployees' })
  if (error) return error

  const { id, fileId } = await params
  const file = await prisma.cosEmployeeFile.findFirst({
    where: { id: fileId, employeeId: id },
  })
  if (!file) return NextResponse.json({ error: '文件不存在' }, { status: 404 })

  await deleteCosEmployeeFile(file.storageKey)
  await prisma.cosEmployeeFile.delete({ where: { id: fileId } })
  await logAudit(session!.user.id, 'DELETE', 'CosEmployeeFile', fileId, file, null)
  return NextResponse.json({ success: true })
}
