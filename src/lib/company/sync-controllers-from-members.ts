import { prisma } from '@/lib/db/prisma'
import { namesMatch } from '@/lib/company/kyc-match'
import { UBO_EFFECTIVE_THRESHOLD_PCT } from '@/lib/aml/ownershipLookThrough'

export type SyncControllersFromMembersResult = {
  created: number
  updated: number
  skipped: number
  candidates: Array<{
    memberId: string
    nameEn: string
    ownershipPercent: number
    action: 'created' | 'updated' | 'skipped'
  }>
}

function latestSharesHeld(
  transactions: Array<{ sharesHeld: number; transactionDate: Date }>,
): number | null {
  if (transactions.length === 0) return null
  return [...transactions].sort(
    (a, b) => b.transactionDate.getTime() - a.transactionDate.getTime(),
  )[0]?.sharesHeld ?? null
}

function natureOfControlFromShares(pct: number): string {
  return `Holds more than ${UBO_EFFECTIVE_THRESHOLD_PCT}% of the issued shares (${pct.toFixed(2)}%)`
}

/**
 * Auto-fill Significant Controllers from ACTIVE members whose direct shareholding
 * is more than 25% of total issued shares among active members (AMLO threshold).
 * Creates missing controllers; updates matched ones' natureOfControl / links.
 * Does not delete existing controllers.
 */
export async function syncControllersFromMembers(
  companyId: string,
): Promise<SyncControllersFromMembersResult> {
  const [members, controllers] = await Promise.all([
    prisma.member.findMany({
      where: { companyId, status: 'ACTIVE' },
      include: {
        shareTransactions: {
          orderBy: { transactionDate: 'desc' },
          select: { sharesHeld: true, transactionDate: true },
        },
        linkedCompany: {
          select: { id: true, nameEn: true, nameZh: true, companyNumber: true, registeredAddress: true },
        },
      },
    }),
    prisma.significantController.findMany({ where: { companyId } }),
  ])

  const withShares = members.map(m => ({
    member: m,
    sharesHeld: latestSharesHeld(m.shareTransactions),
  }))
  const totalShares = withShares.reduce((sum, row) => sum + (row.sharesHeld ?? 0), 0)

  const result: SyncControllersFromMembersResult = {
    created: 0,
    updated: 0,
    skipped: 0,
    candidates: [],
  }

  if (totalShares <= 0) return result

  const today = new Date()

  for (const { member, sharesHeld } of withShares) {
    if (sharesHeld == null || sharesHeld <= 0) continue
    const ownershipPercent = Number(((sharesHeld / totalShares) * 100).toFixed(4))
    if (ownershipPercent <= UBO_EFFECTIVE_THRESHOLD_PCT) continue

    const isLegal = !!member.linkedCompanyId
    const existing =
      (member.keyPersonId
        ? controllers.find(c => c.keyPersonId === member.keyPersonId)
        : undefined)
      ?? (member.linkedCompanyId
        ? controllers.find(c => c.linkedCompanyId === member.linkedCompanyId)
        : undefined)
      ?? controllers.find(c => namesMatch(c.nameEn, c.nameZh, member.nameEn, member.nameZh))

    const natureOfControl = natureOfControlFromShares(ownershipPercent)
    const payload = {
      nameEn: member.nameEn,
      nameZh: member.nameZh,
      keyPersonId: isLegal ? null : (member.keyPersonId ?? null),
      linkedCompanyId: isLegal ? member.linkedCompanyId : null,
      isLegalEntity: isLegal,
      correspondenceAddress:
        member.registeredAddress
        || member.linkedCompany?.registeredAddress
        || null,
      legalEntityRegNo: isLegal
        ? (member.linkedCompany?.companyNumber ?? null)
        : null,
      natureOfControl,
    }

    if (existing) {
      // Only auto-update natureOfControl / links when missing or previously auto-style
      const shouldUpdateNature =
        !existing.natureOfControl
        || existing.natureOfControl.startsWith('Holds more than ')
      await prisma.significantController.update({
        where: { id: existing.id },
        data: {
          ...(shouldUpdateNature ? { natureOfControl } : {}),
          ...(member.keyPersonId && !existing.keyPersonId && !isLegal
            ? { keyPersonId: member.keyPersonId }
            : {}),
          ...(member.linkedCompanyId && !existing.linkedCompanyId && isLegal
            ? { linkedCompanyId: member.linkedCompanyId, isLegalEntity: true, keyPersonId: null }
            : {}),
        },
      })
      result.updated++
      result.candidates.push({
        memberId: member.id,
        nameEn: member.nameEn,
        ownershipPercent,
        action: 'updated',
      })
      continue
    }

    await prisma.significantController.create({
      data: {
        companyId,
        ...payload,
        entryDate: today,
        becomingDate: today,
        remarks: 'Auto-synced from Member (>25% shares)',
      },
    })
    result.created++
    result.candidates.push({
      memberId: member.id,
      nameEn: member.nameEn,
      ownershipPercent,
      action: 'created',
    })
  }

  return result
}
