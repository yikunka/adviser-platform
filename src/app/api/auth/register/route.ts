import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { prisma } from '@/lib/db/prisma'
import { sendOTPEmail } from '@/lib/email/resend'
import { rateLimitAuth } from '@/lib/auth/rate-limit'
import { claimPendingCompaniesForUser, normalizeSignupEmail } from '@/lib/company/claim-pending-client'
import crypto from 'crypto'

const schema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8).max(100),
  nameEn: z.string().min(1).max(100),
  phone: z.string().max(20).optional(),
  locale: z.enum(['zh', 'en']).default('zh'),
  platform: z.enum(['ADVISER', 'SFS_DIAMOND']).default('ADVISER'),
})

export async function POST(req: NextRequest) {
  const rl = rateLimitAuth(req)
  if (rl) return rl

  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
  }

  const { password, nameEn, phone, locale, platform } = parsed.data
  const email = normalizeSignupEmail(parsed.data.email)

  try {
    const existing = await prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
    })
    if (existing) {
      return NextResponse.json({ error: 'Email already registered' }, { status: 409 })
    }

    const passwordHash = await bcrypt.hash(password, 12)
    const user = await prisma.user.create({
      data: { email, passwordHash, nameEn, phone, platform },
    })

    await claimPendingCompaniesForUser(user.id, user.email)

    // Dev mode: no Resend key → auto-verify immediately, no OTP step needed
    if (!process.env.RESEND_API_KEY) {
      await prisma.user.update({
        where: { id: user.id },
        data: { emailVerified: new Date() },
      })
      console.log(`[DEV] Auto-verified ${email} (RESEND_API_KEY not set)`)
      return NextResponse.json({ message: 'auto-verified', userId: user.id, devAutoVerified: true }, { status: 201 })
    }

    const otp = crypto.randomInt(100000, 999999).toString()
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000)

    await prisma.verificationToken.deleteMany({
      where: { userId: user.id, type: 'EMAIL_VERIFY' },
    })
    await prisma.verificationToken.create({
      data: { userId: user.id, token: otp, type: 'EMAIL_VERIFY', expiresAt },
    })

    const sendResult = await sendOTPEmail(email, otp, locale)
    if (sendResult.error) {
      console.error('[register] Resend error:', sendResult.error)
      return NextResponse.json(
        { error: 'Failed to send verification email. Check server email configuration.' },
        { status: 502 },
      )
    }

    return NextResponse.json({ message: 'OTP sent', userId: user.id }, { status: 201 })
  } catch (e) {
    console.error('[register]', e)
    return NextResponse.json({ error: 'Registration failed' }, { status: 500 })
  }
}
