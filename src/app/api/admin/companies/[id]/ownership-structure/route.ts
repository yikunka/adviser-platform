import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'

type CompanyWithMembers = {
  id: string
  nameEn: string
  nameZh: string | null
  companyNumber: string | null
  members: {
    id: string
    keyPersonId: string | null
    nameEn: string
    nameZh: string | null
    shareClass: string
    status: string
    shareTransactions: { sharesHeld: number; transactionDate: Date }[]
  }[]
}

type OwnershipNode = {
  id: string
  type: 'COMPANY' | 'PERSON'
  nameEn: string
  nameZh: string | null
  companyId: string | null
  companyNumber: string | null
  keyPersonId: string | null
  shareClass: string | null
  sharesHeld: number | null
  ownershipPercent: number | null
  circular: boolean
  children: OwnershipNode[]
}

function normalizeName(name: string | null | undefined) {
  return (name ?? '')
    .trim()
    .toLowerCase()
    .replace(/[.,，。()（）]/g, '')
    .replace(/\s+/g, ' ')
}

function latestShares(member: CompanyWithMembers['members'][number]) {
  return member.shareTransactions[0]?.sharesHeld ?? null
}

function indexCompanies(companies: CompanyWithMembers[]) {
  const byName = new Map<string, CompanyWithMembers>()
  for (const company of companies) {
    for (const name of [company.nameEn, company.nameZh]) {
      const normalized = normalizeName(name)
      if (normalized && !byName.has(normalized)) byName.set(normalized, company)
    }
  }
  return byName
}

function buildCompanyNode(
  company: CompanyWithMembers,
  byName: Map<string, CompanyWithMembers>,
  visited: Set<string>,
  meta?: Pick<OwnershipNode, 'shareClass' | 'sharesHeld' | 'ownershipPercent'>,
): OwnershipNode {
  if (visited.has(company.id)) {
    return {
      id: company.id,
      type: 'COMPANY',
      nameEn: company.nameEn,
      nameZh: company.nameZh,
      companyId: company.id,
      companyNumber: company.companyNumber,
      keyPersonId: null,
      shareClass: meta?.shareClass ?? null,
      sharesHeld: meta?.sharesHeld ?? null,
      ownershipPercent: meta?.ownershipPercent ?? null,
      circular: true,
      children: [],
    }
  }

  const nextVisited = new Set(visited)
  nextVisited.add(company.id)
  const activeMembers = company.members.filter(member => member.status === 'ACTIVE')
  const totalShares = activeMembers.reduce((sum, member) => sum + (latestShares(member) ?? 0), 0)

  return {
    id: company.id,
    type: 'COMPANY',
    nameEn: company.nameEn,
    nameZh: company.nameZh,
    companyId: company.id,
    companyNumber: company.companyNumber,
    keyPersonId: null,
    shareClass: meta?.shareClass ?? null,
    sharesHeld: meta?.sharesHeld ?? null,
    ownershipPercent: meta?.ownershipPercent ?? null,
    circular: false,
    children: activeMembers.map(member => {
      const sharesHeld = latestShares(member)
      const ownershipPercent = totalShares > 0 && sharesHeld != null
        ? Number(((sharesHeld / totalShares) * 100).toFixed(2))
        : null
      const matchedCompany = byName.get(normalizeName(member.nameEn))
        ?? byName.get(normalizeName(member.nameZh))
      const metaForMember = {
        shareClass: member.shareClass,
        sharesHeld,
        ownershipPercent,
      }

      if (matchedCompany && matchedCompany.id !== company.id) {
        return buildCompanyNode(matchedCompany, byName, nextVisited, metaForMember)
      }

      return {
        id: member.id,
        type: 'PERSON',
        nameEn: member.nameEn,
        nameZh: member.nameZh,
        companyId: null,
        companyNumber: null,
        keyPersonId: member.keyPersonId,
        shareClass: member.shareClass,
        sharesHeld,
        ownershipPercent,
        circular: false,
        children: [],
      }
    }),
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await requireRole('STAFF', { adminMenu: 'companies' })
  if (error) return error

  const { id } = await params
  const companies = await prisma.company.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      nameEn: true,
      nameZh: true,
      companyNumber: true,
      members: {
        where: { status: 'ACTIVE' },
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          keyPersonId: true,
          nameEn: true,
          nameZh: true,
          shareClass: true,
          status: true,
          shareTransactions: {
            orderBy: { transactionDate: 'desc' },
            take: 1,
            select: { sharesHeld: true, transactionDate: true },
          },
        },
      },
    },
  })

  const root = companies.find(company => company.id === id)
  if (!root) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({
    structure: buildCompanyNode(root, indexCompanies(companies), new Set()),
  })
}
