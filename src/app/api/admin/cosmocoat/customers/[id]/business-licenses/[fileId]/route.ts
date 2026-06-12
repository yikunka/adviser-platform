import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'
import { logAudit } from '@/lib/audit/logger'
import { deleteCosCustomerBusinessLicenseFile } from '@/lib/cosmocoat/customer-business-licenses'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; fileId: string }> },
) {
  const { session, error } = await requireRole('STAFF', { adminMenu: 'cosmocoatCustomers' })
  if (error) return error

  const { id, fileId } = await params
  const file = await prisma.cosCustomerBusinessLicense.findFirst({
    where: { id: fileId, customerId: id },
  })
  if (!file) return NextResponse.json({ error: '文件不存在' }, { status: 404 })

  await deleteCosCustomerBusinessLicenseFile(file.storageKey)
  await prisma.cosCustomerBusinessLicense.delete({ where: { id: fileId } })
  await logAudit(session!.user.id, 'DELETE', 'CosCustomerBusinessLicense', fileId, file, null)
  return NextResponse.json({ success: true })
}
