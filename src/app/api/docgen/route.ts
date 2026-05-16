import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'
import { uploadToR2 } from '@/lib/storage/r2'
import { logAudit } from '@/lib/audit/logger'
import { z } from 'zod'

const schema = z.object({
  type: z.enum(['ROD', 'ROM', 'ROSC', 'DDR', 'NAR1']),
  companyId: z.string(),
  ddrId: z.string().optional(),
})

export async function POST(req: NextRequest) {
  const { session, error } = await requireRole('STAFF', { adminMenu: 'companies' })
  if (error) return error

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 })

  const { type, companyId, ddrId } = parsed.data

  // Verify company exists
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { id: true, nameEn: true, companyNumber: true },
  })
  if (!company) return NextResponse.json({ error: 'Company not found' }, { status: 404 })

  let buffer: Buffer
  let mimeType: string
  let extension: string

  try {
    switch (type) {
      case 'ROD': {
        const { generateROD } = await import('@/lib/docgen/rod')
        buffer = await generateROD(companyId)
        mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        extension = 'docx'
        break
      }
      case 'ROM': {
        const { generateROM } = await import('@/lib/docgen/rom')
        buffer = await generateROM(companyId)
        mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        extension = 'docx'
        break
      }
      case 'ROSC': {
        const { generateROSC } = await import('@/lib/docgen/rosc')
        buffer = await generateROSC(companyId)
        mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        extension = 'docx'
        break
      }
      case 'DDR': {
        const { generateDDR } = await import('@/lib/docgen/ddr')
        buffer = await generateDDR(companyId, ddrId)
        mimeType = 'application/pdf'
        extension = 'pdf'
        break
      }
      case 'NAR1': {
        const { generateNAR1 } = await import('@/lib/docgen/nar1')
        buffer = await generateNAR1(companyId)
        mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        extension = 'docx'
        break
      }
      default:
        return NextResponse.json({ error: 'Unsupported type' }, { status: 400 })
    }
  } catch (err) {
    console.error('[docgen]', err)
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }

  const datestamp = new Date().toISOString().split('T')[0].replace(/-/g, '')
  const storageKey = `docgen/${companyId}/${type}_${datestamp}_${Date.now()}.${extension}`
  await uploadToR2(storageKey, buffer, mimeType)

  const doc = await prisma.document.create({
    data: {
      companyId,
      documentType: type as never,
      name: `${type} — ${company.nameEn} (${datestamp})`,
      storageKey,
      mimeType,
      fileSize: buffer.length,
      uploadedById: session.user.id,
    },
  })

  await logAudit(session.user.id, `GENERATE_${type}`, 'Document', doc.id, null, { companyId, type })

  return NextResponse.json({ documentId: doc.id, storageKey })
}
