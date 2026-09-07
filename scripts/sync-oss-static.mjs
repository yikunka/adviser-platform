#!/usr/bin/env node
/**
 * sync-oss-static.mjs
 *
 * Uploads static assets to Alibaba Cloud OSS after `next build`.
 * Run this before starting the production server so the CDN has the files.
 *
 * Uploads:
 *   .next/static/  →  _next/static/   (hashed chunks; 1-year cache)
 *   public/        →  (root)          (images, fonts, icons; 7-day cache)
 *                    Fast path: HEAD Content-Length vs local size — mismatch → PUT without MD5.
 *                    Same size: read once; single-part ETag = MD5 → skip (multipart ETag → PUT).
 *
 * Optional:
 *   OSS_SYNC_CONCURRENCY  Max parallel uploads per folder (default 24).
 *
 * Required env vars:
 *   OSS_REGION, OSS_ACCESS_KEY_ID, OSS_ACCESS_KEY_SECRET, OSS_BUCKET
 *
 * Usage:
 *   node scripts/sync-oss-static.mjs
 *   OSS_BUCKET=my-bucket node scripts/sync-oss-static.mjs
 */

import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3'
import { createHash } from 'crypto'
import { readFileSync, readdirSync, statSync } from 'fs'
import { join, extname, relative } from 'path'
import { fileURLToPath } from 'url'

// ── Load .env / .env.local ────────────────────────────────────────────────────
function loadEnvFile(p) {
  try {
    const lines = readFileSync(p, 'utf8').split('\n')
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eq = trimmed.indexOf('=')
      if (eq === -1) continue
      const k = trimmed.slice(0, eq).trim()
      let v = trimmed.slice(eq + 1).trim()
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1)
      }
      if (!process.env[k]) process.env[k] = v
    }
  } catch { /* file absent — skip */ }
}

const ROOT = fileURLToPath(new URL('..', import.meta.url))
loadEnvFile(join(ROOT, '.env.local'))
loadEnvFile(join(ROOT, '.env'))

// ── Config ────────────────────────────────────────────────────────────────────
const REGION = (process.env.OSS_REGION ?? '').trim()
const ACCESS_KEY_ID = (process.env.OSS_ACCESS_KEY_ID ?? '').trim()
const ACCESS_KEY_SECRET = (process.env.OSS_ACCESS_KEY_SECRET ?? '').trim()
const BUCKET = (process.env.OSS_BUCKET ?? '').trim()

if (!REGION || !ACCESS_KEY_ID || !ACCESS_KEY_SECRET || !BUCKET) {
  console.error('❌  Missing required env vars: OSS_REGION, OSS_ACCESS_KEY_ID, OSS_ACCESS_KEY_SECRET, OSS_BUCKET')
  process.exit(1)
}

const client = new S3Client({
  region: REGION,
  endpoint: `https://oss-${REGION}.aliyuncs.com`,
  credentials: { accessKeyId: ACCESS_KEY_ID, secretAccessKey: ACCESS_KEY_SECRET },
  forcePathStyle: false,
  // Aliyun OSS: disable optional S3 flexible checksum headers (SDK default breaks PutObject)
  requestChecksumCalculation: 'WHEN_REQUIRED',
  responseChecksumValidation: 'WHEN_REQUIRED',
})

/** Parallel PUT/HEAD cap per folder — unlimited Promise.all often slows OSS on large trees. */
const SYNC_CONCURRENCY = Math.max(1, Number.parseInt(process.env.OSS_SYNC_CONCURRENCY ?? '24', 10) || 24)

// ── MIME types ────────────────────────────────────────────────────────────────
const MIME = {
  '.js':    'application/javascript; charset=utf-8',
  '.css':   'text/css; charset=utf-8',
  '.html':  'text/html; charset=utf-8',
  '.json':  'application/json; charset=utf-8',
  '.txt':   'text/plain; charset=utf-8',
  '.svg':   'image/svg+xml',
  '.png':   'image/png',
  '.jpg':   'image/jpeg',
  '.jpeg':  'image/jpeg',
  '.gif':   'image/gif',
  '.webp':  'image/webp',
  '.avif':  'image/avif',
  '.ico':   'image/x-icon',
  '.woff':  'font/woff',
  '.woff2': 'font/woff2',
  '.ttf':   'font/ttf',
  '.otf':   'font/otf',
  '.mp4':   'video/mp4',
  '.webm':  'video/webm',
  '.pdf':   'application/pdf',
}

function mime(file) {
  return MIME[extname(file).toLowerCase()] ?? 'application/octet-stream'
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function walkDir(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      walkDir(full, files)
    } else {
      files.push(full)
    }
  }
  return files
}

async function mapLimit(items, limit, fn) {
  const results = new Array(items.length)
  if (items.length === 0) return results
  const cap = Math.min(Math.max(1, limit), items.length)
  let next = 0
  async function worker() {
    for (;;) {
      const i = next++
      if (i >= items.length) break
      results[i] = await fn(items[i], i)
    }
  }
  await Promise.all(Array.from({ length: cap }, () => worker()))
  return results
}

async function ossKeyExists(key) {
  try {
    await client.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }))
    return true
  } catch {
    return false
  }
}

function md5Hex(buffer) {
  return createHash('md5').update(buffer).digest('hex')
}

