import crypto from 'node:crypto'
import { uploadSfsDesignObject, getSfsDesignOssConfigError } from '@/lib/storage/r2'
import {
  SFS_DESIGN_KEY_PREFIX,
  resolveSfsDesignContentType,
  validateSfsDesignFile,
} from '@/lib/sfs/design-upload-shared'

export type StoredSfsDesignUpload = {
  storageKey: string
  fileName: string
  mimeType: string
  sizeBytes: number
}

export async function uploadSfsDesignFile(file: File): Promise<StoredSfsDesignUpload> {
  const ossError = getSfsDesignOssConfigError()
  if (ossError) throw new Error(ossError)

  const validationError = validateSfsDesignFile(file)
  if (validationError) throw new Error(validationError)

  const contentType = resolveSfsDesignContentType(file)!
  let ext = 'pdf'
  if (contentType === 'image/jpeg') ext = 'jpg'
  else if (contentType === 'image/png') ext = 'png'
  else if (contentType === 'image/webp') ext = 'webp'

  const key = `${SFS_DESIGN_KEY_PREFIX}${crypto.randomUUID()}.${ext}`
  const buffer = Buffer.from(await file.arrayBuffer())

  await uploadSfsDesignObject(key, buffer, contentType, {
    contentDisposition: `inline; filename="${file.name.replace(/"/g, '')}"`,
  })

  return {
    storageKey: key,
    fileName: file.name,
    mimeType: contentType,
    sizeBytes: file.size,
  }
}
