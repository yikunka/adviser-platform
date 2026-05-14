import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireRole } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'

const patchSchema = z.object({
  nameEn:   z.string().min(1).max(100).optional(),
  email:    z.string().email().max(255).optional(),
  isActive: z.boolean().optional(),
})

// ── PATCH /api/admin/users/[id] ───────────────────────────────────────
// Edit user details or toggle isActive (enable/disable).
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

  const target = await prisma.user.findUnique({ where: { id } })
  if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 })
  if (target.role !== 'CLIENT') {
    return NextResponse.json({ error: 'Cannot modify staff accounts' }, { status: 403 })
  }

  const updates: { nameEn?: string; email?: string; isActive?: boolean } = {}

  if (parsed.data.nameEn !== undefined) updates.nameEn = parsed.data.nameEn
  if (parsed.data.isActive !== undefined) updates.isActive = parsed.data.isActive

  if (parsed.data.email !== undefined) {
    const emailNorm = parsed.data.email.trim().toLowerCase()
    const conflict = await prisma.user.findFirst({
      where: { email: { equals: emailNorm, mode: 'insensitive' }, NOT: { id } },
    })
    if (conflict) return NextResponse.json({ error: 'Email already in use' }, { status: 409 })
    updates.email = emailNorm
  }

  const user = await prisma.user.update({
    where: { id },
    data: updates,
    select: { id: true, email: true, nameEn: true, platform: true, isActive: true, emailVerified: true, createdAt: true },
  })

  return NextResponse.json({ user })
}

// ── DELETE /api/admin/users/[id] ──────────────────────────────────────
// Permanently delete a CLIENT user.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await requireRole('STAFF')
  if (error) return error

  const { id } = await params

  const target = await prisma.user.findUnique({ where: { id } })
  if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 })
  if (target.role !== 'CLIENT') {
    return NextResponse.json({ error: 'Cannot delete staff accounts' }, { status: 403 })
  }

  await prisma.user.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
