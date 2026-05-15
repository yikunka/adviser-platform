/**
 * Alibaba Cloud OSS storage adapter.
 *
 * OSS exposes an S3-compatible API, so we use the AWS SDK v3.
 * Endpoint: https://oss-<region>.aliyuncs.com
 * Bucket URL: https://<bucket>.oss-<region>.aliyuncs.com/<key>
 *
 * Required env vars (set in .env / .env.local):
 *   OSS_REGION          e.g. cn-hangzhou
 *   OSS_ACCESS_KEY_ID
 *   OSS_ACCESS_KEY_SECRET
 *   OSS_BUCKET
 *   OSS_CDN_URL         e.g. https://your-bucket.oss-cn-hangzhou.aliyuncs.com
 *                       or a custom CDN domain — used by next.config assetPrefix
 */

import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

function makeClient(): S3Client {
  const region = (process.env['OSS_REGION'] ?? 'cn-hangzhou').trim()
  return new S3Client({
    region,
    endpoint: `https://oss-${region}.aliyuncs.com`,
    credentials: {
      accessKeyId: process.env['OSS_ACCESS_KEY_ID'] ?? '',
      secretAccessKey: process.env['OSS_ACCESS_KEY_SECRET'] ?? '',
    },
    forcePathStyle: false,
  })
}

function bucket(): string {
  return process.env['OSS_BUCKET'] ?? ''
}

export async function uploadToR2(key: string, body: Buffer, contentType: string): Promise<void> {
  await makeClient().send(
    new PutObjectCommand({ Bucket: bucket(), Key: key, Body: body, ContentType: contentType })
  )
}

export async function getSignedDownloadUrl(key: string, expiresIn = 900): Promise<string> {
  const command = new GetObjectCommand({ Bucket: bucket(), Key: key })
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
