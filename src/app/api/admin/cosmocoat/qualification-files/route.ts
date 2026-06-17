import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireRole } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'
import { logAudit } from '@/lib/audit/logger'
import {
  qualificationFileInclude,
  serializeQualificationFile,
  uploadCosQualificationFile,
  deleteCosQualificationFile,
} from '@/lib/cosmocoat/qualification-files'

const metaSchema = z.object({
  title: z.string().trim().min(1, '请输入文件标题').max(120, '文件标题不能超过 120 个字符'),
  documentType: z.string().trim().min(1, '请输入资质类型').max(80, '资质类型不能超过 80 个字符'),
  notes: z.string().trim().max(500, '备注不能超过 500 个字符').optional().default(''),
})

function storageErrorStatus(message: string) {
  return message.includes('OSS') || message.includes('storage') ? 503 : 400
}

export async function GET(req: NextRequest) {
  const { error } = await requireRole('STAFF', { adminMenu: 'cosmocoatQualificationFiles' })
  if (error) return error

  const q = req.nextUrl.searchParams.get('q')?.trim() ?? ''
  const page = Math.max(1, Number(req.nextUrl.searchParams.get('page') ?? '1') || 1)
  const limit = Math.min(100, Math.max(1, Number(req.nextUrl.searchParams.get('limit') ?? '20') || 20))
  const skip = (page - 1) * limit

  const where = q
    ? {
        OR: [
          { title: { contains: q, mode: 'insensitive' as const } },
          { documentType: { contains: q, mode: 'insensitive' as const } },
          { fileName: { contains: q, mode: 'insensitive' as const } },
          { notes: { contains: q, mode: 'insensitive' as const } },
        ],
      }
    : undefined

  const [total, items] = await Promise.all([
    prisma.cosQualificationFile.count({ where }),
    prisma.cosQualificationFile.findMany({
      where,
      include: qualificationFileInclude,
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
      skip,
      take: limit,
    }),
  ])

  return NextResponse.json({
    items: items.map(serializeQualificationFile),
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  })
}

export async function POST(req: NextRequest) {
  const { session, error } = await requireRole('STAFF', { adminMenu: 'cosmocoatQualificationFiles' })
  if (error) return error

  const formData = await req.formData()
  const file = formData.get('file')
  const parsed = metaSchema.safeParse({
    title: formData.get('title'),
    documentType: formData.get('documentType'),
    notes: formData.get('notes'),
  })

  if (!(file instanceof File)) {
    return NextResponse.json({ error: '请上传资质文件' }, { status: 400 })
  }
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? '参数不正确' }, { status: 400 })
  }

  let uploaded: { key: string; contentType: string } | null = null
  try {
    uploaded = await uploadCosQualificationFile(file)

    const record = await prisma.cosQualificationFile.create({
      data: {
        title: parsed.data.title,
        documentType: parsed.data.documentType,
        fileName: file.name,
        storageKey: uploaded.key,
        mimeType: uploaded.contentType,
        fileSize: file.size,
        notes: parsed.data.notes || null,
        uploadedById: session!.user.id,
      },
      include: qualificationFileInclude,
    })

    await logAudit(session!.user.id, 'CREATE', 'CosQualificationFile', record.id, null, record)
    return NextResponse.json({ item: serializeQualificationFile(record) }, { status: 201 })
  } catch (err) {
    if (uploaded?.key) await deleteCosQualificationFile(uploaded.key)
    const message = err instanceof Error ? err.message : '上传失败'
    return NextResponse.json({ error: message }, { status: storageErrorStatus(message) })
  }
}
