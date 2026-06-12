import crypto from 'crypto'
import { uploadToR2, deleteFromR2, getOssConfigError } from '@/lib/storage/r2'

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

export const COS_CUSTOMER_BUSINESS_LICENSE_MAX_SIZE = 10 * 1024 * 1024

export function resolveCosCustomerBusinessLicenseContentType(file: File): string | null {
  if (ALLOWED_TYPES.includes(file.type)) return file.type
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  const fromExt = EXT_MIME[ext]
  if (fromExt && ALLOWED_TYPES.includes(fromExt)) return fromExt
  return null
}

export function validateCosCustomerBusinessLicenseFile(file: File): string | null {
  const contentType = resolveCosCustomerBusinessLicenseContentType(file)
  if (!contentType) {
    return '不支持的文件格式，请使用 PDF、JPG、PNG 或 WEBP'
  }
  if (file.size > COS_CUSTOMER_BUSINESS_LICENSE_MAX_SIZE) {
    return '文件过大，最大 10 MB'
  }
  return null
}

export async function uploadCosCustomerBusinessLicenseFile(customerId: string, file: File) {
  const ossError = getOssConfigError()
  if (ossError) throw new Error(ossError)

  const validationError = validateCosCustomerBusinessLicenseFile(file)
  if (validationError) throw new Error(validationError)

  const contentType = resolveCosCustomerBusinessLicenseContentType(file)!
  let ext = 'pdf'
  if (contentType === 'image/jpeg') ext = 'jpg'
  else if (contentType === 'image/png') ext = 'png'
  else if (contentType === 'image/webp') ext = 'webp'

  const key = `cosmocoat/customers/${customerId}/business-licenses/${crypto.randomUUID()}.${ext}`
  const buffer = Buffer.from(await file.arrayBuffer())

  await uploadToR2(key, buffer, contentType, {
    contentDisposition: `attachment; filename="${file.name.replace(/"/g, '')}"`,
  })

  return { key, contentType }
}

export async function deleteCosCustomerBusinessLicenseFile(storageKey: string) {
  await deleteFromR2(storageKey).catch(err => {
    console.warn(`OSS delete failed for business license file ${storageKey}:`, err)
  })
}
