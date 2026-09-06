import crypto from 'node:crypto'
import { uploadToR2, getOssConfigError } from '@/lib/storage/r2'
import {
  type PendingDesignUpload,
  resolveSfsDesignContentType,
  validateSfsDesignFile,
} from '@/lib/sfs/design-upload-shared'

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

  const key = `sfs/orders/designs/${crypto.randomUUID()}.${ext}`
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
