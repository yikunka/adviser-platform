import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'
import { uploadToR2 } from '@/lib/storage/r2'
import crypto from 'crypto'

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
const MAX_SIZE = 20 * 1024 * 1024

function safeFileLabel(label: string | undefined) {
  return label?.trim().replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48)
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireRole('STAFF', { adminMenu: 'sfsOrders' })
  if (error) return error

  const { id: orderId } = await params

  const formData = await req.formData()
  const phase      = formData.get('phase') as string
  const stepNumber = parseInt(formData.get('stepNumber') as string, 10)
  const recordedAt = formData.get('recordedAt') as string
  const particular = formData.get('particular') as string
  const notes      = formData.get('notes') as string | null

  if (!phase || !['CHEM_TRANSFORM', 'CVD', 'CRAFTING'].includes(phase)) {
    return NextResponse.json({ error: 'Invalid phase' }, { status: 400 })
  }
  if (!recordedAt || !particular) {
    return NextResponse.json({ error: 'recordedAt and particular are required' }, { status: 400 })
  }

  // Upload any attached files
  const fileKeys: string[] = []
  const files = formData.getAll('files') as File[]
  const fileLabels = formData.getAll('fileLabels').map(label => String(label ?? ''))
  for (const [index, file] of files.entries()) {
    if (!ALLOWED_TYPES.includes(file.type)) continue
    if (file.size > MAX_SIZE) continue
    const ext = file.name.split('.').pop() ?? 'bin'
    const label = safeFileLabel(fileLabels[index])
    const key = `sfs-orders/${orderId}/steps/${label ? `${label}-` : ''}${crypto.randomUUID()}.${ext}`
    const buf = Buffer.from(await file.arrayBuffer())
    await uploadToR2(key, buf, file.type)
    fileKeys.push(key)
  }

  const step = await prisma.sfsOrderStep.create({
    data: {
      orderId,
      phase,
      stepNumber: isNaN(stepNumber) ? 0 : stepNumber,
      recordedAt: new Date(recordedAt),
      particular,
      notes: notes ?? undefined,
      fileKeys,
    },
  })

  return NextResponse.json(step, { status: 201 })
}
