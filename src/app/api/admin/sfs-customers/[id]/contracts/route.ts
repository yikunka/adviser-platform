import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'
import { logAudit } from '@/lib/audit/logger'
import { uploadSfsCustomerContractFile } from '@/lib/sfs/customer-contracts'
import { resolveSfsCustomerIdFromRowId } from '@/lib/sfs/resolve-customer-row-id'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await requireRole('STAFF', { adminMenu: 'sfsCustomers' })
  if (error) return error

  const { id } = await params
  const customerId = await resolveSfsCustomerIdFromRowId(decodeURIComponent(id))
  if (!customerId) {
    return NextResponse.json({ contracts: [], customerId: null })
  }

  const contracts = await prisma.sfsCustomerContract.findMany({
    where: { customerId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      fileName: true,
      storageKey: true,
      mimeType: true,
      fileSize: true,
      notes: true,
      createdAt: true,
      uploadedBy: { select: { nameEn: true, email: true } },
    },
  })

  return NextResponse.json({
    customerId,
    contracts: contracts.map(contract => ({
      ...contract,
      createdAt: contract.createdAt.toISOString(),
    })),
  })
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, error } = await requireRole('STAFF', { adminMenu: 'sfsCustomers' })
  if (error) return error

  const { id } = await params
  const customerId = await resolveSfsCustomerIdFromRowId(decodeURIComponent(id))
  if (!customerId) {
    return NextResponse.json(
      { error: 'Save a customer profile before uploading contracts.' },
      { status: 400 },
    )
  }

  const customer = await prisma.sfsCustomer.findUnique({ where: { id: customerId }, select: { id: true } })
  if (!customer) return NextResponse.json({ error: 'Customer not found' }, { status: 404 })

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const notes = (formData.get('notes') as string | null)?.trim() || null

  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  try {
    const { key, contentType } = await uploadSfsCustomerContractFile(customerId, file)

    const contract = await prisma.sfsCustomerContract.create({
      data: {
        customerId,
        fileName: file.name,
        storageKey: key,
        mimeType: contentType,
        fileSize: file.size,
        notes,
        uploadedById: session!.user.id,
      },
    })

    await logAudit(session!.user.id, 'CREATE', 'SfsCustomerContract', contract.id, null, contract)
    return NextResponse.json({ contract }, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Upload failed'
    const status = message.includes('OSS') || message.includes('storage') ? 503 : 400
    return NextResponse.json({ error: message }, { status })
  }
}
