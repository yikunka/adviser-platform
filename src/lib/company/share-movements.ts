export type ShareHoldingTx = {
  sharesHeld: number
  transactionDate: Date
  createdAt?: Date
}

export function latestSharesHeld(transactions: ShareHoldingTx[]): number {
  if (transactions.length === 0) return 0
  const latest = [...transactions].sort((a, b) => {
    const byDate = b.transactionDate.getTime() - a.transactionDate.getTime()
    if (byDate !== 0) return byDate
    return (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0)
  })[0]
  return latest?.sharesHeld ?? 0
}

/** Interactive Prisma transaction client (or the root client). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any

export async function syncMemberStatusFromLatestHolding(
  db: Db,
  memberId: string,
) {
  const latest = await db.shareTransaction.findFirst({
    where: { memberId },
    orderBy: [{ transactionDate: 'desc' }, { createdAt: 'desc' }],
    select: { sharesHeld: true },
  })
  if (!latest) return

  await db.member.update({
    where: { id: memberId },
    data: { status: latest.sharesHeld <= 0 ? 'TRANSFERRED_OUT' : 'ACTIVE' },
  })
}

export async function getMemberHolding(
  db: Db,
  memberId: string,
  companyId: string,
): Promise<{ member: { id: string; nameEn: string; shareClass: string; status: string }; holding: number } | null> {
  const member = await db.member.findFirst({
    where: { id: memberId, companyId },
    select: {
      id: true,
      nameEn: true,
      shareClass: true,
      status: true,
      shareTransactions: {
        select: { sharesHeld: true, transactionDate: true, createdAt: true },
      },
    },
  })
  if (!member) return null
  return {
    member: {
      id: member.id,
      nameEn: member.nameEn,
      shareClass: member.shareClass,
      status: member.status,
    },
    holding: latestSharesHeld(member.shareTransactions),
  }
}

export type NewMemberInput = {
  nameEn: string
  nameZh?: string
  shareClass: 'ORDINARY' | 'PREFERENCE' | 'OTHER'
  registeredAddress: string
  occupation?: string
  keyPersonId?: string | null
  linkedCompanyId?: string | null
}

export async function createMemberForCompany(
  db: Db,
  companyId: string,
  input: NewMemberInput,
) {
  const linkedCompanyId = input.linkedCompanyId ?? null
  const keyPersonId = linkedCompanyId ? null : (input.keyPersonId ?? null)
  return db.member.create({
    data: {
      companyId,
      nameEn: input.nameEn,
      nameZh: input.nameZh,
      shareClass: input.shareClass,
      registeredAddress: input.registeredAddress,
      occupation: input.occupation,
      keyPersonId,
      linkedCompanyId,
      status: 'ACTIVE',
    },
  })
}

export type OptionalCertFields = {
  allotmentTransferNo?: string
  certificateNo?: string
  distinctiveNosFrom?: number
  distinctiveNosTo?: number
  amountPaid?: string
  certificateSurrendered?: string
  certificateSurrenderedShares?: number
  balanceCertificateNo?: string
  balanceCertificateShares?: number
  balanceDistinctiveNosFrom?: number
  balanceDistinctiveNosTo?: number
}

function optionalCertData(fields: OptionalCertFields): Record<string, string | number> {
  const data: Record<string, string | number> = {}
  if (fields.allotmentTransferNo) data.allotmentTransferNo = fields.allotmentTransferNo
  if (fields.certificateNo) data.certificateNo = fields.certificateNo
  if (fields.distinctiveNosFrom != null) data.distinctiveNosFrom = fields.distinctiveNosFrom
  if (fields.distinctiveNosTo != null) data.distinctiveNosTo = fields.distinctiveNosTo
  if (fields.amountPaid) data.amountPaid = parseFloat(fields.amountPaid)
  if (fields.certificateSurrendered) data.certificateSurrendered = fields.certificateSurrendered
  if (fields.certificateSurrenderedShares != null) {
    data.certificateSurrenderedShares = fields.certificateSurrenderedShares
  }
  if (fields.balanceCertificateNo) data.balanceCertificateNo = fields.balanceCertificateNo
  if (fields.balanceCertificateShares != null) data.balanceCertificateShares = fields.balanceCertificateShares
  if (fields.balanceDistinctiveNosFrom != null) {
    data.balanceDistinctiveNosFrom = fields.balanceDistinctiveNosFrom
  }
  if (fields.balanceDistinctiveNosTo != null) data.balanceDistinctiveNosTo = fields.balanceDistinctiveNosTo
  return data
}

export async function appendAllotment(
  db: Db,
  memberId: string,
  input: {
    transactionDate: Date
    shares: number
    previousHolding: number
  } & OptionalCertFields,
) {
  const sharesHeld = input.previousHolding + input.shares
  return db.shareTransaction.create({
    data: {
      memberId,
      transactionType: 'ALLOTMENT',
      transactionDate: input.transactionDate,
      sharesAcquired: input.shares,
      sharesHeld,
      ...optionalCertData(input),
    },
  })
}

export async function appendTransferPair(
  db: Db,
  input: {
    fromMemberId: string
    toMemberId: string
    transactionDate: Date
    shares: number
    fromPreviousHolding: number
    toPreviousHolding: number
  } & OptionalCertFields,
) {
  const fromHeld = input.fromPreviousHolding - input.shares
  const toHeld = input.toPreviousHolding + input.shares
  if (fromHeld < 0) {
    throw new Error('INSUFFICIENT_SHARES')
  }

  const sharedNo = input.allotmentTransferNo
  const [outTx, inTx] = await Promise.all([
    db.shareTransaction.create({
      data: {
        memberId: input.fromMemberId,
        transactionType: 'TRANSFER_OUT',
        transactionDate: input.transactionDate,
        sharesTransferred: input.shares,
        sharesHeld: fromHeld,
        ...optionalCertData({
          allotmentTransferNo: sharedNo,
          certificateSurrendered: input.certificateSurrendered,
          certificateSurrenderedShares: input.certificateSurrenderedShares,
          balanceCertificateNo: input.balanceCertificateNo,
          balanceCertificateShares: input.balanceCertificateShares,
          balanceDistinctiveNosFrom: input.balanceDistinctiveNosFrom,
          balanceDistinctiveNosTo: input.balanceDistinctiveNosTo,
        }),
      },
    }),
    db.shareTransaction.create({
      data: {
        memberId: input.toMemberId,
        transactionType: 'TRANSFER_IN',
        transactionDate: input.transactionDate,
        sharesAcquired: input.shares,
        sharesHeld: toHeld,
        ...optionalCertData({
          allotmentTransferNo: sharedNo,
          certificateNo: input.certificateNo,
          distinctiveNosFrom: input.distinctiveNosFrom,
          distinctiveNosTo: input.distinctiveNosTo,
          amountPaid: input.amountPaid,
        }),
      },
    }),
  ])

  await syncMemberStatusFromLatestHolding(db, input.fromMemberId)
  await syncMemberStatusFromLatestHolding(db, input.toMemberId)

  return { outTx, inTx, fromHeld, toHeld }
}
