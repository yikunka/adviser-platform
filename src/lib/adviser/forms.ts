import crypto from 'crypto'
import { contentDispositionHeader } from '@/lib/http/content-disposition'
import { deleteFromR2, getOssConfigError, uploadToR2 } from '@/lib/storage/r2'

const ALLOWED_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]

const EXT_MIME: Record<string, string> = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
}

export const ADVISER_FORM_FILE_MAX_SIZE = 15 * 1024 * 1024

export function resolveAdviserFormContentType(file: File): string | null {
  if (ALLOWED_TYPES.includes(file.type)) return file.type
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  const fromExt = EXT_MIME[ext]
  if (fromExt && ALLOWED_TYPES.includes(fromExt)) return fromExt
  return null
}

export function validateAdviserFormFile(file: File): string | null {
  const contentType = resolveAdviserFormContentType(file)
  if (!contentType) {
    return '不支持的文件格式，请使用 PDF、Word 或 Excel'
  }
  if (file.size > ADVISER_FORM_FILE_MAX_SIZE) {
    return '文件过大，最大 15 MB'
  }
  return null
}

function extensionForContentType(contentType: string): string {
  if (contentType === 'application/msword') return 'doc'
  if (contentType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') return 'docx'
  if (contentType === 'application/vnd.ms-excel') return 'xls'
  if (contentType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') return 'xlsx'
  return 'pdf'
}

export async function uploadAdviserFormFile(formId: string, file: File) {
  const ossError = getOssConfigError()
  if (ossError) throw new Error(ossError)

  const validationError = validateAdviserFormFile(file)
  if (validationError) throw new Error(validationError)

  const contentType = resolveAdviserFormContentType(file)!
  const key = `adviser/forms/${formId}/${crypto.randomUUID()}.${extensionForContentType(contentType)}`
  const buffer = Buffer.from(await file.arrayBuffer())

  await uploadToR2(key, buffer, contentType, {
    contentDisposition: contentDispositionHeader('attachment', file.name),
  })

  return { key, contentType }
}

export async function deleteAdviserFormFile(storageKey: string) {
  await deleteFromR2(storageKey).catch(err => {
    console.warn(`OSS delete failed for Adviser form file ${storageKey}:`, err)
  })
}
