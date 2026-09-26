import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireRole } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'
import { logAudit } from '@/lib/audit/logger'
import { syncControllersFromMembers } from '@/lib/company/sync-controllers-from-members'
import {
  appendAllotment,
  createMemberForCompany,
  getMemberHolding,
  syncMemberStatusFromLatestHolding,
} from '@/lib/company/share-movements'

const newMemberSchema = z.object({
  nameEn: z.string().min(1).max(200),
  nameZh: z.string().max(200).optional(),
  shareClass: z.enum(['ORDINARY', 'PREFERENCE', 'OTHER']).default('ORDINARY'),
  registeredAddress: z.string().min(1).max(500),
  occupation: z.string().max(200).optional(),
  keyPersonId: z.string().cuid().nullable().optional(),
  linkedCompanyId: z.string().cuid().nullable().optional(),
})

const schema = z.object({
  memberId: z.string().cuid().optional(),
  newMember: newMemberSchema.optional(),
  transactionDate: z.string().min(1),
  shares: z.number().int().positive(),
  allotmentTransferNo: z.string().max(50).optional(),
  certificateNo: z.string().max(50).optional(),
  distinctiveNosFrom: z.number().int().nonnegative().optional(),
  distinctiveNosTo: z.number().int().nonnegative().optional(),
  amountPaid: z.string().optional(),
}).refine(data => Boolean(data.memberId) !== Boolean(data.newMember), {
  message: 'Provide either memberId or newMember',
})

type Ctx = { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, ctx: Ctx) {
  const { session, error } = await requireRole('STAFF', { adminMenu: 'companies' })
  if (error) return error

  const { id: companyId } = await ctx.params
  const company = await prisma.company.findUnique({ where: { id: companyId }, select: { id: true } })
  if (!company) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  const data = parsed.data
  if (data.newMember?.linkedCompanyId === companyId) {
    return NextResponse.json({ error: 'Cannot link member to the same company' }, { status: 400 })
  }

  try {
    const result = await prisma.$transaction(async tx => {
      let memberId = data.memberId
      let previousHolding = 0
      let createdMember = false

      if (data.newMember) {
        const member = await createMemberForCompany(tx, companyId, data.newMember)
        memberId = member.id
        previousHolding = 0
        createdMember = true
      } else {
        const row = await getMemberHolding(tx, data.memberId!, companyId)
        if (!row) throw new Error('MEMBER_NOT_FOUND')
        memberId = row.member.id
        previousHolding = row.holding
      }

      const transactionDate = new Date(data.transactionDate)
      const shareTx = await appendAllotment(tx, memberId!, {
        transactionDate,
        shares: data.shares,
        previousHolding,
        allotmentTransferNo: data.allotmentTransferNo,
        certificateNo: data.certificateNo,
        distinctiveNosFrom: data.distinctiveNosFrom,
        distinctiveNosTo: data.distinctiveNosTo,
        amountPaid: data.amountPaid,
      })
      await syncMemberStatusFromLatestHolding(tx, memberId!)

      return {
        memberId: memberId!,
        createdMember,
        previousHolding,
        sharesHeld: previousHolding + data.shares,
        shareTransactionId: shareTx.id,
      }
    })

    await logAudit(session!.user.id, 'CREATE', 'ShareAllotment', result.shareTransactionId, null, {
      companyId,
      ...result,
      shares: data.shares,
      transactionDate: data.transactionDate,
    })

    const controllerSync = await syncControllersFromMembers(companyId)
    return NextResponse.json({ ...result, controllerSync }, { status: 201 })
  } catch (err) {
    if (err instanceof Error && err.message === 'MEMBER_NOT_FOUND') {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 })
    }
    throw err
  }
}