/**
 * Single-part PutObject on S3-compatible OSS uses ETag = MD5 (quoted hex).
 * Multipart/composite ETags contain "-" — we cannot equate them to file MD5, so no skip.
 */
function etagMatchesBody(etag, body) {
  if (!etag) return false
  const t = etag.replace(/^"|"$/g, '')
  if (t.includes('-')) return false
  if (!/^[0-9a-f]{32}$/i.test(t)) return false
  return t.toLowerCase() === md5Hex(body).toLowerCase()
}

async function putObject(localPath, body, ossKey, cacheControl) {
  await client.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: ossKey,
    Body: body,
    ContentType: mime(localPath),
    CacheControl: cacheControl,
  }))
}

/** Hashed chunks: HEAD-only skip — no disk read when already on OSS. */
async function uploadNextStatic(localPath, ossKey, cacheControl) {
  if (await ossKeyExists(ossKey)) return 'skipped'
  const body = readFileSync(localPath)
  await putObject(localPath, body, ossKey, cacheControl)
  return 'uploaded'
}

/**
 * Stable paths: HEAD first; size mismatch → upload without MD5;
 * same size → read once, compare single-part ETag to MD5 or PUT.
 */
async function uploadPublic(localPath, ossKey, cacheControl) {
  const localSize = statSync(localPath).size

  let head = null
  try {
    head = await client.send(new HeadObjectCommand({ Bucket: BUCKET, Key: ossKey }))
  } catch {
    head = null
  }

  if (!head) {
    const body = readFileSync(localPath)
    await putObject(localPath, body, ossKey, cacheControl)
    return 'uploaded'
  }

  const remoteSize = head.ContentLength
  if (remoteSize !== undefined && remoteSize !== localSize) {
    const body = readFileSync(localPath)
    await putObject(localPath, body, ossKey, cacheControl)
    return 'uploaded'
  }

  const body = readFileSync(localPath)
  if (etagMatchesBody(head.ETag ?? '', body)) return 'skipped'

  await putObject(localPath, body, ossKey, cacheControl)
  return 'uploaded'
}

// ── Upload jobs ───────────────────────────────────────────────────────────────
async function syncNextStatic() {
  const dir = join(ROOT, '.next', 'static')

  const files = walkDir(dir)
  console.log(`\n📦  .next/static/  →  _next/static/   (${files.length} files, 1-year cache)`)

  const results = await mapLimit(files, SYNC_CONCURRENCY, async (f) => {
    const rel = relative(dir, f)
    const ossKey = `_next/static/${rel}`
    try {
      return await uploadNextStatic(f, ossKey, 'public, max-age=31536000, immutable')
    } catch (e) {
      console.error(`  ✗ ${ossKey}:`, e.message)
      return 'failed'
    }
  })

  let ok = 0, skipped = 0, failed = 0
  for (const r of results) {
    if (r === 'skipped') skipped++
    else if (r === 'failed') failed++
    else ok++
  }

  console.log(`  ✓ uploaded ${ok}  skipped ${skipped}  failed ${failed}`)
  return failed
}

async function syncPublic() {
  const dir = join(ROOT, 'public')

  const files = walkDir(dir)
  console.log(`\n🖼   public/  →  (root)   (${files.length} files, 7-day cache)`)

  const results = await mapLimit(files, SYNC_CONCURRENCY, async (f) => {
    const rel = relative(dir, f)
    const ossKey = rel.replace(/\\/g, '/')
    try {
      return await uploadPublic(f, ossKey, 'public, max-age=604800')
    } catch (e) {
      console.error(`  ✗ ${ossKey}:`, e.message)
      return 'failed'
    }
  })

  let ok = 0, skipped = 0, failed = 0
  for (const r of results) {
    if (r === 'skipped') skipped++
    else if (r === 'failed') failed++
    else ok++
  }

  console.log(`  ✓ uploaded ${ok}  skipped ${skipped}  failed ${failed}`)
  return failed
}

// ── Main ──────────────────────────────────────────────────────────────────────
console.log(`🚀  Syncing static assets to OSS`)
console.log(`    Bucket : ${BUCKET}`)
console.log(`    Region : ${REGION}`)
console.log(`    CDN    : ${process.env.OSS_CDN_URL ?? `https://${BUCKET}.oss-${REGION}.aliyuncs.com`}`)
console.log(`    Concurrency / folder : ${SYNC_CONCURRENCY}`)

const t0 = Date.now()
let exitCode = 0
try {
  const [f1, f2] = await Promise.all([syncNextStatic(), syncPublic()])
  const total = f1 + f2
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1)

  console.log(`\n${total === 0 ? '✅' : '⚠️ '}  Done in ${elapsed}s${total > 0 ? ` — ${total} file(s) failed` : ''}`)
  exitCode = total > 0 ? 1 : 0
} catch (err) {
  console.error('❌  OSS sync failed:', err instanceof Error ? err.message : err)
  exitCode = 1
} finally {
  // Avoid SIGABRT (exit 134) on process teardown from AWS SDK HTTP keep-alive /
  // OpenSSL cleanup on some Linux Node builds (seen after a successful sync).
  try {
    client.destroy()
  } catch {
    /* ignore */
  }
  process.exit(exitCode)
}
