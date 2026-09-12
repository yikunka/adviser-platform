import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'
import { logAudit } from '@/lib/audit/logger'
import { syncControllersFromMembers } from '@/lib/company/sync-controllers-from-members'
import { z } from 'zod'

const txSchema = z.object({
  id: z.string().cuid().optional(),
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

const updateSchema = z.object({
  nameEn: z.string().min(1).max(200).optional(),
  nameZh: z.string().max(200).optional(),
  shareClass: z.enum(['ORDINARY', 'PREFERENCE', 'OTHER']).optional(),
  registeredAddress: z.string().min(1).max(500).optional(),
  occupation: z.string().max(200).optional(),
  status: z.enum(['ACTIVE', 'TRANSFERRED_OUT']).optional(),
  keyPersonId: z.string().cuid().nullable().optional(),
  linkedCompanyId: z.string().cuid().nullable().optional(),
  transaction: txSchema.optional(),
  removeInitialTransaction: z.boolean().optional(),
})

type Params = { params: Promise<{ id: string; memberId: string }> }

function buildShareTransactionData(transaction: z.infer<typeof txSchema>) {
  const { id: _id, ...rest } = transaction
  return {
    ...rest,
    transactionDate: new Date(transaction.transactionDate),
    amountPaid: transaction.amountPaid ? parseFloat(transaction.amountPaid) : undefined,
  }
}

function getInitialShareTransaction<T extends { id: string; transactionDate: Date }>(transactions: T[]) {
  if (transactions.length === 0) return null
  return [...transactions].sort(
    (a, b) => a.transactionDate.getTime() - b.transactionDate.getTime(),
  )[0]
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { session, error } = await requireRole('STAFF', { adminMenu: 'companies' })
  if (error) return error

  const { id: companyId, memberId } = await params
  const before = await prisma.member.findFirst({
    where: { id: memberId, companyId },
    include: { shareTransactions: true },
  })
  if (!before) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json().catch(() => null)
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })

  const { transaction, removeInitialTransaction, keyPersonId, linkedCompanyId, ...memberData } = parsed.data

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

  const data: Record<string, unknown> = { ...memberData }

  if (linkedCompanyId !== undefined || keyPersonId !== undefined) {
    const nextLinked =
      linkedCompanyId !== undefined ? linkedCompanyId : before.linkedCompanyId
    const nextKey =
      keyPersonId !== undefined ? keyPersonId : before.keyPersonId

    if (linkedCompanyId !== undefined && linkedCompanyId) {
      data.linkedCompanyId = linkedCompanyId
      data.keyPersonId = null
    } else if (keyPersonId !== undefined && keyPersonId) {
      data.keyPersonId = keyPersonId
      data.linkedCompanyId = null
    } else {
      // Explicit clears / remaining state
      if (linkedCompanyId !== undefined) data.linkedCompanyId = linkedCompanyId
      if (keyPersonId !== undefined) data.keyPersonId = keyPersonId
      // If both end up set somehow, prefer company
      if (nextLinked && nextKey && linkedCompanyId === undefined && keyPersonId !== undefined) {
        data.linkedCompanyId = null
      }
      if (nextLinked && nextKey && keyPersonId === undefined && linkedCompanyId !== undefined) {
        data.keyPersonId = null
      }
    }
  }

  try {
    await prisma.$transaction(async tx => {
      await tx.member.update({
        where: { id: memberId },
        data,
      })

      if (transaction) {
        const txData = buildShareTransactionData(transaction)
        if (transaction.id) {
          const existing = before.shareTransactions.find(st => st.id === transaction.id)
          if (!existing) {
            throw new Error('NOT_FOUND_TX')
          }
          await tx.shareTransaction.update({
            where: { id: transaction.id },
            data: txData,
          })
        } else if (before.shareTransactions.length === 0) {
          await tx.shareTransaction.create({
            data: { memberId, ...txData },
          })
        } else {
          const initial = getInitialShareTransaction(before.shareTransactions)
          if (!initial) return
          await tx.shareTransaction.update({
            where: { id: initial.id },
            data: txData,
          })
        }
      } else if (removeInitialTransaction) {
        const initial = getInitialShareTransaction(before.shareTransactions)
        if (initial) {
          await tx.shareTransaction.delete({ where: { id: initial.id } })
        }
      }
    })
  } catch (err) {
    if (err instanceof Error && err.message === 'NOT_FOUND_TX') {
      return NextResponse.json({ error: 'Share transaction not found' }, { status: 404 })
    }
    throw err
  }

  const member = await prisma.member.findUnique({
    where: { id: memberId },
    include: {
      shareTransactions: { orderBy: { transactionDate: 'desc' } },
      linkedCompany: { select: { id: true, nameEn: true, nameZh: true, companyCode: true } },
      keyPerson: { select: { id: true, nameEn: true, nameZh: true, kycStatus: true } },
    },
  })

  await logAudit(session!.user.id, 'UPDATE', 'Member', memberId, before, member)

  const controllerSync = await syncControllersFromMembers(companyId)
  return NextResponse.json({ ...member, controllerSync })
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { session, error } = await requireRole('STAFF', { adminMenu: 'companies' })
  if (error) return error

  const { id: companyId, memberId } = await params
  const member = await prisma.member.findFirst({ where: { id: memberId, companyId } })
  if (!member) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.member.delete({ where: { id: memberId } })
  await logAudit(session!.user.id, 'DELETE', 'Member', memberId, member, null)

  const controllerSync = await syncControllersFromMembers(companyId)
  return NextResponse.json({ message: 'Deleted', controllerSync })
}
