import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'

const WORK_TASK_KINDS = new Set([
  'SHARE_TRANSFER',
  'COMPANY_NAME_CHANGE',
  'REGISTERED_OFFICE_ADDRESS',
  'REGISTER_LOCATION',
  'ACCOUNTING_REFERENCE_DATE',
])

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await requireRole('STAFF', { adminMenu: 'workTasks' })
  if (error) return error

  const { id } = await params
  const task = await prisma.advWorkTask.findUnique({
    where: { id },
    select: {
      id: true,
      taskNumber: true,
      kind: true,
      createdAt: true,
      payload: true,
      company: { select: { id: true, nameEn: true, nameZh: true } },
      createdBy: { select: { nameEn: true } },
      files: {
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          templateKey: true,
          fileName: true,
          storageKey: true,
          fileSize: true,
        },
      },
    },
  })
  if (!task || !WORK_TASK_KINDS.has(task.kind)) {
    return NextResponse.json({ error: '找不到这项任务。' }, { status: 404 })
  }

  return NextResponse.json({ task })
}
