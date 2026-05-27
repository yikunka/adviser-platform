import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { requireRole } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'
import { uploadToR2 } from '@/lib/storage/r2'

// Allowed file types for TDS and MSDS documents
const ALLOWED_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/png',
  'image/webp',
]
const MAX_SIZE = 10 * 1024 * 1024 // 10MB

type FileType = 'tds' | 'msds'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await requireRole('STAFF', { adminMenu: 'cosmocoatRawMaterials' })
  if (error) return error

  const { id } = await params

  // Check if raw material exists
  const rawMaterial = await prisma.cosTableRawMaterial.findUnique({ where: { id } })
  if (!rawMaterial) {
    return NextResponse.json({ error: '原料不存在' }, { status: 404 })
  }

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const fileType = formData.get('type') as FileType | null

  if (!file) {
    return NextResponse.json({ error: '未提供文件' }, { status: 400 })
  }

  if (!fileType || !['tds', 'msds'].includes(fileType)) {
    return NextResponse.json({ error: '无效的文件类型，必须是 tds 或 msds' }, { status: 400 })
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: '不支持的文件格式。支持 PDF、Word、JPG、PNG、WEBP' },
      { status: 400 },
    )
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: '文件过大，最大支持 10MB' }, { status: 400 })
  }

  // Determine file extension
  let ext = 'pdf'
  if (file.type === 'image/jpeg') ext = 'jpg'
  else if (file.type === 'image/png') ext = 'png'
  else if (file.type === 'image/webp') ext = 'webp'
  else if (file.type === 'application/msword') ext = 'doc'
  else if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') ext = 'docx'

  // Generate unique key for storage
  const key = `cosmocoat/raw-materials/${id}/${fileType}/${crypto.randomUUID()}.${ext}`
  const buffer = Buffer.from(await file.arrayBuffer())

  try {
    await uploadToR2(key, buffer, file.type, {
      contentDisposition: `attachment; filename="${file.name}"`,
    })

    // Update the raw material record with the file key
    const updateData =
      fileType === 'tds'
        ? { tdsFileKey: key }
        : { msdsFileKey: key }

    await prisma.cosTableRawMaterial.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json({
      success: true,
      fileKey: key,
      fileType,
      message: `${fileType.toUpperCase()} 文件上传成功`,
    }, { status: 201 })
  } catch (err) {
    console.error('File upload error:', err)
    return NextResponse.json({ error: '文件上传失败' }, { status: 500 })
  }
}
