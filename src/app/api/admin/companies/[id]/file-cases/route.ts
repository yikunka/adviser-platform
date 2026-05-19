import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireRole } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'

const createSchema = z.object({
  name: z.string().trim().min(1).max(200),
  caseDate: z.string().optional().nullable(),
  remark: z.string().trim().max(1000).optional().nullable(),
})

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await requireRole('STAFF', { adminMenu: 'companies' })
  if (error) return error

  const { id } = await params
  const body = await req.json().catch(() => null)
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 })

  const company = await prisma.company.findUnique({ where: { id }, select: { id: true } })
  if (!company) return NextResponse.json({ error: 'Company not found' }, { status: 404 })

  const fileCase = await prisma.companyFileCase.create({
    data: {
      companyId: id,
      name: parsed.data.name,
      caseDate: parsed.data.caseDate ? new Date(parsed.data.caseDate) : undefined,
      remark: parsed.data.remark || undefined,
    },
    include: { documents: { where: { deletedAt: null }, orderBy: { createdAt: 'desc' } } },
  })

  return NextResponse.json({ fileCase }, { status: 201 })
}
