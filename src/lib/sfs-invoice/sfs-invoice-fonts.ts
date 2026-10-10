import fs from 'node:fs/promises'
import path from 'node:path'
import { PDFDocument, StandardFonts, type PDFFont } from 'pdf-lib'
import type { Fontkit } from 'pdf-lib/es/types/fontkit'
import * as pdfLibFontkit from '@pdf-lib/fontkit'
import { loadPdfFonts } from '@/lib/pdf/cjk-font'

export type SfsInvoiceFonts = {
  /** Playfair Display — INVOICE title */
  display: PDFFont
  /** Cormorant Garamond Light — section labels */
  section: PDFFont
  /** Cormorant Garamond Regular — body / descriptions */
  body: PDFFont
  /** Cormorant Garamond Medium — amounts */
  amount: PDFFont
  /** CJK Song-style face for Chinese issuer name (思源宋体气质；部署用 UMing) */
  cjk: PDFFont
  supportsUnicode: boolean
}

function registerFontkit(doc: PDFDocument): boolean {
  const fk = (pdfLibFontkit as unknown as { default?: Fontkit } & Fontkit)
  const raw = (fk.default ?? fk) as Fontkit
  if (!raw || typeof raw.create !== 'function') return false
  doc.registerFontkit(raw)
  return true
}

async function embedLocal(
  doc: PDFDocument,
  relativePath: string,
): Promise<PDFFont | null> {
  const full = path.join(/* turbopackIgnore: true */ process.cwd(), relativePath)
  try {
    await fs.access(full)
  } catch {
    return null
  }
  const bytes = await fs.readFile(full)
  return doc.embedFont(bytes, { subset: true })
}

/**
 * Luxury serif stack for SFS invoice PDFs.
 * Falls back to Helvetica (+ shared CJK loader) when custom faces are missing.
 */
export async function loadSfsInvoiceFonts(doc: PDFDocument): Promise<SfsInvoiceFonts> {
  const hasKit = registerFontkit(doc)
  const cjkBundle = await loadPdfFonts(doc)

  if (!hasKit) {
    return {
      display: cjkBundle.regular,
      section: cjkBundle.regular,
      body: cjkBundle.regular,
      amount: cjkBundle.bold,
      cjk: cjkBundle.regular,
      supportsUnicode: cjkBundle.supportsUnicode,
    }
  }

  const [display, section, body, amount] = await Promise.all([
    embedLocal(doc, 'assets/fonts/sfs-invoice/PlayfairDisplay-Regular.ttf'),
    embedLocal(doc, 'assets/fonts/sfs-invoice/CormorantGaramond-Light.ttf'),
    embedLocal(doc, 'assets/fonts/sfs-invoice/CormorantGaramond-Regular.ttf'),
    embedLocal(doc, 'assets/fonts/sfs-invoice/CormorantGaramond-Medium.ttf'),
  ])

  if (!display || !section || !body || !amount) {
    const helvetica = await doc.embedFont(StandardFonts.Helvetica)
    const helveticaBold = await doc.embedFont(StandardFonts.HelveticaBold)
    return {
      display: helvetica,
      section: helvetica,
      body: helvetica,
      amount: helveticaBold,
      cjk: cjkBundle.regular,
      supportsUnicode: cjkBundle.supportsUnicode,
    }
  }

  return {
    display,
    section,
    body,
    amount,
    cjk: cjkBundle.regular,
    supportsUnicode: cjkBundle.supportsUnicode,
  }
}
