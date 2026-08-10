import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { requireRole } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'
import type { Platform } from '@prisma/client'

// ── GET /api/admin/users ──────────────────────────────────────────────
// Returns all CLIENT users across all platforms.
// Query params:
//   ?platform=ADVISER|SFS_DIAMOND  — filter by platform (optional)
//   ?q=<search>                    — search by email or name (optional)
export async function GET(req: NextRequest) {
  const { error } = await requireRole('STAFF', { adminMenu: 'users' })
  if (error) return error

  const platform = req.nextUrl.searchParams.get('platform') as Platform | null
  const q = req.nextUrl.searchParams.get('q')?.trim().toLowerCase() ?? ''

  const users = await prisma.user.findMany({
    where: {
      role: 'CLIENT',
      ...(platform ? { platform } : {}),
      ...(q
        ? {
            OR: [
              { email: { contains: q, mode: 'insensitive' } },
              { nameEn: { contains: q, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      email: true,
      nameEn: true,
      platform: true,
      role: true,
      isActive: true,
      emailVerified: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 500,
  })

  return NextResponse.json({ users })
}

// ── POST /api/admin/users ─────────────────────────────────────────────
// Admin creates a new CLIENT user and assigns them to a platform.
// Admin-created accounts are pre-verified (emailVerified set immediately).
const createSchema = z.object({
  email:    z.string().email().max(255),
  nameEn:   z.string().min(1).max(100),
  password: z.string().min(8).max(100),
  platform: z.enum(['ADVISER', 'SFS_DIAMOND']),
})

export async function POST(req: NextRequest) {
  const { error } = await requireRole('STAFF', { adminMenu: 'users' })
  if (error) return error

  const body = await req.json().catch(() => null)
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  const { nameEn, password, platform } = parsed.data
  const email = parsed.data.email.trim().toLowerCase()

  const existing = await prisma.user.findFirst({
    where: { email: { equals: email, mode: 'insensitive' } },
  })
  if (existing) {
    return NextResponse.json({ error: 'Email already registered' }, { status: 409 })
  }

  const passwordHash = await bcrypt.hash(password, 12)

  const user = await prisma.user.create({
    data: {
      email,
      nameEn,
      passwordHash,
      platform,
      role: 'CLIENT',
      emailVerified: new Date(), // admin-created users are pre-verified
    },
    select: {
      id: true,
      email: true,
      nameEn: true,
      platform: true,
    },
  })

  return NextResponse.json({ user }, { status: 201 })
}
