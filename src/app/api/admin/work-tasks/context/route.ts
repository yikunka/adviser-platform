import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'
import {
  assertCompanyAccessible,
  buildCompanyAccessWhere,
  resolveCompanyAccess,
} from '@/lib/company-access'

function shareClassLabel(value: string) {
  if (value === 'ORDINARY') return 'Ordinary'
  if (value === 'PREFERENCE') return 'Preference'
  return value
}

export async function GET(req: NextRequest) {
  const { session, error } = await requireRole('STAFF', { adminMenu: 'workTasks' })
  if (error) return error

  const access = await resolveCompanyAccess(session!.user.id, session!.user.role)
  const companyId = req.nextUrl.searchParams.get('companyId')
  const q = (req.nextUrl.searchParams.get('q') ?? '').trim()
  const scope = req.nextUrl.searchParams.get('scope') ?? 'company'

  if (companyId) {
    if (!(await assertCompanyAccessible(access, companyId))) {
      return NextResponse.json({ error: '找不到这家公司。' }, { status: 404 })
    }
    const company = await prisma.company.findFirst({
      where: { id: companyId, deletedAt: null },
      select: {
        id: true,
        nameEn: true,
        nameZh: true,
        companyNumber: true,
        businessRegNumber: true,
        hasCompanyRoundSeal: true,
        directors: {
          where: { status: 'ACTIVE' },
          orderBy: { dateOfAppointment: 'asc' },
          select: { id: true, nameEn: true, nameZh: true },
        },
        members: {
          orderBy: { nameEn: 'asc' },
          select: {
            id: true,
            nameEn: true,
            nameZh: true,
            registeredAddress: true,
            occupation: true,
            shareClass: true,
            status: true,
            keyPersonId: true,
            linkedCompanyId: true,
            keyPerson: { select: { homeAddress: true, contactAddress: true, position: true } },
            linkedCompany: { select: { registeredAddress: true } },
            shareTransactions: {
              orderBy: [{ transactionDate: 'desc' }, { createdAt: 'desc' }],
              take: 1,
              select: { sharesHeld: true, certificateNo: true },
            },
          },
        },
      },
    })
    if (!company) return NextResponse.json({ error: '找不到这家公司。' }, { status: 404 })

    return NextResponse.json({
      company: {
        id: company.id,
        nameEn: company.nameEn,
        nameZh: company.nameZh ?? '',
        companyNumber: company.companyNumber ?? '',
        businessRegNumber: company.businessRegNumber ?? '',
        hasCompanyRoundSeal: company.hasCompanyRoundSeal,
      },
      directors: company.directors,
      members: company.members.map(member => {
        const latest = member.shareTransactions[0]
        return {
          id: member.id,
          nameEn: member.nameEn,
          nameZh: member.nameZh ?? '',
          address: member.registeredAddress
            || member.keyPerson?.contactAddress
            || member.keyPerson?.homeAddress
            || member.linkedCompany?.registeredAddress
            || '',
          occupation: member.occupation || member.keyPerson?.position || '',
          shareClass: shareClassLabel(member.shareClass),
          status: member.status,
          sharesHeld: latest?.sharesHeld ?? null,
          certificateNo: latest?.certificateNo ?? '',
          keyPersonId: member.keyPersonId,
          linkedCompanyId: member.linkedCompanyId,
        }
      }),
    })
  }

  const accessWhere = buildCompanyAccessWhere(access)
  const companyWhere = {
    deletedAt: null as null,
    ...(accessWhere ?? {}),
    ...(q
      ? {
          OR: [
            { nameEn: { contains: q, mode: 'insensitive' as const } },
            { nameZh: { contains: q, mode: 'insensitive' as const } },
            { companyCode: { contains: q, mode: 'insensitive' as const } },
            { companyNumber: { contains: q, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  }
  if (scope === 'options') {
    const [companies, people] = await Promise.all([
      prisma.company.findMany({
        where: { deletedAt: null, ...(accessWhere ?? {}) },
        orderBy: { nameEn: 'asc' },
        take: 500,
        select: {
          id: true,
          nameEn: true,
          nameZh: true,
          companyCode: true,
          companyNumber: true,
          businessRegNumber: true,
          registeredAddress: true,
        },
      }),
      prisma.keyPerson.findMany({
        orderBy: { nameEn: 'asc' },
        take: 500,
        select: {
          id: true,
          nameEn: true,
          nameZh: true,
          kycCode: true,
          homeAddress: true,
          contactAddress: true,
          position: true,
        },
      }),
    ])
    return NextResponse.json({ companies, people })
  }

  const companies = await prisma.company.findMany({
    where: companyWhere,
    orderBy: { nameEn: 'asc' },
    take: 20,
    select: {
      id: true,
      nameEn: true,
      nameZh: true,
      companyCode: true,
      companyNumber: true,
      businessRegNumber: true,
      registeredAddress: true,
    },
  })

  if (scope !== 'party') return NextResponse.json({ companies })

  const people = q
    ? await prisma.keyPerson.findMany({
        where: {
          kycStatus: 'APPROVED',
          OR: [
            { nameEn: { contains: q, mode: 'insensitive' } },
            { nameZh: { contains: q, mode: 'insensitive' } },
            { kycCode: { contains: q, mode: 'insensitive' } },
          ],
        },
        orderBy: { nameEn: 'asc' },
        take: 20,
        select: {
          id: true,
          nameEn: true,
          nameZh: true,
          kycCode: true,
          homeAddress: true,
          contactAddress: true,
          position: true,
        },
      })
    : []

  return NextResponse.json({ companies, people })
}
