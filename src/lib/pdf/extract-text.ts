import { inflateRawSync, inflateSync } from 'zlib'

const MAX_TEXT_CHARS = 20000
let pdfjsReady: Promise<typeof import('pdfjs-dist/legacy/build/pdf.mjs') | null> | null = null
let pdfjsUnavailable = false

async function loadPdfjs() {
  if (pdfjsUnavailable) return null
  if (!pdfjsReady) {
    pdfjsReady = (async () => {
      try {
        // Static package paths — Turbopack cannot resolve dynamic file:// imports.
        const workerMod = await import('pdfjs-dist/legacy/build/pdf.worker.mjs')
        ;(globalThis as typeof globalThis & { pdfjsWorker?: unknown }).pdfjsWorker = workerMod

        const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
        pdfjs.GlobalWorkerOptions.workerSrc = 'pdfjs-dist/legacy/build/pdf.worker.mjs'
        return pdfjs
      } catch (error) {
        pdfjsUnavailable = true
        console.warn(
          '[pdf/extract-text] pdfjs unavailable; using legacy PDF text extraction.',
          error instanceof Error ? error.message : error,
        )
        return null
      }
    })()
  }
  return pdfjsReady
}

export async function extractPdfText(buffer: Buffer, maxChars = MAX_TEXT_CHARS): Promise<string> {
  const fromPdfjs = await extractPdfTextWithPdfjs(buffer, maxChars)
  if (fromPdfjs.trim().length > 80) return fromPdfjs

  return extractPdfTextLegacy(buffer, maxChars)
}

async function extractPdfTextWithPdfjs(buffer: Buffer, maxChars: number): Promise<string> {
  const pdfjs = await loadPdfjs()
  if (!pdfjs) return ''

  try {
    const doc = await pdfjs.getDocument({ data: new Uint8Array(buffer), useSystemFonts: true }).promise
    const parts: string[] = []

    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i)
      const textContent = await page.getTextContent()
      const pageText = textContent.items
        .map(item => ('str' in item && typeof item.str === 'string' ? item.str : ''))
        .join(' ')
      if (pageText.trim()) {
        parts.push(`--- Page ${i} ---`)
        parts.push(pageText)
      }
    }

    return normalizePdfText(parts.join('\n'), maxChars)
  } catch (error) {
    console.warn('[pdf/extract-text] pdfjs extraction failed:', error)
    return ''
  }
}

function extractPdfTextLegacy(buffer: Buffer, maxChars: number): string {
  const source = buffer.toString('latin1')
  const chunks: string[] = []

  for (const match of source.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)) {
    const raw = Buffer.from(match[1], 'latin1')
    const variants = [raw]
    try { variants.push(inflateSync(raw)) } catch {}
    try { variants.push(inflateRawSync(raw)) } catch {}
    for (const variant of variants) {
      const text = decodePdfStrings(variant.toString('latin1'))
      if (text) chunks.push(text)
    }
  }

  const direct = decodePdfStrings(source)
  if (direct) chunks.push(direct)

  return normalizePdfText(chunks.join('\n'), maxChars)
}

function normalizePdfText(text: string, maxChars: number): string {
  return text
    .replace(/([\u4e00-\u9fff])\s+(?=[\u4e00-\u9fff])/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxChars)
}

function decodePdfStrings(input: string) {
  const values: string[] = []
  for (const match of input.matchAll(/\(((?:\\.|[^\\)])*)\)\s*Tj/g)) {
    values.push(unescapePdfString(match[1]))
  }
  for (const arrayMatch of input.matchAll(/\[((?:\s*\((?:\\.|[^\\)])*\)\s*-?\d*)+)\]\s*TJ/g)) {
    for (const stringMatch of arrayMatch[1].matchAll(/\((?:\\.|[^\\)])*\)/g)) {
      values.push(unescapePdfString(stringMatch[0].slice(1, -1)))
    }
  }
  return values.join(' ')
}

function unescapePdfString(value: string) {
  return value
    .replace(/\\([nrtbf()\\])/g, (_all, ch: string) => {
      const map: Record<string, string> = {
        n: '\n', r: '\r', t: '\t', b: '\b', f: '\f', '(': '(', ')': ')', '\\': '\\',
      }
      return map[ch] ?? ch
    })
    .replace(/\\([0-7]{1,3})/g, (_all, octal: string) => String.fromCharCode(parseInt(octal, 8)))
}
