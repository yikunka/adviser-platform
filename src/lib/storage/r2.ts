/**
 * Alibaba Cloud OSS storage adapter.
 *
 * OSS exposes an S3-compatible API, so we use the AWS SDK v3.
 * Endpoint: https://oss-<region>.aliyuncs.com
 * Bucket URL: https://<bucket>.oss-<region>.aliyuncs.com/<key>
 *
 * Aliyun OSS does not fully implement newer S3 checksum headers. We set
 * `requestChecksumCalculation` / `responseChecksumValidation` to WHEN_REQUIRED
 * so PutObject/GetObject behave like classic SigV4 without extra checksum fields.
 *
 * Required env vars (set in .env / .env.local):
 *   OSS_REGION          e.g. cn-hangzhou
 *   OSS_ACCESS_KEY_ID
 *   OSS_ACCESS_KEY_SECRET
 *   OSS_BUCKET
 *   OSS_CDN_URL         e.g. https://your-bucket.oss-cn-hangzhou.aliyuncs.com
 *                       or a custom CDN domain — used by next.config assetPrefix
 */

import { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

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
  try {
    const out = await makeClient().send(new HeadObjectCommand({ Bucket: bucket(), Key: key }))
    return { metadata: out.Metadata ?? {} }
  } catch {
    return null
  }
}

export async function getSignedDownloadUrl(
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
 * Fetch the raw bytes of a stored file.
 * Used server-side when we need the buffer directly (e.g. PDF report generation).
 */
export async function readFileBuffer(key: string): Promise<Buffer> {
  const url = await getSignedDownloadUrl(key, 300)
  const resp = await fetch(url)
  if (!resp.ok) throw new Error(`OSS fetch failed for key "${key}": ${resp.status} ${resp.statusText}`)
  return Buffer.from(await resp.arrayBuffer())
}

/**
 * Backward-compat shim — callers that previously used readLocalFile still work.
 * filePath is the OSS key (not a real filesystem path in production).
 */
export async function readLocalFile(key: string): Promise<{ buffer: Buffer; filePath: string }> {
  const buffer = await readFileBuffer(key)
  return { buffer, filePath: key }
}
