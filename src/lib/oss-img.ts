/**
 * OSS Image Processing helper.
 *
 * Alibaba Cloud OSS lets you append `?x-oss-process=image/<ops>` to any
 * object URL to resize, convert format, and compress on the fly — no
 * extra infrastructure needed.
 *
 * In development (NEXT_PUBLIC_OSS_CDN_URL not set), returns the original
 * path unchanged so local dev works without OSS.
 *
 * Usage:
 *   <img src={ossImg('/cosmocoat/hero-banner.jpeg', { w: 1920, format: 'webp', quality: 80 })} />
 *   <img src={ossImg('/cosmocoat/logo.png')} />          // skip optimization for SVG/PNG logos
 */

type ResizeMode = 'lfit' | 'mfit' | 'fill' | 'pad' | 'fixed'
type ImageFormat = 'webp' | 'jpg' | 'png' | 'avif'

export type OssImgOpts = {
  /** Target width in px */
  w?: number
  /** Target height in px */
  h?: number
  /** Resize mode (default: lfit — fit within bounds, no crop) */
  mode?: ResizeMode
  /** Output format (default: webp) */
  format?: ImageFormat
  /** Quality 1–100 (default: 82) */
  quality?: number
  /** Skip all processing — return original URL */
  raw?: boolean
}

const SKIP_EXTENSIONS = new Set(['.svg', '.gif', '.ico'])

function getCdnBase(): string {
  const raw = typeof process !== 'undefined' ? (process.env['NEXT_PUBLIC_OSS_CDN_URL'] ?? '') : ''
  return raw.trim().replace(/\/$/, '')
}

export function ossImg(src: string, opts: OssImgOpts = {}): string {
  const cdn = getCdnBase()

  // No CDN configured → return src as-is (local dev / missing env var)
  if (!cdn) return src

  // Skip non-raster formats
  const lower = src.toLowerCase()
  const dot = lower.lastIndexOf('.')
  const ext = dot !== -1 ? lower.slice(dot) : ''
  if (SKIP_EXTENSIONS.has(ext) || opts.raw) return `${cdn}/${src.replace(/^\//, '')}`

  const ops: string[] = []

  // resize
  if (opts.w || opts.h) {
    const parts = ['resize']
    if (opts.w) parts.push(`w_${opts.w}`)
    if (opts.h) parts.push(`h_${opts.h}`)
    if (opts.mode) {
      parts.push(`m_${opts.mode}`)
    } else if (opts.w && opts.h) {
      parts.push('m_fill')  // crop to exact box when both dimensions given
    }
    ops.push(parts.join(','))
  }

  // format — always convert to webp unless caller overrides
  ops.push(`format,${opts.format ?? 'webp'}`)

  // quality
  ops.push(`quality,q_${opts.quality ?? 82}`)

  const key = src.replace(/^\//, '')
  return `${cdn}/${key}?x-oss-process=image/${ops.join('/')}`
}
