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
   * Company-event date (allotment / transfer / edit) used when the ledger walk
   * cannot derive a threshold-crossing date (e.g. empty history).
   */
  asOfDate?: Date
}

export type ShareMovement = {
  sharesHeld: number
  transactionDate: Date
  createdAt?: Date
  transactionType?: string
}

export type ShareLedgerEvent = ShareMovement & {
  memberId: string
}

export type MemberControllerDates = {
  /** Start of the current (or most recently ended) spell above the threshold. */
  becomingDate: Date | null
  /** Date ownership most recently fell to the threshold or below; null if still above. */
  cessationDate: Date | null
  currentlyAbove: boolean
  /**
   * Ownership % at end of the becoming action day (frozen for the spell).
   * Used for ROSC nature of control — not recomputed from later movements.
   */
  ownershipPercentAtBecoming: number | null
}

type MemberRow = {
  id: string
  nameEn: string
  nameZh: string | null
  status: string
  keyPersonId: string | null
  linkedCompanyId: string | null
  registeredAddress: string
  shareTransactions: Array<{
    sharesHeld: number
    transactionDate: Date
    createdAt?: Date
    transactionType?: string
  }>
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

function calendarDayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
}

function transferSortRank(type: string | undefined): number {
  // Apply outs before ins/allotments so a same-day transfer does not leave a
  // zero-total intermediate when evaluating ownership.
  return type === 'TRANSFER_OUT' ? 0 : 1
}

function compareLedgerEventsAsc(a: ShareLedgerEvent, b: ShareLedgerEvent) {
  const byDate = a.transactionDate.getTime() - b.transactionDate.getTime()
  if (byDate !== 0) return byDate
  const byType = transferSortRank(a.transactionType) - transferSortRank(b.transactionType)
  if (byType !== 0) return byType
  return (a.createdAt?.getTime() ?? 0) - (b.createdAt?.getTime() ?? 0)
}

function ownershipPercent(sharesHeld: number, totalShares: number): number {
  if (totalShares <= 0 || sharesHeld <= 0) return 0
  return Number(((sharesHeld / totalShares) * 100).toFixed(4))
}

function totalIssuedShares(holdings: Map<string, number>): number {
  let total = 0
  for (const shares of holdings.values()) {
    if (shares > 0) total += shares
  }
  return total
}

/**
 * Walk the company share ledger and compute, per member, the current (or last)
 * spell above the significant-controller threshold.
 *
 * Becoming = date ownership first crossed above the threshold in the current spell.
 * Ceased = date ownership first fell to the threshold or below in that spell.
 * ownershipPercentAtBecoming = % at end of the becoming action day (frozen).
 * Dilution (another member's allotment) is included because totals are recomputed
 * after every company event.
 */
export function computeMemberControllerDates(
  events: ShareLedgerEvent[],
  memberIds: string[],
  thresholdPct: number = UBO_EFFECTIVE_THRESHOLD_PCT,
): Map<string, MemberControllerDates> {
  const empty = (): MemberControllerDates => ({
    becomingDate: null,
    cessationDate: null,
    currentlyAbove: false,
    ownershipPercentAtBecoming: null,
  })
  const result = new Map<string, MemberControllerDates>()
  for (const id of memberIds) {
    result.set(id, empty())
  }
  if (events.length === 0) return result

  const holdings = new Map<string, number>()
  for (const id of memberIds) holdings.set(id, 0)

  const above = new Map<string, boolean>()
  const spellStart = new Map<string, Date | null>()
  const spellPct = new Map<string, number | null>()
  for (const id of memberIds) {
    above.set(id, false)
    spellStart.set(id, null)
    spellPct.set(id, null)
  }

  const sorted = [...events].sort(compareLedgerEventsAsc)

  const applySnapshots = (eventDate: Date) => {
    const total = totalIssuedShares(holdings)
    for (const id of memberIds) {
      const shares = holdings.get(id) ?? 0
      const pct = ownershipPercent(shares, total)
      const isAbove = pct > thresholdPct
      const wasAbove = above.get(id) ?? false
      const row = result.get(id)!

      if (isAbove && !wasAbove) {
        spellStart.set(id, eventDate)
        spellPct.set(id, pct)
        row.becomingDate = eventDate
        row.cessationDate = null
        row.currentlyAbove = true
        row.ownershipPercentAtBecoming = pct
      } else if (!isAbove && wasAbove) {
        row.becomingDate = spellStart.get(id) ?? row.becomingDate
        row.ownershipPercentAtBecoming = spellPct.get(id) ?? row.ownershipPercentAtBecoming
        row.cessationDate = eventDate
        row.currentlyAbove = false
        spellStart.set(id, null)
        spellPct.set(id, null)
      } else {
        row.currentlyAbove = isAbove
        if (isAbove) {
          row.becomingDate = spellStart.get(id) ?? row.becomingDate
          row.ownershipPercentAtBecoming = spellPct.get(id) ?? row.ownershipPercentAtBecoming
          row.cessationDate = null
        }
      }
      above.set(id, isAbove)
    }
  }

  let i = 0
  while (i < sorted.length) {
    const day = calendarDayKey(sorted[i].transactionDate)
    const dayDate = sorted[i].transactionDate
    while (i < sorted.length && calendarDayKey(sorted[i].transactionDate) === day) {
      holdings.set(sorted[i].memberId, sorted[i].sharesHeld)
      i++
    }
    // Evaluate ownership once per calendar day after all that day's movements.
    applySnapshots(dayDate)
  }

  return result
}

