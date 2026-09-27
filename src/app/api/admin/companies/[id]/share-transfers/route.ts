import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireRole } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'
import { logAudit } from '@/lib/audit/logger'
import { syncControllersFromMembers, parseShareCalendarDate } from '@/lib/company/sync-controllers-from-members'
import {
  appendTransferPair,
  createMemberForCompany,
  getMemberHolding,
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
  fromMemberId: z.string().cuid(),
  toMemberId: z.string().cuid().optional(),
  newMember: newMemberSchema.optional(),
  transactionDate: z.string().min(1),
  shares: z.number().int().positive(),
  allotmentTransferNo: z.string().max(50).optional(),
  certificateNo: z.string().max(50).optional(),
  distinctiveNosFrom: z.number().int().nonnegative().optional(),
  distinctiveNosTo: z.number().int().nonnegative().optional(),
  amountPaid: z.string().optional(),
  certificateSurrendered: z.string().max(50).optional(),
  certificateSurrenderedShares: z.number().int().nonnegative().optional(),
  balanceCertificateNo: z.string().max(50).optional(),
  balanceCertificateShares: z.number().int().nonnegative().optional(),
  balanceDistinctiveNosFrom: z.number().int().nonnegative().optional(),
  balanceDistinctiveNosTo: z.number().int().nonnegative().optional(),
}).refine(data => Boolean(data.toMemberId) !== Boolean(data.newMember), {
  message: 'Provide either toMemberId or newMember',
}).refine(data => !data.toMemberId || data.toMemberId !== data.fromMemberId, {
  message: 'Transferor and transferee must be different members',
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
      const from = await getMemberHolding(tx, data.fromMemberId, companyId)
      if (!from) throw new Error('FROM_NOT_FOUND')
      if (from.holding < data.shares) throw new Error('INSUFFICIENT_SHARES')

      let toMemberId = data.toMemberId
      let toPreviousHolding = 0
      let createdMember = false

      if (data.newMember) {
        const member = await createMemberForCompany(tx, companyId, {
          ...data.newMember,
          shareClass: data.newMember.shareClass ?? from.member.shareClass as 'ORDINARY' | 'PREFERENCE' | 'OTHER',
        })
        toMemberId = member.id
        toPreviousHolding = 0
        createdMember = true
      } else {
        const to = await getMemberHolding(tx, data.toMemberId!, companyId)
        if (!to) throw new Error('TO_NOT_FOUND')
        toMemberId = to.member.id
        toPreviousHolding = to.holding
      }

      const transactionDate = parseShareCalendarDate(data.transactionDate)
      const pair = await appendTransferPair(tx, {
        fromMemberId: data.fromMemberId,
        toMemberId: toMemberId!,
        transactionDate,
        shares: data.shares,
        fromPreviousHolding: from.holding,
        toPreviousHolding,
        allotmentTransferNo: data.allotmentTransferNo,
        certificateNo: data.certificateNo,
        distinctiveNosFrom: data.distinctiveNosFrom,
        distinctiveNosTo: data.distinctiveNosTo,
        amountPaid: data.amountPaid,
        certificateSurrendered: data.certificateSurrendered,
        certificateSurrenderedShares: data.certificateSurrenderedShares,
        balanceCertificateNo: data.balanceCertificateNo,
        balanceCertificateShares: data.balanceCertificateShares,
        balanceDistinctiveNosFrom: data.balanceDistinctiveNosFrom,
        balanceDistinctiveNosTo: data.balanceDistinctiveNosTo,
      })

      return {
        fromMemberId: data.fromMemberId,
        toMemberId: toMemberId!,
        createdMember,
        shares: data.shares,
        fromPreviousHolding: from.holding,
        fromHeld: pair.fromHeld,
        toPreviousHolding,
        toHeld: pair.toHeld,
        outTransactionId: pair.outTx.id,
        inTransactionId: pair.inTx.id,
      }
    })

    await logAudit(session!.user.id, 'CREATE', 'ShareTransfer', result.outTransactionId, null, {
      companyId,
      ...result,
      transactionDate: data.transactionDate,
    })

    const controllerSync = await syncControllersFromMembers(companyId, {
      asOfDate: parseShareCalendarDate(data.transactionDate),
    })
    return NextResponse.json({ ...result, controllerSync }, { status: 201 })
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === 'FROM_NOT_FOUND') {
        return NextResponse.json({ error: 'Transferor not found' }, { status: 404 })
      }
      if (err.message === 'TO_NOT_FOUND') {
        return NextResponse.json({ error: 'Transferee not found' }, { status: 404 })
      }
      if (err.message === 'INSUFFICIENT_SHARES') {
        return NextResponse.json({ error: 'Transferor does not hold enough shares' }, { status: 400 })
      }
    }
    throw err
  }
}
