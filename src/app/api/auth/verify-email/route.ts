import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db/prisma'
import { claimPendingCompaniesForUser } from '@/lib/company/claim-pending-client'

const schema = z.object({
  userId: z.string().cuid(),
  otp: z.string().length(6),
})

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
  }

  const { userId, otp } = parsed.data

  const token = await prisma.verificationToken.findFirst({
    where: { userId, token: otp, type: 'EMAIL_VERIFY' },
  })

  if (!token) {
    return NextResponse.json({ error: 'Invalid code' }, { status: 400 })
  }
  if (token.expiresAt < new Date()) {
    return NextResponse.json({ error: 'Code expired' }, { status: 400 })
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data: { emailVerified: new Date() },
  })
  await prisma.verificationToken.delete({ where: { id: token.id } })

  if (user.role === 'CLIENT') {
    await claimPendingCompaniesForUser(user.id, user.email)
  }

  return NextResponse.json({ message: 'Email verified' })
}
