import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import type { Platform, UserRole } from '@prisma/client'
import { requireRole } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'
import { ADMIN_MENU_KEYS, type AdminMenuKey } from '@/lib/auth/admin-access'

const createSchema = z.object({
  email: z.string().email().max(255),
  nameEn: z.string().min(1).max(100),
  password: z.string().min(8).max(100),
  role: z.enum(['STAFF', 'COMPLIANCE', 'SUPER_ADMIN']),
  adminPlatforms: z.array(z.enum(['ADVISER', 'SFS_DIAMOND', 'COSMICOAT'])).default([]),
  adminMenuKeys: z.array(z.string()).default([]),
  adminRoleId: z.string().optional().nullable(),
})

function normalizeMenus(keys: string[]): string[] {
  const allowed = new Set<string>(ADMIN_MENU_KEYS as unknown as string[])
  return keys.filter(k => allowed.has(k))
}

/** GET /api/admin/team — list staff accounts (super admin only). */
export async function GET() {
  const { error } = await requireRole('SUPER_ADMIN')
  if (error) return error

  const users = await prisma.user.findMany({
    where: { role: { in: ['STAFF', 'COMPLIANCE', 'SUPER_ADMIN'] } },
    select: {
      id: true,
      email: true,
      nameEn: true,
      nameZh: true,
      role: true,
      isActive: true,
      adminPlatforms: true,
      adminMenuKeys: true,
      adminRoleId: true,
      adminRole: { select: { id: true, name: true, color: true } },
      emailVerified: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
  })

  return NextResponse.json({ users })
}

/** POST /api/admin/team — create a staff / admin account. */
export async function POST(req: Request) {
  const { error } = await requireRole('SUPER_ADMIN')
  if (error) return error

  const body = await req.json().catch(() => null)
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  const email = parsed.data.email.trim().toLowerCase()
  const existing = await prisma.user.findFirst({
    where: { email: { equals: email, mode: 'insensitive' } },
  })
  if (existing) {
    return NextResponse.json({ error: 'Email already registered' }, { status: 409 })
  }

  const adminMenuKeys = normalizeMenus(parsed.data.adminMenuKeys) as unknown as AdminMenuKey[]
  const adminPlatforms = parsed.data.adminPlatforms as Platform[]

  const passwordHash = await bcrypt.hash(parsed.data.password, 12)

  const user = await prisma.user.create({
    data: {
      email,
      nameEn: parsed.data.nameEn,
      passwordHash,
      role: parsed.data.role as UserRole,
      platform: 'ADVISER',
      adminPlatforms,
      adminMenuKeys: adminMenuKeys as unknown as string[],
      adminRoleId: parsed.data.adminRoleId ?? null,
      emailVerified: new Date(),
    },
    select: {
      id: true,
      email: true,
      nameEn: true,
      role: true,
      adminPlatforms: true,
      adminMenuKeys: true,
    },
  })

  return NextResponse.json({ user }, { status: 201 })
}
