import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'
import { logAudit } from '@/lib/audit/logger'
import { syncControllersFromMembers } from '@/lib/company/sync-controllers-from-members'
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
  keyPersonId: z.string().cuid().nullable().optional(),
  linkedCompanyId: z.string().cuid().nullable().optional(),
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

  const { transaction, keyPersonId, linkedCompanyId, ...memberData } = parsed.data

  if (linkedCompanyId) {
    if (linkedCompanyId === companyId) {
      return NextResponse.json({ error: 'Cannot link member to the same company' }, { status: 400 })
    }
    const linked = await prisma.company.findFirst({
      where: { id: linkedCompanyId, deletedAt: null },
      select: { id: true },
    })
    if (!linked) return NextResponse.json({ error: 'Linked company not found' }, { status: 400 })
  }

  if (keyPersonId) {
    const person = await prisma.keyPerson.findUnique({ where: { id: keyPersonId }, select: { id: true } })
    if (!person) return NextResponse.json({ error: 'Linked KYC person not found' }, { status: 400 })
  }

  // Prefer one link type: corporate vs natural person (linked company wins if both sent)
  const finalLinkedCompanyId = linkedCompanyId ?? null
  const finalKeyPersonId = finalLinkedCompanyId ? null : (keyPersonId ?? null)

  const member = await prisma.member.create({
    data: {
      ...memberData,
      companyId,
      keyPersonId: finalKeyPersonId,
      linkedCompanyId: finalLinkedCompanyId,
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

  const controllerSync = await syncControllersFromMembers(companyId)

  return NextResponse.json({ ...member, controllerSync }, { status: 201 })
}
