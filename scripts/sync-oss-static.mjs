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
 *
 * Required env vars:
 *   OSS_REGION, OSS_ACCESS_KEY_ID, OSS_ACCESS_KEY_SECRET, OSS_BUCKET
 *
 * Usage:
 *   node scripts/sync-oss-static.mjs
 *   OSS_BUCKET=my-bucket node scripts/sync-oss-static.mjs
 */

import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3'
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
})

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

async function ossKeyExists(key) {
  try {
    await client.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }))
    return true
  } catch {
    return false
  }
}

async function upload(localPath, ossKey, cacheControl, { skipIfExists = false } = {}) {
  if (skipIfExists && await ossKeyExists(ossKey)) {
    return 'skipped'
  }
  const body = readFileSync(localPath)
  await client.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: ossKey,
    Body: body,
    ContentType: mime(localPath),
    CacheControl: cacheControl,
  }))
  return 'uploaded'
}

// ── Upload jobs ───────────────────────────────────────────────────────────────
async function syncNextStatic() {
  const dir = join(ROOT, '.next', 'static')
  let ok = 0, skipped = 0, failed = 0

  const files = walkDir(dir)
  console.log(`\n📦  .next/static/  →  _next/static/   (${files.length} files, 1-year cache)`)

  await Promise.all(files.map(async (f) => {
    const rel = relative(dir, f)
    const ossKey = `_next/static/${rel}`
    try {
      // Hashed filenames — skip if already on OSS to avoid redundant uploads
      const result = await upload(f, ossKey, 'public, max-age=31536000, immutable', { skipIfExists: true })
      result === 'skipped' ? skipped++ : ok++
    } catch (e) {
      console.error(`  ✗ ${ossKey}:`, e.message)
      failed++
    }
  }))

  console.log(`  ✓ uploaded ${ok}  skipped ${skipped}  failed ${failed}`)
  return failed
}

async function syncPublic() {
  const dir = join(ROOT, 'public')
  let ok = 0, failed = 0

  const files = walkDir(dir)
  console.log(`\n🖼   public/  →  (root)   (${files.length} files, 7-day cache)`)

  await Promise.all(files.map(async (f) => {
    const rel = relative(dir, f)
    const ossKey = rel.replace(/\\/g, '/')
    try {
      await upload(f, ossKey, 'public, max-age=604800')
      ok++
    } catch (e) {
      console.error(`  ✗ ${ossKey}:`, e.message)
      failed++
    }
  }))

  console.log(`  ✓ uploaded ${ok}  failed ${failed}`)
  return failed
}

// ── Main ──────────────────────────────────────────────────────────────────────
console.log(`🚀  Syncing static assets to OSS`)
console.log(`    Bucket : ${BUCKET}`)
console.log(`    Region : ${REGION}`)
console.log(`    CDN    : ${process.env.OSS_CDN_URL ?? `https://${BUCKET}.oss-${REGION}.aliyuncs.com`}`)

const t0 = Date.now()
const [f1, f2] = await Promise.all([syncNextStatic(), syncPublic()])
const total = f1 + f2
const elapsed = ((Date.now() - t0) / 1000).toFixed(1)

console.log(`\n${total === 0 ? '✅' : '⚠️ '}  Done in ${elapsed}s${total > 0 ? ` — ${total} file(s) failed` : ''}`)
if (total > 0) process.exit(1)
