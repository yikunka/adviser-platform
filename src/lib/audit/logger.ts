import { prisma } from '@/lib/db/prisma'

const MASKED_FIELDS = new Set(['passwordHash', 'idNumber', 'passportNumber', 'token'])

function maskDiff(obj: unknown): unknown {
  if (!obj || typeof obj !== 'object') return obj
  const masked: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    masked[key] = MASKED_FIELDS.has(key) ? '[REDACTED]' : value
  }
  return masked
}

export async function logAudit(
  userId: string,
  action: string,
  entityType: string,
  entityId: string,
  before?: unknown,
  after?: unknown,
) {
  await prisma.auditLog.create({
    data: {
      userId,
      action,
      entityType,
      entityId,
      beforeData: before ? (maskDiff(before) as never) : undefined,
      afterData: after ? (maskDiff(after) as never) : undefined,
    },
  })
}
