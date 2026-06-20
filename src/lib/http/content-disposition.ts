export type ContentDispositionType = 'inline' | 'attachment'

function stripHeaderUnsafe(value: string) {
  return value.replace(/["\r\n]/g, '').trim()
}

function extensionOf(fileName: string) {
  const clean = stripHeaderUnsafe(fileName)
  const dot = clean.lastIndexOf('.')
  if (dot <= 0 || dot === clean.length - 1) return ''
  const ext = clean.slice(dot).replace(/[^A-Za-z0-9.]/g, '')
  return ext && ext !== '.' ? ext : ''
}

export function sanitizeDownloadFileName(fileName: string | null | undefined) {
  return stripHeaderUnsafe(fileName ?? '')
}

export function contentDispositionHeader(disposition: ContentDispositionType, fileName: string | null | undefined) {
  const sanitized = sanitizeDownloadFileName(fileName)
  if (!sanitized) return disposition

  const fallback = `download${extensionOf(sanitized)}`
  return `${disposition}; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(sanitized)}`
}

export function fileNameFromContentDisposition(value: string | null | undefined) {
  if (!value) return null
  const utf8Match = value.match(/filename\*=UTF-8''([^;]+)/i)
  if (utf8Match?.[1]) {
    try {
      return sanitizeDownloadFileName(decodeURIComponent(utf8Match[1]))
    } catch {
      return sanitizeDownloadFileName(utf8Match[1])
    }
  }
  const asciiMatch = value.match(/filename="([^"]+)"/i)
  return asciiMatch?.[1] ? sanitizeDownloadFileName(asciiMatch[1]) : null
}
