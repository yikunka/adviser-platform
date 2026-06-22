import crypto from 'crypto'
import { contentDispositionHeader } from '@/lib/http/content-disposition'
import { deleteFromR2, getOssConfigError, uploadToR2 } from '@/lib/storage/r2'

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

export const ADVISER_CONTRACT_FILE_MAX_SIZE = 10 * 1024 * 1024

export function resolveAdviserContractContentType(file: File): string | null {
  if (ALLOWED_TYPES.includes(file.type)) return file.type
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  const fromExt = EXT_MIME[ext]
  if (fromExt && ALLOWED_TYPES.includes(fromExt)) return fromExt
  return null
}

export function validateAdviserContractFile(file: File): string | null {
  const contentType = resolveAdviserContractContentType(file)
  if (!contentType) {
    return '不支持的文件格式，请使用 PDF、Word、JPG、PNG 或 WEBP'
  }
  if (file.size > ADVISER_CONTRACT_FILE_MAX_SIZE) {
    return '文件过大，最大 10 MB'
  }
  return null
}

function extensionForContentType(contentType: string): string {
  if (contentType === 'image/jpeg') return 'jpg'
  if (contentType === 'image/png') return 'png'
  if (contentType === 'image/webp') return 'webp'
  if (contentType === 'application/msword') return 'doc'
  if (contentType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') return 'docx'
  return 'pdf'
}

export async function uploadAdviserContractFile(contractId: string, file: File) {
  const ossError = getOssConfigError()
  if (ossError) throw new Error(ossError)

  const validationError = validateAdviserContractFile(file)
  if (validationError) throw new Error(validationError)

  const contentType = resolveAdviserContractContentType(file)!
  const key = `adviser/contracts/${contractId}/${crypto.randomUUID()}.${extensionForContentType(contentType)}`
  const buffer = Buffer.from(await file.arrayBuffer())

  await uploadToR2(key, buffer, contentType, {
    contentDisposition: contentDispositionHeader('attachment', file.name),
  })

  return { key, contentType }
}

export async function deleteAdviserContractFile(storageKey: string) {
  await deleteFromR2(storageKey).catch(err => {
    console.warn(`OSS delete failed for Adviser contract file ${storageKey}:`, err)
  })
}
