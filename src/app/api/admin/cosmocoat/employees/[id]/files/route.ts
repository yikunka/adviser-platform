import { NextRequest, NextResponse } from 'next/server'
import type { CosEmployeeFileType } from '@prisma/client'
import { requireRole } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'
import { logAudit } from '@/lib/audit/logger'
import { uploadCosEmployeeFile } from '@/lib/cosmocoat/employee-files'

const FILE_TYPES: CosEmployeeFileType[] = ['LABOR_CONTRACT', 'RESUME']

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await requireRole('STAFF', { adminMenu: 'cosmocoatEmployees' })
  if (error) return error

  const { id } = await params
  const fileType = req.nextUrl.searchParams.get('fileType')?.trim() ?? ''

  const employee = await prisma.cosEmployee.findUnique({ where: { id }, select: { id: true } })
  if (!employee) return NextResponse.json({ error: '员工不存在' }, { status: 404 })

  const where = {
    employeeId: id,
    ...(FILE_TYPES.includes(fileType as CosEmployeeFileType)
      ? { fileType: fileType as CosEmployeeFileType }
      : {}),
  }

  const files = await prisma.cosEmployeeFile.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      fileType: true,
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
  const { session, error } = await requireRole('STAFF', { adminMenu: 'cosmocoatEmployees' })
  if (error) return error

  const { id } = await params
  const employee = await prisma.cosEmployee.findUnique({ where: { id }, select: { id: true } })
  if (!employee) return NextResponse.json({ error: '员工不存在' }, { status: 404 })

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const fileTypeRaw = (formData.get('fileType') as string | null)?.trim() ?? ''
  const notes = (formData.get('notes') as string | null)?.trim() || null

  if (!file) return NextResponse.json({ error: '未提供文件' }, { status: 400 })
  if (!FILE_TYPES.includes(fileTypeRaw as CosEmployeeFileType)) {
    return NextResponse.json({ error: '无效的文件类型' }, { status: 400 })
  }
  const fileType = fileTypeRaw as CosEmployeeFileType

  try {
    const { key, contentType } = await uploadCosEmployeeFile(id, fileType, file)

    const record = await prisma.cosEmployeeFile.create({
      data: {
        employeeId: id,
        fileType,
        fileName: file.name,
        storageKey: key,
        mimeType: contentType,
        fileSize: file.size,
        notes,
        uploadedById: session!.user.id,
      },
    })

    await logAudit(session!.user.id, 'CREATE', 'CosEmployeeFile', record.id, null, record)
    return NextResponse.json({ file: record }, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : '上传失败'
    const status = message.includes('OSS') || message.includes('storage') ? 503 : 400
    return NextResponse.json({ error: message }, { status })
  }
}
