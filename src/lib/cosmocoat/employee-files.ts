import crypto from 'crypto'
import { uploadToR2, deleteFromR2, getOssConfigError } from '@/lib/storage/r2'
import { contentDispositionHeader } from '@/lib/http/content-disposition'
import type { CosEmployeeFileType } from '@prisma/client'

const ALLOWED_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/png',
  'image/webp',
]

const EXT_MIME: Record<string, string> = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
}

const MAX_SIZE = 10 * 1024 * 1024

export function resolveCosEmployeeFileContentType(file: File): string | null {
  if (ALLOWED_TYPES.includes(file.type)) return file.type
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  const fromExt = EXT_MIME[ext]
  if (fromExt && ALLOWED_TYPES.includes(fromExt)) return fromExt
  return null
}

export function validateCosEmployeeFile(file: File): string | null {
  const contentType = resolveCosEmployeeFileContentType(file)
  if (!contentType) {
    return '不支持的文件格式，请使用 PDF、Word、JPG、PNG 或 WEBP'
  }
  if (file.size > MAX_SIZE) {
    return '文件过大，最大 10 MB'
  }
  return null
}

export async function uploadCosEmployeeFile(
  employeeId: string,
  fileType: CosEmployeeFileType,
  file: File,
) {
  const ossError = getOssConfigError()
  if (ossError) throw new Error(ossError)

  const validationError = validateCosEmployeeFile(file)
  if (validationError) throw new Error(validationError)

  const contentType = resolveCosEmployeeFileContentType(file)!
  let ext = 'pdf'
  if (contentType === 'image/jpeg') ext = 'jpg'
  else if (contentType === 'image/png') ext = 'png'
  else if (contentType === 'image/webp') ext = 'webp'
  else if (contentType === 'application/msword') ext = 'doc'
  else if (contentType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') ext = 'docx'

  const folderByType: Record<CosEmployeeFileType, string> = {
    LABOR_CONTRACT: 'contracts',
    RESUME: 'resumes',
    ID_CARD: 'id-cards',
  }
  const folder = folderByType[fileType]
  const key = `cosmocoat/employees/${employeeId}/${folder}/${crypto.randomUUID()}.${ext}`
  const buffer = Buffer.from(await file.arrayBuffer())

  await uploadToR2(key, buffer, contentType, {
    contentDisposition: contentDispositionHeader('inline', file.name),
  })

  return { key, contentType }
}

export async function deleteCosEmployeeFile(storageKey: string) {
  await deleteFromR2(storageKey).catch(err => {
    console.warn(`OSS delete failed for employee file ${storageKey}:`, err)
  })
}
