import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'
import { logAudit } from '@/lib/audit/logger'
import { z } from 'zod'

const txSchema = z.object({
  transactionType: z.enum(['ALLOTMENT', 'TRANSFER_IN', 'TRANSFER_OUT']),
  transactionDate: z.string().min(1),
  allotmentTransferNo: z.string().max(50).optional(),
  certificateNo: z.string().max(50).optional(),
  sharesAcquired: z.number().int().nonnegative().optional(),
  distinctiveNosFrom: z.number().int().nonnegative().optional(),
  distinctiveNosTo: z.number().int().nonnegative().optional(),
  amountPaid: z.string().optional(),
  sharesTransferred: z.number().int().nonnegative().optional(),
  certificateSurrendered: z.string().max(50).optional(),
  certificateSurrenderedShares: z.number().int().nonnegative().optional(),
  balanceCertificateNo: z.string().max(50).optional(),
  balanceCertificateShares: z.number().int().nonnegative().optional(),
  balanceDistinctiveNosFrom: z.number().int().nonnegative().optional(),
  balanceDistinctiveNosTo: z.number().int().nonnegative().optional(),
  sharesHeld: z.number().int().nonnegative(),
})

const createSchema = z.object({
  nameEn: z.string().min(1).max(200),
  nameZh: z.string().max(200).optional(),
  shareClass: z.enum(['ORDINARY', 'PREFERENCE', 'OTHER']),
  registeredAddress: z.string().min(1).max(500),
  occupation: z.string().max(200).optional(),
  status: z.enum(['ACTIVE', 'TRANSFERRED_OUT']).optional(),
  transaction: txSchema.optional(),
})

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, error } = await requireRole('STAFF', { adminMenu: 'companies' })
  if (error) return error

  const { id: companyId } = await params
  const company = await prisma.company.findUnique({ where: { id: companyId } })
  if (!company) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json().catch(() => null)
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })

  const { transaction, ...memberData } = parsed.data

  const member = await prisma.member.create({
    data: {
      ...memberData,
      companyId,
      ...(transaction
        ? {
            shareTransactions: {
              create: {
                ...transaction,
                transactionDate: new Date(transaction.transactionDate),
                amountPaid: transaction.amountPaid ? parseFloat(transaction.amountPaid) : undefined,
              },
            },
          }
        : {}),
    },
  })

  await logAudit(session!.user.id, 'CREATE', 'Member', member.id, null, member)
  return NextResponse.json(member, { status: 201 })
}
