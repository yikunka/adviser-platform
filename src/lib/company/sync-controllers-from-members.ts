import { prisma } from '@/lib/db/prisma'
import { namesMatch } from '@/lib/company/kyc-match'
import { UBO_EFFECTIVE_THRESHOLD_PCT } from '@/lib/aml/ownershipLookThrough'

export type SyncControllersFromMembersResult = {
  created: number
  updated: number
  ceased: number
  skipped: number
  candidates: Array<{
    memberId: string
    nameEn: string
    ownershipPercent: number
    action: 'created' | 'updated' | 'ceased' | 'skipped'
  }>
}

export type SyncControllersOptions = {
  /**
   * Explicit event date (e.g. the share transfer / allotment date just recorded).
   * When omitted, each create/cease uses that member's latest share transaction date.
   */
  asOfDate?: Date
}

type MemberRow = {
  id: string
  nameEn: string
  nameZh: string | null
  status: string
  keyPersonId: string | null
  linkedCompanyId: string | null
  registeredAddress: string
  shareTransactions: Array<{ sharesHeld: number; transactionDate: Date; createdAt?: Date }>
  linkedCompany: {
    id: string
    nameEn: string
    nameZh: string | null
    companyNumber: string | null
    registeredAddress: string | null
  } | null
}

type ControllerRow = {
  id: string
  nameEn: string
  nameZh: string | null
  keyPersonId: string | null
  linkedCompanyId: string | null
  natureOfControl: string | null
  cessationDate: Date | null
}

function latestShareTransaction(
  transactions: Array<{ sharesHeld: number; transactionDate: Date; createdAt?: Date }>,
) {
  if (transactions.length === 0) return null
  return [...transactions].sort((a, b) => {
    const byDate = b.transactionDate.getTime() - a.transactionDate.getTime()
    if (byDate !== 0) return byDate
    return (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0)
  })[0] ?? null
}

function latestSharesHeld(
  transactions: Array<{ sharesHeld: number; transactionDate: Date; createdAt?: Date }>,
): number | null {
  return latestShareTransaction(transactions)?.sharesHeld ?? null
}

/** Prefer explicit asOfDate; otherwise the member's latest share movement date; else today. */
function controllerEventDate(
  member: MemberRow,
  asOfDate: Date | undefined,
): Date {
  if (asOfDate) return asOfDate
  const latest = latestShareTransaction(member.shareTransactions)
  if (latest?.transactionDate) return latest.transactionDate
  return new Date()
}

/**
 * Parse a share-document calendar date (YYYY-MM-DD) without UTC day-shift.
 * Used so becoming / cessation match the transfer/allotment date on screen.
 */
export function parseShareCalendarDate(value: string | Date): Date {
  if (value instanceof Date) return value
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim())
  if (m) {
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0)
  }
  return new Date(value)
}

function natureOfControlFromShares(pct: number): string {
  return `Holds more than ${UBO_EFFECTIVE_THRESHOLD_PCT}% of the issued shares (${pct.toFixed(2)}%)`
}

function findOpenControllerForMember(controllers: ControllerRow[], member: MemberRow) {
  const open = controllers.filter(c => !c.cessationDate)
  return (
    (member.keyPersonId
      ? open.find(c => c.keyPersonId === member.keyPersonId)
      : undefined)
    ?? (member.linkedCompanyId
      ? open.find(c => c.linkedCompanyId === member.linkedCompanyId)
      : undefined)
    ?? open.find(c => namesMatch(c.nameEn, c.nameZh, member.nameEn, member.nameZh))
  )
}

function findMemberForController(members: MemberRow[], controller: ControllerRow) {
  return (
    (controller.keyPersonId
      ? members.find(m => m.keyPersonId === controller.keyPersonId)
      : undefined)
    ?? (controller.linkedCompanyId
      ? members.find(m => m.linkedCompanyId === controller.linkedCompanyId)
      : undefined)
    ?? members.find(m => namesMatch(controller.nameEn, controller.nameZh, m.nameEn, m.nameZh))
  )
}

