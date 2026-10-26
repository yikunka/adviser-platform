import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { requireRole } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'

// ── GET /api/admin/users ──────────────────────────────────────────────
// Advise (TCSP) CLIENT portal accounts only. SFS logins are managed under SFS Customers.
export async function GET(req: NextRequest) {
  const { error } = await requireRole('STAFF', { adminMenu: 'users' })
  if (error) return error

  const q = req.nextUrl.searchParams.get('q')?.trim().toLowerCase() ?? ''

  const users = await prisma.user.findMany({
    where: {
      role: 'CLIENT',
      platform: 'ADVISER',
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
// Create an Advise CLIENT account (pre-verified).
const createSchema = z.object({
  email: z.string().email().max(255),
  nameEn: z.string().min(1).max(100),
  password: z.string().min(8).max(100),
})

export async function POST(req: NextRequest) {
  const { error } = await requireRole('STAFF', { adminMenu: 'users' })
  if (error) return error

  const body = await req.json().catch(() => null)
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  const { nameEn, password } = parsed.data
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
      platform: 'ADVISER',
      role: 'CLIENT',
      emailVerified: new Date(),
      accountApprovalStatus: 'APPROVED',
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
