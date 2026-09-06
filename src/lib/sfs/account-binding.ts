import { prisma } from '@/lib/db/prisma'

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

/** Attach prior anonymous SFS orders after the account has verified its email. */
export async function claimAnonymousSfsOrdersForUser(userId: string, email: string): Promise<number> {
  const emailNorm = normalizeEmail(email)
  return prisma.$transaction(async tx => {
    const customer = await tx.sfsCustomer.upsert({
      where: { userId },
      create: { userId, name: emailNorm, email: emailNorm },
      update: {},
      select: { id: true },
    })
    const claimed = await tx.sfsOrder.updateMany({
      where: { userId: null, email: { equals: emailNorm, mode: 'insensitive' } },
      data: { userId, customerId: customer.id },
    })
    return claimed.count
  })
}
