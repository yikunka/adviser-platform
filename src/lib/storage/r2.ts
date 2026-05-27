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

function uploadsRoot(): string {
  const fromEnv = (process.env['LOCAL_UPLOADS_DIR'] ?? '').trim()
  if (fromEnv) return path.resolve(fromEnv)
  return path.join(process.cwd(), 'uploads')
}

function resolveLocalPath(key: string): string {
  const filePath = path.join(uploadsRoot(), key)
  const resolved = path.resolve(filePath)
  if (!resolved.startsWith(path.resolve(uploadsRoot()))) {
    throw new Error('Invalid file path')
  }
  return resolved
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

function getAppBaseUrl(): string {
  const url = (
    process.env['NEXT_PUBLIC_APP_URL']
    ?? process.env['AUTH_URL']
    ?? process.env['NEXTAUTH_URL']
    ?? 'http://localhost:3000'
  ).trim()
  return url.replace(/\/$/, '')
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

export async function headObjectMeta(key: string): Promise<{ metadata: Record<string, string> } | null> {
  if (isLocalStorageEnabled()) {
    try {
      await access(resolveLocalPath(key))
      return { metadata: {} }
    } catch {
      return null
    }
  }

  try {
    const out = await makeClient().send(new HeadObjectCommand({ Bucket: bucket(), Key: key }))
    return { metadata: out.Metadata ?? {} }
  } catch {
    return null
  }
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
      const match = disposition.match(/filename="([^"]+)"/)
      if (match?.[1]) params.set('filename', match[1])
    }
    return `${getAppBaseUrl()}/api/files?${params.toString()}`
  }

  return signOssDownloadUrl(key, expiresIn, opts)
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
