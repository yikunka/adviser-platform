#!/usr/bin/env node
/**
 * Upload a pg_dump gzip file to OSS and prune old backups.
 *
 * Required env: OSS_REGION, OSS_ACCESS_KEY_ID, OSS_ACCESS_KEY_SECRET, OSS_BUCKET
 * Optional env:
 *   BACKUP_OSS_PREFIX   default: backups/db
 *   BACKUP_RETAIN_COUNT default: 10
 *
 * Usage:
 *   node scripts/backup-db-to-oss.mjs /path/to/adviser_20260524_030000.sql.gz
 *   node scripts/backup-db-to-oss.mjs --dry-run /path/to/dump.sql.gz
 */

import { createReadStream, readFileSync, statSync } from 'node:fs'
import { basename, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  S3Client,
  PutObjectCommand,
  ListObjectsV2Command,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3'

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
  } catch {
    /* absent */
  }
}

const ROOT = fileURLToPath(new URL('..', import.meta.url))
loadEnvFile(join(ROOT, '.env.local'))
loadEnvFile(join(ROOT, '.env'))

const REGION = (process.env.OSS_REGION ?? '').trim()
const ACCESS_KEY_ID = (process.env.OSS_ACCESS_KEY_ID ?? '').trim()
const ACCESS_KEY_SECRET = (process.env.OSS_ACCESS_KEY_SECRET ?? '').trim()
const BUCKET = (process.env.OSS_BUCKET ?? '').trim()
const PREFIX = (process.env.BACKUP_OSS_PREFIX ?? 'backups/db').replace(/^\/+|\/+$/g, '')
const RETAIN = Math.max(1, Number.parseInt(process.env.BACKUP_RETAIN_COUNT ?? '10', 10) || 10)

const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const filePath = args.find(a => !a.startsWith('--'))

if (!filePath) {
  console.error('Usage: node scripts/backup-db-to-oss.mjs [--dry-run] <dump.sql.gz>')
  process.exit(1)
}

if (!REGION || !ACCESS_KEY_ID || !ACCESS_KEY_SECRET || !BUCKET) {
  console.error('Missing OSS env vars: OSS_REGION, OSS_ACCESS_KEY_ID, OSS_ACCESS_KEY_SECRET, OSS_BUCKET')
  process.exit(1)
}

const client = new S3Client({
  region: REGION,
  endpoint: `https://oss-${REGION}.aliyuncs.com`,
  credentials: { accessKeyId: ACCESS_KEY_ID, secretAccessKey: ACCESS_KEY_SECRET },
  forcePathStyle: false,
  requestChecksumCalculation: 'WHEN_REQUIRED',
  responseChecksumValidation: 'WHEN_REQUIRED',
})

function ossKey(name) {
  return `${PREFIX}/${name}`
}

async function listBackupObjects() {
  const prefix = `${PREFIX}/`
  const objects = []
  let token
  do {
    const out = await client.send(new ListObjectsV2Command({
      Bucket: BUCKET,
      Prefix: prefix,
      ContinuationToken: token,
    }))
    for (const item of out.Contents ?? []) {
      if (item.Key && item.Key.endsWith('.sql.gz')) {
        objects.push({
          key: item.Key,
          lastModified: item.LastModified ?? new Date(0),
          size: item.Size ?? 0,
        })
      }
    }
    token = out.IsTruncated ? out.NextContinuationToken : undefined
  } while (token)
  return objects.sort((a, b) => b.lastModified - a.lastModified)
}

async function uploadDump(localPath) {
  const name = basename(localPath)
  const key = ossKey(name)
  const size = statSync(localPath).size
  const sizeMb = (size / 1024 / 1024).toFixed(2)

  if (dryRun) {
    console.log(`[dry-run] would upload ${localPath} (${sizeMb} MB) -> oss://${BUCKET}/${key}`)
    return key
  }

  await client.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: createReadStream(localPath),
    ContentType: 'application/gzip',
    ContentEncoding: 'gzip',
    Metadata: {
      source: 'adviser-platform',
      'backup-type': 'postgresql-pgdump',
    },
  }))
  console.log(`Uploaded ${name} (${sizeMb} MB) -> oss://${BUCKET}/${key}`)
  return key
}

async function pruneOldBackups() {
  const objects = await listBackupObjects()
  const toDelete = objects.slice(RETAIN)
  if (toDelete.length === 0) {
    console.log(`Retention OK: ${objects.length}/${RETAIN} backup(s) on OSS`)
    return
  }

  for (const obj of toDelete) {
    if (dryRun) {
      console.log(`[dry-run] would delete oss://${BUCKET}/${obj.key}`)
      continue
    }
    await client.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: obj.key }))
    console.log(`Deleted old backup: ${obj.key}`)
  }
  console.log(`Retention applied: kept ${RETAIN}, removed ${toDelete.length}`)
}

const uploadedKey = await uploadDump(filePath)
await pruneOldBackups()
console.log(`Backup complete${dryRun ? ' (dry-run)' : ''}: ${uploadedKey}`)
