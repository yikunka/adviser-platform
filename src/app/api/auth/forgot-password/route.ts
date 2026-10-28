import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db/prisma'
import { sendPasswordResetEmail } from '@/lib/email/resend'
import { rateLimitAuth } from '@/lib/auth/rate-limit'
import crypto from 'crypto'

const schema = z.object({
  email: z.string().email().max(255),
  locale: z.enum(['zh', 'en']).default('zh'),
  platform: z.enum(['ADVISER', 'SFS_DIAMOND', 'JMM_TRADING']).optional(),
})

export async function POST(req: NextRequest) {
  const rl = rateLimitAuth(req)
  if (rl) return rl

  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
  }

  const { email, locale, platform } = parsed.data

  // Always return success to prevent email enumeration
  const user = await prisma.user.findFirst({
    where: {
      email,
      ...(platform ? { platform } : {}),
    },
  })
  if (!user || !user.emailVerified) {
    return NextResponse.json({ message: 'If the email exists, a reset link has been sent.' })
  }

  const token = crypto.randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000)

  await prisma.verificationToken.deleteMany({
    where: { userId: user.id, type: 'PASSWORD_RESET' },
  })
  await prisma.verificationToken.create({
    data: { userId: user.id, token, type: 'PASSWORD_RESET', expiresAt },
  })

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const link =
    user.platform === 'SFS_DIAMOND'
      ? `${appUrl}/sfsdiamond/reset-password?token=${token}`
      : `${appUrl}/${locale}/reset-password?token=${token}`
  await sendPasswordResetEmail(email, link, user.platform === 'SFS_DIAMOND' ? 'en' : locale)

  return NextResponse.json({ message: 'If the email exists, a reset link has been sent.' })
}
