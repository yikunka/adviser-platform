import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireRole } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'
import { logAudit } from '@/lib/audit/logger'
import { mergeSfsCustomers, resolveOrCreateSfsCustomerId } from '@/lib/sfs/merge-customers'

const mergeSchema = z.object({
  targetRowId: z.string().min(1),
  sourceRowIds: z.array(z.string().min(1)).min(1),
  reassignOrderUsers: z.boolean().optional(),
  deleteSourceProfiles: z.boolean().optional(),
  deactivateSourceUsers: z.boolean().optional(),
})

export async function POST(req: NextRequest) {
  const { session, error } = await requireRole('STAFF', { adminMenu: 'sfsCustomers' })
  if (error) return error

  const body = await req.json().catch(() => null)
  const parsed = mergeSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  const uniqueSources = Array.from(new Set(parsed.data.sourceRowIds)).filter(id => id !== parsed.data.targetRowId)
  if (uniqueSources.length === 0) {
    return NextResponse.json({ error: 'Select at least one other customer to merge.' }, { status: 400 })
  }

  try {
    const targetCustomerId = await resolveOrCreateSfsCustomerId(
      prisma,
      parsed.data.targetRowId,
      session!.user.id,
    )
    const sourceCustomerIds: string[] = []
    for (const rowId of uniqueSources) {
      sourceCustomerIds.push(await resolveOrCreateSfsCustomerId(prisma, rowId, session!.user.id))
    }

    const result = await mergeSfsCustomers(prisma, {
      targetCustomerId,
      sourceCustomerIds,
      reassignOrderUsers: parsed.data.reassignOrderUsers,
      deleteSourceProfiles: parsed.data.deleteSourceProfiles,
      deactivateSourceUsers: parsed.data.deactivateSourceUsers,
    })

    await logAudit(session!.user.id, 'UPDATE', 'SfsCustomer', targetCustomerId, {
      action: 'merge',
      sourceRowIds: uniqueSources,
      ...result,
    }, result)

    return NextResponse.json({ success: true, result })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Merge failed'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
