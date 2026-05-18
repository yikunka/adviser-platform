import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'

export async function GET(req: NextRequest) {
  const { error } = await requireRole('STAFF', { adminMenu: 'kyc' })
  if (error) return error

  const { searchParams } = req.nextUrl
  const status = searchParams.get('status')
  const page = parseInt(searchParams.get('page') ?? '1')
  const limit = 20

  const where = status ? { kycStatus: status as never } : {}

  const [records, total] = await Promise.all([
    prisma.keyPerson.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { updatedAt: 'desc' },
      include: {
        kycDocuments: {
          select: {
            id: true,
            fileName: true,
            documentType: true,
            storageKey: true,
            mimeType: true,
            fileSize: true,
            status: true,
            uploadedAt: true,
          },
        },
        submittedByUser: { select: { email: true, nameEn: true } },
        companyLinks: {
          include: {
            company: {
              select: {
                nameEn: true,
                clientUser: { select: { email: true, nameEn: true } },
              },
            },
          },
        },
      },
    }),
    prisma.keyPerson.count({ where }),
  ])

  return NextResponse.json({ records, total, page, limit })
}
