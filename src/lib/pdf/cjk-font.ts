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
      const faces = result.fonts?.length ? result.fonts : [result]
      const glyfFaces = faces.filter(face => faceTableNames(face).includes('glyf'))
      const pool = glyfFaces.length ? glyfFaces : faces
      return preferredCollectionFont(pool)
    },
  }
  return { fontkit, subset: true }
}

function faceTableNames(font: Font): string[] {
  const directory = (font as Font & { directory?: { tables?: Record<string, unknown> } }).directory
  return Object.keys(directory?.tables ?? {})
}

async function fontFileHasGlyfFace(fontPath: string): Promise<boolean> {
  const fk = (pdfLibFontkit as unknown as { default?: Fontkit } & Fontkit)
  const rawFontkit = (fk.default ?? fk) as Fontkit
  if (!rawFontkit || typeof rawFontkit.create !== 'function') return false
  try {
    const bytes = await fs.readFile(fontPath)
    const created = rawFontkit.create(bytes) as Font & { fonts?: Font[] }
    const faces = created.fonts?.length ? created.fonts : [created]
    return faces.some(face => faceTableNames(face).includes('glyf'))
  } catch {
    return false
  }
}

async function firstExistingFontPath(): Promise<string | null> {
  // pdf-lib drops CJK outlines when subsetting CFF fonts such as Noto CJK.
  // AR PL UMing is a Songti/Ming TrueType face, close to Times for Latin text.
  const candidates = [
    process.env.DDR_PDF_FONT_PATH,
    path.join(/* turbopackIgnore: true */ process.cwd(), 'assets/fonts/uming.ttc'),
    '/usr/share/fonts/truetype/arphic/uming.ttc',
    path.join(/* turbopackIgnore: true */ process.cwd(), 'assets/fonts/wqy-microhei.ttc'),
    '/usr/share/fonts/wqy-microhei/wqy-microhei.ttc',
    '/System/Library/Fonts/Supplemental/Arial Unicode.ttf',
  ].filter(Boolean) as string[]
  for (const candidate of candidates) {
    try {
      await fs.access(candidate)
    } catch {
      continue
    }
    if (await fontFileHasGlyfFace(candidate)) return candidate
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
