import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/rbac'
import { analyzeCompanyDocuments } from '@/lib/company/document-analysis'

const ALLOWED_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/png'])
const MAX_FILE_SIZE = 10 * 1024 * 1024
const MAX_FILES = 6

export async function POST(req: NextRequest) {
  const { error } = await requireRole('STAFF', { adminMenu: 'companies' })
  if (error) return error

  const formData = await req.formData()
  const files = formData
    .getAll('files')
    .filter((value): value is File => value instanceof File)
    .slice(0, MAX_FILES)

  if (files.length === 0) {
    return NextResponse.json({ error: 'No files provided' }, { status: 400 })
  }

  for (const file of files) {
    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json({ error: 'Invalid file type. Only PDF, JPG, PNG allowed.' }, { status: 400 })
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'File too large. Max 10MB.' }, { status: 400 })
    }
  }

  const result = await analyzeCompanyDocuments(files)
  return NextResponse.json(result)
}
