import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { prisma } from '@/lib/db/prisma'
import { rateLimitAuth } from '@/lib/auth/rate-limit'

const schema = z.object({
  token: z.string().min(32).max(128),
  password: z.string().min(8).max(100),
})

export async function POST(req: NextRequest) {
  const rl = rateLimitAuth(req)
  if (rl) return rl

  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
  }

  const { token, password } = parsed.data

  const record = await prisma.verificationToken.findFirst({
    where: { token, type: 'PASSWORD_RESET' },
  })

  if (!record) {
    return NextResponse.json({ error: 'Invalid or expired token' }, { status: 400 })
  }
  if (record.expiresAt < new Date()) {
    return NextResponse.json({ error: 'Token expired' }, { status: 400 })
  }

  const passwordHash = await bcrypt.hash(password, 12)
  await prisma.user.update({
    where: { id: record.userId },
    data: { passwordHash },
  })
  await prisma.verificationToken.delete({ where: { id: record.id } })

  return NextResponse.json({ message: 'Password reset successfully' })
}
