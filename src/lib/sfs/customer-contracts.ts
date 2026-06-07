import crypto from 'crypto'
import { uploadToR2, deleteFromR2, getOssConfigError } from '@/lib/storage/r2'

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

export function resolveSfsContractContentType(file: File): string | null {
  if (ALLOWED_TYPES.includes(file.type)) return file.type
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  const fromExt = EXT_MIME[ext]
  if (fromExt && ALLOWED_TYPES.includes(fromExt)) return fromExt
  return null
}

export function validateSfsContractFile(file: File): string | null {
  const contentType = resolveSfsContractContentType(file)
  if (!contentType) {
    return 'Unsupported file format. Use PDF, Word, JPG, PNG, or WEBP.'
  }
  if (file.size > MAX_SIZE) {
    return 'File too large. Maximum size is 10 MB.'
  }
  return null
}

export async function uploadSfsCustomerContractFile(customerId: string, file: File) {
  const ossError = getOssConfigError()
  if (ossError) throw new Error(ossError)

  const validationError = validateSfsContractFile(file)
  if (validationError) throw new Error(validationError)

  const contentType = resolveSfsContractContentType(file)!
  let ext = 'pdf'
  if (contentType === 'image/jpeg') ext = 'jpg'
  else if (contentType === 'image/png') ext = 'png'
  else if (contentType === 'image/webp') ext = 'webp'
  else if (contentType === 'application/msword') ext = 'doc'
  else if (contentType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') ext = 'docx'

  const key = `sfs/customers/${customerId}/contracts/${crypto.randomUUID()}.${ext}`
  const buffer = Buffer.from(await file.arrayBuffer())

  await uploadToR2(key, buffer, contentType, {
    contentDisposition: `attachment; filename="${file.name.replace(/"/g, '')}"`,
  })

  return { key, contentType }
}

export async function deleteSfsCustomerContractFile(storageKey: string) {
  await deleteFromR2(storageKey).catch(err => {
    console.warn(`OSS delete failed for contract file ${storageKey}:`, err)
  })
}
