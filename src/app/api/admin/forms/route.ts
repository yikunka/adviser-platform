import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { requirePermission, requireRole } from '@/lib/auth/rbac'
import { logAudit } from '@/lib/audit/logger'
import { prisma } from '@/lib/db/prisma'
import { deleteAdviserFormFile, uploadAdviserFormFile } from '@/lib/adviser/forms'

const formSelect = {
  id: true,
  formName: true,
  notes: true,
  fileName: true,
  storageKey: true,
  mimeType: true,
  fileSize: true,
  createdAt: true,
  updatedAt: true,
  uploadedBy: { select: { nameEn: true, email: true } },
} as const

function serializeForm<T extends { createdAt: Date; updatedAt: Date }>(form: T) {
  return {
    ...form,
    createdAt: form.createdAt.toISOString(),
    updatedAt: form.updatedAt.toISOString(),
  }
}

export async function GET(req: NextRequest) {
  const { error } = await requireRole('STAFF', { adminMenu: 'forms' })
  if (error) return error

  const search = (req.nextUrl.searchParams.get('q') ?? '').trim()
  const forms = await prisma.adviserForm.findMany({
    where: search
      ? {
          OR: [
            { formName: { contains: search, mode: 'insensitive' } },
            { fileName: { contains: search, mode: 'insensitive' } },
            { notes: { contains: search, mode: 'insensitive' } },
          ],
        }
      : undefined,
    orderBy: [{ formName: 'asc' }, { createdAt: 'desc' }],
    select: formSelect,
  })

  return NextResponse.json({ forms: forms.map(serializeForm) })
}

export async function POST(req: NextRequest) {
  const { session, error } = await requirePermission('forms.create')
  if (error) return error

  const formData = await req.formData()
  const formName = ((formData.get('formName') as string | null) ?? '').trim()
  const notes = ((formData.get('notes') as string | null) ?? '').trim() || null
  const file = formData.get('file') as File | null

  if (!formName) return NextResponse.json({ error: '表格名称不能为空。' }, { status: 400 })
  if (formName.length > 200) return NextResponse.json({ error: '表格名称过长。' }, { status: 400 })
  if (notes && notes.length > 2000) return NextResponse.json({ error: '备注过长。' }, { status: 400 })
  if (!file) return NextResponse.json({ error: '请选择表格文件。' }, { status: 400 })

  const id = crypto.randomUUID()
  let uploaded: { key: string; contentType: string } | null = null

  try {
    uploaded = await uploadAdviserFormFile(id, file)
    const form = await prisma.adviserForm.create({
      data: {
        id,
        formName,
        notes,
        fileName: file.name,
        storageKey: uploaded.key,
        mimeType: uploaded.contentType,
        fileSize: file.size,
        uploadedById: session!.user.id,
      },
      select: formSelect,
    })

    await logAudit(session!.user.id, 'CREATE', 'AdviserForm', form.id, null, form)
    return NextResponse.json({ form: serializeForm(form), toast: '表格已上传。' }, { status: 201 })
  } catch (err) {
    if (uploaded) await deleteAdviserFormFile(uploaded.key)
    const message = err instanceof Error ? err.message : '上传表格失败。'
    const status = message.includes('OSS') || message.includes('storage') ? 503 : 400
    return NextResponse.json({ error: message }, { status })
  }
}
