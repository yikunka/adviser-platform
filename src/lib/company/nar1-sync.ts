import { prisma } from '@/lib/db/prisma'
import type { NAR1UiAnalysisResult } from '@/lib/company/nar1-analysis'
import {
  loadKeyPersonCandidates,
  mapIdType,
  mapShareClass,
  matchKeyPersonByName,
  namesMatch,
  parseFlexibleDate,
} from '@/lib/company/kyc-match'

function buildInitialShareTransaction(
  sharesHeld: number,
  becomingDate?: string,
  fallback?: Date | null,
) {
  return {
    transactionType: 'ALLOTMENT' as const,
    transactionDate: parseFlexibleDate(becomingDate, fallback),
    sharesHeld,
    sharesAcquired: sharesHeld,
  }
}

export type Nar1SyncSummary = {
  directors: { created: number; updated: number; kycLinked: number }
  members: { created: number; updated: number; kycLinked: number }
  controllers: { created: number; updated: number; kycLinked: number }
}

export async function syncNar1ToRegisters(
  companyId: string,
  data: NAR1UiAnalysisResult,
  fallbackDate?: string,
): Promise<Nar1SyncSummary> {
  const fallback = parseFlexibleDate(fallbackDate)
  const kycCandidates = await loadKeyPersonCandidates(companyId)

  const [existingDirectors, existingMembers, existingControllers] = await Promise.all([
    prisma.director.findMany({ where: { companyId } }),
    prisma.member.findMany({ where: { companyId }, include: { shareTransactions: true } }),
    prisma.significantController.findMany({ where: { companyId } }),
  ])

  const summary: Nar1SyncSummary = {
    directors: { created: 0, updated: 0, kycLinked: 0 },
    members: { created: 0, updated: 0, kycLinked: 0 },
    controllers: { created: 0, updated: 0, kycLinked: 0 },
  }

  for (const director of data.directors) {
    if (!director.nameEn.trim()) continue

    const kyc = matchKeyPersonByName(kycCandidates, director.nameEn, director.nameZh, director.idNumber)
    if (kyc) summary.directors.kycLinked++

    const existing = existingDirectors.find(d =>
      namesMatch(d.nameEn, d.nameZh, director.nameEn, director.nameZh),
    )

    const payload = {
      nameEn: director.nameEn.trim(),
      nameZh: director.nameZh?.trim() || null,
      keyPersonId: kyc?.id ?? null,
      dateOfAppointment: parseFlexibleDate(director.dateOfAppointment, fallback),
      dateAsReserve: director.dateAsReserve ? parseFlexibleDate(director.dateAsReserve) : null,
      dateOfCessation: director.cessationDate ? parseFlexibleDate(director.cessationDate) : null,
      addressForService: director.addressForService?.trim() || '—',
      dateOfBirth: director.dateOfBirth ? parseFlexibleDate(director.dateOfBirth) : null,
      placeOfBirth: director.placeOfBirth?.trim() || null,
      nationality: director.nationality?.trim() || null,
      idType: mapIdType(director.idType) ?? null,
      idNumber: director.idNumber?.trim() || null,
      countryOfIssuance: director.countryOfIssuance?.trim() || null,
      isCorporation: director.isCorporation ?? false,
      corpRegNumber: director.corpRegNumber?.trim() || null,
      corpRegPlace: director.corpRegPlace?.trim() || null,
      status: (director.status === 'resigned' || director.cessationDate ? 'CEASED' : 'ACTIVE') as 'ACTIVE' | 'CEASED',
    }

    if (existing) {
      await prisma.director.update({ where: { id: existing.id }, data: payload })
      summary.directors.updated++
    } else {
      await prisma.director.create({ data: { ...payload, companyId } })
      summary.directors.created++
    }
  }

  for (const member of data.members) {
    if (!member.nameEn.trim()) continue

    const kyc = matchKeyPersonByName(kycCandidates, member.nameEn, member.nameZh, member.idNumber)
    if (kyc) summary.members.kycLinked++

    const existing = existingMembers.find(m =>
      namesMatch(m.nameEn, m.nameZh, member.nameEn, member.nameZh),
    )

    const payload = {
      nameEn: member.nameEn.trim(),
      nameZh: member.nameZh?.trim() || null,
      keyPersonId: kyc?.id ?? null,
      shareClass: mapShareClass(member.shareClass),
      registeredAddress: member.address?.trim() || '—',
      occupation: member.occupation?.trim() || null,
      status: (member.status === 'resigned' ? 'TRANSFERRED_OUT' : 'ACTIVE') as 'ACTIVE' | 'TRANSFERRED_OUT',
    }

    if (existing) {
      await prisma.member.update({ where: { id: existing.id }, data: payload })
      if (member.sharesHeld != null && member.sharesHeld > 0 && existing.shareTransactions.length === 0) {
        await prisma.shareTransaction.create({
          data: {
            memberId: existing.id,
            ...buildInitialShareTransaction(member.sharesHeld, member.becomingDate, fallback),
          },
        })
      }
      summary.members.updated++
    } else {
      await prisma.member.create({
        data: {
          ...payload,
          companyId,
          ...(member.sharesHeld != null && member.sharesHeld > 0
            ? {
                shareTransactions: {
                  create: buildInitialShareTransaction(member.sharesHeld, member.becomingDate, fallback),
                },
              }
            : {}),
        },
      })
      summary.members.created++
    }
  }

  for (const controller of data.significantControllers) {
    if (!controller.nameEn.trim()) continue

    const kyc = matchKeyPersonByName(
      kycCandidates,
      controller.nameEn,
      controller.nameZh,
      controller.idPassportNo,
    )
    if (kyc) summary.controllers.kycLinked++

    const existing = existingControllers.find(c =>
      namesMatch(c.nameEn, c.nameZh, controller.nameEn, controller.nameZh),
    )

    const becomingDate = parseFlexibleDate(controller.becomingDate ?? controller.entryDate, fallback)
    const payload = {
      nameEn: controller.nameEn.trim(),
      nameZh: controller.nameZh?.trim() || null,
      keyPersonId: kyc?.id ?? null,
      entryDate: parseFlexibleDate(controller.entryDate ?? controller.becomingDate, becomingDate),
      becomingDate,
      cessationDate: controller.cessationDate ? parseFlexibleDate(controller.cessationDate) : null,
      correspondenceAddress: controller.correspondenceAddress?.trim() || null,
      idType: controller.isLegalEntity ? null : (mapIdType(controller.idType) ?? null),
      idPassportNo: controller.idPassportNo?.trim() || null,
      issuingCountry: controller.issuingCountry?.trim() || null,
      natureOfControl: controller.natureOfControl?.trim() || null,
      isLegalEntity: controller.isLegalEntity ?? false,
      legalEntityRegNo: controller.legalEntityRegNo?.trim() || null,
      legalEntityGovLaw: controller.legalEntityGovLaw?.trim() || null,
      remarks: controller.remarks?.trim() || null,
    }

    if (existing) {
      await prisma.significantController.update({ where: { id: existing.id }, data: payload })
      summary.controllers.updated++
    } else {
      await prisma.significantController.create({ data: { ...payload, companyId } })
      summary.controllers.created++
    }
  }

  return summary
}
