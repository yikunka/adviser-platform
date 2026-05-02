import { prisma } from '@/lib/db/prisma'

export function normalizeSignupEmail(email: string): string {
  return email.trim().toLowerCase()
}

/** Link companies pre-assigned to this email when the client account is created or verified. */
export async function claimPendingCompaniesForUser(userId: string, email: string): Promise<number> {
  const pendingClientEmail = normalizeSignupEmail(email)

  // Raw SQL: avoids PrismaClientValidationError when the generated client is stale vs DB
  // (e.g. pendingClientEmail missing from Client until `prisma generate`), and avoids
  // updateMany quirks on relation scalars in some Prisma versions.
  const rows = await prisma.$queryRaw<Array<{ id: string }>>`
    UPDATE "companies"
    SET "clientUserId" = ${userId}, "pendingClientEmail" = NULL
    WHERE "pendingClientEmail" = ${pendingClientEmail}
      AND "clientUserId" IS NULL
    RETURNING id
  `
  return rows.length
}
