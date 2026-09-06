/**
 * File storage adapter — Alibaba Cloud OSS in production, local disk in dev.
 *
 * OSS (production):
 *   OSS_REGION, OSS_ACCESS_KEY_ID, OSS_ACCESS_KEY_SECRET, OSS_BUCKET
 *
 * Local (development):
 *   Set LOCAL_UPLOADS_DIR (default: <cwd>/uploads) or leave OSS unset in dev —
 *   files are written to disk and served via GET /api/files?key=<storageKey>
 */

import fs from 'fs/promises'
import path from 'path'
import { access } from 'fs/promises'
import { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { fileNameFromContentDisposition } from '@/lib/http/content-disposition'

function uploadsRoot(): string {
  const fromEnv = (process.env['LOCAL_UPLOADS_DIR'] ?? '').trim()
  if (fromEnv) return path.resolve(/*turbopackIgnore: true*/ fromEnv)
  return path.join(/*turbopackIgnore: true*/ process.cwd(), 'uploads')
}

function storageKeyPathParts(key: string): string[] {
  const normalized = key.replace(/\\/g, '/')
  if (!normalized.trim() || path.isAbsolute(normalized)) {
    throw new Error('Invalid file path')
  }

  const parts = normalized.split('/').filter(Boolean)
  if (parts.length === 0 || parts.some(part => part === '.' || part === '..')) {
    throw new Error('Invalid file path')
  }
  return parts
}

function resolveLocalPath(key: string): string {
  return path.join(uploadsRoot(), ...storageKeyPathParts(key))
}

function ossCredentialsMissing(): boolean {
  const accessKeyId = (process.env['OSS_ACCESS_KEY_ID'] ?? '').trim()
  const secretAccessKey = (process.env['OSS_ACCESS_KEY_SECRET'] ?? '').trim()
  const bucket = (process.env['OSS_BUCKET'] ?? '').trim()
  const region = (process.env['OSS_REGION'] ?? '').trim()
  return !accessKeyId || !secretAccessKey || !bucket || !region
}

/** True when OSS credentials and bucket are configured. */
export function isOssConfigured(): boolean {
  return !ossCredentialsMissing()
}

/** True when uploads/downloads should use the local uploads directory. */
export function isLocalStorageEnabled(): boolean {
  const forceLocal =
    (process.env['USE_LOCAL_STORAGE'] ?? '').trim() === '1'
    || (process.env['USE_LOCAL_STORAGE'] ?? '').trim().toLowerCase() === 'true'
  if (forceLocal) return true

  // Production: prefer OSS when configured (ignore stray LOCAL_UPLOADS_DIR in .env).
  if (process.env.NODE_ENV === 'production') {
    return !isOssConfigured()
  }

  if ((process.env['LOCAL_UPLOADS_DIR'] ?? '').trim()) {
    return true
  }
  return ossCredentialsMissing()
}

function encodeStorageKeyPath(key: string): string {
  return key.split('/').map(part => encodeURIComponent(part)).join('/')
}

function getOssBaseUrl(): string {
  const configured = (
    process.env['NEXT_PUBLIC_OSS_CDN_URL']
    ?? process.env['OSS_CDN_URL']
    ?? ''
  ).trim()
  if (configured) return configured.replace(/\/$/, '')

  const region = (process.env['OSS_REGION'] ?? 'cn-hangzhou').trim()
  return `https://${bucket()}.oss-${region}.aliyuncs.com`
}

export function getOssConfigError(): string | null {
  if (isLocalStorageEnabled()) return null
  const region = (process.env['OSS_REGION'] ?? '').trim()
  const accessKeyId = (process.env['OSS_ACCESS_KEY_ID'] ?? '').trim()
  const secretAccessKey = (process.env['OSS_ACCESS_KEY_SECRET'] ?? '').trim()
  const bucket = (process.env['OSS_BUCKET'] ?? '').trim()
  if (!accessKeyId || !secretAccessKey) {
    return 'OSS 未配置：请在 .env.local 中设置 OSS_ACCESS_KEY_ID 和 OSS_ACCESS_KEY_SECRET'
  }
  if (!bucket) {
    return 'OSS 未配置：请在 .env.local 中设置 OSS_BUCKET'
  }
  if (!region) {
    return 'OSS 未配置：请在 .env.local 中设置 OSS_REGION（例如 cn-hangzhou）'
  }
  return null
}

function requireBucket(): string {
  const b = (process.env['OSS_BUCKET'] ?? '').trim()
  if (!b) {
    throw new Error('OSS_BUCKET is not set — uploads and downloads require OSS configuration.')
  }
  return b
}

function makeClient(): S3Client {
  const region = (process.env['OSS_REGION'] ?? 'cn-hangzhou').trim()
  const accessKeyId = (process.env['OSS_ACCESS_KEY_ID'] ?? '').trim()
  const secretAccessKey = (process.env['OSS_ACCESS_KEY_SECRET'] ?? '').trim()
  if (!accessKeyId || !secretAccessKey) {
    throw new Error('OSS_ACCESS_KEY_ID / OSS_ACCESS_KEY_SECRET are not set.')
  }
  return new S3Client({
    region,
    endpoint: `https://oss-${region}.aliyuncs.com`,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
    forcePathStyle: false,
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
  })
}

function bucket(): string {
  return requireBucket()
}

const SFS_DESIGN_KEY_PREFIX = 'sfs/orders/designs/'

function isSfsDesignStorageKey(key: string): boolean {
  return key.startsWith(SFS_DESIGN_KEY_PREFIX) && !key.includes('..')
}

/** SFS custom designs reuse the configured application OSS bucket. */
export function getSfsDesignOssConfigError(): string | null {
  return getOssConfigError()
}

export type UploadToR2Options = {
  metadata?: Record<string, string>
  contentDisposition?: string
  cacheControl?: string
}

export async function uploadToR2(
  key: string,
  body: Buffer,
  contentType: string,
  opts?: UploadToR2Options,
): Promise<void> {
  if (isLocalStorageEnabled()) {
    const dest = resolveLocalPath(key)
    await fs.mkdir(path.dirname(dest), { recursive: true })
    await fs.writeFile(dest, body)
    void contentType
    void opts
    return
  }

  await makeClient().send(
    new PutObjectCommand({
      Bucket: bucket(),
      Key: key,
      Body: body,
      ContentType: contentType,
      Metadata: opts?.metadata,
      ContentDisposition: opts?.contentDisposition,
      CacheControl: opts?.cacheControl ?? undefined,
    }),
  )
}

async function localObjectExists(key: string): Promise<boolean> {
  try {
    await access(resolveLocalPath(key))
    return true
  } catch {
    return false
  }
}

async function ossObjectExists(key: string): Promise<boolean> {
  if (!isOssConfigured()) return false
  try {
    await makeClient().send(new HeadObjectCommand({ Bucket: bucket(), Key: key }))
    return true
  } catch {
    return false
  }
}

/**
 * True when the object is readable from the active backend, or the other
 * backend during mixed local/OSS migration (same fallback as GET /api/files).
 */
export async function storageObjectExists(key: string): Promise<boolean> {
  if (isLocalStorageEnabled()) {
    if (await localObjectExists(key)) return true
    return ossObjectExists(key)
  }
  if (await ossObjectExists(key)) return true
  return localObjectExists(key)
}

export async function headObjectMeta(key: string): Promise<{ metadata: Record<string, string> } | null> {
  if (!(await storageObjectExists(key))) return null

  if (isLocalStorageEnabled() && (await localObjectExists(key))) {
    return { metadata: {} }
  }

  if (isOssConfigured()) {
    try {
      const out = await makeClient().send(new HeadObjectCommand({ Bucket: bucket(), Key: key }))
      return { metadata: out.Metadata ?? {} }
    } catch {
      // fall through to local empty meta when only local copy exists
    }
  }

  if (await localObjectExists(key)) return { metadata: {} }
  return null
}

export async function deleteFromR2(key: string): Promise<void> {
  if (isLocalStorageEnabled()) {
    await fs.unlink(resolveLocalPath(key)).catch(err => {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err
    })
    return
  }

  await makeClient().send(new DeleteObjectCommand({ Bucket: bucket(), Key: key }))
}

/** Store a new custom-design object in the configured application bucket. */
export async function uploadSfsDesignObject(
  key: string,
  body: Buffer,
  contentType: string,
  opts?: UploadToR2Options,
): Promise<void> {
  if (!isSfsDesignStorageKey(key)) throw new Error('Invalid SFS design storage key')
  const configError = getSfsDesignOssConfigError()
  if (configError) throw new Error(configError)

  await uploadToR2(key, body, contentType, opts)
}

/** Delete a custom-design object from the configured application bucket. */
export async function deleteSfsDesignFile(key: string): Promise<void> {
  await deleteFromR2(key)
}

export async function getSignedDownloadUrl(
  key: string,
  expiresIn = 900,
  opts?: { responseContentDisposition?: string },
): Promise<string> {
  if (isLocalStorageEnabled()) {
    const params = new URLSearchParams({ key })
    const disposition = opts?.responseContentDisposition ?? ''
    if (disposition.includes('attachment')) {
      params.set('download', '1')
      const fileName = fileNameFromContentDisposition(disposition)
      if (fileName) params.set('filename', fileName)
    }
    // Relative path keeps the browser on the same origin (session cookies).
    return `/api/files?${params.toString()}`
  }

  return signOssDownloadUrl(key, expiresIn, opts)
}

/**
 * Stable object URL for records that need to persist links.
 * In OSS mode this is the CDN/public bucket URL; in local mode it points at /api/files.
 */
export function getStoredObjectUrl(key: string): string {
  if (isLocalStorageEnabled()) {
    const params = new URLSearchParams({ key })
    return `/api/files?${params.toString()}`
  }
  return `${getOssBaseUrl()}/${encodeStorageKeyPath(key)}`
}

async function signOssDownloadUrl(
  key: string,
  expiresIn = 900,
  opts?: { responseContentDisposition?: string },
): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: bucket(),
    Key: key,
    ResponseContentDisposition: opts?.responseContentDisposition,
  })
  return getSignedUrl(makeClient(), command, { expiresIn })
}

/** Always returns an OSS presigned URL (ignores local-storage mode). */
export async function getOssPresignedDownloadUrl(
  key: string,
  expiresIn = 900,
  opts?: { responseContentDisposition?: string },
): Promise<string> {
  return signOssDownloadUrl(key, expiresIn, opts)
}

/**
 * Fetch the raw bytes of a stored file (server-side).
 */
export async function readFileBuffer(key: string): Promise<Buffer> {
  if (isLocalStorageEnabled()) {
    const { buffer } = await readLocalFile(key)
    return buffer
  }

  const out = await makeClient().send(
    new GetObjectCommand({ Bucket: bucket(), Key: key }),
  )
  if (!out.Body) {
    throw new Error(`OSS fetch failed for key "${key}": empty response body`)
  }
  return Buffer.from(await out.Body.transformToByteArray())
}

/** Read a file from local disk (local storage mode only). */
export async function readLocalFile(key: string): Promise<{ buffer: Buffer; filePath: string }> {
  const filePath = resolveLocalPath(key)
  const buffer = await fs.readFile(filePath)
  return { buffer, filePath }
}
