import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/rbac'
import { logAudit } from '@/lib/audit/logger'
import { prisma } from '@/lib/db/prisma'
import { deleteAdviserFormFile } from '@/lib/adviser/forms'
import { formPatchSchema } from '@/lib/adviser/form-schemas'

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

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, error } = await requirePermission('forms.edit')
  if (error) return error

  const { id } = await params
  const body = await req.json().catch(() => null)
  const parsed = formPatchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: '请检查表格名称和备注。' }, { status: 400 })
  }

  const before = await prisma.adviserForm.findUnique({ where: { id } })
  if (!before) return NextResponse.json({ error: '表格不存在。' }, { status: 404 })

  const form = await prisma.adviserForm.update({
    where: { id },
    data: {
      formName: parsed.data.formName.trim(),
      notes: parsed.data.notes?.trim() || null,
    },
    select: formSelect,
  })

  await logAudit(session!.user.id, 'UPDATE', 'AdviserForm', id, before, form)
  return NextResponse.json({ form: serializeForm(form), toast: '表格已更新。' })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, error } = await requirePermission('forms.delete')
  if (error) return error

  const { id } = await params
  const form = await prisma.adviserForm.findUnique({ where: { id } })
  if (!form) return NextResponse.json({ error: '表格不存在。' }, { status: 404 })

  await prisma.adviserForm.delete({ where: { id } })
  await deleteAdviserFormFile(form.storageKey)
  await logAudit(session!.user.id, 'DELETE', 'AdviserForm', id, form, null)

  return NextResponse.json({ toast: '表格已删除。' })
}
