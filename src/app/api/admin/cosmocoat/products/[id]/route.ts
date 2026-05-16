import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { requireRole } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'

const patchSchema = z.object({
  pid: z.string().trim().min(1).max(64).optional(),
  type: z.enum(['feel', 'lacquer', 'uv', 'special']).optional(),
  title: z.string().trim().min(1).max(160).optional(),
  teaser: z.string().trim().max(500).optional(),
  detail: z.string().trim().min(1).optional(),
  imagePath: z.string().trim().min(1).max(500).optional(),
  sortOrder: z.coerce.number().int().min(0).max(999999).optional(),
  isFeatured: z.boolean().optional(),
  isVisible: z.boolean().optional(),
})

function revalidateCosmoCoat(pid?: string) {
  revalidatePath('/cosmocoat')
  revalidatePath('/cosmocoat/products')
  if (pid) revalidatePath(`/cosmocoat/products/${pid}`)
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await requireRole('STAFF')
  if (error) return error

  const { id } = await params
  const body = await req.json().catch(() => null)
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  const current = await prisma.cosTableProduct.findUnique({ where: { id } })
  if (!current) return NextResponse.json({ error: 'Product not found' }, { status: 404 })

  if (parsed.data.pid && parsed.data.pid !== current.pid) {
    const conflict = await prisma.cosTableProduct.findUnique({ where: { pid: parsed.data.pid } })
    if (conflict) return NextResponse.json({ error: 'Product ID already exists' }, { status: 409 })
  }

  const product = await prisma.cosTableProduct.update({
    where: { id },
    data: parsed.data,
  })

  revalidateCosmoCoat(current.pid)
  revalidateCosmoCoat(product.pid)
  return NextResponse.json({ product })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await requireRole('STAFF')
  if (error) return error

  const { id } = await params
  const current = await prisma.cosTableProduct.findUnique({ where: { id } })
  if (!current) return NextResponse.json({ error: 'Product not found' }, { status: 404 })

  await prisma.cosTableProduct.delete({ where: { id } })
  revalidateCosmoCoat(current.pid)
  return NextResponse.json({ success: true })
}
