import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/rbac'
import { logAudit } from '@/lib/audit/logger'
import { prisma } from '@/lib/db/prisma'
import { deleteAdviserContractFile } from '@/lib/adviser/contracts'
import { contractPatchSchema } from '@/lib/adviser/contract-schemas'

const contractSelect = {
  id: true,
  contractName: true,
  startDate: true,
  endDate: true,
  notes: true,
  fileName: true,
  storageKey: true,
  mimeType: true,
  fileSize: true,
  createdAt: true,
  updatedAt: true,
  uploadedBy: { select: { nameEn: true, email: true } },
} as const

function serializeContract<T extends {
  startDate: Date
  endDate: Date
  createdAt: Date
  updatedAt: Date
}>(contract: T) {
  return {
    ...contract,
    startDate: contract.startDate.toISOString(),
    endDate: contract.endDate.toISOString(),
    createdAt: contract.createdAt.toISOString(),
    updatedAt: contract.updatedAt.toISOString(),
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, error } = await requirePermission('contracts.edit')
  if (error) return error

  const { id } = await params
  const body = await req.json().catch(() => null)
  const parsed = contractPatchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: '请检查合同表单。' }, { status: 400 })
  }

  const startDate = new Date(parsed.data.startDate)
  const endDate = new Date(parsed.data.endDate)
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return NextResponse.json({ error: '合同日期格式不正确。' }, { status: 400 })
  }

  const before = await prisma.adviserContract.findUnique({ where: { id } })
  if (!before) return NextResponse.json({ error: '合同不存在。' }, { status: 404 })

  const contract = await prisma.adviserContract.update({
    where: { id },
    data: {
      contractName: parsed.data.contractName.trim(),
      startDate,
      endDate,
      notes: parsed.data.notes?.trim() || null,
    },
    select: contractSelect,
  })

  await logAudit(session!.user.id, 'UPDATE', 'AdviserContract', id, before, contract)
  return NextResponse.json({ contract: serializeContract(contract), toast: '合同已更新。' })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, error } = await requirePermission('contracts.delete')
  if (error) return error

  const { id } = await params
  const contract = await prisma.adviserContract.findUnique({ where: { id } })
  if (!contract) return NextResponse.json({ error: '合同不存在。' }, { status: 404 })

  await prisma.adviserContract.delete({ where: { id } })
  await deleteAdviserContractFile(contract.storageKey)
  await logAudit(session!.user.id, 'DELETE', 'AdviserContract', id, contract, null)

  return NextResponse.json({ toast: '合同已删除。' })
}
