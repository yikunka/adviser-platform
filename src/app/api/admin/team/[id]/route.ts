import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import type { Platform, UserRole } from '@prisma/client'
import { requireRole } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'
import { ADMIN_MENU_KEYS, type AdminMenuKey } from '@/lib/auth/admin-access'

const patchSchema = z.object({
  nameEn: z.string().min(1).max(100).optional(),
  email: z.string().email().max(255).optional(),
  role: z.enum(['STAFF', 'COMPLIANCE', 'SUPER_ADMIN']).optional(),
  isActive: z.boolean().optional(),
  password: z.string().min(8).max(100).optional(),
  adminPlatforms: z.array(z.enum(['ADVISER', 'SFS_DIAMOND', 'COSMICOAT'])).optional(),
  adminMenuKeys: z.array(z.string()).optional(),
})

function normalizeMenus(keys: string[] | undefined): string[] | undefined {
  if (!keys) return undefined
  const allowed = new Set<string>(ADMIN_MENU_KEYS as unknown as string[])
  return keys.filter(k => allowed.has(k))
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await requireRole('SUPER_ADMIN')
  if (error) return error

  const { id } = await params
  const body = await req.json().catch(() => null)
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  const target = await prisma.user.findUnique({ where: { id } })
  if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 })
  if (target.role === 'CLIENT') {
    return NextResponse.json({ error: 'Not a staff account' }, { status: 400 })
  }

  if (parsed.data.email !== undefined) {
    const emailNorm = parsed.data.email.trim().toLowerCase()
    const conflict = await prisma.user.findFirst({
      where: { email: { equals: emailNorm, mode: 'insensitive' }, NOT: { id } },
    })
    if (conflict) return NextResponse.json({ error: 'Email already in use' }, { status: 409 })
  }

  const data: Record<string, unknown> = {}
  if (parsed.data.nameEn !== undefined) data.nameEn = parsed.data.nameEn
  if (parsed.data.email !== undefined) data.email = parsed.data.email.trim().toLowerCase()
  if (parsed.data.role !== undefined) data.role = parsed.data.role as UserRole
  if (parsed.data.isActive !== undefined) data.isActive = parsed.data.isActive
  if (parsed.data.adminPlatforms !== undefined) data.adminPlatforms = parsed.data.adminPlatforms as Platform[]
  if (parsed.data.adminMenuKeys !== undefined) {
    const m = normalizeMenus(parsed.data.adminMenuKeys) as unknown as AdminMenuKey[]
    data.adminMenuKeys = m as unknown as string[]
  }
  if (parsed.data.password) {
    data.passwordHash = await bcrypt.hash(parsed.data.password, 12)
  }

  const user = await prisma.user.update({
    where: { id },
    data: {
      ...(data.nameEn !== undefined ? { nameEn: data.nameEn as string } : {}),
      ...(data.email !== undefined ? { email: data.email as string } : {}),
      ...(data.role !== undefined ? { role: data.role as UserRole } : {}),
      ...(data.isActive !== undefined ? { isActive: data.isActive as boolean } : {}),
      ...(data.adminPlatforms !== undefined ? { adminPlatforms: data.adminPlatforms as Platform[] } : {}),
      ...(data.adminMenuKeys !== undefined ? { adminMenuKeys: data.adminMenuKeys as string[] } : {}),
      ...(data.passwordHash !== undefined ? { passwordHash: data.passwordHash as string } : {}),
    },
    select: {
      id: true,
      email: true,
      nameEn: true,
      role: true,
      isActive: true,
      adminPlatforms: true,
      adminMenuKeys: true,
    },
  })

  return NextResponse.json({ user })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, error } = await requireRole('SUPER_ADMIN')
  if (error) return error

  const { id } = await params
  if (session!.user.id === id) {
    return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 })
  }

  const target = await prisma.user.findUnique({ where: { id } })
  if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 })
  if (target.role === 'CLIENT') {
    return NextResponse.json({ error: 'Not a staff account' }, { status: 400 })
  }

  await prisma.user.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
