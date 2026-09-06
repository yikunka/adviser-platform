import crypto from 'crypto'
import { uploadToR2, getOssConfigError } from '@/lib/storage/r2'

export const SFS_CUSTOM_DESIGN_VALUE = 'Custom'

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

const MAX_SIZE = 10 * 1024 * 1024
const DESIGN_KEY_PREFIX = 'sfs/orders/designs/'

export type PendingDesignUpload = {
  storageKey: string
  fileName: string
  mimeType: string
  sizeBytes: number
}

export function isSfsCustomDesign(design: string | null | undefined): boolean {
  return (design ?? '').trim() === SFS_CUSTOM_DESIGN_VALUE
}

export function resolveSfsDesignContentType(file: File): string | null {
  if (ALLOWED_TYPES.includes(file.type)) return file.type
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  const fromExt = EXT_MIME[ext]
  if (fromExt && ALLOWED_TYPES.includes(fromExt)) return fromExt
  return null
}

export function validateSfsDesignFile(file: File): string | null {
  const contentType = resolveSfsDesignContentType(file)
  if (!contentType) {
    return 'Unsupported file format. Use PDF, JPG, PNG, or WEBP.'
  }
  if (file.size > MAX_SIZE) {
    return 'File too large. Maximum size is 10 MB.'
  }
  return null
}

export function isSfsDesignUploadKey(key: string): boolean {
  return key.startsWith(DESIGN_KEY_PREFIX) && !key.includes('..')
}

export async function uploadSfsDesignFile(file: File): Promise<PendingDesignUpload> {
  const ossError = getOssConfigError()
  if (ossError) throw new Error(ossError)

  const validationError = validateSfsDesignFile(file)
  if (validationError) throw new Error(validationError)

  const contentType = resolveSfsDesignContentType(file)!
  let ext = 'pdf'
  if (contentType === 'image/jpeg') ext = 'jpg'
  else if (contentType === 'image/png') ext = 'png'
  else if (contentType === 'image/webp') ext = 'webp'

  const key = `${DESIGN_KEY_PREFIX}${crypto.randomUUID()}.${ext}`
  const buffer = Buffer.from(await file.arrayBuffer())

  await uploadToR2(key, buffer, contentType, {
    contentDisposition: `inline; filename="${file.name.replace(/"/g, '')}"`,
  })

  return {
    storageKey: key,
    fileName: file.name,
    mimeType: contentType,
    sizeBytes: file.size,
  }
}
