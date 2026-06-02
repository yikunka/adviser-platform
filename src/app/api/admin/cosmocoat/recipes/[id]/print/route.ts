import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/rbac'
import { buildRecipePrintDocx, recipePrintFilename } from '@/lib/cosmocoat/recipe-print-docx'
import { serializeFullRecipe } from '@/lib/cosmocoat/recipe-serializer'

function contentDisposition(filename: string) {
  const ascii = filename.replace(/[^\w.-]+/g, '_') || 'recipe-print.docx'
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await requireRole('STAFF', { adminMenu: 'cosmocoatRecipes' })
  if (error) return error

  const { id } = await params
  const recipe = await serializeFullRecipe(id)
  if (!recipe) return NextResponse.json({ error: '配方不存在' }, { status: 404 })

  const buf = await buildRecipePrintDocx(recipe)
  const filename = recipePrintFilename(recipe.code)
  return new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': contentDisposition(filename),
    },
  })
}
