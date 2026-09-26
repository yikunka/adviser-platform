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
   * Fallback event date when a member has no share movements yet.
   * Becoming uses the member's first share movement; Ceased uses the movement
   * that took them to 25% or below (or to zero). This date is not applied to
   * every member on a company-wide sync.
   */
  asOfDate?: Date
}

export type ShareMovement = {
  sharesHeld: number
  transactionDate: Date
  createdAt?: Date
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
  becomingDate: Date | null
  cessationDate: Date | null
}

function latestShareTransaction(transactions: ShareMovement[]) {
  if (transactions.length === 0) return null
  return [...transactions].sort(compareShareMovementsDesc)[0] ?? null
}

function earliestShareTransaction(transactions: ShareMovement[]) {
  if (transactions.length === 0) return null
  return [...transactions].sort((a, b) => compareShareMovementsDesc(b, a))[0] ?? null
}

function compareShareMovementsDesc(a: ShareMovement, b: ShareMovement) {
  const byDate = b.transactionDate.getTime() - a.transactionDate.getTime()
  if (byDate !== 0) return byDate
  return (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0)
}

/** Member in date: the first allotment or transfer in. */
export function memberShareInDate(transactions: ShareMovement[]): Date | null {
  return earliestShareTransaction(transactions)?.transactionDate ?? null
}

/**
 * Date the controller should cease.
 * Zero shares: the movement that took the holding to 0.
 * Still holding, but no longer above 25%: the latest movement, when there is
 * more than one (a single allotment is an in date, not an out date).
 */
export function controllerCeaseDateFromMovements(
  transactions: ShareMovement[],
  currentlyAboveThreshold: boolean,
): Date | null {
  if (currentlyAboveThreshold) return null
  const latest = latestShareTransaction(transactions)
  if (!latest) return null
  if (latest.sharesHeld === 0) return latest.transactionDate
  if (transactions.length < 2) return null
  return latest.transactionDate
}

export function sameCalendarDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate()
}

function latestSharesHeld(transactions: ShareMovement[]): number | null {
  return latestShareTransaction(transactions)?.sharesHeld ?? null
}

function memberInDateOrFallback(member: MemberRow, asOfDate: Date | undefined): Date {
  return memberShareInDate(member.shareTransactions) ?? asOfDate ?? new Date()
}

function memberCeaseDateOrFallback(member: MemberRow, asOfDate: Date | undefined): Date {
  return controllerCeaseDateFromMovements(member.shareTransactions, false)
    ?? latestShareTransaction(member.shareTransactions)?.transactionDate
    ?? asOfDate
    ?? new Date()
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
    becomingDate: c.becomingDate,
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
      const inDate = memberInDateOrFallback(member, explicitAsOf)

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
        const alignBecoming = !existing.becomingDate || !sameCalendarDay(existing.becomingDate, inDate)
        await prisma.significantController.update({
          where: { id: existing.id },
          data: {
            ...(shouldUpdateNature ? { natureOfControl } : {}),
            ...(alignBecoming ? { becomingDate: inDate } : {}),
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
          entryDate: inDate,
          becomingDate: inDate,
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
        becomingDate: created.becomingDate,
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
  const ceasedThisRun = new Set<string>()
  for (const controller of controllers) {
    if (controller.cessationDate) continue

    const matched = findMemberForController(members, controller)
    if (!matched) continue
    if (stillAboveIds.has(matched.id)) continue

    const sharesHeld = latestSharesHeld(matched.shareTransactions) ?? 0
    const ownershipPercent = totalShares > 0
      ? Number(((sharesHeld / totalShares) * 100).toFixed(4))
      : 0
    const inDate = memberShareInDate(matched.shareTransactions)
    const outDate = memberCeaseDateOrFallback(matched, explicitAsOf)
    const alignBecoming = !!inDate && (
      !controller.becomingDate || !sameCalendarDay(controller.becomingDate, inDate)
    )

    await prisma.significantController.update({
      where: { id: controller.id },
      data: {
        cessationDate: outDate,
        ...(alignBecoming && inDate ? { becomingDate: inDate } : {}),
      },
    })
    ceasedThisRun.add(matched.id)
    result.ceased++
    result.candidates.push({
      memberId: matched.id,
      nameEn: matched.nameEn,
      ownershipPercent,
      action: 'ceased',
    })
  }

  // Already-ceased rows keep a stale Becoming/Ceased when NAR1 stored those
  // dates separately from the share ledger. Rewrite only the latest ceased
  // row for a member who is not currently above 25%.
  const repairedIds = new Set<string>()
  for (const member of members) {
    if (stillAboveIds.has(member.id) || ceasedThisRun.has(member.id)) continue
    const ceased = controllers
      .filter(c => c.cessationDate && controllerMatchesMember(c, member))
      .sort((a, b) => (b.cessationDate?.getTime() ?? 0) - (a.cessationDate?.getTime() ?? 0))
    const controller = ceased[0]
    if (!controller?.cessationDate || repairedIds.has(controller.id)) continue

    const inDate = memberShareInDate(member.shareTransactions)
    const outDate = controllerCeaseDateFromMovements(member.shareTransactions, false)
    if (!inDate && !outDate) continue

    const alignBecoming = !!inDate && (
      !controller.becomingDate || !sameCalendarDay(controller.becomingDate, inDate)
    )
    const alignCease = !!outDate && !sameCalendarDay(controller.cessationDate, outDate)
    if (!alignBecoming && !alignCease) continue

    await prisma.significantController.update({
      where: { id: controller.id },
      data: {
        ...(alignBecoming && inDate ? { becomingDate: inDate } : {}),
        ...(alignCease && outDate ? { cessationDate: outDate } : {}),
      },
    })
    repairedIds.add(controller.id)
    result.updated++
    const sharesHeld = latestSharesHeld(member.shareTransactions) ?? 0
    const ownershipPercent = totalShares > 0
      ? Number(((sharesHeld / totalShares) * 100).toFixed(4))
      : 0
    result.candidates.push({
      memberId: member.id,
      nameEn: member.nameEn,
      ownershipPercent,
      action: 'updated',
    })
  }

  return result
}

function controllerMatchesMember(controller: ControllerRow, member: MemberRow) {
  if (member.keyPersonId && controller.keyPersonId === member.keyPersonId) return true
  if (member.linkedCompanyId && controller.linkedCompanyId === member.linkedCompanyId) return true
  return namesMatch(controller.nameEn, controller.nameZh, member.nameEn, member.nameZh)
}
