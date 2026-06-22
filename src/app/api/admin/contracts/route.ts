import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { requirePermission, requireRole } from '@/lib/auth/rbac'
import { logAudit } from '@/lib/audit/logger'
import { prisma } from '@/lib/db/prisma'
import { deleteAdviserContractFile, uploadAdviserContractFile } from '@/lib/adviser/contracts'

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

export async function GET(req: NextRequest) {
  const { error } = await requireRole('STAFF', { adminMenu: 'contracts' })
  if (error) return error

  const search = (req.nextUrl.searchParams.get('q') ?? '').trim()
  const contracts = await prisma.adviserContract.findMany({
    where: search
      ? {
          OR: [
            { contractName: { contains: search, mode: 'insensitive' } },
            { fileName: { contains: search, mode: 'insensitive' } },
            { notes: { contains: search, mode: 'insensitive' } },
          ],
        }
      : undefined,
    orderBy: [{ endDate: 'asc' }, { createdAt: 'desc' }],
    select: contractSelect,
  })

  return NextResponse.json({ contracts: contracts.map(serializeContract) })
}

export async function POST(req: NextRequest) {
  const { session, error } = await requirePermission('contracts.create')
  if (error) return error

  const formData = await req.formData()
  const contractName = ((formData.get('contractName') as string | null) ?? '').trim()
  const startDateText = ((formData.get('startDate') as string | null) ?? '').trim()
  const endDateText = ((formData.get('endDate') as string | null) ?? '').trim()
  const notes = ((formData.get('notes') as string | null) ?? '').trim() || null
  const file = formData.get('file') as File | null

  if (!contractName) return NextResponse.json({ error: '合同名称不能为空。' }, { status: 400 })
  if (!startDateText || !endDateText) return NextResponse.json({ error: '合同开始日期和结束日期不能为空。' }, { status: 400 })
  if (!file) return NextResponse.json({ error: '请选择合同文件。' }, { status: 400 })

  const startDate = new Date(startDateText)
  const endDate = new Date(endDateText)
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return NextResponse.json({ error: '合同日期格式不正确。' }, { status: 400 })
  }

  const id = crypto.randomUUID()
  let uploaded: { key: string; contentType: string } | null = null

  try {
    uploaded = await uploadAdviserContractFile(id, file)
    const contract = await prisma.adviserContract.create({
      data: {
        id,
        contractName,
        startDate,
        endDate,
        notes,
        fileName: file.name,
        storageKey: uploaded.key,
        mimeType: uploaded.contentType,
        fileSize: file.size,
        uploadedById: session!.user.id,
      },
      select: contractSelect,
    })

    await logAudit(session!.user.id, 'CREATE', 'AdviserContract', contract.id, null, contract)
    return NextResponse.json({ contract: serializeContract(contract), toast: '合同已上传。' }, { status: 201 })
  } catch (err) {
    if (uploaded) await deleteAdviserContractFile(uploaded.key)
    const message = err instanceof Error ? err.message : '上传合同失败。'
    const status = message.includes('OSS') || message.includes('storage') ? 503 : 400
    return NextResponse.json({ error: message }, { status })
  }
}
