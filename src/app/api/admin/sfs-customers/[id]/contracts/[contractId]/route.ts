import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'
import { logAudit } from '@/lib/audit/logger'
import { deleteSfsCustomerContractFile } from '@/lib/sfs/customer-contracts'
import { resolveSfsCustomerIdFromRowId } from '@/lib/sfs/resolve-customer-row-id'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; contractId: string }> },
) {
  const { session, error } = await requireRole('STAFF', { adminMenu: 'sfsCustomers' })
  if (error) return error

  const { id, contractId } = await params
  const customerId = await resolveSfsCustomerIdFromRowId(decodeURIComponent(id))
  if (!customerId) return NextResponse.json({ error: 'Customer not found' }, { status: 404 })

  const contract = await prisma.sfsCustomerContract.findFirst({
    where: { id: contractId, customerId },
  })
  if (!contract) return NextResponse.json({ error: 'Contract not found' }, { status: 404 })

  await prisma.sfsCustomerContract.delete({ where: { id: contract.id } })
  await deleteSfsCustomerContractFile(contract.storageKey)
  await logAudit(session!.user.id, 'DELETE', 'SfsCustomerContract', contract.id, contract, null)

  return NextResponse.json({ success: true })
}