/**
 * Auto-fill Significant Controllers from members whose direct shareholding
 * is more than 25% of total issued shares among current holders (AMLO threshold).
 * Creates missing open controllers; updates open matched ones' natureOfControl / links.
 * When a matched member falls to 25% or below (e.g. after a transfer out), sets
 * cessationDate on that open controller (does not delete the row).
 * If the same person later rises above 25% again, a new ROSC entry is created;
 * earlier ceased rows are left unchanged.
 */
export async function syncControllersFromMembers(
  companyId: string,
  options?: SyncControllersOptions,
): Promise<SyncControllersFromMembersResult> {
  const explicitAsOf = options?.asOfDate

  const [memberRows, controllerRows] = await Promise.all([
    prisma.member.findMany({
      where: { companyId },
      include: {
        shareTransactions: {
          orderBy: [{ transactionDate: 'desc' }, { createdAt: 'desc' }],
          select: { sharesHeld: true, transactionDate: true, createdAt: true },
        },
        linkedCompany: {
          select: { id: true, nameEn: true, nameZh: true, companyNumber: true, registeredAddress: true },
        },
      },
    }),
    prisma.significantController.findMany({ where: { companyId } }),
  ])

  const members: MemberRow[] = memberRows
  const controllers: ControllerRow[] = controllerRows.map(c => ({
    id: c.id,
    nameEn: c.nameEn,
    nameZh: c.nameZh,
    keyPersonId: c.keyPersonId,
    linkedCompanyId: c.linkedCompanyId,
    natureOfControl: c.natureOfControl,
    cessationDate: c.cessationDate,
  }))

  const withShares = members.map(m => ({
    member: m,
    sharesHeld: latestSharesHeld(m.shareTransactions) ?? 0,
  }))

  // Issued-share base: current holdings of members who still hold shares
  const totalShares = withShares.reduce((sum, row) => {
    if (row.sharesHeld <= 0) return sum
    return sum + row.sharesHeld
  }, 0)

  const result: SyncControllersFromMembersResult = {
    created: 0,
    updated: 0,
    ceased: 0,
    skipped: 0,
    candidates: [],
  }

  const stillAboveIds = new Set<string>()

  if (totalShares > 0) {
    for (const { member, sharesHeld } of withShares) {
      if (sharesHeld <= 0) continue
      const ownershipPercent = Number(((sharesHeld / totalShares) * 100).toFixed(4))
      if (ownershipPercent <= UBO_EFFECTIVE_THRESHOLD_PCT) continue

      stillAboveIds.add(member.id)

      const isLegal = !!member.linkedCompanyId
      // Only match an open (not ceased) controller — a prior ceased row stays on file
      const existing = findOpenControllerForMember(controllers, member)
      const eventDate = controllerEventDate(member, explicitAsOf)

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

      const created = await prisma.significantController.create({
        data: {
          companyId,
          ...payload,
          entryDate: eventDate,
          becomingDate: eventDate,
          remarks: 'Auto-synced from Member (>25% shares)',
        },
      })
      controllers.push({
        id: created.id,
        nameEn: created.nameEn,
        nameZh: created.nameZh,
        keyPersonId: created.keyPersonId,
        linkedCompanyId: created.linkedCompanyId,
        natureOfControl: created.natureOfControl,
        cessationDate: created.cessationDate,
      })
      result.created++
      result.candidates.push({
        memberId: member.id,
        nameEn: member.nameEn,
        ownershipPercent,
        action: 'created',
      })
    }
  }

  // Cease open controllers whose matched member no longer holds more than 25%
  for (const controller of controllers) {
    if (controller.cessationDate) continue

    const matched = findMemberForController(members, controller)
    if (!matched) continue
    if (stillAboveIds.has(matched.id)) continue

    const sharesHeld = latestSharesHeld(matched.shareTransactions) ?? 0
    const ownershipPercent = totalShares > 0
      ? Number(((sharesHeld / totalShares) * 100).toFixed(4))
      : 0
    const eventDate = controllerEventDate(matched, explicitAsOf)

    await prisma.significantController.update({
      where: { id: controller.id },
      data: { cessationDate: eventDate },
    })
    result.ceased++
    result.candidates.push({
      memberId: matched.id,
      nameEn: matched.nameEn,
      ownershipPercent,
      action: 'ceased',
    })
  }

  return result
}
