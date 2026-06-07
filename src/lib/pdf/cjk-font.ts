import fs from 'node:fs/promises'
import path from 'node:path'
import { PDFDocument, StandardFonts, type PDFFont } from 'pdf-lib'
import type { Font, Fontkit } from 'pdf-lib/es/types/fontkit'
import * as pdfLibFontkit from '@pdf-lib/fontkit'

export type PdfFonts = {
  bold: PDFFont
  regular: PDFFont
  supportsUnicode: boolean
}

type FontkitFontWithNames = Font & {
  familyName?: string
  fullName?: string
  postscriptName?: string
}

function fontFaceName(font: FontkitFontWithNames) {
  return [font.postscriptName, font.fullName, font.familyName].filter(Boolean).join(' ')
}

function preferredCollectionFont(fonts: Font[]): Font {
  const namedFonts = fonts as FontkitFontWithNames[]
  const preferredPatterns = [
    /cjkhk/i,
    /\bhk\b/i,
    /cjk[-_\s]?tc/i,
    /\btc\b/i,
    /traditional/i,
    /cjk[-_\s]?sc/i,
    /\bsc\b/i,
    /simplified/i,
  ]
  for (const pattern of preferredPatterns) {
    const font = namedFonts.find(item => pattern.test(fontFaceName(item)))
    if (font) return font
  }
  return namedFonts[0]
}

function loadFontkitBridge(): { fontkit: Fontkit; subset: boolean } | null {
  const fk = (pdfLibFontkit as unknown as { default?: Fontkit } & Fontkit)
  const rawFontkit = (fk.default ?? fk) as Fontkit
  if (!rawFontkit || typeof rawFontkit.create !== 'function') return null
  const fontkit: Fontkit = {
    create(data: Uint8Array) {
      const result = rawFontkit.create(data) as Font & { fonts?: Font[] }
      return (result.fonts?.length ? preferredCollectionFont(result.fonts) : result) as Font
    },
  }
  return { fontkit, subset: true }
}

async function firstExistingFontPath(): Promise<string | null> {
  const candidates = [
    process.env.DDR_PDF_FONT_PATH,
    path.join(process.cwd(), 'assets/fonts/NotoSansCJK-Regular.otf'),
    path.join(process.cwd(), 'assets/fonts/NotoSansCJKsc-Regular.otf'),
    '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc',
    '/usr/share/fonts/opentype/noto/NotoSansCJKsc-Regular.otf',
    '/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc',
    '/usr/share/fonts/google-noto-cjk/NotoSansCJK-Regular.ttc',
    '/System/Library/Fonts/Supplemental/Arial Unicode.ttf',
    '/System/Library/Fonts/Hiragino Sans GB.ttc',
    '/System/Library/Fonts/STHeiti Medium.ttc',
  ].filter(Boolean) as string[]
  for (const p of candidates) {
    try {
      await fs.access(p)
      return p
    } catch {
      /* try next */
    }
  }
  return null
}

export async function loadPdfFonts(doc: PDFDocument): Promise<PdfFonts> {
  const fontPath = await firstExistingFontPath()
  const bridge = fontPath ? loadFontkitBridge() : null
  if (fontPath && bridge) {
    doc.registerFontkit(bridge.fontkit)
    const bytes = await fs.readFile(fontPath)
    const regular = await doc.embedFont(bytes, { subset: bridge.subset })
    return { regular, bold: regular, supportsUnicode: true }
  }
  return {
    bold: await doc.embedFont(StandardFonts.HelveticaBold),
    regular: await doc.embedFont(StandardFonts.Helvetica),
    supportsUnicode: false,
  }
}
