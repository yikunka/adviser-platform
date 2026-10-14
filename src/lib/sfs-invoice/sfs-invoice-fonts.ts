import { PDFDocument, StandardFonts, type PDFFont } from 'pdf-lib'
import { loadPdfFonts } from '@/lib/pdf/cjk-font'

export type SfsInvoiceFonts = {
  /** Large title — Times (matches Word Georgia) */
  display: PDFFont
  /** Labels / light body — Times */
  section: PDFFont
  /** Body / descriptions — Times */
  body: PDFFont
  /** Emphasized amounts / names — Times Bold */
  amount: PDFFont
  /** Sans labels (BILL TO, table header, PAYMENT) — Helvetica */
  sans: PDFFont
  /** Sans bold */
  sansBold: PDFFont
  /** CJK Song-style for Chinese issuer name */
  cjk: PDFFont
  supportsUnicode: boolean
}

/**
 * Fonts for SFS invoice PDFs — aligned with Word (Georgia/Arial).
 * Uses PDF standard Times/Helvetica for reliable Latin glyphs; CJK only for Chinese.
 * (Custom Cormorant/Playfair subsetting was dropping glyphs in production.)
 */
export async function loadSfsInvoiceFonts(doc: PDFDocument): Promise<SfsInvoiceFonts> {
  const cjkBundle = await loadPdfFonts(doc)
  const [
    times,
    timesBold,
    helvetica,
    helveticaBold,
  ] = await Promise.all([
    doc.embedFont(StandardFonts.TimesRoman),
    doc.embedFont(StandardFonts.TimesRomanBold),
    doc.embedFont(StandardFonts.Helvetica),
    doc.embedFont(StandardFonts.HelveticaBold),
  ])

  return {
    display: timesBold,
    section: times,
    body: times,
    amount: timesBold,
    sans: helvetica,
    sansBold: helveticaBold,
    cjk: cjkBundle.regular,
    supportsUnicode: cjkBundle.supportsUnicode,
  }
}
