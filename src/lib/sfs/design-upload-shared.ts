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

export const SFS_DESIGN_UPLOAD_MAX_SIZE = 10 * 1024 * 1024
/** Existing SFS custom-design namespace in the application OSS bucket. */
export const SFS_DESIGN_KEY_PREFIX = 'sfs/orders/designs/'

export type PendingDesignUpload = {
  uploadId: string
  fileName: string
  mimeType: string
  sizeBytes: number
}

export function isSfsCustomDesign(design: string | null | undefined): boolean {
  return (design ?? '').trim() === SFS_CUSTOM_DESIGN_VALUE
}

export function resolveSfsDesignContentType(file: Pick<File, 'name' | 'type'>): string | null {
  if (ALLOWED_TYPES.includes(file.type)) return file.type
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  const fromExt = EXT_MIME[ext]
  return fromExt && ALLOWED_TYPES.includes(fromExt) ? fromExt : null
}

export function validateSfsDesignFile(file: Pick<File, 'name' | 'size' | 'type'>): string | null {
  const contentType = resolveSfsDesignContentType(file)
  if (!contentType) return 'Unsupported file format. Use PDF, JPG, PNG, or WEBP.'
  if (file.size > SFS_DESIGN_UPLOAD_MAX_SIZE) return 'File too large. Maximum size is 10 MB.'
  return null
}

export function isSfsDesignStorageKey(key: string): boolean {
  return key.startsWith(SFS_DESIGN_KEY_PREFIX) && !key.includes('..')
}
