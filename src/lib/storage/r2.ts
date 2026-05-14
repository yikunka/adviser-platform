/**
 * Local-filesystem storage shim.
 * Keeps the same public interface as the R2 implementation so no call-sites
 * need to change.  When you're ready to migrate to Cloudflare R2, replace
 * this file with the original S3-client version.
 *
 * Files are written to  LOCAL_UPLOADS_DIR/<key>  (default: <cwd>/uploads)
 * Downloads are served via  GET /api/files?key=<key>
 *
 * Production: set LOCAL_UPLOADS_DIR to a path *outside* the deploy directory.
 * deploy.sh uses rsync --delete into $APP_DIR, which removes /opt/adviser-app/uploads.
 */

import fs from 'fs/promises'
import path from 'path'

/** Resolve on every call so production picks up `.env` from the shell (avoid stale module-init paths). Use bracket access so the bundler does not inline a build-time value. */
function getUploadsRoot(): string {
  let raw = process.env['LOCAL_UPLOADS_DIR']?.trim()
  if (raw?.startsWith('"') && raw.endsWith('"')) raw = raw.slice(1, -1).trim()
  if (raw?.startsWith("'") && raw.endsWith("'")) raw = raw.slice(1, -1).trim()
  if (raw) return path.resolve(raw)
  return path.join(process.cwd(), 'uploads')
}

export async function uploadToR2(key: string, body: Buffer, contentType: string): Promise<void> {
  const root = getUploadsRoot()
  const dest = path.join(root, key)
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
  const root = path.resolve(getUploadsRoot())
  const filePath = path.join(root, key)
  // Prevent path-traversal attacks
  const resolved = path.resolve(filePath)
  if (!resolved.startsWith(root)) {
    throw new Error('Invalid file path')
  }
  const buffer = await fs.readFile(resolved)
  return { buffer, filePath: resolved }
}
