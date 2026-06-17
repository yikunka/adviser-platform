import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireRole } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'
import { logAudit } from '@/lib/audit/logger'
import {
  deleteCosQualificationFile,
  qualificationFileInclude,
  serializeQualificationFile,
  uploadCosQualificationFile,
} from '@/lib/cosmocoat/qualification-files'

const metaSchema = z.object({
  title: z.string().trim().min(1, '请输入文件标题').max(120, '文件标题不能超过 120 个字符'),
  documentType: z.string().trim().min(1, '请输入资质类型').max(80, '资质类型不能超过 80 个字符'),
  notes: z.string().trim().max(500, '备注不能超过 500 个字符').optional().default(''),
})

function storageErrorStatus(message: string) {
  return message.includes('OSS') || message.includes('storage') ? 503 : 400
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, error } = await requireRole('STAFF', { adminMenu: 'cosmocoatQualificationFiles' })
  if (error) return error

  const { id } = await params
  const current = await prisma.cosQualificationFile.findUnique({ where: { id } })
  if (!current) return NextResponse.json({ error: '文件不存在' }, { status: 404 })

  const formData = await req.formData()
  const maybeFile = formData.get('file')
  const file = maybeFile instanceof File && maybeFile.size > 0 ? maybeFile : null
  const parsed = metaSchema.safeParse({
    title: formData.get('title'),
    documentType: formData.get('documentType'),
    notes: formData.get('notes'),
  })

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? '参数不正确' }, { status: 400 })
  }

  let uploaded: { key: string; contentType: string } | null = null
  try {
    if (file) {
      uploaded = await uploadCosQualificationFile(file)
    }

    const record = await prisma.cosQualificationFile.update({
      where: { id },
      data: {
        title: parsed.data.title,
        documentType: parsed.data.documentType,
        notes: parsed.data.notes || null,
        ...(uploaded
          ? {
              fileName: file!.name,
              storageKey: uploaded.key,
              mimeType: uploaded.contentType,
              fileSize: file!.size,
            }
          : {}),
      },
      include: qualificationFileInclude,
    })

    if (uploaded && current.storageKey !== uploaded.key) {
      await deleteCosQualificationFile(current.storageKey)
    }

    await logAudit(session!.user.id, 'UPDATE', 'CosQualificationFile', id, current, record)
    return NextResponse.json({ item: serializeQualificationFile(record) })
  } catch (err) {
    if (uploaded?.key) await deleteCosQualificationFile(uploaded.key)
    const message = err instanceof Error ? err.message : '保存失败'
    return NextResponse.json({ error: message }, { status: storageErrorStatus(message) })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, error } = await requireRole('STAFF', { adminMenu: 'cosmocoatQualificationFiles' })
  if (error) return error

  const { id } = await params
  const current = await prisma.cosQualificationFile.findUnique({ where: { id } })
  if (!current) return NextResponse.json({ error: '文件不存在' }, { status: 404 })

  await deleteCosQualificationFile(current.storageKey)
  await prisma.cosQualificationFile.delete({ where: { id } })
  await logAudit(session!.user.id, 'DELETE', 'CosQualificationFile', id, current, null)
  return NextResponse.json({ success: true })
}
