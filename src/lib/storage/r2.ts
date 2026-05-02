/**
 * Local-filesystem storage shim.
 * Keeps the same public interface as the R2 implementation so no call-sites
 * need to change.  When you're ready to migrate to Cloudflare R2, replace
 * this file with the original S3-client version.
 *
 * Files are written to  <project-root>/uploads/<key>
 * Downloads are served via  GET /api/files?key=<key>
 */

import fs from 'fs/promises'
import path from 'path'

const UPLOADS_DIR = path.join(process.cwd(), 'uploads')

export async function uploadToR2(key: string, body: Buffer, contentType: string): Promise<void> {
  const dest = path.join(UPLOADS_DIR, key)
  await fs.mkdir(path.dirname(dest), { recursive: true })
  await fs.writeFile(dest, body)
  void contentType // retained for interface compatibility
}

export async function getSignedDownloadUrl(key: string, _expiresIn = 900): Promise<string> {
  // Return a local serve URL; the /api/files route reads from disk.
  return `/api/files?key=${encodeURIComponent(key)}`
}

/** Internal helper used by the /api/files route. */
export async function readLocalFile(key: string): Promise<{ buffer: Buffer; filePath: string }> {
  const filePath = path.join(UPLOADS_DIR, key)
  // Prevent path-traversal attacks
  const resolved = path.resolve(filePath)
  if (!resolved.startsWith(path.resolve(UPLOADS_DIR))) {
    throw new Error('Invalid file path')
  }
  const buffer = await fs.readFile(resolved)
  return { buffer, filePath: resolved }
}
