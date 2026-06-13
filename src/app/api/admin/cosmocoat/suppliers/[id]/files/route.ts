import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'
import { logAudit } from '@/lib/audit/logger'
import { uploadCosSupplierFile } from '@/lib/cosmocoat/supplier-files'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await requireRole('STAFF', { adminMenu: 'cosmocoatSuppliers' })
  if (error) return error

  const { id } = await params
  const supplier = await prisma.cosSupplier.findUnique({ where: { id }, select: { id: true } })
  if (!supplier) return NextResponse.json({ error: '供应商不存在' }, { status: 404 })

  const files = await prisma.cosSupplierFile.findMany({
    where: { supplierId: id },
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
    files: files.map(file => ({
      ...file,
      createdAt: file.createdAt.toISOString(),
    })),
  })
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, error } = await requireRole('STAFF', { adminMenu: 'cosmocoatSuppliers' })
  if (error) return error

  const { id } = await params
  const supplier = await prisma.cosSupplier.findUnique({ where: { id }, select: { id: true } })
  if (!supplier) return NextResponse.json({ error: '供应商不存在' }, { status: 404 })

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const notes = (formData.get('notes') as string | null)?.trim() || null

  if (!file) return NextResponse.json({ error: '未提供文件' }, { status: 400 })

  try {
    const { key, contentType } = await uploadCosSupplierFile(id, file)

    const record = await prisma.cosSupplierFile.create({
      data: {
        supplierId: id,
        fileName: file.name,
        storageKey: key,
        mimeType: contentType,
        fileSize: file.size,
        notes,
        uploadedById: session!.user.id,
      },
    })

    await logAudit(session!.user.id, 'CREATE', 'CosSupplierFile', record.id, null, record)
    return NextResponse.json({ file: record }, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : '上传失败'
    const status = message.includes('OSS') || message.includes('storage') ? 503 : 400
    return NextResponse.json({ error: message }, { status })
  }
}