/** @deprecated Prefer computeMemberControllerDates — kept for single-ledger callers. */
export function memberShareInDate(transactions: ShareMovement[]): Date | null {
  return earliestShareTransaction(transactions)?.transactionDate ?? null
}

/**
 * @deprecated Prefer computeMemberControllerDates.
 * Zero shares → latest zero movement; otherwise latest movement when below threshold.
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

function spellForMember(
  datesByMember: Map<string, MemberControllerDates>,
  memberId: string,
): MemberControllerDates {
  return datesByMember.get(memberId) ?? {
    becomingDate: null,
    cessationDate: null,
    currentlyAbove: false,
    ownershipPercentAtBecoming: null,
  }
}

/** Becoming for a member currently (or newly) above 25%. */
function becomingDateForAboveMember(
  spell: MemberControllerDates,
  asOfDate: Date | undefined,
  ownTransactions: ShareMovement[],
): Date {
  return (
    spell.becomingDate
    ?? asOfDate
    ?? earliestShareTransaction(ownTransactions)?.transactionDate
    ?? new Date()
  )
}

/** Ceased date when the member is no longer above 25%. */
function cessationDateForBelowMember(
  spell: MemberControllerDates,
  asOfDate: Date | undefined,
  ownTransactions: ShareMovement[],
): Date {
  return (
    spell.cessationDate
    ?? asOfDate
    ?? latestShareTransaction(ownTransactions)?.transactionDate
    ?? new Date()
  )
}

/**
 * Parse a share-document calendar date (YYYY-MM-DD) without UTC day-shift.
 * Used so becoming / cessation match the transfer/allotment date on screen.
 */
export function parseShareCalendarDate(value: string | Date): Date {
  if (value instanceof Date) {
    // Re-normalise midnight-UTC ISO strings that came from `new Date('YYYY-MM-DD')`
    // so local calendar day matches the document date in HK.
    if (
      value.getUTCHours() === 0
      && value.getUTCMinutes() === 0
      && value.getUTCSeconds() === 0
      && value.getUTCMilliseconds() === 0
    ) {
      return new Date(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate(), 12, 0, 0)
    }
    return value
  }
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
 *
 * Becoming / Ceased dates follow threshold crossings on the company share ledger
 * (including dilution), not merely the member's first/last share movement.
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
          select: {
            sharesHeld: true,
            transactionDate: true,
            createdAt: true,
            transactionType: true,
          },
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

  const ledgerEvents: ShareLedgerEvent[] = []
  for (const member of members) {
    for (const tx of member.shareTransactions) {
      ledgerEvents.push({
        memberId: member.id,
        sharesHeld: tx.sharesHeld,
        transactionDate: tx.transactionDate,
        createdAt: tx.createdAt,
        transactionType: tx.transactionType,
      })
    }
  }
  const datesByMember = computeMemberControllerDates(
    ledgerEvents,
    members.map(m => m.id),
  )

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
      const ownershipPercentValue = ownershipPercent(sharesHeld, totalShares)
      if (ownershipPercentValue <= UBO_EFFECTIVE_THRESHOLD_PCT) continue

      stillAboveIds.add(member.id)

      const isLegal = !!member.linkedCompanyId
      // Only match an open (not ceased) controller — a prior ceased row stays on file
      const existing = findOpenControllerForMember(controllers, member)
      const spell = spellForMember(datesByMember, member.id)
      const inDate = becomingDateForAboveMember(
        spell,
        explicitAsOf,
        member.shareTransactions,
      )

      // Nature % is frozen at the becoming action day — not today's live %.
      const naturePercent = spell.ownershipPercentAtBecoming ?? ownershipPercentValue
      const natureOfControl = natureOfControlFromShares(naturePercent)
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
          ownershipPercent: naturePercent,
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
        ownershipPercent: naturePercent,
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
    const ownershipPercentValue = ownershipPercent(sharesHeld, totalShares)
    const spell = spellForMember(datesByMember, matched.id)
    const outDate = cessationDateForBelowMember(
      spell,
      explicitAsOf,
      matched.shareTransactions,
    )
    // Only rewrite Becoming when the ledger knows the spell start (do not
    // clobber a manual ROSC becoming with asOfDate / first share).
    const inDate = spell.becomingDate
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
      ownershipPercent: ownershipPercentValue,
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

    const spell = datesByMember.get(member.id)
    if (!spell?.becomingDate && !spell?.cessationDate) continue

    const inDate = spell.becomingDate
    const outDate = spell.cessationDate
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
    const ownershipPercentValue = ownershipPercent(sharesHeld, totalShares)
    result.candidates.push({
      memberId: member.id,
      nameEn: member.nameEn,
      ownershipPercent: ownershipPercentValue,
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
