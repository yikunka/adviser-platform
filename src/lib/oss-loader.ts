/**
 * Next.js custom image loader — Alibaba Cloud OSS Image Processing.
 *
 * Configured via next.config.ts → images.loaderFile.
 * All <Image> components in the app automatically route through this loader
 * when NEXT_PUBLIC_OSS_CDN_URL is set.
 *
 * OSS IMG reference:
 *   https://help.aliyun.com/document_detail/44688.html
 */

type LoaderParams = {
  src: string
  width: number
  quality?: number
}

const SKIP_EXTENSIONS = new Set(['.svg', '.gif', '.ico'])

export default function ossLoader({ src, width, quality }: LoaderParams): string {
  const cdn = (process.env['NEXT_PUBLIC_OSS_CDN_URL'] ?? '').trim().replace(/\/$/, '')

  if (!cdn) {
    // Dev / CDN not configured — Next.js built-in behaviour
    return src
  }

  const lower = src.toLowerCase()
  const dot = lower.lastIndexOf('.')
  const ext = dot !== -1 ? lower.slice(dot) : ''

  const key = src.replace(/^\//, '')
  const base = `${cdn}/${key}`

  if (SKIP_EXTENSIONS.has(ext)) return base

  const q = quality ?? 82
  return `${base}?x-oss-process=image/resize,w_${width}/format,webp/quality,q_${q}`
}
