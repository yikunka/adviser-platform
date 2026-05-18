import { prisma } from '@/lib/db/prisma'
import { uploadToR2 } from '@/lib/storage/r2'
import type { DocumentType } from '@prisma/client'

type GeneratedDocType = Extract<DocumentType, 'ROD' | 'ROM' | 'ROSC' | 'DDR' | 'NAR1'>

function monthRange(date = new Date()) {
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1))
  const end = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1))
  return { start, end, key: `${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, '0')}` }
}

async function renderDocument(type: GeneratedDocType, companyId: string) {
  switch (type) {
    case 'ROD': {
      const { generateROD } = await import('@/lib/docgen/rod')
      return {
        buffer: await generateROD(companyId),
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        extension: 'docx',
      }
    }
    case 'ROM': {
      const { generateROM } = await import('@/lib/docgen/rom')
      return {
        buffer: await generateROM(companyId),
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        extension: 'docx',
      }
    }
    case 'ROSC': {
      const { generateROSC } = await import('@/lib/docgen/rosc')
      return {
        buffer: await generateROSC(companyId),
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        extension: 'docx',
      }
    }
    case 'NAR1': {
      const { generateNAR1 } = await import('@/lib/docgen/nar1')
      return {
        buffer: await generateNAR1(companyId),
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        extension: 'docx',
      }
    }
    case 'DDR': {
      const { generateDDR } = await import('@/lib/docgen/ddr')
      return {
        buffer: await generateDDR(companyId),
        mimeType: 'application/pdf',
        extension: 'pdf',
      }
    }
  }
}

export async function generateAndStoreCompanyDocument({
  type,
  companyId,
  uploadedById,
  notes,
  effectiveDate,
}: {
  type: GeneratedDocType
  companyId: string
  uploadedById: string
  notes?: string
  effectiveDate?: Date
}) {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { id: true, nameEn: true },
  })
  if (!company) throw new Error('Company not found')

  const rendered = await renderDocument(type, companyId)
  const datestamp = new Date().toISOString().split('T')[0].replace(/-/g, '')
  const storageKey = `docgen/${companyId}/${type}_${datestamp}_${Date.now()}.${rendered.extension}`
  await uploadToR2(storageKey, rendered.buffer, rendered.mimeType)

  return prisma.document.create({
    data: {
      companyId,
      documentType: type,
      name: `${type} — ${company.nameEn} (${notes ?? datestamp})`,
      storageKey,
      mimeType: rendered.mimeType,
      fileSize: rendered.buffer.length,
      uploadedById,
      notes,
      effectiveDate,
    },
  })
}

export async function ensureNar1Document(companyId: string, uploadedById: string) {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { annualReturnDate: true },
  })
  if (!company?.annualReturnDate) return null

  const year = String(company.annualReturnDate.getUTCFullYear())
  const existing = await prisma.document.findFirst({
    where: { companyId, documentType: 'NAR1', notes: `Year: ${year}`, deletedAt: null },
    orderBy: { createdAt: 'desc' },
  })
  if (existing) return existing

  return generateAndStoreCompanyDocument({
    type: 'NAR1',
    companyId,
    uploadedById,
    notes: `Year: ${year}`,
    effectiveDate: new Date(Date.UTC(Number(year), 0, 1)),
  })
}

export async function ensureMonthlyDdrDocument(companyId: string, uploadedById: string, date = new Date()) {
  const { start, end, key } = monthRange(date)
  const existing = await prisma.document.findFirst({
    where: {
      companyId,
      documentType: 'DDR',
      effectiveDate: { gte: start, lt: end },
      deletedAt: null,
    },
    orderBy: { createdAt: 'desc' },
  })
  if (existing) return existing

  return generateAndStoreCompanyDocument({
    type: 'DDR',
    companyId,
    uploadedById,
    notes: `Month: ${key}`,
    effectiveDate: start,
  })
}

export async function findSystemDocumentUserId() {
  const user = await prisma.user.findFirst({
    where: { role: { in: ['SUPER_ADMIN', 'COMPLIANCE', 'STAFF'] } },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  })
  return user?.id ?? null
}
