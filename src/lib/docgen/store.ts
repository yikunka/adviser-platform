import { prisma } from '@/lib/db/prisma'
import { uploadToR2 } from '@/lib/storage/r2'
import type { AMLCheckTrigger, DocumentType } from '@prisma/client'

type GeneratedDocType = Extract<DocumentType, 'ROD' | 'ROM' | 'ROSC' | 'DDR' | 'NAR1'>
type DdrScreenTrigger = Extract<AMLCheckTrigger, 'SCHEDULED' | 'MANUAL' | 'KYC_SUBMIT'>

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

const REGISTER_DOC_TYPES = new Set<GeneratedDocType>(['ROD', 'ROM', 'ROSC'])

function isGeneratedRegisterDocName(type: string, name: string) {
  return name.startsWith(`${type} —`)
}

async function findGeneratedRegisterDoc(companyId: string, type: 'ROD' | 'ROM' | 'ROSC') {
  const docs = await prisma.document.findMany({
    where: { companyId, documentType: type, deletedAt: null },
    orderBy: { createdAt: 'desc' },
  })
  return docs.find(d => isGeneratedRegisterDocName(type, d.name)) ?? null
}

export async function generateAndStoreCompanyDocument({
  type,
  companyId,
  uploadedById,
  notes,
  effectiveDate,
  ddrScreenTrigger = 'MANUAL',
}: {
  type: GeneratedDocType
  companyId: string
  uploadedById: string
  notes?: string
  effectiveDate?: Date
  ddrScreenTrigger?: DdrScreenTrigger
}) {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { id: true, nameEn: true },
  })
  if (!company) throw new Error('Company not found')

  if (type === 'DDR') {
    const { screenCompany } = await import('@/lib/aml/screener')
    await screenCompany(companyId, ddrScreenTrigger, uploadedById)
  }

  const rendered = await renderDocument(type, companyId)
  const datestamp = new Date().toISOString().split('T')[0].replace(/-/g, '')
  const storageKey = `docgen/${companyId}/${type}_${datestamp}_${Date.now()}.${rendered.extension}`
  await uploadToR2(storageKey, rendered.buffer, rendered.mimeType)

  const docName = `${type} — ${company.nameEn} (${notes ?? datestamp})`
  const docNotes = notes ?? datestamp

  if (REGISTER_DOC_TYPES.has(type)) {
    const registerType = type as 'ROD' | 'ROM' | 'ROSC'
    const existing = await findGeneratedRegisterDoc(companyId, registerType)
    if (existing) {
      const updated = await prisma.document.update({
        where: { id: existing.id },
        data: {
          name: docName,
          storageKey,
          mimeType: rendered.mimeType,
          fileSize: rendered.buffer.length,
          uploadedById,
          notes: docNotes,
          version: { increment: 1 },
        },
      })
      await prisma.document.updateMany({
        where: {
          companyId,
          documentType: registerType,
          deletedAt: null,
          id: { not: existing.id },
          name: { startsWith: `${registerType} —` },
        },
        data: { deletedAt: new Date() },
      })
      return updated
    }
  }

  return prisma.document.create({
    data: {
      companyId,
      documentType: type,
      name: docName,
      storageKey,
      mimeType: rendered.mimeType,
      fileSize: rendered.buffer.length,
      uploadedById,
      notes: docNotes,
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
    ddrScreenTrigger: 'SCHEDULED',
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
