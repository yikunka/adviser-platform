import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/rbac'
import {
  buildColorFormulaPrintDocx,
  colorFormulaPrintFilename,
  loadPrintFormula,
} from '@/lib/cosmocoat/color-formula-print-docx'

function contentDisposition(filename: string) {
  const ascii = filename.replace(/[^\w.-]+/g, '_') || 'color-formula-print.docx'
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await requireRole('STAFF', { adminMenu: 'cosmocoatColorFormulas' })
  if (error) return error

  const { id } = await params
  const formula = await loadPrintFormula(id)
  if (!formula) return NextResponse.json({ error: '调色配方不存在' }, { status: 404 })

  const buf = await buildColorFormulaPrintDocx(formula)
  const filename = colorFormulaPrintFilename(formula.code)
  return new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': contentDisposition(filename),
    },
  })
}
