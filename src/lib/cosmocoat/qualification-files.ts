import crypto from 'crypto'
import type { Prisma } from '@prisma/client'
import { deleteFromR2, getOssConfigError, uploadToR2 } from '@/lib/storage/r2'

const ALLOWED_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
]

const EXT_MIME: Record<string, string> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
}

export const COS_QUALIFICATION_FILE_MAX_SIZE = 10 * 1024 * 1024

export const qualificationFileInclude = {
  uploadedBy: { select: { nameEn: true, email: true } },
} satisfies Prisma.CosQualificationFileInclude

type QualificationFileRecord = Prisma.CosQualificationFileGetPayload<{ include: typeof qualificationFileInclude }>

export function resolveCosQualificationFileContentType(file: File): string | null {
  if (ALLOWED_TYPES.includes(file.type)) return file.type
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  const fromExt = EXT_MIME[ext]
  if (fromExt && ALLOWED_TYPES.includes(fromExt)) return fromExt
  return null
}

export function validateCosQualificationFile(file: File): string | null {
  const contentType = resolveCosQualificationFileContentType(file)
  if (!contentType) {
    return '不支持的文件格式，请使用 PDF、JPG、PNG 或 WEBP'
  }
  if (file.size > COS_QUALIFICATION_FILE_MAX_SIZE) {
    return '文件过大，最大 10 MB'
  }
  return null
}

export async function uploadCosQualificationFile(file: File) {
  const ossError = getOssConfigError()
  if (ossError) throw new Error(ossError)

  const validationError = validateCosQualificationFile(file)
  if (validationError) throw new Error(validationError)

  const contentType = resolveCosQualificationFileContentType(file)!
  let ext = 'pdf'
  if (contentType === 'image/jpeg') ext = 'jpg'
  else if (contentType === 'image/png') ext = 'png'
  else if (contentType === 'image/webp') ext = 'webp'

  const key = `cosmocoat/system-qualification-files/${crypto.randomUUID()}.${ext}`
  const buffer = Buffer.from(await file.arrayBuffer())

  await uploadToR2(key, buffer, contentType, {
    contentDisposition: `inline; filename="${file.name.replace(/"/g, '')}"`,
  })

  return { key, contentType }
}

export async function deleteCosQualificationFile(storageKey: string) {
  await deleteFromR2(storageKey).catch(err => {
    console.warn(`OSS delete failed for qualification file ${storageKey}:`, err)
  })
}

export function serializeQualificationFile(file: QualificationFileRecord) {
  return {
    id: file.id,
    title: file.title,
    documentType: file.documentType,
    fileName: file.fileName,
    storageKey: file.storageKey,
    mimeType: file.mimeType,
    fileSize: file.fileSize,
    notes: file.notes,
    createdAt: file.createdAt.toISOString(),
    updatedAt: file.updatedAt.toISOString(),
    uploadedBy: file.uploadedBy,
  }
}
